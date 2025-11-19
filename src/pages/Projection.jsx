import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { getPriceChartData } from '../services/monitorService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Dimensional frequencies φ_i (Phonon Correction) - Full crystalline 12-d set
const PHI_D = [3, 7, 31, 12, 19, 5, 11, 13, 17, 23, 29, 31];

// Tetration depth constant
const TETRATION_DEPTH = 31;

// Prime depth slider stops (tetration depth primes)
const PRIME_STOPS = [11, 13, 17, 29, 31, 47, 59, 61, 97, 101];

// Q8 Fixed-point constants (72-bit with +8 guard bits)
const MOD_BITS = 72n; // 64 + 8 guard bits
const MOD = 1n << MOD_BITS; // 2^72
const LAMBDA = 1n << (MOD_BITS - 2n); // 2^(72-2) for odd base cycles
const Q_FRAC_BITS = 8n; // +8 bits computations
const OUTPUT_SCALE = 1n << 64n; // after truncation, map to 64-bit fractional space
const Q8 = 1 << 8; // 256

// Safe modular exponentiation: a^e mod m (BigInt)
function modPow(a, e, m) {
  a = ((a % m) + m) % m;
  let result = 1n;
  while (e > 0n) {
    if (e & 1n) result = (result * a) % m;
    a = (a * a) % m;
    e >>= 1n;
  }
  return result;
}

// Compute triadic prime tower amplitude A = base^(p2^p3) mod 2^(64+8),
// with exponent reduced mod λ(2^k) since base is odd and gcd(base, 2^k)=1.
function amplitudeFromTriad(base, triad) {
  const [p1, p2, p3] = triad; // p1 is for reference, we build tower base^(p2^p3)
  // Exponent E = p2^p3 mod LAMBDA
  const eMod = modPow(BigInt(p2), BigInt(p3), LAMBDA);
  const eEff = eMod + LAMBDA; // ensure in correct range for odd base modulo cycles
  const A = modPow(BigInt(base), eEff, MOD);
  return A; // 0..2^72-1
}

// Turn a 72-bit amplitude to symmetric float [-1, +1), truncating +8 bits before mapping
function amplitudeToSymmetric(A72) {
  const aQ8 = A72 >> Q_FRAC_BITS; // drop 8 guard bits, now in 0..2^64-1
  const aUnit = Number(aQ8) / Number(1n << 64n); // [0,1)
  return (aUnit * 2) - 1; // (-1, +1)
}

// Z(n): aggregate cosine of all 12 φ_d without sweeping dimensions
// Lattice angular oscillator for step n (n ≥ 1)
function latticeOscillatorZ(n) {
  const k = (n - 1);
  let sum = 0;
  for (let i = 0; i < PHI_D.length; i++) {
    const angle = k * (Math.PI * 2 / 12) * PHI_D[i];
    sum += Math.cos(angle);
  }
  return sum / PHI_D.length; // average in [-1,1]
}

// Fixed-point Q8 truncation helpers
function toQ8(xFloat) {
  // truncate (not round) to Q8
  const scaled = Math.trunc(xFloat * Q8);
  return scaled; // integer
}

function fromQ8(q8int) {
  return q8int / Q8;
}

// Quick sieve for first N primes
function firstNPrimes(N = 500) {
  const limit = 4000; // enough to get ~550 primes
  const sieve = new Uint8Array(limit + 1);
  const primes = [];
  for (let i = 2; i <= limit; i++) {
    if (!sieve[i]) {
      primes.push(i);
      for (let j = i * 2; j <= limit; j += i) sieve[j] = 1;
    }
    if (primes.length >= N) break;
  }
  return primes;
}

const PRIMES_500 = firstNPrimes(500);

// Generate default triads near a given prime depth pDepth
// Build 11–13 triads centered around pDepth using neighbors in the prime list.
function generateTriadsAroundPrime(pDepth, count, primes) {
  const idx = primes.indexOf(pDepth);
  if (idx === -1) throw new Error(`Depth prime ${pDepth} not in primes list`);
  const triads = [];
  const half = Math.floor(count / 2);
  for (let offset = -half; offset <= half; offset++) {
    if (triads.length >= count) break;
    const i = Math.max(0, Math.min(primes.length - 3, idx + offset));
    // triadic set: [p[i], p[i+1], p[i+2]]
    triads.push([primes[i], primes[i + 1], primes[i + 2]]);
  }
  return triads;
}

// Tetration function: ^(depth)x = x^(x^(x^...)) depth times
// For depth 31, we use a logarithmic approach to compute tetration safely
function tetration(base, depth) {
  if (depth <= 0) return 1;
  if (depth === 1) return base;
  if (base <= 0) return 0;
  if (base === 1) return 1;
  
  // For depth 31, use iterated logarithm method
  // log(^(n)x) = log(x) * log(^(n-1)x) for n > 1
  if (depth >= 10) {
    // Start with log of base
    let logResult = Math.log(base);
    
    // Iterate logarithm depth-1 times
    for (let i = 2; i < depth; i++) {
      logResult = Math.log(base) * logResult;
      // Cap to prevent overflow (exp(700) is near JS max)
      if (logResult > 700) {
        logResult = 700;
        break;
      }
    }
    
    // Return exp of the final logarithm
    const result = Math.exp(logResult);
    return isFinite(result) ? result : Number.MAX_SAFE_INTEGER;
  }
  
  // Direct recursive calculation for small depths
  let result = base;
  for (let i = 1; i < depth; i++) {
    result = Math.pow(base, result);
    if (!isFinite(result) || result > Number.MAX_SAFE_INTEGER) {
      return Number.MAX_SAFE_INTEGER;
    }
  }
  return result;
}

// Helper: Check if number is prime
function isPrime(n) {
  if (n < 2) return false;
  if (n === 2) return true;
  if (n % 2 === 0) return false;
  for (let i = 3; i * i <= n; i += 2) {
    if (n % i === 0) return false;
  }
  return true;
}

// Count primes in dimension d
function countPrimesInD(d) {
  if (d < 0 || d >= PHI_D.length) return 0;
  let count = 0;
  for (let i = 0; i <= d; i++) {
    if (isPrime(PHI_D[i])) {
      count++;
    }
  }
  return count;
}

// Calculate entropy of lattice points
function calculateLatticeEntropy(d, historicalPrices) {
  if (!historicalPrices || historicalPrices.length === 0) return 1;
  
  // Use price variance as entropy measure
  const mean = historicalPrices.reduce((a, b) => a + b, 0) / historicalPrices.length;
  const variance = historicalPrices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / historicalPrices.length;
  const entropy = Math.log2(Math.max(1, variance)) + 1;
  
  // Scale by dimension
  return Math.max(1, entropy * (d + 1) / 12);
}

// Γ(n, d) - Lattice Density / Entropy
function calculateGamma(n, d, historicalPrices) {
  const primeCount = countPrimesInD(d);
  const entropy = calculateLatticeEntropy(d, historicalPrices);
  return Math.log2(Math.max(1, primeCount) / Math.max(1, entropy));
}

// ν(λ) - Phonetic Value with tetration depth 31
function calculateNu(lambda) {
  // Use tetration depth 31: ^(31)3 then apply lambda
  const tetrated = tetration(3, TETRATION_DEPTH);
  // Apply lambda as exponent to the tetrated result, then modulo 7
  return Math.pow(tetrated, lambda) % 7;
}

// Γ(k) - Möbius Duality Twist
function calculateMobiusGamma(k) {
  return Math.pow(-1, k);
}

// θ_n - Angle function
function calculateThetaN(n) {
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  return n * Math.PI * 2 * goldenRatio;
}

// θ(n, k, λ) - Combined angle function
function calculateTheta(n, k, lambda, omega, psi) {
  // Simplified version: θ(n, k, λ) = kπ(1 - ...)
  // Using golden ratio connection
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  return k * Math.PI * (1 - (lambda / (omega || 144000)) * goldenRatio);
}

// Z_n^(d) - The main lattice formula with tetration depth 31
function calculateZ(n, d) {
  if (d < 0 || d >= PHI_D.length) return 0;
  
  const phi_d = PHI_D[d];
  const exponent = ((n - 1) * 2 * Math.PI / 12) / Math.log(3);
  const cosineArg = (n - 1) * 2 * Math.PI / 12 * phi_d;
  
  // Use tetration depth 31: compute ^(31)3, then use its logarithm for scaling
  const tetratedValue = tetration(3, TETRATION_DEPTH);
  // Scale exponent by tetration depth factor: log(^(31)3) / log(3) / 31
  const tetrationScale = Math.log(tetratedValue) / (Math.log(3) * TETRATION_DEPTH);
  const scaledExponent = exponent * tetrationScale;
  const baseValue = Math.pow(3, scaledExponent);
  
  return baseValue * Math.cos(cosineArg);
}

// P_n^(d)(k) - Projection function with tetration depth 31
function calculateP(n, d, k, historicalPrices) {
  if (d < 0 || d >= PHI_D.length) return 0;
  
  // Fixed parameter order: calculateTheta(n, k, lambda, omega, psi)
  const theta = calculateTheta(n, k, 0, 144000, 0);
  const exponent = theta / Math.log(12) - Math.log(3);
  
  // Use tetration depth 31: compute ^(31)12, then use its logarithm for scaling
  const tetratedValue = tetration(12, TETRATION_DEPTH);
  // Scale exponent by tetration depth factor: log(^(31)12) / log(12) / 31
  const tetrationScale = Math.log(tetratedValue) / (Math.log(12) * TETRATION_DEPTH);
  const scaledExponent = exponent * tetrationScale;
  const baseTerm = Math.pow(12, scaledExponent);
  
  // Product of cosines
  let product = 1;
  for (let i = 0; i <= d && i < PHI_D.length; i++) {
    product *= Math.cos(theta * PHI_D[i]);
  }
  
  return baseTerm * product;
}

// L(n, d, k, λ) - Lattice Output function with tetration depth 31
function calculateL(n, d, k, lambda, historicalPrices) {
  if (d < 0 || d >= PHI_D.length) return 0;
  
  const theta = calculateTheta(n, k, lambda, 144000, 0);
  
  // Use tetration depth 31: compute ^(31)3, then use its logarithm for scaling
  const tetratedValue = tetration(3, TETRATION_DEPTH);
  // Scale theta by tetration depth factor: log(^(31)3) / log(3) / 31
  const tetrationScale = Math.log(tetratedValue) / (Math.log(3) * TETRATION_DEPTH);
  const scaledTheta = theta * tetrationScale;
  const threeToTheta = Math.pow(3, scaledTheta);
  
  // Product of cosines
  let cosineProduct = 1;
  for (let i = 0; i <= d && i < PHI_D.length; i++) {
    cosineProduct *= Math.cos(theta * PHI_D[i]);
  }
  
  const gammaK = calculateMobiusGamma(k);
  const nuLambda = calculateNu(lambda);
  const gammaND = calculateGamma(n, d, historicalPrices);
  
  return threeToTheta * cosineProduct * gammaK * nuLambda * gammaND;
}

// Complex number helper
function complex(re, im) {
  return { re, im };
}

// FFT implementation using complex numbers
function fftComplex(signal) {
  const N = signal.length;
  
  if (N <= 1) {
    return signal.map(x => typeof x === 'number' ? complex(x, 0) : x);
  }
  
  // Ensure power of 2
  const nextPowerOf2 = Math.pow(2, Math.ceil(Math.log2(N)));
  const padded = signal.map(x => typeof x === 'number' ? complex(x, 0) : x);
  while (padded.length < nextPowerOf2) {
    padded.push(complex(0, 0));
  }
  const paddedN = padded.length;
  
  // Divide
  const even = [];
  const odd = [];
  for (let i = 0; i < paddedN; i += 2) {
    even.push(padded[i]);
    if (i + 1 < paddedN) {
      odd.push(padded[i + 1]);
    }
  }
  
  // Recursive FFT
  const evenFFT = fftComplex(even);
  const oddFFT = fftComplex(odd);
  
  // Combine
  const result = new Array(paddedN);
  for (let k = 0; k < paddedN / 2; k++) {
    const angle = -2 * Math.PI * k / paddedN;
    const twiddle = complex(Math.cos(angle), Math.sin(angle));
    
    // Multiply complex numbers
    const oddK = oddFFT[k] || complex(0, 0);
    const tRe = oddK.re * twiddle.re - oddK.im * twiddle.im;
    const tIm = oddK.re * twiddle.im + oddK.im * twiddle.re;
    const t = complex(tRe, tIm);
    
    const evenK = evenFFT[k] || complex(0, 0);
    result[k] = complex(evenK.re + t.re, evenK.im + t.im);
    result[k + paddedN / 2] = complex(evenK.re - t.re, evenK.im - t.im);
  }
  
  return result;
}

// Calculate magnitude of FFT result
function fftMagnitude(fftResult) {
  return fftResult.map(x => {
    const re = typeof x === 'number' ? x : x.re;
    const im = typeof x === 'number' ? 0 : x.im;
    return Math.sqrt(re * re + im * im);
  });
}

// Detect oscillations using FFT on the actual price signal
function detectOscillations(historicalPrices) {
  if (!historicalPrices || historicalPrices.length < 8) return null;
  
  // Normalize the price signal (remove DC component and normalize)
  const mean = historicalPrices.reduce((a, b) => a + b, 0) / historicalPrices.length;
  const normalizedSignal = historicalPrices.map(p => p - mean);
  const maxAmplitude = Math.max(...normalizedSignal.map(Math.abs));
  if (maxAmplitude > 0) {
    normalizedSignal.forEach((val, i) => {
      normalizedSignal[i] = val / maxAmplitude;
    });
  }
  
  // Perform FFT on the normalized price signal
  const fftResult = fftComplex(normalizedSignal);
  const magnitudes = fftMagnitude(fftResult);
  
  // Extract dominant frequencies (peaks in frequency domain)
  const N = normalizedSignal.length;
  const sampleRate = 1; // 1 sample per time unit
  const frequencies = [];
  
  // Only analyze first half (Nyquist limit)
  for (let i = 1; i < Math.floor(N / 2); i++) {
    const magnitude = magnitudes[i];
    const frequency = (i * sampleRate) / N;
    const period = frequency > 0 ? 1 / frequency : N;
    
    if (period >= 2 && period <= N / 2 && magnitude > 0.1) {
      frequencies.push({
        frequency,
        period,
        magnitude,
        index: i
      });
    }
  }
  
  // Sort by magnitude and get top oscillations
  frequencies.sort((a, b) => b.magnitude - a.magnitude);
  
  // Return top 5 dominant oscillations
  const oscillations = frequencies.slice(0, 5).map(freq => ({
    period: freq.period,
    frequency: freq.frequency,
    strength: freq.magnitude,
    magnitude: freq.magnitude
  }));
  
  return oscillations.length > 0 ? oscillations : null;
}

// Find primes and coprimes for stabilized model based on FFT-detected oscillations
function findStabilizedPrimes(oscillations, historicalPrices) {
  if (!oscillations || oscillations.length === 0) {
    return { primes: PHI_D.slice(0, 6), coprimes: [] };
  }
  
  // Use all detected oscillations, weighted by their strength
  const weightedPeriods = [];
  oscillations.forEach(osc => {
    const period = Math.round(osc.period);
    const weight = osc.strength || osc.magnitude || 1;
    if (period >= 2 && period <= 100) {
      weightedPeriods.push({ period, weight });
    }
  });
  
  // Sort by weight and get dominant periods
  weightedPeriods.sort((a, b) => b.weight - a.weight);
  const dominantPeriods = weightedPeriods.slice(0, 5).map(wp => wp.period);
  
  const primes = [];
  const coprimes = [];
  const primeWeights = new Map();
  
  // Find prime factors of dominant periods (weighted by oscillation strength)
  oscillations.forEach(osc => {
    const period = Math.round(osc.period);
    const weight = osc.strength || osc.magnitude || 1;
    
    // Find all prime factors
    for (let i = 2; i <= period; i++) {
      if (isPrime(i) && period % i === 0) {
        const currentWeight = primeWeights.get(i) || 0;
        primeWeights.set(i, currentWeight + weight);
      }
    }
  });
  
  // Sort primes by weight and select top ones
  const sortedPrimes = Array.from(primeWeights.entries())
    .sort((a, b) => b[1] - a[1])
    .map(entry => entry[0]);
  
  primes.push(...sortedPrimes.slice(0, 8));
  
  // Find coprimes that are relatively prime to ALL dominant periods
  for (let i = 2; i <= 31; i++) {
    if (primes.includes(i)) continue;
    
    let isCoprime = true;
    for (const period of dominantPeriods) {
      if (gcd(i, period) !== 1) {
        isCoprime = false;
        break;
      }
    }
    if (isCoprime) {
      coprimes.push(i);
    }
  }
  
  // Ensure we have sufficient primes/coprimes
  if (primes.length === 0) {
    primes.push(...PHI_D.slice(0, 6));
  }
  if (primes.length < 6) {
    // Add default primes if needed
    PHI_D.forEach(p => {
      if (!primes.includes(p) && primes.length < 12) {
        primes.push(p);
      }
    });
  }
  if (coprimes.length === 0) {
    coprimes.push(7, 11, 13, 17, 19, 23);
  }
  
  return { 
    primes: primes.slice(0, 12), 
    coprimes: coprimes.slice(0, 12),
    dominantPeriods: dominantPeriods
  };
}

// GCD helper function
function gcd(a, b) {
  while (b !== 0) {
    const temp = b;
    b = a % b;
    a = temp;
  }
  return a;
}

// Recursive stabilization function with FFT-based signal processing
function recursiveStabilization(historicalPrices, stabilizedModel, maxIterations = 10) {
  // Ensure we always have a valid model
  if (!stabilizedModel || typeof stabilizedModel !== 'object') {
    stabilizedModel = {
      primes: PHI_D.slice(0, 6),
      coprimes: [],
      lockedPoints: [],
      lastOscillations: null,
      iteration: 0,
      signalStability: 0,
    };
  }
  
  // Ensure arrays exist
  if (!Array.isArray(stabilizedModel.primes)) {
    stabilizedModel.primes = PHI_D.slice(0, 6);
  }
  if (!Array.isArray(stabilizedModel.coprimes)) {
    stabilizedModel.coprimes = [];
  }
  if (!Array.isArray(stabilizedModel.lockedPoints)) {
    stabilizedModel.lockedPoints = [];
  }
  if (typeof stabilizedModel.iteration !== 'number') {
    stabilizedModel.iteration = 0;
  }
  if (typeof stabilizedModel.signalStability !== 'number') {
    stabilizedModel.signalStability = 0;
  }
  
  // Perform FFT analysis on the actual price signal
  const oscillations = detectOscillations(historicalPrices);
  
  if (!oscillations || oscillations.length === 0) {
    // If no oscillations detected, return current model
    return stabilizedModel;
  }
  
  // Calculate signal stability (how consistent the oscillations are)
  const oscillationStrengths = oscillations.map(o => o.strength || o.magnitude || 0);
  const avgStrength = oscillationStrengths.reduce((a, b) => a + b, 0) / oscillationStrengths.length;
  const stability = avgStrength;
  
  // Check if we need to recurse (new oscillations or improved stability)
  const hasNewOscillation = !stabilizedModel.lastOscillations || 
    JSON.stringify(oscillations) !== JSON.stringify(stabilizedModel.lastOscillations);
  const improvedStability = stability > stabilizedModel.signalStability + 0.01;
  const shouldRecurse = (hasNewOscillation || improvedStability) && stabilizedModel.iteration < maxIterations;
  
  if (shouldRecurse) {
    // Recalculate primes/coprimes based on FFT-detected oscillations
    const newPrimesCoprimes = findStabilizedPrimes(oscillations, historicalPrices);
    
    // Update stabilized model with new primes from signal analysis
    if (newPrimesCoprimes && newPrimesCoprimes.primes && Array.isArray(newPrimesCoprimes.primes)) {
      // Merge new primes with existing, prioritizing high-weight primes
      const mergedPrimes = [...new Set([...newPrimesCoprimes.primes, ...stabilizedModel.primes])];
      stabilizedModel.primes = mergedPrimes.slice(0, 12);
    }
    if (newPrimesCoprimes && newPrimesCoprimes.coprimes && Array.isArray(newPrimesCoprimes.coprimes)) {
      const mergedCoprimes = [...new Set([...newPrimesCoprimes.coprimes, ...stabilizedModel.coprimes])];
      stabilizedModel.coprimes = mergedCoprimes.slice(0, 12);
    }
    
    stabilizedModel.lastOscillations = oscillations;
    stabilizedModel.signalStability = stability;
    stabilizedModel.iteration++;
    
    // Lock in key data points based on detected oscillation periods
    const lockedPoints = [];
    if (Array.isArray(historicalPrices) && historicalPrices.length > 2) {
      // Use dominant periods to identify phase-aligned points
      const dominantPeriods = newPrimesCoprimes?.dominantPeriods || [];
      
      for (let i = 1; i < historicalPrices.length - 1; i++) {
        const isLocalMin = historicalPrices[i] < historicalPrices[i - 1] && 
                           historicalPrices[i] < historicalPrices[i + 1];
        const isLocalMax = historicalPrices[i] > historicalPrices[i - 1] && 
                           historicalPrices[i] > historicalPrices[i + 1];
        
        // Check if point aligns with detected oscillation periods
        let phaseAligned = false;
        for (const period of dominantPeriods) {
          if (period > 0 && (i % Math.round(period)) < 2) {
            phaseAligned = true;
            break;
          }
        }
        
        if ((isLocalMin || isLocalMax) && phaseAligned) {
          lockedPoints.push({ 
            index: i, 
            price: historicalPrices[i], 
            type: isLocalMin ? 'min' : 'max',
            phase: i % (dominantPeriods[0] || 1)
          });
        }
      }
    }
    stabilizedModel.lockedPoints = lockedPoints.slice(-30); // Keep last 30 phase-aligned points
    
    // Recursively call with updated model to further refine
    return recursiveStabilization(historicalPrices, stabilizedModel, maxIterations);
  }
  
  return stabilizedModel;
}

// Calculate price ratio normalization factor
function calculateNormalizationFactor(historicalPrices, projectedValue) {
  const minPrice = Math.min(...historicalPrices);
  const maxPrice = Math.max(...historicalPrices);
  const priceRange = maxPrice - minPrice;
  const lastPrice = historicalPrices[historicalPrices.length - 1];
  const avgPrice = historicalPrices.reduce((a, b) => a + b, 0) / historicalPrices.length;
  
  // Calculate ratio of projection to real-time price scale
  const projectionRatio = Math.abs(projectedValue - lastPrice) / lastPrice;
  const historicalVolatility = priceRange / avgPrice;
  
  // Normalize based on historical volatility
  const normalizationFactor = Math.min(1, historicalVolatility / Math.max(0.01, projectionRatio));
  
  return normalizationFactor;
}

// Detect oscillations in projection data
function detectProjectionOscillations(projections, threshold = 0.02) {
  if (!projections || projections.length < 4) return null;
  
  const oscillations = [];
  const changes = [];
  
  // Calculate price changes
  for (let i = 1; i < projections.length; i++) {
    const change = (projections[i] - projections[i - 1]) / projections[i - 1];
    changes.push(change);
  }
  
  // Detect periodic patterns in changes
  for (let period = 2; period <= Math.min(20, changes.length / 2); period++) {
    let oscillationStrength = 0;
    let matches = 0;
    
    for (let i = period; i < changes.length; i++) {
      const current = changes[i];
      const previous = changes[i - period];
      const similarity = 1 - Math.abs(current - previous) / (Math.abs(current) + Math.abs(previous) + 0.0001);
      if (similarity > 0.5) {
        oscillationStrength += similarity;
        matches++;
      }
    }
    
    if (matches > 0) {
      const avgStrength = oscillationStrength / matches;
      if (avgStrength > threshold) {
        oscillations.push({ period, strength: avgStrength });
      }
    }
  }
  
  return oscillations.length > 0 ? oscillations.sort((a, b) => b.strength - a.strength) : null;
}

// Detect price jump (discontinuity) in projection
function detectPriceJump(historicalPrices, projections, jumpThreshold = 0.05) {
  if (!projections || projections.length === 0 || !historicalPrices || historicalPrices.length === 0) {
    return false;
  }
  
  const lastPrice = historicalPrices[historicalPrices.length - 1];
  const firstProjection = projections[0];
  
  // Check if first projection has significant jump from last price
  const jump = Math.abs(firstProjection - lastPrice) / lastPrice;
  if (jump > jumpThreshold) {
    return true;
  }
  
  // Check for jumps within projections
  for (let i = 1; i < Math.min(5, projections.length); i++) {
    const change = Math.abs(projections[i] - projections[i - 1]) / projections[i - 1];
    if (change > jumpThreshold * 2) {
      return true;
    }
  }
  
  return false;
}

// Recursive self-similar lattice calculation at depth level with tetration depth 31 at every layer
function recursiveLatticeLayer(n, d, k, lambda, depth, maxDepth, effectivePrimes, historicalPrices) {
  if (depth > maxDepth) return 1;
  
  // Apply tetration depth 31 at EVERY recursive layer (self-similar structure)
  const tetrated3 = tetration(3, TETRATION_DEPTH);
  
  // Self-similar scaling factor based on depth (fractal structure)
  const depthScale = Math.pow(2, -depth); // Each layer is half the scale (self-similar)
  
  // Calculate theta with recursive self-similarity
  const baseTheta = calculateTheta(n, k, lambda, 144000, 0);
  // Apply self-similar scaling at this depth
  const theta = baseTheta * depthScale;
  
  // Apply tetration depth 31 scaling at THIS layer (recursive application)
  const tetrationScale3 = Math.log(tetrated3) / (Math.log(3) * TETRATION_DEPTH);
  const scaledTheta = theta * tetrationScale3;
  const threeToTheta = Math.pow(3, scaledTheta);
  
  // Recursive cosine product with self-similar structure
  let cosineProduct = 1;
  for (let i = 0; i <= d && i < effectivePrimes.length; i++) {
    const phi = effectivePrimes[i];
    // Current layer contribution with self-similar scaling
    const layerContribution = Math.cos(theta * phi * depthScale);
    cosineProduct *= layerContribution;
    
    // Recursively calculate next layer if not at max depth (self-similar recursion)
    if (depth < maxDepth) {
      // Each recursive layer also applies tetration depth 31
      const recursiveLayer = recursiveLatticeLayer(n, d, k, lambda, depth + 1, maxDepth, effectivePrimes, historicalPrices);
      // Multiply by recursive contribution (self-similar structure)
      cosineProduct *= recursiveLayer;
    }
  }
  
  // Apply gamma and nu with tetration depth 31
  const gammaK = calculateMobiusGamma(k);
  const nuLambda = calculateNu(lambda); // This already uses tetration depth 31
  const gammaND = calculateGamma(n, d, historicalPrices);
  
  // Combine with recursive self-similar structure
  // Each layer contributes with its depth scale (fractal structure)
  return threeToTheta * cosineProduct * gammaK * nuLambda * gammaND * depthScale;
}

// Advanced projection using 12-fold crystalline periodic lattice with recursive self-similar structure
function calculateAdvancedProjection(historicalPrices, projectionSteps, stabilizedModel = null, maxRecursions = 10) {
  if (historicalPrices.length < 12) {
    return calculateSimpleProjection(historicalPrices, projectionSteps);
  }

  const n = historicalPrices.length;
  const lastPrice = historicalPrices[n - 1];
  
  // Perform recursive stabilization to get initial model
  let model = recursiveStabilization(historicalPrices, stabilizedModel);
  
  // Use stabilized primes/coprimes
  let effectivePrimes = (model.primes && Array.isArray(model.primes) && model.primes.length > 0) 
    ? model.primes 
    : PHI_D.slice(0, 6);
  const effectiveCoprimes = (model.coprimes && Array.isArray(model.coprimes)) 
    ? model.coprimes 
    : [];
  
  let projections = [];
  let oscillationDetected = true;
  let recursionCount = 0;
  const maxOscillationIterations = maxRecursions;
  
  // Recursive loop: continue until oscillation is minimized
  while (oscillationDetected && recursionCount < maxOscillationIterations) {
    projections = [];
    const minPrice = Math.min(...historicalPrices);
    const maxPrice = Math.max(...historicalPrices);
    const priceRange = maxPrice - minPrice;
    const avgPrice = historicalPrices.reduce((a, b) => a + b, 0) / historicalPrices.length;
    const historicalVolatility = priceRange / avgPrice;
    const scaleFactor = Math.max(0.01, Math.min(1, historicalVolatility * 0.1));
    
    // Calculate projections using recursive self-similar structure
    for (let step = 1; step <= projectionSteps; step++) {
      // RECURSIVE LOOP FOR EACH STEP: Iterate multiple times to create oscillations
      let stepProjection = null;
      let stepIteration = 0;
      const maxStepIterations = 5; // Recursive iterations per step
      const stepOscillationTarget = 0.01; // Target oscillation amplitude
      
      // Start with previous projection or last price
      let previousStepPrice = step === 1 ? lastPrice : (projections[step - 2] || lastPrice);
      
      // Recursive loop for this specific step
      while (stepIteration < maxStepIterations) {
        let weightedSum = 0;
        let totalWeight = 0;
        
        // Recursive self-similar calculation for each dimension
        for (let d = 0; d < effectivePrimes.length; d++) {
          const n_new = n + step;
          const phi_d = effectivePrimes[d];
          
          // Add iteration-based phase shift to create oscillations
          const phaseShift = stepIteration * Math.PI / (2 * maxStepIterations);
          const oscillationPhase = Math.sin(phaseShift) * 0.1; // Small oscillation component
          
          // Z calculation with tetration depth 31 at every layer
          const exponent = ((n_new - 1) * 2 * Math.PI / 12) / Math.log(3);
          const cosineArg = (n_new - 1) * 2 * Math.PI / 12 * phi_d + oscillationPhase;
          const tetratedValue = tetration(3, TETRATION_DEPTH);
          const tetrationScale = Math.log(tetratedValue) / (Math.log(3) * TETRATION_DEPTH);
          const scaledExponent = exponent * tetrationScale;
          const zValue = Math.pow(3, scaledExponent) * Math.cos(cosineArg);
          
          // L function with recursive self-similar structure (3 layers deep)
          // Add recursive iteration depth for more oscillations
          let lSum = 0;
          const kValues = [0, 1, 2, 3];
          for (const k of kValues) {
            const lambda = d % 3;
            // Recursive self-similar calculation with increased depth based on iteration
            const recursiveDepth = 2 + Math.floor(stepIteration / 2); // Increase depth with iterations
            const recursiveL = recursiveLatticeLayer(n_new, d, k, lambda, 0, recursiveDepth, effectivePrimes, historicalPrices);
            lSum += recursiveL;
          }
          
          // P function with tetration depth 31
          // Add iteration-based modulation for oscillations
          const thetaBase = calculateTheta(n_new, step, 0, 144000, 0);
          const theta = thetaBase + oscillationPhase * phi_d; // Modulate theta with oscillation
          const tetratedValue12 = tetration(12, TETRATION_DEPTH);
          const tetrationScale12 = Math.log(tetratedValue12) / (Math.log(12) * TETRATION_DEPTH);
          const exponentP = theta / Math.log(12) - Math.log(3);
          const scaledExponentP = exponentP * tetrationScale12;
          const baseTerm = Math.pow(12, scaledExponentP);
          
          let product = 1;
          for (let i = 0; i <= d && i < effectivePrimes.length; i++) {
            product *= Math.cos(theta * effectivePrimes[i]);
          }
          const pValue = baseTerm * product;
          
          // Combine with weights - add oscillation component
          const weight = Math.abs(zValue) + Math.abs(lSum) / kValues.length + Math.abs(pValue);
          const oscillationComponent = Math.sin(stepIteration * Math.PI / maxStepIterations) * stepOscillationTarget;
          const combinedFactor = (zValue * 0.4 + lSum * 0.3 + pValue * 0.3) + oscillationComponent;
          
          // Normalize change factor
          const rawChangeFactor = combinedFactor / 100;
          const normalizedChangeFactor = rawChangeFactor * scaleFactor;
          const stepChangeFactor = Math.max(-0.05, Math.min(0.05, normalizedChangeFactor));
          
          // Use previous iteration result or last price as base
          const basePrice = stepIteration === 0 ? previousStepPrice : (stepProjection || previousStepPrice);
          const projection = basePrice * Math.pow(1 + stepChangeFactor, 1); // Single step change
          
          // Apply normalization
          const normalizationFactor = calculateNormalizationFactor(historicalPrices, projection);
          const normalizedProjection = basePrice + (projection - basePrice) * normalizationFactor;
          
          weightedSum += normalizedProjection * weight;
          totalWeight += weight;
        }
        
        // Calculate base projection for this iteration
        let baseProjection = totalWeight > 0 ? weightedSum / totalWeight : previousStepPrice;
        
        // Apply locked points influence
        if (model.lockedPoints && Array.isArray(model.lockedPoints) && model.lockedPoints.length > 0) {
          const recentLocked = model.lockedPoints.slice(-5);
          const lockedInfluence = recentLocked.reduce((sum, point) => {
            const distance = Math.abs((n + step) - point.index);
            const weight = Math.exp(-distance / 10);
            return sum + point.price * weight;
          }, 0) / recentLocked.reduce((sum, point) => {
            const distance = Math.abs((n + step) - point.index);
            return sum + Math.exp(-distance / 10);
          }, 0);
          
          baseProjection = baseProjection * 0.7 + lockedInfluence * 0.3;
        }
        
        // Apply recursive refinement: blend with previous iteration
        if (stepIteration > 0 && stepProjection !== null) {
          // Blend current with previous iteration to create smooth oscillations
          const blendFactor = 0.6; // 60% new, 40% previous
          baseProjection = baseProjection * blendFactor + stepProjection * (1 - blendFactor);
        }
        
        // Ensure smooth continuity - no jumps
        if (step === 1) {
          // First projection must be very close to last price
          const maxDeviation = lastPrice * 0.05;
          if (Math.abs(baseProjection - lastPrice) > maxDeviation) {
            baseProjection = lastPrice + Math.sign(baseProjection - lastPrice) * maxDeviation;
          }
        } else {
          // Subsequent projections should be smooth but allow oscillations
          const prevProjection = projections[step - 2];
          const maxStepChange = prevProjection * 0.08; // Allow up to 8% change for oscillations
          const change = baseProjection - prevProjection;
          if (Math.abs(change) > maxStepChange) {
            baseProjection = prevProjection + Math.sign(change) * maxStepChange;
          }
        }
        
        // Store this iteration's result
        stepProjection = baseProjection;
        stepIteration++;
      }
      
      // Apply trend with oscillation preservation
      const recentPrices = historicalPrices.slice(-12);
      const recentTrend = recentPrices.length > 1 
        ? recentPrices.reduce((sum, price, idx, arr) => {
            if (idx === 0) return 0;
            return sum + (price - arr[idx - 1]) / arr[idx - 1];
          }, 0) / (recentPrices.length - 1)
        : 0;
      
      const normalizedTrend = recentTrend * scaleFactor * 0.1;
      // Apply trend but preserve oscillations from recursive loop
      let projectedPrice = stepProjection * (1 + normalizedTrend);
      
      // Add final oscillation component to ensure visible oscillations
      const finalOscillation = Math.sin(step * Math.PI / 6) * stepOscillationTarget * projectedPrice;
      projectedPrice = projectedPrice + finalOscillation * 0.3; // 30% oscillation strength
      
      // Final bounds check
      projectedPrice = Math.max(lastPrice * 0.5, Math.min(lastPrice * 2, projectedPrice));
      projections.push(Math.max(0, projectedPrice));
    }
    
    // Detect oscillations in projections with stricter threshold
    const projectionOscillations = detectProjectionOscillations(projections, 0.15);
    const hasPriceJump = detectPriceJump(historicalPrices, projections, 0.03);
    
    // Calculate oscillation strength
    const maxOscillationStrength = projectionOscillations && projectionOscillations.length > 0 
      ? projectionOscillations[0].strength 
      : 0;
    
    // Continue recursing if oscillation is significant (strength > 0.15) or price jump detected
    if ((projectionOscillations && projectionOscillations.length > 0 && maxOscillationStrength > 0.15) || 
        (hasPriceJump && recursionCount < maxOscillationIterations)) {
      
      if (projectionOscillations && projectionOscillations.length > 0) {
        // Use dominant oscillation frequency to identify prime
        const dominantOsc = projectionOscillations[0];
        const oscillationPeriod = Math.round(dominantOsc.period);
        
        // Find prime closest to oscillation period (the frequency indicates the prime)
        let bestPrime = effectivePrimes[0];
        let minDiff = Math.abs(oscillationPeriod - bestPrime);
        
        // Also check all primes in PHI_D if not in effectivePrimes
        for (const prime of [...effectivePrimes, ...PHI_D]) {
          const diff = Math.abs(oscillationPeriod - prime);
          if (diff < minDiff) {
            minDiff = diff;
            bestPrime = prime;
          }
        }
        
        // Reorder primes to prioritize the oscillation-indicated prime
        const newPrimes = [bestPrime, ...effectivePrimes.filter(p => p !== bestPrime)];
        effectivePrimes = newPrimes.slice(0, 12);
        
        // Reassess anchors and k values with new prime priority
        model = recursiveStabilization(historicalPrices, {
          ...model,
          primes: effectivePrimes,
          iteration: (model.iteration || 0) + 1,
          lastOscillations: projectionOscillations
        });
      } else if (hasPriceJump) {
        // Price jump detected - reassess everything including k values
        model = recursiveStabilization(historicalPrices, {
          ...model,
          iteration: (model.iteration || 0) + 1,
          lastOscillations: null // Force re-detection
        });
        
        // Recalculate effective primes from fresh analysis
        effectivePrimes = (model.primes && Array.isArray(model.primes) && model.primes.length > 0) 
          ? model.primes 
          : PHI_D.slice(0, 6);
      }
      
      oscillationDetected = true;
      recursionCount++;
    } else {
      // Oscillation is minimized (strength <= 0.15) and no price jump - we're done
      oscillationDetected = false;
    }
  }
  
  return { projections, stabilizedModel: model };
}

// Monte Carlo Simulation for price projection
function calculateMonteCarloProjection(historicalPrices, projectionSteps, simulations = 10000) {
  if (historicalPrices.length < 2) {
    return Array(projectionSteps).fill(historicalPrices[historicalPrices.length - 1] || 0);
  }

  // Calculate returns from historical data
  const returns = [];
  for (let i = 1; i < historicalPrices.length; i++) {
    const returnValue = (historicalPrices[i] - historicalPrices[i - 1]) / historicalPrices[i - 1];
    returns.push(returnValue);
  }

  // Calculate statistics
  const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
  const stdDev = Math.sqrt(variance);
  const lastPrice = historicalPrices[historicalPrices.length - 1];

  // Run Monte Carlo simulations
  const simulationResults = [];
  
  for (let sim = 0; sim < simulations; sim++) {
    let currentPrice = lastPrice;
    const path = [currentPrice];
    
    for (let step = 1; step <= projectionSteps; step++) {
      // Generate random return using normal distribution approximation
      // Box-Muller transform for normal distribution
      const u1 = Math.random();
      const u2 = Math.random();
      const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
      const randomReturn = meanReturn + stdDev * z0;
      
      // Apply return with drift
      currentPrice = currentPrice * (1 + randomReturn);
      path.push(Math.max(0, currentPrice));
    }
    
    simulationResults.push(path);
  }

  // Calculate expected value (mean) for each step
  const projections = [];
  for (let step = 1; step <= projectionSteps; step++) {
    const stepPrices = simulationResults.map(path => path[step] || path[path.length - 1]);
    const meanPrice = stepPrices.reduce((a, b) => a + b, 0) / stepPrices.length;
    projections.push(Math.max(0, meanPrice));
  }

  return projections;
}

// Prime Tetration Projection using multiple triads (11-13 projection lines)
function calculatePrimeTetrationProjection(historicalPrices, horizon, base, triads, beta = 0.01) {
  if (historicalPrices.length < 2) {
    return { lines: [] };
  }

  const lastPrice = historicalPrices[historicalPrices.length - 1];
  const lines = [];

  // Build projections for each triad
  for (let li = 0; li < triads.length; li++) {
    const triad = triads[li];
    const A72 = amplitudeFromTriad(base, triad);
    const aSym = amplitudeToSymmetric(A72); // [-1,1)

    // Compute ΔP(n) & projection P̂(n)
    let p = lastPrice;
    const q8Points = [];
    let prev = null;
    let zeroCross = 0;
    let extrema = 0;

    for (let n = 1; n <= horizon; n++) {
      const Z = latticeOscillatorZ(n);
      const delta = beta * aSym * Z; // small fractional change
      p = p * (1 + delta);
      const q8 = toQ8(p);
      q8Points.push(q8);

      // Oscillation stats (zero-cross of Z and turning points on delta)
      if (n > 1) {
        const prevZ = latticeOscillatorZ(n - 1);
        if ((Z > 0 && prevZ <= 0) || (Z < 0 && prevZ >= 0)) zeroCross++;
        if (prev != null) {
          const prevDelta = (p - prev) / Math.max(prev, 1e-9);
          const currDelta = delta;
          // crude turning point when sign of change in delta flips
          if (Math.sign(prevDelta) !== Math.sign(currDelta)) extrema++;
        }
      }
      prev = p;
    }

    lines.push({
      triad, // [p1, p2, p3]
      base, // 2 or 3
      aQ8: (A72 >> Q_FRAC_BITS).toString(), // truncated amplitude
      pointsQ8: q8Points, // projected prices in Q8 integers
      points: q8Points.map(fromQ8), // convert back to float for display
      zeroCrossings: zeroCross,
      turningPoints: extrema
    });
  }

  return {
    symbol: null, // will be set by caller
    lastPriceQ8: toQ8(lastPrice),
    beta,
    horizon,
    lines
  };
}

// Simple linear regression fallback
function calculateSimpleProjection(historicalPrices, projectionSteps) {
  if (historicalPrices.length < 2) {
    return Array(projectionSteps).fill(historicalPrices[historicalPrices.length - 1] || 0);
  }

  const dataPoints = historicalPrices.slice(-30);
  const n = dataPoints.length;
  
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  dataPoints.forEach((price, index) => {
    const x = index;
    const y = price;
    sumX += x;
    sumY += y;
    sumXY += x * y;
    sumX2 += x * x;
  });

  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  const projections = [];
  for (let i = 1; i <= projectionSteps; i++) {
    const projectedPrice = intercept + slope * (n + i - 1);
    projections.push(Math.max(0, projectedPrice));
  }

  return projections;
}

// Get or create stabilized model for a stock
function getStabilizedModel(symbol) {
  try {
    const key = `stabilizedModel_${symbol.toUpperCase()}`;
    const saved = localStorage.getItem(key);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading stabilized model:', error);
  }
  return null;
}

// Save stabilized model for a stock
function saveStabilizedModel(symbol, model) {
  try {
    const key = `stabilizedModel_${symbol.toUpperCase()}`;
    localStorage.setItem(key, JSON.stringify(model));
  } catch (error) {
    console.error('Error saving stabilized model:', error);
  }
}

// Color function for projection lines
function getProjectionColor(i, alpha = 0.9) {
  const hues = [210, 0, 40, 90, 140, 260, 300, 20, 170, 200, 280, 320, 45];
  const h = hues[i % hues.length];
  return `hsla(${h}, 85%, 60%, ${alpha})`;
}

function Projection() {
  const [symbol, setSymbol] = useState('');
  const [interval, setInterval] = useState('1D');
  const [chartData, setChartData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [currentInterval, setCurrentInterval] = useState(null);
  const [projectionSteps, setProjectionSteps] = useState(20);
  const [projectionHours, setProjectionHours] = useState(48); // 48-hour projection option
  const [recentSearches, setRecentSearches] = useState([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [projectionModel, setProjectionModel] = useState('lattice'); // 'lattice', 'montecarlo', 'linear', 'primetetration'
  const [modelParams, setModelParams] = useState(null);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [stabilizedModel, setStabilizedModel] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showModelParams, setShowModelParams] = useState(false);
  // Prime Tetration controls
  const [primeDepthIndex, setPrimeDepthIndex] = useState(4); // Default to index 4 = 31
  const [base, setBase] = useState(3); // Default seed base 3
  const [projectionCount, setProjectionCount] = useState(12); // Default 12 projections
  const [snapshotData, setSnapshotData] = useState(null); // Stores snapshot with multiple lines
  const [beta, setBeta] = useState(0.01); // Calibration factor
  const inputRef = useRef(null);
  const chartDataRef = useRef(null);
  const historicalPricesRef = useRef(null);

  const lineChartOptions = useRef({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          usePointStyle: true,
          padding: 15,
          font: {
            size: 12,
            weight: '600',
          },
        },
      },
      tooltip: {
        mode: 'index',
        intersect: false,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        padding: 12,
        titleFont: {
          size: 14,
          weight: 'bold',
        },
        bodyFont: {
          size: 13,
        },
        callbacks: {
          label: function(context) {
            if (context.parsed.y !== null && context.parsed.y !== undefined) {
              return `${context.dataset.label}: $${context.parsed.y.toFixed(2)}`;
            }
            return '';
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: true,
          color: 'rgba(0, 0, 0, 0.05)',
        },
        ticks: {
          maxTicksLimit: 20,
          font: {
            size: 11,
          },
          autoSkip: true,
        },
      },
      y: {
        beginAtZero: false,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false,
        },
        ticks: {
          callback: function(value) {
            if (value !== null && value !== undefined && !isNaN(value)) {
              return '$' + value.toFixed(2);
            }
            return '';
          },
          font: {
            size: 11,
          },
        },
        // Auto-scale based on data range
        // Calculate min/max from actual data values
        min: undefined, // Will be calculated
        max: undefined, // Will be calculated
      },
    },
  });

  const loadChartData = useCallback(async () => {
    if (!symbol || !symbol.trim()) {
      setError('Please enter a stock symbol');
      return;
    }

    const previousChartData = chartData;
    
    setLoading(true);
    setError(null);
    
    try {
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout. Please try again.')), 20000)
      );
      
      const dataPromise = getPriceChartData(symbol.toUpperCase().trim(), interval);
      const data = await Promise.race([dataPromise, timeoutPromise]);
      
      if (!data) {
        throw new Error('No data received from API');
      }
      
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid data format: data.data is not an array');
      }
      
      if (data.data.length === 0) {
        throw new Error('No chart data available for this symbol');
      }
      
      const validData = data.data.filter((d) => {
        if (!d || !d.timestamp) return false;
        const close = d.close;
        return close !== null && close !== undefined && !isNaN(close) && close > 0;
      });
      
      if (validData.length === 0) {
        throw new Error('No valid price data available. All data points are invalid.');
      }
      
      validData.sort((a, b) => a.timestamp - b.timestamp);
      
      const historicalPrices = validData.map((d) => Number(d.close));
      historicalPricesRef.current = historicalPrices;
      
      const historicalLabels = validData.map((d) => {
        try {
          const date = new Date(d.timestamp);
          if (isNaN(date.getTime())) {
            return '';
          }
          if (interval === '1H') {
            return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          } else {
            return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
          }
        } catch (e) {
          return '';
        }
      }).filter(label => label !== '');
      
      // Load stabilized model for this stock
      const savedModel = getStabilizedModel(symbol.toUpperCase().trim());
      
      // Calculate projections using selected model
      let projectedPrices = [];
      let currentStabilizedModel = savedModel;
      
      // Calculate projection steps based on hours if needed
      let stepsToUse = projectionSteps;
      if ((projectionModel === 'lattice' || projectionModel === 'primetetration') && projectionHours) {
        // Convert hours to steps based on interval
        // For 1H interval: 1 hour = 1 step
        // For 1D interval: 1 day = 24 hours, so 48 hours = 2 steps
        if (interval === '1H') {
          stepsToUse = projectionHours;
        } else if (interval === '1D' || interval === '1d') {
          stepsToUse = Math.ceil(projectionHours / 24);
        } else {
          stepsToUse = projectionSteps; // Use default steps
        }
      }
      
      // Ensure stepsToUse is valid and positive
      stepsToUse = Math.max(1, Math.min(1000, stepsToUse || projectionSteps || 20));
      
      const lastPrice = historicalPrices[historicalPrices.length - 1];
      
      if (projectionModel === 'primetetration') {
        // Prime Tetration with multiple triads (11-13 projection lines)
        try {
          const depthPrime = PRIME_STOPS[primeDepthIndex] || 31;
          const triads = generateTriadsAroundPrime(depthPrime, projectionCount, PRIMES_500);
          const snapshotResult = calculatePrimeTetrationProjection(historicalPrices, stepsToUse, base, triads, beta);
          snapshotResult.symbol = symbol.toUpperCase().trim();
          setSnapshotData(snapshotResult);
          
          // Use first line as primary projection for compatibility
          if (snapshotResult.lines && snapshotResult.lines.length > 0 && snapshotResult.lines[0].points) {
            projectedPrices = snapshotResult.lines[0].points;
            // Ensure we have the correct number of points
            if (projectedPrices.length !== stepsToUse) {
              console.warn(`Projected prices length (${projectedPrices.length}) doesn't match stepsToUse (${stepsToUse})`);
              // Pad or trim to match stepsToUse
              if (projectedPrices.length < stepsToUse) {
                const lastProjPrice = projectedPrices[projectedPrices.length - 1] || lastPrice;
                while (projectedPrices.length < stepsToUse) {
                  projectedPrices.push(lastProjPrice);
                }
              } else {
                projectedPrices = projectedPrices.slice(0, stepsToUse);
              }
            }
          } else {
            projectedPrices = calculateSimpleProjection(historicalPrices, stepsToUse);
          }
        } catch (err) {
          console.error('Prime Tetration projection failed, falling back to simple:', err);
          projectedPrices = calculateSimpleProjection(historicalPrices, stepsToUse);
          setSnapshotData(null);
        }
      } else if (projectionModel === 'lattice') {
        try {
          const result = calculateAdvancedProjection(historicalPrices, stepsToUse, savedModel, 15);
          if (result && result.projections && Array.isArray(result.projections)) {
            projectedPrices = result.projections;
            // Ensure we have the correct number of points
            if (projectedPrices.length !== stepsToUse) {
              console.warn(`Projected prices length (${projectedPrices.length}) doesn't match stepsToUse (${stepsToUse})`);
              if (projectedPrices.length < stepsToUse) {
                const lastProjPrice = projectedPrices[projectedPrices.length - 1] || lastPrice;
                while (projectedPrices.length < stepsToUse) {
                  projectedPrices.push(lastProjPrice);
                }
              } else {
                projectedPrices = projectedPrices.slice(0, stepsToUse);
              }
            }
            currentStabilizedModel = result.stabilizedModel || savedModel;
            
            // Save the updated stabilized model
            if (currentStabilizedModel) {
              saveStabilizedModel(symbol.toUpperCase().trim(), currentStabilizedModel);
              setStabilizedModel(currentStabilizedModel);
            }
          } else {
            throw new Error('Invalid projection result');
          }
        } catch (err) {
          console.error('Lattice projection failed, falling back to simple:', err);
          projectedPrices = calculateSimpleProjection(historicalPrices, stepsToUse);
        }
      } else if (projectionModel === 'montecarlo') {
        try {
          projectedPrices = calculateMonteCarloProjection(historicalPrices, stepsToUse);
          // Ensure we have the correct number of points
          if (projectedPrices.length !== stepsToUse) {
            console.warn(`Monte Carlo projected prices length (${projectedPrices.length}) doesn't match stepsToUse (${stepsToUse})`);
            if (projectedPrices.length < stepsToUse) {
              const lastProjPrice = projectedPrices[projectedPrices.length - 1] || lastPrice;
              while (projectedPrices.length < stepsToUse) {
                projectedPrices.push(lastProjPrice);
              }
            } else {
              projectedPrices = projectedPrices.slice(0, stepsToUse);
            }
          }
        } catch (err) {
          console.error('Monte Carlo projection failed, falling back to simple:', err);
          projectedPrices = calculateSimpleProjection(historicalPrices, stepsToUse);
        }
      } else {
        // No valid model selected - use lattice as fallback
        try {
          const result = calculateAdvancedProjection(historicalPrices, stepsToUse, savedModel, 15);
          if (result && result.projections && Array.isArray(result.projections)) {
            projectedPrices = result.projections;
            // Ensure we have the correct number of points
            if (projectedPrices.length !== stepsToUse) {
              console.warn(`Projected prices length (${projectedPrices.length}) doesn't match stepsToUse (${stepsToUse})`);
              if (projectedPrices.length < stepsToUse) {
                const lastProjPrice = projectedPrices[projectedPrices.length - 1] || lastPrice;
                while (projectedPrices.length < stepsToUse) {
                  projectedPrices.push(lastProjPrice);
                }
              } else {
                projectedPrices = projectedPrices.slice(0, stepsToUse);
              }
            }
            currentStabilizedModel = result.stabilizedModel || savedModel;
            
            // Save the updated stabilized model
            if (currentStabilizedModel) {
              saveStabilizedModel(symbol.toUpperCase().trim(), currentStabilizedModel);
              setStabilizedModel(currentStabilizedModel);
            }
          } else {
            throw new Error('Invalid projection result');
          }
        } catch (err) {
          console.error('Projection failed:', err);
          projectedPrices = Array(stepsToUse).fill(lastPrice);
        }
      }
      
      // Clear snapshot data for non-Prime Tetration models
      if (projectionModel !== 'primetetration') {
        setSnapshotData(null);
      }
      
      // Ensure projectedPrices is a valid array with correct length
      if (!Array.isArray(projectedPrices) || projectedPrices.length === 0) {
        projectedPrices = Array(stepsToUse).fill(lastPrice);
      } else if (projectedPrices.length !== stepsToUse) {
        // Final check - ensure length matches
        console.warn(`Final projectedPrices length (${projectedPrices.length}) doesn't match stepsToUse (${stepsToUse}), adjusting...`);
        if (projectedPrices.length < stepsToUse) {
          const lastProjPrice = projectedPrices[projectedPrices.length - 1] || lastPrice;
          while (projectedPrices.length < stepsToUse) {
            projectedPrices.push(lastProjPrice);
          }
        } else {
          projectedPrices = projectedPrices.slice(0, stepsToUse);
        }
      }
      
      // Calculate model parameters for display
      const avgGamma = Array.from({ length: 12 }, (_, d) => 
        calculateGamma(historicalPrices.length, d, historicalPrices)
      ).reduce((a, b) => a + b, 0) / 12;
      
      const avgZ = Array.from({ length: 12 }, (_, d) => 
        Math.abs(calculateZ(historicalPrices.length, d))
      ).reduce((a, b) => a + b, 0) / 12;
      
      // Update model parameters based on selected model
      if (projectionModel === 'primetetration' && snapshotData) {
        // Prime Tetration model parameters
        setModelParams({
          depthPrime: PRIME_STOPS[primeDepthIndex] || 31,
          base: base,
          projectionCount: projectionCount,
          beta: beta,
          horizon: stepsToUse,
          phi: PHI_D,
          lines: snapshotData.lines ? snapshotData.lines.length : 0,
        });
      } else if (projectionModel === 'lattice') {
        const primes = (currentStabilizedModel?.primes && Array.isArray(currentStabilizedModel.primes)) 
          ? currentStabilizedModel.primes 
          : PHI_D.slice(0, 6);
        const coprimes = (currentStabilizedModel?.coprimes && Array.isArray(currentStabilizedModel.coprimes)) 
          ? currentStabilizedModel.coprimes 
          : [];
        const oscillations = (currentStabilizedModel?.lastOscillations && Array.isArray(currentStabilizedModel.lastOscillations))
          ? currentStabilizedModel.lastOscillations
          : null;
        
        setModelParams({
          gamma: avgGamma.toFixed(4),
          zValue: avgZ.toFixed(4),
          primeCount: countPrimesInD(11),
          entropy: calculateLatticeEntropy(11, historicalPrices).toFixed(4),
          primes: primes,
          coprimes: coprimes,
          oscillations: oscillations,
          iteration: currentStabilizedModel?.iteration || 0,
          lockedPoints: (currentStabilizedModel?.lockedPoints && Array.isArray(currentStabilizedModel.lockedPoints))
            ? currentStabilizedModel.lockedPoints.length
            : 0,
        });
      } else if (projectionModel === 'montecarlo') {
        // Calculate Monte Carlo statistics
        const returns = [];
        for (let i = 1; i < historicalPrices.length; i++) {
          returns.push((historicalPrices[i] - historicalPrices[i - 1]) / historicalPrices[i - 1]);
        }
        const meanReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
        const variance = returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / returns.length;
        const stdDev = Math.sqrt(variance);
        
        setModelParams({
          meanReturn: (meanReturn * 100).toFixed(4),
          volatility: (stdDev * 100).toFixed(4),
          simulations: 10000,
          dataPoints: historicalPrices.length,
        });
      } else {
        setModelParams(null);
      }
      
      // Generate future labels for projections (using time-based labels)
      const projectedLabels = [];
      const lastTimestamp = validData[validData.length - 1]?.timestamp || Date.now();
      for (let i = 1; i <= stepsToUse; i++) {
        if (interval === '1H') {
          const futureTime = new Date(lastTimestamp + i * 60 * 60 * 1000);
          projectedLabels.push(futureTime.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
        } else {
          const futureTime = new Date(lastTimestamp + i * 24 * 60 * 60 * 1000);
          projectedLabels.push(futureTime.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
        }
      }
      
      // Ensure arrays are valid before spreading
      const safeHistoricalLabels = Array.isArray(historicalLabels) ? historicalLabels : [];
      const safeProjectedLabels = Array.isArray(projectedLabels) ? projectedLabels : [];
      const safeHistoricalPrices = Array.isArray(historicalPrices) ? historicalPrices : [];
      const safeProjectedPrices = Array.isArray(projectedPrices) ? projectedPrices : [];
      
      // Validate data arrays have matching lengths
      if (safeHistoricalLabels.length !== safeHistoricalPrices.length) {
        console.warn('Historical labels and prices length mismatch:', safeHistoricalLabels.length, safeHistoricalPrices.length);
        const minLength = Math.min(safeHistoricalLabels.length, safeHistoricalPrices.length);
        safeHistoricalLabels.splice(minLength);
        safeHistoricalPrices.splice(minLength);
      }
      
      if (safeProjectedLabels.length !== safeProjectedPrices.length) {
        console.warn('Projected labels and prices length mismatch:', safeProjectedLabels.length, safeProjectedPrices.length);
        const minLength = Math.min(safeProjectedLabels.length, safeProjectedPrices.length);
        safeProjectedLabels.splice(minLength);
        safeProjectedPrices.splice(minLength);
      }
      
      // Combine historical and projected data
      const allLabels = [...safeHistoricalLabels, ...safeProjectedLabels];
      const allPrices = [...safeHistoricalPrices, ...safeProjectedPrices];
      
      // Ensure allPrices and allLabels have the same length
      if (allLabels.length !== allPrices.length) {
        console.warn('Labels and prices length mismatch:', allLabels.length, allPrices.length);
        const minLength = Math.min(allLabels.length, allPrices.length);
        allLabels.splice(minLength);
        allPrices.splice(minLength);
      }
      
      const firstPrice = safeHistoricalPrices[0] || 0;
      const projectedLastPrice = safeProjectedPrices.length > 0 ? safeProjectedPrices[safeProjectedPrices.length - 1] : lastPrice;
      
      // Calculate historical change
      const change = lastPrice - firstPrice;
      const changePercent = firstPrice !== 0 ? (change / firstPrice) * 100 : 0;
      
      // Calculate projected change with bounds checking
      const projectedChange = projectedLastPrice - lastPrice;
      let projectedChangePercent = 0;
      
      if (lastPrice !== 0 && lastPrice > 0) {
        projectedChangePercent = (projectedChange / lastPrice) * 100;
        // Clamp percentage to reasonable range (-1000% to +1000%) to avoid scientific notation
        projectedChangePercent = Math.max(-1000, Math.min(1000, projectedChangePercent));
      }
      
      // Ensure projected price is reasonable
      const finalProjectedPrice = Math.max(0, projectedLastPrice);
      
      // Ensure first projected price connects smoothly to last historical price
      if (safeProjectedPrices.length > 0 && safeHistoricalPrices.length > 0) {
        const lastHistoricalPrice = safeHistoricalPrices[safeHistoricalPrices.length - 1];
        const firstProjectedPrice = safeProjectedPrices[0];
        
        // If there's a significant jump, adjust the first projected price to connect smoothly
        const jump = Math.abs(firstProjectedPrice - lastHistoricalPrice) / lastHistoricalPrice;
        if (jump > 0.02) { // More than 2% jump
          // Smoothly transition: first projection should be very close to last historical
          safeProjectedPrices[0] = lastHistoricalPrice + (firstProjectedPrice - lastHistoricalPrice) * 0.3;
          // Update allPrices array to reflect this change
          allPrices[safeHistoricalPrices.length] = safeProjectedPrices[0];
        }
      }
      
      // Create datasets with proper data mapping - ensure arrays match label length
      // Historical data: show prices for historical indices, include last point for connection
      const historicalData = allLabels.map((label, index) => {
        if (index < safeHistoricalPrices.length) {
          const price = allPrices[index];
          return (price !== null && price !== undefined && !isNaN(price) && price > 0) ? Number(price) : null;
        }
        // Include the first projected point in historical dataset for smooth connection
        if (index === safeHistoricalPrices.length && safeHistoricalPrices.length > 0) {
          const lastHistorical = safeHistoricalPrices[safeHistoricalPrices.length - 1];
          const firstProjected = allPrices[index];
          if (firstProjected !== null && firstProjected !== undefined && !isNaN(firstProjected) && firstProjected > 0) {
            // Smooth connection point: blend between last historical and first projected
            const connectionPrice = lastHistorical * 0.8 + Number(firstProjected) * 0.2;
            return connectionPrice;
          }
          return lastHistorical; // Fallback to last historical price
        }
        return null;
      });
      
      // Projected data: show null for historical, prices for projected
      // IMPORTANT: First projected point should connect to last historical point
      const projectedData = allLabels.map((label, index) => {
        if (index < safeHistoricalPrices.length) {
          return null; // Historical indices are null in projected dataset
        }
        // First projected point: ensure smooth connection
        if (index === safeHistoricalPrices.length && safeHistoricalPrices.length > 0) {
          const lastHistorical = safeHistoricalPrices[safeHistoricalPrices.length - 1];
          const firstProjected = allPrices[index];
          if (firstProjected !== null && firstProjected !== undefined && !isNaN(firstProjected) && firstProjected > 0) {
            // Smooth connection: blend between last historical and first projected
            const connectionPrice = lastHistorical * 0.8 + Number(firstProjected) * 0.2;
            return connectionPrice;
          }
          return lastHistorical; // Fallback to last historical price
        }
        // Other projected points
        if (index < allPrices.length) {
          const price = allPrices[index];
          return (price !== null && price !== undefined && !isNaN(price) && price > 0) ? Number(price) : null;
        }
        return null;
      });
      
      // Ensure we have valid data
      const hasHistoricalData = historicalData.some(d => d !== null && d !== undefined);
      const hasProjectedData = projectedData.some(d => d !== null && d !== undefined);
      
      if (!hasHistoricalData && !hasProjectedData) {
        throw new Error('No valid chart data available. All data points are null or invalid.');
      }
      
      // Debug: Log data to ensure it's correct
      const connectionIndex = safeHistoricalPrices.length;
      const connectionPrice = historicalData[connectionIndex] || projectedData[connectionIndex];
      console.log('Chart Data Debug:', {
        labelsLength: allLabels.length,
        pricesLength: allPrices.length,
        historicalLength: safeHistoricalPrices.length,
        projectedLength: safeProjectedPrices.length,
        historicalDataPoints: historicalData.filter(d => d !== null && d !== undefined).length,
        projectedDataPoints: projectedData.filter(d => d !== null && d !== undefined).length,
        firstHistorical: historicalData[0],
        lastHistorical: historicalData[safeHistoricalPrices.length - 1],
        connectionIndex: connectionIndex,
        connectionPrice: connectionPrice,
        firstProjected: projectedData[connectionIndex],
        secondProjected: projectedData[connectionIndex + 1],
        lastProjected: projectedData[projectedData.length - 1],
        hasHistoricalData,
        hasProjectedData,
        sampleHistorical: historicalData.slice(Math.max(0, safeHistoricalPrices.length - 5), safeHistoricalPrices.length + 1),
        sampleProjected: projectedData.slice(connectionIndex, connectionIndex + 5),
        // Check for oscillations in projected data
        projectedOscillations: projectedData.slice(connectionIndex, connectionIndex + 10).filter(d => d !== null).map((price, idx, arr) => {
          if (idx === 0) return 0;
          return arr[idx] - arr[idx - 1];
        }),
      });
      
      // Final validation: ensure we have at least some valid data points
      const validHistoricalCount = historicalData.filter(d => d !== null && d !== undefined && !isNaN(d)).length;
      const validProjectedCount = projectedData.filter(d => d !== null && d !== undefined && !isNaN(d)).length;
      
      if (validHistoricalCount === 0 && validProjectedCount === 0) {
        throw new Error('No valid data points available for chart. All values are null or invalid.');
      }
      
      // Ensure data arrays are the same length as labels
      while (historicalData.length < allLabels.length) {
        historicalData.push(null);
      }
      while (projectedData.length < allLabels.length) {
        projectedData.push(null);
      }
      
      // Build datasets array
      const datasets = [
        {
          label: `${symbol.toUpperCase()} Historical`,
          data: historicalData.slice(0, allLabels.length),
          borderColor: 'rgb(59, 130, 246)',
          backgroundColor: 'rgba(59, 130, 246, 0.1)',
          tension: 0.4,
          fill: false,
          pointRadius: 2,
          pointHoverRadius: 6,
          borderWidth: 2,
          spanGaps: false,
          showLine: true,
          stepped: false,
        },
      ];

      // Add projection lines based on model
      if (projectionModel === 'primetetration' && snapshotData && snapshotData.lines && snapshotData.lines.length > 0) {
        // Multiple projection lines for Prime Tetration (11-13 lines)
        snapshotData.lines.forEach((line, idx) => {
          // Ensure line.points has the correct length
          let linePoints = line.points || [];
          if (linePoints.length !== stepsToUse) {
            console.warn(`Line ${idx} points length (${linePoints.length}) doesn't match stepsToUse (${stepsToUse})`);
            if (linePoints.length < stepsToUse) {
              const lastPoint = linePoints[linePoints.length - 1] || lastPrice;
              while (linePoints.length < stepsToUse) {
                linePoints.push(lastPoint);
              }
            } else {
              linePoints = linePoints.slice(0, stepsToUse);
            }
          }
          
          const lineData = allLabels.map((label, index) => {
            if (index < safeHistoricalPrices.length) {
              return null;
            }
            const projectionIndex = index - safeHistoricalPrices.length;
            if (projectionIndex >= 0 && projectionIndex < linePoints.length) {
              // First point: smooth connection to last historical price
              if (projectionIndex === 0 && safeHistoricalPrices.length > 0) {
                const lastHistorical = safeHistoricalPrices[safeHistoricalPrices.length - 1];
                return lastHistorical * 0.8 + linePoints[0] * 0.2;
              }
              const point = linePoints[projectionIndex];
              return (point !== null && point !== undefined && !isNaN(point) && point > 0) ? Number(point) : null;
            }
            return null;
          });

          datasets.push({
            label: `Triad [${line.triad.join('-')}]`,
            data: lineData,
            borderColor: getProjectionColor(idx, 0.9),
            backgroundColor: getProjectionColor(idx, 0.18),
            fill: false,
            borderWidth: 2,
            pointRadius: 0,
            tension: 0.4,
            spanGaps: false,
            showLine: true,
            stepped: false,
          });
        });
      } else {
        // Single projection line for other models
        datasets.push({
            label: `${symbol.toUpperCase()} Projected (${
            projectionModel === 'lattice' ? '12-Fold Lattice' : 
            projectionModel === 'montecarlo' ? 'Monte Carlo' : 
            'Lattice'
          })`,
          data: projectedData.slice(0, allLabels.length),
          borderColor: 'rgb(168, 85, 247)',
          backgroundColor: 'rgba(168, 85, 247, 0.1)',
          borderDash: [5, 5],
          tension: 0.4,
          fill: false,
          pointRadius: 2,
          pointHoverRadius: 6,
          borderWidth: 2,
          spanGaps: false,
          showLine: true,
          stepped: false,
        });
      }

      const chartDataObj = {
        labels: allLabels,
        datasets: datasets,
        currentPrice: data.currentPrice || lastPrice,
        change: change,
        changePercent: changePercent,
        projectedPrice: finalProjectedPrice,
        projectedChange: projectedChange,
        projectedChangePercent: projectedChangePercent,
      };
      
      // Final check: log the actual data being sent to chart
      console.log('Final Chart Data:', {
        labelsCount: chartDataObj.labels.length,
        datasetsCount: chartDataObj.datasets.length,
        historicalDataCount: chartDataObj.datasets[0].data.length,
        projectedDataCount: chartDataObj.datasets[1].data.length,
        historicalValid: chartDataObj.datasets[0].data.filter(d => d !== null).length,
        projectedValid: chartDataObj.datasets[1].data.filter(d => d !== null).length,
        firstFewHistorical: chartDataObj.datasets[0].data.slice(0, 5),
        firstFewProjected: chartDataObj.datasets[1].data.slice(safeHistoricalPrices.length, safeHistoricalPrices.length + 5),
      });
      
      // Calculate min/max for y-axis scaling based on actual data
      const allValidValues = [...historicalData, ...projectedData].filter(
        v => v !== null && v !== undefined && !isNaN(v) && typeof v === 'number' && v > 0
      );
      
      if (allValidValues.length > 0) {
        const minValue = Math.min(...allValidValues);
        const maxValue = Math.max(...allValidValues);
        const range = maxValue - minValue;
        const padding = Math.max(range * 0.05, minValue * 0.01);
        
        // Update chart options with calculated min/max
        lineChartOptions.current.scales.y.min = Math.max(0, minValue - padding);
        lineChartOptions.current.scales.y.max = maxValue + padding;
      }
      
      chartDataRef.current = chartDataObj;
      setChartData(chartDataObj);
      setCurrentInterval(interval);
      setLastRefresh(new Date());
      
      const searchKey = `${symbol.toUpperCase()}-${interval}`;
      setRecentSearches(prev => {
        const filtered = prev.filter(s => s !== searchKey);
        const newSearches = [searchKey, ...filtered].slice(0, 5);
        localStorage.setItem('projectionRecentSearches', JSON.stringify(newSearches));
        return newSearches;
      });
    } catch (err) {
      const errorMessage = err.message || 'Failed to load chart data. Please check the symbol and try again.';
      setError(errorMessage);
      if (!previousChartData) {
        setChartData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [symbol, interval, projectionSteps, projectionModel, primeDepthIndex, base, projectionCount, beta]);

  useEffect(() => {
    const saved = localStorage.getItem('projectionRecentSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        // Silently fail
      }
    }
  }, []);


  const handleSearch = () => {
    const trimmedSymbol = symbol?.trim();
    if (trimmedSymbol) {
      setShowRecentSearches(false);
      loadChartData();
    } else {
      setError('Please enter a stock symbol');
    }
  };

  const handleRefresh = () => {
    if (symbol && symbol.trim()) {
      loadChartData();
    }
  };

  const handleIntervalChange = (newInterval) => {
    if (newInterval === interval) return;
    setInterval(newInterval);
    if (symbol && symbol.trim() && chartData) {
      setTimeout(() => {
        loadChartData();
      }, 100);
    }
  };

  const handleRecentSearch = (searchKey) => {
    const [sym, int] = searchKey.split('-');
    setSymbol(sym);
    setInterval(int);
    setShowRecentSearches(false);
    setTimeout(() => {
      loadChartData();
    }, 100);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleRecursiveAnalysis = async () => {
    if (!symbol || !symbol.trim()) {
      setError('Please enter a stock symbol first');
      return;
    }

    if (!historicalPricesRef.current) {
      setError('Please load chart data first by searching for a stock');
      return;
    }

    setAnalyzing(true);
    setError(null);

    try {
      const historicalPrices = historicalPricesRef.current;
      
      if (!Array.isArray(historicalPrices) || historicalPrices.length < 8) {
        throw new Error('Insufficient data for FFT analysis. Need at least 8 data points. Current data points: ' + (historicalPrices?.length || 0));
      }
      
      const symbolKey = symbol.toUpperCase().trim();
      const savedModel = getStabilizedModel(symbolKey);
      
      // Calculate steps based on hours
      let stepsToUse = projectionSteps;
      if (projectionHours) {
        if (interval === '1H') {
          stepsToUse = projectionHours;
        } else if (interval === '1D' || interval === '1d') {
          stepsToUse = Math.ceil(projectionHours / 24);
        }
      }
      
      // Force full recursive analysis - the calculateAdvancedProjection will automatically recurse
      const modelToAnalyze = savedModel ? { 
        ...savedModel, 
        iteration: 0,
        signalStability: 0,
        lastOscillations: null
      } : null;
      
      // Perform recursive analysis with automatic oscillation minimization (max 15 iterations)
      const result = calculateAdvancedProjection(historicalPrices, stepsToUse, modelToAnalyze, 15);
      
      if (!result || !result.projections || !Array.isArray(result.projections)) {
        throw new Error('Invalid projection result from advanced model');
      }
      
      // Verify no price jump at start
      const lastPrice = historicalPrices[historicalPrices.length - 1];
      const firstProjection = result.projections[0];
      const jump = Math.abs(firstProjection - lastPrice) / lastPrice;
      
      if (jump > 0.05) {
        // Still has jump - force another round
        const reanalyzedResult = calculateAdvancedProjection(historicalPrices, stepsToUse, result.stabilizedModel, 10);
        if (reanalyzedResult && reanalyzedResult.projections) {
          Object.assign(result, reanalyzedResult);
        }
      }
      
      // Save the updated stabilized model
      saveStabilizedModel(symbolKey, result.stabilizedModel);
      setStabilizedModel(result.stabilizedModel);
      
      // Reload chart with new model
      await loadChartData();
      
    } catch (error) {
      console.error('Recursive FFT analysis failed:', error);
      setError('Failed to perform recursive FFT analysis: ' + (error.message || 'Unknown error'));
    } finally {
      setAnalyzing(false);
    }
  };

  useEffect(() => {
    return () => {
      // Cleanup if needed
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Price Projection</h1>
        <p className="text-gray-600 dark:text-gray-400">12-Fold Crystalline Periodic Lattice Model</p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex flex-col lg:flex-row gap-4 items-end">
          <div className="flex-1 relative">
            <label htmlFor="symbol" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Stock Symbol
            </label>
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                id="symbol"
                value={symbol}
                onChange={(e) => {
                  const newValue = e.target.value.toUpperCase();
                  setSymbol(newValue);
                  setShowRecentSearches(newValue.length === 0 && recentSearches.length > 0);
                }}
                onKeyDown={handleKeyPress}
                onFocus={() => {
                  if (recentSearches.length > 0 && !symbol) {
                    setShowRecentSearches(true);
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowRecentSearches(false), 200);
                }}
                placeholder="Enter symbol (e.g., AAPL, TSLA, MSFT)"
                className="w-full px-4 py-3 pr-10 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
              />
              {symbol && (
                <button
                  type="button"
                  onClick={() => {
                    setSymbol('');
                    setShowRecentSearches(false);
                    inputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              
              {showRecentSearches && recentSearches.length > 0 && !loading && (
                <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto" style={{ zIndex: 10 }}>
                  <div className="px-3 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                    Recent Searches
                  </div>
                  {recentSearches.map((searchKey) => {
                    const [sym, int] = searchKey.split('-');
                    return (
                      <button
                        key={searchKey}
                        type="button"
                        onClick={() => handleRecentSearch(searchKey)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-between transition-colors"
                      >
                        <span className="font-medium text-gray-900 dark:text-white">{sym}</span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">{int}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          
          <div className="w-full lg:w-auto">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Time Interval
            </label>
            <div className="flex gap-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => handleIntervalChange('1D')}
                className={`px-6 py-2 rounded-md font-medium transition-all ${
                  interval === '1D'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                1 Day
              </button>
              <button
                type="button"
                onClick={() => handleIntervalChange('1H')}
                className={`px-6 py-2 rounded-md font-medium transition-all ${
                  interval === '1H'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                1 Hour
              </button>
            </div>
          </div>

          <div className="w-full lg:w-auto">
            <label htmlFor="projectionSteps" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              {projectionModel === 'lattice' ? 'Projection Hours' : 'Projection Steps'}
            </label>
            {projectionModel === 'lattice' ? (
              <select
                id="projectionHours"
                value={projectionHours}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setProjectionHours(value);
                  if (chartData) {
                    setTimeout(() => loadChartData(), 100);
                  }
                }}
                className="w-full lg:w-32 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
              >
                <option value={24}>24 Hours</option>
                <option value={48}>48 Hours</option>
                <option value={72}>72 Hours</option>
                <option value={96}>96 Hours</option>
              </select>
            ) : (
              <select
                id="projectionSteps"
                value={projectionSteps}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  setProjectionSteps(value);
                  if (chartData) {
                    setTimeout(() => loadChartData(), 100);
                  }
                }}
                className="w-full lg:w-32 px-4 py-3 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
              >
                <option value={10}>10 Steps</option>
                <option value={20}>20 Steps</option>
                <option value={40}>40 Steps</option>
                <option value={60}>60 Steps</option>
              </select>
            )}
          </div>
          
          <div className="w-full lg:w-auto">
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSearch();
              }}
              disabled={loading || !symbol || !symbol.trim()}
              className="w-full lg:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed disabled:opacity-50 shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 relative z-0"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Loading...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Search</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-3 bg-gray-50 dark:bg-gray-900/30 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex-1">
            <label htmlFor="projectionModel" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Projection Model
            </label>
            <select
              id="projectionModel"
              value={projectionModel}
              onChange={(e) => {
                setProjectionModel(e.target.value);
                if (chartData) {
                  setTimeout(() => loadChartData(), 100);
                }
              }}
              className="w-full sm:w-64 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white transition-all text-sm font-medium"
            >
              <option value="lattice">12-Fold Lattice Model</option>
              <option value="primetetration">Prime Tetration Projections</option>
              <option value="montecarlo">Monte Carlo Simulation</option>
            </select>
          </div>
          {projectionModel === 'primetetration' && (
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex-1">
                <label htmlFor="base" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Base (seed)
                </label>
                <select
                  id="base"
                  value={base}
                  onChange={(e) => {
                    setBase(parseInt(e.target.value, 10));
                    if (chartData) {
                      setTimeout(() => loadChartData(), 100);
                    }
                  }}
                  className="w-full sm:w-32 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white transition-all text-sm font-medium"
                >
                  <option value={3}>3 (preferred)</option>
                  <option value={2}>2 (Enigma-style)</option>
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="projectionCount" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Projections Count
                </label>
                <select
                  id="projectionCount"
                  value={projectionCount}
                  onChange={(e) => {
                    setProjectionCount(parseInt(e.target.value, 10));
                    if (chartData) {
                      setTimeout(() => loadChartData(), 100);
                    }
                  }}
                  className="w-full sm:w-32 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white transition-all text-sm font-medium"
                >
                  <option value={11}>11</option>
                  <option value={12}>12</option>
                  <option value={13}>13</option>
                </select>
              </div>
              <div className="flex-1">
                <label htmlFor="primeDepthSlider" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Prime Depth: {PRIME_STOPS[primeDepthIndex] || 31}
                </label>
                <input
                  type="range"
                  id="primeDepthSlider"
                  min="0"
                  max={PRIME_STOPS.length - 1}
                  step="1"
                  value={primeDepthIndex}
                  onChange={(e) => {
                    setPrimeDepthIndex(parseInt(e.target.value, 10));
                    if (chartData) {
                      setTimeout(() => loadChartData(), 100);
                    }
                  }}
                  className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                />
                <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                  <span>{PRIME_STOPS[0]}</span>
                  <span>{PRIME_STOPS[PRIME_STOPS.length - 1]}</span>
                </div>
              </div>
              <div className="flex-1">
                <label htmlFor="beta" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  Beta (scale)
                </label>
                <input
                  type="number"
                  id="beta"
                  step="0.001"
                  value={beta}
                  onChange={(e) => {
                    setBeta(parseFloat(e.target.value) || 0.01);
                    if (chartData) {
                      setTimeout(() => loadChartData(), 100);
                    }
                  }}
                  className="w-full sm:w-32 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white transition-all text-sm font-medium"
                />
              </div>
            </div>
          )}
          {projectionModel === 'lattice' && (
            <button
              type="button"
              onClick={handleRecursiveAnalysis}
              disabled={analyzing || !symbol || !symbol.trim() || !historicalPricesRef.current || (historicalPricesRef.current && historicalPricesRef.current.length < 8)}
              className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white text-sm font-semibold rounded-lg hover:from-purple-700 hover:to-purple-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed disabled:opacity-50 shadow-md hover:shadow-lg transition-all flex items-center gap-2 self-end sm:self-center"
              title={!symbol || !symbol.trim() ? 'Enter a stock symbol first' : !historicalPricesRef.current ? 'Load chart data first' : (historicalPricesRef.current && historicalPricesRef.current.length < 8) ? 'Need at least 8 data points for FFT analysis' : 'Perform recursive FFT analysis on price signal'}
            >
              {analyzing ? (
                <>
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Analyzing...</span>
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  <span>Recursive Analysis</span>
                </>
              )}
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
                <p className="text-xs text-red-600 dark:text-red-300 mt-1">Please check the symbol and try again</p>
              </div>
            </div>
          </div>
        )}

        {chartData && (
          <div className="mt-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Price Metrics</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-5 border border-blue-200 dark:border-blue-800 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Current Price</p>
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {chartData?.currentPrice !== undefined && chartData.currentPrice !== null ? (
                    `$${chartData.currentPrice.toFixed(2)}`
                  ) : (
                    <span className="text-gray-400">N/A</span>
                  )}
                </p>
              </div>
              
              <div className={`rounded-xl p-5 border shadow-sm ${
                chartData && chartData.change >= 0
                  ? 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800'
                  : 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Historical Change</p>
                  {chartData && (
                    <svg className={`w-4 h-4 ${chartData.change >= 0 ? 'text-green-500' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {chartData.change >= 0 ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                      )}
                    </svg>
                  )}
                </div>
                <p className={`text-xl font-bold ${
                  chartData.change >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                }`}>
                  {chartData?.change !== undefined && chartData.change !== null ? (
                    `${chartData.change >= 0 ? '+' : ''}$${Math.abs(chartData.change).toFixed(2)}`
                  ) : (
                    <span className="text-gray-400">--</span>
                  )}
                </p>
                {chartData?.changePercent !== undefined && chartData.changePercent !== null && (
                  <p className={`text-xs mt-1 ${
                    chartData.changePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {chartData.changePercent >= 0 ? '+' : ''}{chartData.changePercent.toFixed(2)}%
                  </p>
                )}
              </div>
              
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-5 border border-purple-200 dark:border-purple-800 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-purple-600 dark:text-purple-400 uppercase tracking-wide">Projected Price</p>
                  <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {chartData?.projectedPrice !== undefined && chartData.projectedPrice !== null && chartData.projectedPrice > 0 ? (
                    (() => {
                      const price = chartData.projectedPrice;
                      // Format price appropriately
                      if (price >= 1000) {
                        return `$${price.toFixed(2)}`;
                      } else if (price >= 1) {
                        return `$${price.toFixed(2)}`;
                      } else {
                        return `$${price.toFixed(4)}`;
                      }
                    })()
                  ) : (
                    <span className="text-gray-400">N/A</span>
                  )}
                </p>
              </div>
              
              <div className={`rounded-xl p-5 border shadow-sm ${
                chartData && chartData.projectedChange >= 0
                  ? 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800'
                  : 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Projected Change</p>
                  {chartData && (
                    <svg className={`w-4 h-4 ${chartData.projectedChange >= 0 ? 'text-green-500' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {chartData.projectedChange >= 0 ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                      )}
                    </svg>
                  )}
                </div>
                <p className={`text-xl font-bold ${
                  chartData.projectedChange >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                }`}>
                  {chartData?.projectedChange !== undefined && chartData.projectedChange !== null ? (
                    (() => {
                      const change = chartData.projectedChange;
                      // Format dollar change appropriately
                      if (Math.abs(change) >= 1000) {
                        return `${change >= 0 ? '+' : ''}$${Math.abs(change).toFixed(2)}`;
                      } else if (Math.abs(change) >= 1) {
                        return `${change >= 0 ? '+' : ''}$${Math.abs(change).toFixed(2)}`;
                      } else {
                        return `${change >= 0 ? '+' : ''}$${Math.abs(change).toFixed(4)}`;
                      }
                    })()
                  ) : (
                    <span className="text-gray-400">--</span>
                  )}
                </p>
                {chartData?.projectedChangePercent !== undefined && chartData.projectedChangePercent !== null && (
                  <p className={`text-xs mt-1 ${
                    chartData.projectedChangePercent >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                  }`}>
                    {(() => {
                      const percent = chartData.projectedChangePercent;
                      // Format to avoid scientific notation
                      if (Math.abs(percent) >= 1000) {
                        return `${percent >= 0 ? '+' : ''}${percent.toFixed(0)}%`;
                      } else if (Math.abs(percent) >= 100) {
                        return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
                      } else {
                        return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
                      }
                    })()}
                  </p>
                )}
              </div>
              
              <div className={`rounded-xl p-5 border shadow-sm ${
                chartData && chartData.projectedChangePercent >= 0
                  ? 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800'
                  : 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wide">Change %</p>
                  {chartData && (
                    <svg className={`w-4 h-4 ${chartData.projectedChangePercent >= 0 ? 'text-green-500' : 'text-red-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      {chartData.projectedChangePercent >= 0 ? (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                      )}
                    </svg>
                  )}
                </div>
                <p className={`text-xl font-bold ${
                  chartData.projectedChangePercent >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
                }`}>
                  {chartData?.projectedChangePercent !== undefined && chartData.projectedChangePercent !== null ? (
                    (() => {
                      const percent = chartData.projectedChangePercent;
                      // Format to avoid scientific notation for large numbers
                      if (Math.abs(percent) >= 1000) {
                        return `${percent >= 0 ? '+' : ''}${percent.toFixed(0)}%`;
                      } else if (Math.abs(percent) >= 100) {
                        return `${percent >= 0 ? '+' : ''}${percent.toFixed(1)}%`;
                      } else {
                        return `${percent >= 0 ? '+' : ''}${percent.toFixed(2)}%`;
                      }
                    })()
                  ) : (
                    <span className="text-gray-400">--</span>
                  )}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Projected</p>
              </div>
            </div>
          </div>
        )}

        {modelParams && (
          <div className="mt-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
            <button
              type="button"
              onClick={() => setShowModelParams(!showModelParams)}
              className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                </svg>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {projectionModel === 'primetetration' ? 'Prime Tetration Parameters' :
                   projectionModel === 'lattice' ? 'Stabilized Model Parameters' : 
                   projectionModel === 'montecarlo' ? 'Monte Carlo Parameters' : 
                   'Model Parameters'}
                </h4>
                {projectionModel === 'lattice' && modelParams.iteration > 0 && (
                  <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full font-medium">
                    Iteration {modelParams.iteration}
                  </span>
                )}
              </div>
              <svg
                className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
                  showModelParams ? 'rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {showModelParams && (
              <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900/30">
                <div className="flex flex-col gap-4">
                  {projectionModel === 'primetetration' ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 dark:text-gray-400">Depth Prime:</span>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">{modelParams.depthPrime}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 dark:text-gray-400">Base:</span>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">{modelParams.base}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 dark:text-gray-400">Lines:</span>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">{modelParams.lines}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 dark:text-gray-400">Beta:</span>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">{modelParams.beta}</span>
                        </div>
                      </div>
                      
                      {modelParams.phi && Array.isArray(modelParams.phi) && (
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex flex-col gap-2">
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Full φ_d: [3,7,31,12,19,5,11,13,17,23,29,31]</span>
                            <span className="text-xs text-gray-500 dark:text-gray-400">+8 bits truncation active</span>
                          </div>
                        </div>
                      )}
                      
                      {snapshotData && snapshotData.lines && snapshotData.lines.length > 0 && (
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex flex-col gap-2">
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Oscillation Stats:</span>
                            <div className="flex flex-wrap gap-2">
                              {snapshotData.lines.slice(0, 6).map((line, idx) => (
                                <div key={idx} className="text-xs font-mono text-gray-900 dark:text-white bg-purple-100 dark:bg-purple-900/30 px-3 py-2 rounded flex flex-col gap-1">
                                  <span className="font-semibold">L{idx+1}[{line.triad.join('-')}]</span>
                                  <span className="text-gray-600 dark:text-gray-400">zc={line.zeroCrossings}, tp={line.turningPoints}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  ) : projectionModel === 'lattice' ? (
                    <>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 dark:text-gray-400">Γ:</span>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">{modelParams.gamma}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 dark:text-gray-400">Z:</span>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">{modelParams.zValue}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 dark:text-gray-400">Entropy:</span>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">{modelParams.entropy}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 dark:text-gray-400">Iteration:</span>
                          <span className="font-mono font-semibold text-gray-900 dark:text-white">{modelParams.iteration || 0}</span>
                        </div>
                      </div>
                      
                      {modelParams.primes && Array.isArray(modelParams.primes) && modelParams.primes.length > 0 && (
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex flex-col gap-2">
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Stabilized Primes:</span>
                            <div className="flex flex-wrap gap-2">
                              {modelParams.primes.map((prime, idx) => (
                                <span key={idx} className="text-xs font-mono text-gray-900 dark:text-white bg-purple-100 dark:bg-purple-900/30 px-2 py-1 rounded">
                                  {prime}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {modelParams.coprimes && Array.isArray(modelParams.coprimes) && modelParams.coprimes.length > 0 && (
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex flex-col gap-2">
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Stabilized Coprimes:</span>
                            <div className="flex flex-wrap gap-2">
                              {modelParams.coprimes.map((coprime, idx) => (
                                <span key={idx} className="text-xs font-mono text-gray-900 dark:text-white bg-blue-100 dark:bg-blue-900/30 px-2 py-1 rounded">
                                  {coprime}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {modelParams.oscillations && Array.isArray(modelParams.oscillations) && modelParams.oscillations.length > 0 && (
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex flex-col gap-2">
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Detected Oscillations:</span>
                            <div className="flex flex-wrap gap-2">
                              {modelParams.oscillations.slice(0, 5).map((osc, idx) => (
                                <div key={idx} className="text-xs font-mono text-gray-900 dark:text-white bg-green-100 dark:bg-green-900/30 px-3 py-2 rounded flex flex-col gap-1">
                                  <span className="font-semibold">Period: {osc.period?.toFixed(1) || 'N/A'}</span>
                                  <span className="text-gray-600 dark:text-gray-400">Strength: {osc.strength?.toFixed(3) || 'N/A'}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {modelParams.lockedPoints > 0 && (
                        <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">Locked Data Points:</span>
                            <span className="text-xs font-mono font-semibold text-gray-900 dark:text-white bg-yellow-100 dark:bg-yellow-900/30 px-2 py-1 rounded">
                              {modelParams.lockedPoints} points
                            </span>
                          </div>
                        </div>
                      )}
                    </>
                  ) : projectionModel === 'montecarlo' ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400">Mean Return:</span>
                        <span className="font-mono font-semibold text-gray-900 dark:text-white">{modelParams.meanReturn}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400">Volatility:</span>
                        <span className="font-mono font-semibold text-gray-900 dark:text-white">{modelParams.volatility}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400">Simulations:</span>
                        <span className="font-mono font-semibold text-gray-900 dark:text-white">{modelParams.simulations.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500 dark:text-gray-400">Data Points:</span>
                        <span className="font-mono font-semibold text-gray-900 dark:text-white">{modelParams.dataPoints}</span>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
        )}

        {(lastRefresh || chartData) && (
          <div className="mt-4 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{lastRefresh ? `Last updated: ${lastRefresh.toLocaleString()}` : 'Ready to load data'}</span>
            </div>
            {chartData && (
              <button
                type="button"
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:text-gray-400 transition-colors"
              >
                <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>Refresh</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="mb-6">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">Price Projection Chart</h3>
              {symbol && currentInterval && (
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  {symbol.toUpperCase()} - {currentInterval} interval - {projectionSteps} step projection
                </p>
              )}
            </div>
            {chartData && (
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                  <span className="text-gray-600 dark:text-gray-400">Historical</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-purple-500 border-2 border-dashed border-purple-500"></div>
                  <span className="text-gray-600 dark:text-gray-400">Projected</span>
                </div>
              </div>
            )}
          </div>
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
            <button
              type="button"
              onClick={() => setShowModelInfo(!showModelInfo)}
              className="w-full flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 hover:bg-gray-100 dark:hover:bg-gray-900/70 transition-colors"
            >
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                  {projectionModel === 'primetetration' ? 'About Prime Tetration Projections' :
                   projectionModel === 'lattice' ? 'About 12-Fold Lattice Model' : 
                   projectionModel === 'montecarlo' ? 'About Monte Carlo Simulation' : 
                   'About 12-Fold Lattice Model'}
                </span>
              </div>
              <svg
                className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${showModelInfo ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {showModelInfo && (
              <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                  {projectionModel === 'primetetration'
                    ? 'Prime Tetration Projections use the full crystalline 12-dimensional lattice with triadic prime exponentiation towers. Each projection line represents a different prime triad [p1,p2,p3] with amplitude A = base^(p2^p3) mod 2^72. The lattice oscillator Z(n) aggregates all 12 φ_d dimensions without dimension sweeping. All calculations use Q8 fixed-point truncation (+8 guard bits).'
                    : projectionModel === 'lattice' 
                    ? 'Projections use the 12-Fold Crystalline Periodic Lattice Model with Z_n^(d), L(n,d,k,λ), and Γ(n,d) functions. This model incorporates prime number theory, entropy calculations, FFT-based oscillation detection, and dimensional frequencies φ_i = [3,7,31,12,19,5,11,13,17,23,29,31].'
                    : projectionModel === 'montecarlo'
                    ? 'Projections use Monte Carlo simulation with 10,000 iterations. The model calculates historical returns, estimates mean return and volatility, and simulates multiple price paths using normal distribution. The expected value is calculated from the mean of all simulated paths.'
                    : 'Projections use the 12-Fold Crystalline Periodic Lattice Model. This model incorporates prime number theory, entropy calculations, FFT-based oscillation detection, and dimensional frequencies φ_i = [3,7,31,12,19,5,11,13,17,23,29,31].'}
                </p>
              </div>
            )}
          </div>
        </div>
        <div className="h-[600px] relative">
          {chartData && 
           Array.isArray(chartData.labels) && 
           chartData.labels.length > 0 && 
           Array.isArray(chartData.datasets) && 
           chartData.datasets.length > 0 && 
           chartData.datasets[0] && 
           Array.isArray(chartData.datasets[0].data) && 
           chartData.datasets[0].data.some(d => d !== null && d !== undefined) ? (
            <>
              {loading && (
                <div className="absolute inset-0 bg-white/90 dark:bg-gray-800/90 z-10 flex items-center justify-center backdrop-blur-sm">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-200 border-t-blue-600 mx-auto"></div>
                  </div>
                </div>
              )}
              <Line
                key={`chart-${symbol}-${interval}-${projectionSteps}-${chartData.labels?.length || 0}`}
                data={{
                  labels: Array.isArray(chartData.labels) ? chartData.labels : [],
                  datasets: Array.isArray(chartData.datasets) ? chartData.datasets.map(dataset => ({
                    ...dataset,
                    data: Array.isArray(dataset.data) ? dataset.data : []
                  })) : []
                }}
                options={{
                  ...lineChartOptions.current,
                  responsive: true,
                  maintainAspectRatio: false,
                }}
                redraw
              />
            </>
          ) : loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
                <p className="text-gray-600 dark:text-gray-400 font-medium">Loading chart data...</p>
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">Please wait</p>
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                <p className="text-gray-600 dark:text-gray-400 font-medium mb-2">No chart data available</p>
                <p className="text-sm text-gray-500 dark:text-gray-500">Please try searching again or check the symbol</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Projection;
