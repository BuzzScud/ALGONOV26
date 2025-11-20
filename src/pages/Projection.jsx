/**
 * IMPROVED CRYSTALLINE PROJECTION ENGINE
 * =======================================
 * 
 * Mathematical Enhancements Integrated from Research:
 * 
 * 1. Ψ(p,q) - Plimpton Triple Modulator
 *    Formula: Ψ = (p² - q²)/(p² + q²)
 *    Provides prime-based modulation for projection stability
 * 
 * 2. θ(i, Ψ, λ, ω) - Theta Step Function
 *    Formula: θ = k·π·(1 - Ψ) + ν(λ)·(π/180) + Ω_phase(ω)
 *    Combines Plimpton modulation, phonetic values, and cymatic frequencies
 * 
 * 3. g(i) - Recursive 3^θ Growth Step
 *    Formula: g_i = g_{i-1} · 3^(θ/100) · (1 + τ/1000)
 *    where τ = log(p1·p2·p3)/log(3)
 *    Implements self-similar recursive growth
 * 
 * 4. 12-Sector Crystalline Lattice
 *    - Each projection uses 12 sectors with quadrant-based polarity
 *    - Möbius parity twist: Γ(k) = (-1)^k
 *    - Phonetic modulation: ν(λ) maps dub=3, kubt=5, k'anch=7
 *    - Omega phase gate: Ω(ω) for cymatic frequency integration (432Hz, 528Hz, etc.)
 * 
 * 5. Q8 Fixed-Point Arithmetic
 *    - 72-bit modular arithmetic with 8 guard bits
 *    - Precise amplitude calculations using modular exponentiation
 *    - PRIME EXPONENTIATION TOWERS: base^(p1^(p2^p3)) using triadic prime sets [p1, p2, p3]
 *    - CRITICAL: This is NOT generic tetration (x^x^x), but specifically prime-based towers
 *    - Example: 2^(5^(7^11)) for triadic set [5, 7, 11]
 *    - First 500 primes are hardcoded in PRIMES_500
 *    - Triadic sets MUST contain primes (or explicitly allowed coprimes like 12 or 15)
 * 
 * 6. Projection Formula
 *    For each step i in [0..N]:
 *      - Calculate λ = lambdaSchedule[i mod len]
 *      - Calculate ω = omegaSchedule[i mod len]
 *      - Compute θ_i using Plimpton modulation
 *      - Update g_i recursively with 3^θ growth
 *      - Calculate lattice sum over 12 sectors with polarities
 *      - Scale by depth (log(prime)/log(2)) and triad factor (τ)
 *      - Projection: P_i = lastPrice + Δ_i
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
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
import zoomPlugin from 'chartjs-plugin-zoom';
import { Line } from 'react-chartjs-2';
import { getPriceChartData } from '../services/monitorService';
import { saveProjection } from '../services/projectionService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  zoomPlugin
);

// Dimensional frequencies φ_i (Phonon Correction) - Full crystalline 12-d set
// Primarily uses primes, with EXPLICIT coprime exception: 12 is coprime to 5,7,11,13,17,19,23,29,31
// This is similar to Enigma device using (11, 15, 17) where 15 = 3×5 is coprime to 3*5
// IMPORTANT: 12 is an explicitly chosen coprime exception, NOT a prime
// All other values are primes: [3, 7, 31, 19, 5, 11, 13, 17, 23, 29, 31]
const PHI_D = [3, 7, 31, 12, 19, 5, 11, 13, 17, 23, 29, 31];

// Prime Exponentiation Tower depth - MUST be prime
// CRITICAL: This is NOT generic tetration (x^x^x), but PRIME EXPONENTIATION TOWERS
// Prime exponentiation towers use triadic prime sets: base^(p1^(p2^p3)) where p1,p2,p3 are primes
// Example: 2^(5^(7^11)) for triadic set [5, 7, 11]
// The depth prime (31) is used to select triadic sets from PRIMES_500
// DO NOT confuse this with generic tetration - these are fundamentally different
const TETRATION_DEPTH = 31; // 11th prime - used for selecting triadic sets, NOT for generic tetration

// Prime depth slider stops (tetration depth primes)
const PRIME_STOPS = [11, 13, 17, 29, 31, 47, 59, 61, 97, 101];

// Q8 Fixed-point constants (72-bit with +8 guard bits)
const MOD_BITS = 72n; // 64 + 8 guard bits
const MOD = 1n << MOD_BITS; // 2^72
const LAMBDA = 1n << (MOD_BITS - 2n); // 2^(72-2) for odd base cycles
const Q_FRAC_BITS = 8n; // +8 bits computations
const OUTPUT_SCALE = 1n << 64n; // after truncation, map to 64-bit fractional space
const Q8 = 1 << 8; // 256

// Crystalline lattice constants
const SECTORS = 12; // 12-sector lattice (crystalline basis)
const TWO_PI = Math.PI * 2;
const PHI_VEC = [3, 7, 31, 12, 19, 5, 11, 13, 17, 23, 29, 31]; // Full φ-vector

// Lambda schedule (phonetic modulation)
const LAMBDA_DEFAULT = ['dub', 'kubt', "k'anch", 'dub', 'kubt', "k'anch"];

// Projection colors
const COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#84cc16',
  '#06b6d4', '#a855f7', '#22c55e'
];

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

// Ψ(p, q) - Plimpton Triple Modulator
// Computes (p² - q²) / (p² + q²) for prime pairs
function psiPlimpton(p, q) {
  const p2 = p * p;
  const q2 = q * q;
  return (p2 - q2) / (p2 + q2);
}

// Ψ(depth) - Compute psi from depth prime
function psiFromDepth(depthPrime) {
  // Use depthPrime and its neighbor for Plimpton modulation
  const idx = PRIME_STOPS.indexOf(depthPrime);
  if (idx === -1) return psiPlimpton(depthPrime, depthPrime - 2);
  const p = depthPrime;
  const q = idx > 0 ? PRIME_STOPS[idx - 1] : 2;
  return psiPlimpton(p, q);
}

// ν(λ) - Phonetic value mapping
// Formula: ν(λ) = 3^λ mod 3 for numeric lambda
// Also maps phonetic strings: ν(dub) = 3, ν(kubt) = 5, ν(k'anch) = 7
function nuLambda(lambda) {
  if (lambda === 'dub') return 3;
  if (lambda === 'kubt') return 5;
  if (lambda === "k'anch" || lambda === "k'anchay") return 7;
  if (typeof lambda === 'number') {
    // Formula: ν(λ) = 3^λ mod 3
    return Math.pow(3, lambda) % 3;
  }
  return 3; // default
}

// Ω(ω) - Omega gate (cymatic frequency phase)
function omegaGate(omegaHz) {
  // Map Hz to phase angle
  // 432 Hz → 0°, 528 Hz → 90°, etc.
  const baseFreq = 432;
  const ratio = omegaHz / baseFreq;
  const phase = (Math.log(ratio) / Math.log(2)) * (Math.PI / 2);
  return { phase, magnitude: Math.sqrt(ratio) };
}

// ω(i) - Omega schedule at step i
function omegaAt(i, schedule) {
  if (Array.isArray(schedule)) {
    return schedule[i % schedule.length];
  }
  return schedule; // single value
}

// θ(i, Ψ, λ, ω) - Theta step function (legacy, for computeCrystallineProjection)
// This uses the complete formula: θ(n,k,λ,ω,ψ) = k·π·(1 + √5) + n·2π/12 + log3(ν(λ)) + ω/432 + p² - q²
function thetaStep(i, psi, lambda, omegaHz, depthPrime = 31) {
  const n = i;
  const k = i;
  
  // Pass depthPrime to calculateTheta so it can extract p and q
  // If psi is already a number (depthPrime), pass it directly
  const psiValue = typeof psi === 'number' ? psi : depthPrime;
  
  // Use the complete theta formula with depthPrime for p,q extraction
  return calculateTheta(n, k, lambda, omegaHz, psiValue, depthPrime);
}

// g(i) - Recursive 3^θ growth step
function growthStep(gPrev, theta, omegaHz, triad) {
  // g_i = g_{i-1} · 3^(θ/100) · (1 + τ/1000)
  // where τ = log(p1·p2·p3) / log(3)
  const triProd = triad.slice(0, 3).reduce((a, b) => a * b, 1);
  const tau = Math.log(triProd) / Math.log(3);
  const exponent = theta / 100;
  const base3Term = Math.pow(3, exponent);
  const tauTerm = 1 + tau / 1000;
  return gPrev * base3Term * tauTerm;
}

// Γ(k) - Möbius parity twist
function mobiusParity(k) {
  return Math.pow(-1, k);
}

// Truncate to Q8 precision
function trunc(x, decimals) {
  const multiplier = Math.pow(10, decimals);
  return Math.floor(x * multiplier) / multiplier;
}

// ==================== IMPROVED PROJECTION ENGINE ====================
// Compute projection using crystalline lattice with 12 sectors
function computeCrystallineProjection({
  lastPrice,
  depthPrime,
  omegaHz = 432,
  triad = [2, 5, 7],
  decimals = 8,
  lambdaSchedule = LAMBDA_DEFAULT,
  omegaSchedule = null,
  N = 120
}) {
  const psi = psiFromDepth(depthPrime);
  const triProd = triad.slice(0, 3).reduce((a, b) => a * b, 1);
  const tau = Math.log(triProd) / Math.log(3);
  
  // Initialize growth factor
  let g = 1 + 0.01 * tau + 0.001 * (depthPrime % 7);
  
  const points = [];
  
  for (let i = 0; i < N; i++) {
    // Get lambda and omega for this step
    const lambda = lambdaSchedule[i % lambdaSchedule.length];
    const wHz = omegaAt(i, omegaSchedule || omegaHz);
    
    // Calculate theta for this step using correct formula
    const theta_i = thetaStep(i, psi, lambda, wHz, depthPrime);
    
    // Update growth recursively
    g = growthStep(g, theta_i, wHz, triad);
    
    // Calculate lattice sum across all 12 sectors
    let latticeSum = 0;
    
    for (let s = 0; s < SECTORS; s++) {
      // Base angle for this sector
      const angleBase = (i) * (TWO_PI / SECTORS) + (s * TWO_PI / SECTORS);
      
      // Add φ-vector component for this sector
      const phiTerm = (PHI_VEC[s] % 360) * (Math.PI / 180);
      
      // Add phonetic nudge
      const nuVal = nuLambda(lambda);
      const lambdaNudge = (nuVal % 3) * (Math.PI / 360);
      
      // Add omega phase
      const { phase: omegaPhase } = omegaGate(wHz);
      
      // Calculate quadrant and polarities
      const quadrant = Math.floor(s / 3);
      const polQuad = ((quadrant % 2) === 0) ? 1 : -1; // Alternating quadrants
      const polMob = ((i + s) % 2 === 0) ? 1 : -1; // Möbius twist
      
      // Complete angle
      const ang = angleBase + phiTerm + lambdaNudge + 0.5 * omegaPhase;
      
      // Calculate term with all components
      const base = Math.cos(ang);
      const gNorm = Math.tanh(g / 1e5);
      const term = base * polQuad * polMob * psi * (1 + 0.5 * gNorm);
      
      latticeSum += term;
    }
    
    // Scale by depth and triad
    const depthScale = Math.log(depthPrime) / Math.log(2);
    const triScale = Math.max(1, tau);
    const delta = trunc(latticeSum * depthScale * 0.5 * triScale, decimals);
    
    // Calculate price point
    const pricePoint = trunc(lastPrice + delta, decimals);
    
    points.push({ x: i, y: pricePoint });
  }
  
  return points;
}

// Compute triadic prime tower amplitude A = base^(p2^p3) mod 2^(64+8),
// with exponent reduced mod λ(2^k) since base is odd and gcd(base, 2^k)=1.
// CRITICAL: Triadic set MUST contain primes (or explicitly allowed coprimes)
// This is a PRIME EXPONENTIATION TOWER, NOT generic tetration
function amplitudeFromTriad(base, triad) {
  // Validate triadic set contains primes (no coprimes allowed for amplitude calculations)
  validateTriadicSet(triad, false);
  
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

// First 500 primes - HARDCODED for prime exponentiation towers
// These primes are used to generate triadic sets [p1, p2, p3] for prime exponentiation towers
// Example: [5, 7, 11] creates tower base^(5^(7^11))
// Generated using Sieve of Eratosthenes, hardcoded for performance and determinism
const PRIMES_500 = [2,3,5,7,11,13,17,19,23,29,31,37,41,43,47,53,59,61,67,71,73,79,83,89,97,101,103,107,109,113,127,131,137,139,149,151,157,163,167,173,179,181,191,193,197,199,211,223,227,229,233,239,241,251,257,263,269,271,277,281,283,293,307,311,313,317,331,337,347,349,353,359,367,373,379,383,389,397,401,409,419,421,431,433,439,443,449,457,461,463,467,479,487,491,499,503,509,521,523,541,547,557,563,569,571,577,587,593,599,601,607,613,617,619,631,641,643,647,653,659,661,673,677,683,691,701,709,719,727,733,739,743,751,757,761,769,773,787,797,809,811,821,823,827,829,839,853,857,859,863,877,881,883,887,907,911,919,929,937,941,947,953,967,971,977,983,991,997,1009,1013,1019,1021,1031,1033,1039,1049,1051,1061,1063,1069,1087,1091,1093,1097,1103,1109,1117,1123,1129,1151,1153,1163,1171,1181,1187,1193,1201,1213,1217,1223,1229,1231,1237,1249,1259,1277,1279,1283,1289,1291,1297,1301,1303,1307,1319,1321,1327,1361,1367,1373,1381,1399,1409,1423,1427,1429,1433,1439,1447,1451,1453,1459,1471,1481,1483,1487,1489,1493,1499,1511,1523,1531,1543,1549,1553,1559,1567,1571,1579,1583,1597,1601,1607,1609,1613,1619,1621,1627,1637,1657,1663,1667,1669,1693,1697,1699,1709,1721,1723,1733,1741,1747,1753,1759,1777,1783,1787,1789,1801,1811,1823,1831,1847,1861,1867,1871,1873,1877,1879,1889,1901,1907,1913,1931,1933,1949,1951,1973,1979,1987,1993,1997,1999,2003,2011,2017,2027,2029,2039,2053,2063,2069,2081,2083,2087,2089,2099,2111,2113,2129,2131,2137,2141,2143,2153,2161,2179,2203,2207,2213,2221,2237,2239,2243,2251,2267,2269,2273,2281,2287,2293,2297,2309,2311,2333,2339,2341,2347,2351,2357,2371,2377,2381,2383,2389,2393,2399,2411,2417,2423,2437,2441,2447,2459,2467,2473,2477,2503,2521,2531,2539,2543,2549,2551,2557,2579,2591,2593,2609,2617,2621,2633,2647,2657,2659,2663,2671,2677,2683,2687,2689,2693,2699,2707,2711,2713,2719,2729,2731,2741,2749,2753,2767,2777,2789,2791,2797,2801,2803,2819,2833,2837,2843,2851,2857,2861,2879,2887,2897,2903,2909,2917,2927,2939,2953,2957,2963,2969,2971,2999,3001,3011,3019,3023,3037,3041,3049,3061,3067,3079,3083,3089,3109,3119,3121,3137,3163,3167,3169,3181,3187,3191,3203,3209,3217,3221,3229,3251,3253,3257,3259,3271,3299,3301,3307,3313,3319,3323,3329,3331,3343,3347,3359,3361,3371,3373,3389,3391,3407,3413,3433,3449,3457,3461,3463,3467,3469,3491,3499,3511,3517,3527,3529,3533,3539,3541,3547,3557,3559,3571];

// Generate triadic prime sets near a given prime depth pDepth
// Build 11–13 triads centered around pDepth using sequential primes from PRIMES_500
// Each triadic set is [p[i], p[i+1], p[i+2]] where all values are primes
// These triadic sets are used for prime exponentiation towers: base^(p1^(p2^p3))
function generateTriadsAroundPrime(pDepth, count, primes) {
  if (!isPrime(pDepth)) {
    throw new Error(`Depth must be a prime number, got: ${pDepth}. Prime exponentiation towers require prime-based depth.`);
  }
  
  const idx = primes.indexOf(pDepth);
  if (idx === -1) {
    throw new Error(`Depth prime ${pDepth} not found in PRIMES_500. Prime exponentiation towers must use primes from the hardcoded list.`);
  }
  
  const triads = [];
  const half = Math.floor(count / 2);
  
  for (let offset = -half; offset <= half; offset++) {
    if (triads.length >= count) break;
    const i = Math.max(0, Math.min(primes.length - 3, idx + offset));
    
    // Create triadic set: [p[i], p[i+1], p[i+2]]
    // All values are guaranteed to be primes since they come from PRIMES_500
    const triad = [primes[i], primes[i + 1], primes[i + 2]];
    
    // Validate the triadic set (should always pass since from PRIMES_500, but safety check)
    try {
      validateTriadicSet(triad, false); // No coprimes allowed in auto-generated sets
      triads.push(triad);
    } catch (err) {
      console.error(`Invalid triadic set generated: ${JSON.stringify(triad)}`, err);
      throw new Error(`Failed to generate valid triadic set: ${err.message}`);
    }
  }
  
  return triads;
}

// Prime Exponentiation Tower: Compute base^(p1^(p2^p3)) using triadic prime sets
// This is NOT generic tetration (x^x^x), but specifically prime-based towers
// Example: 2^(5^(7^11)) for triadic set [5,7,11]
// The base is typically 2 or 3, and the tower is built from primes
// CRITICAL: Triadic sets MUST contain primes (or explicitly allowed coprimes like 12 or 15)
function primeExponentiationTower(base, primeTriad, useModular = true, allowCoprimes = false) {
  if (!primeTriad || primeTriad.length === 0) {
    throw new Error('Prime exponentiation tower requires a triadic set [p1, p2, p3]');
  }
  
  // Validate that triadic set contains primes (or explicitly allowed coprimes)
  validateTriadicSet(primeTriad, allowCoprimes);
  
  // For triadic sets [p1, p2, p3], compute base^(p1^(p2^p3))
  // Build from the top down: p2^p3 first, then p1^result, then base^result
  
  if (useModular) {
    // Use modular arithmetic for large towers to prevent overflow
    // Compute using Euler's theorem and modular exponentiation
    const [p1, p2, p3] = primeTriad;
    
    // First compute p2^p3 mod LAMBDA (for reduction)
    const topExponent = modPow(BigInt(p2), BigInt(p3), LAMBDA);
    
    // Then compute p1^topExponent mod LAMBDA
    const middleExponent = modPow(BigInt(p1), topExponent, LAMBDA);
    
    // Finally compute base^middleExponent mod MOD
    const result = modPow(BigInt(base), middleExponent, MOD);
    
    // Convert to float in reasonable range
    return Number(result) / Number(1n << 32n); // Scale down from 72-bit space
  } else {
    // Logarithmic method for non-modular computation
    // log(base^(p1^(p2^p3))) = (p1^(p2^p3)) * log(base)
    const [p1, p2, p3] = primeTriad;
    
    // Compute p2^p3 safely
    let exponent = Math.log(p2) * p3; // log(p2^p3)
    if (exponent > 100) exponent = 100; // Cap to prevent overflow
    let p2ToPowerP3 = Math.exp(exponent);
    if (p2ToPowerP3 > 1000) p2ToPowerP3 = 1000; // Cap
    
    // Compute p1^(p2^p3) safely
    exponent = Math.log(p1) * p2ToPowerP3;
    if (exponent > 700) exponent = 700; // Cap to prevent exp overflow
    
    // Final result: base^(p1^(p2^p3))
    const finalResult = Math.exp(exponent * Math.log(base));
    return isFinite(finalResult) ? finalResult : Number.MAX_SAFE_INTEGER;
  }
}

// DEPRECATED: Legacy tetration wrapper - DO NOT USE
// This function name is confusing because it suggests generic tetration (x^x^x),
// but we actually use PRIME EXPONENTIATION TOWERS: base^(p1^(p2^p3)) with triadic prime sets
// 
// Use primeExponentiationTower() directly with explicit triadic sets instead.
// Example: primeExponentiationTower(2, [5, 7, 11]) for 2^(5^(7^11))
//
// This wrapper is kept only for backward compatibility but should be removed.
// It converts a depth index to a triadic set, which is not the correct way to use prime towers.
function tetration(base, depth) {
  console.warn(
    'WARNING: tetration() is deprecated. Use primeExponentiationTower() with explicit triadic sets instead. ' +
    'Example: primeExponentiationTower(2, [5, 7, 11]) for prime exponentiation tower 2^(5^(7^11))'
  );
  
  // Convert depth to a prime-based triadic set from PRIMES_500
  // Use depth as index into PRIMES_500 to select triadic set
  const primeIndex = Math.min(depth, PRIMES_500.length - 3);
  const triad = [
    PRIMES_500[primeIndex % PRIMES_500.length],
    PRIMES_500[(primeIndex + 1) % PRIMES_500.length],
    PRIMES_500[(primeIndex + 2) % PRIMES_500.length]
  ];
  
  return primeExponentiationTower(base, triad, false);
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

// Explicitly allowed coprimes for triadic sets (like Enigma device using 15 coprime to 3*5)
// These are exceptions to the prime-only rule and must be explicitly chosen
// Example: (11, 15, 17) where 15 is coprime to 3*5
const ALLOWED_COPRIMES = [12, 15]; // 12 is coprime to 5,7,11,13,17,19,23,29,31; 15 is coprime to 3*5

// Validate triadic set: ensures all values are primes OR explicitly allowed coprimes
// Triadic sets for prime exponentiation towers MUST be [p1, p2, p3] where p1, p2, p3 are primes
// Exception: explicitly allowed coprimes (like 12 or 15) may be used if explicitly chosen
function validateTriadicSet(triad, allowCoprimes = false) {
  if (!Array.isArray(triad) || triad.length !== 3) {
    throw new Error(`Triadic set must be array of exactly 3 elements, got: ${JSON.stringify(triad)}`);
  }
  
  for (const value of triad) {
    if (!Number.isInteger(value) || value < 2) {
      throw new Error(`Triadic set values must be integers >= 2, got: ${JSON.stringify(triad)}`);
    }
    
    // Check if it's a prime
    if (isPrime(value)) {
      continue; // Valid prime
    }
    
    // Check if it's an explicitly allowed coprime
    if (allowCoprimes && ALLOWED_COPRIMES.includes(value)) {
      continue; // Valid coprime exception
    }
    
    // Not a prime and not an allowed coprime
    throw new Error(
      `Triadic set contains non-prime value ${value} which is not an explicitly allowed coprime. ` +
      `Triadic sets for prime exponentiation towers must contain primes. ` +
      `Allowed coprimes (if explicitly chosen): ${ALLOWED_COPRIMES.join(', ')}. ` +
      `Got: ${JSON.stringify(triad)}`
    );
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

// ν(λ) - Phonetic Value
// Formula: ν(λ) = 3^λ mod 3
// Also maps phonetic strings: ν(dub) = 3, ν(kubt) = 5, ν(k'anch) = 7
function calculateNu(lambda) {
  // Handle phonetic strings
  if (lambda === 'dub') return 3;
  if (lambda === 'kubt') return 5;
  if (lambda === "k'anch" || lambda === "k'anchay") return 7;
  
  // For numeric lambda: ν(λ) = 3^λ mod 3
  if (typeof lambda === 'number') {
    return Math.pow(3, lambda) % 3;
  }
  
  // Default fallback
  return 3;
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

// θ(n, k, λ, ω, ψ) - Complete Theta Function
// Formula: θ(n,k,λ,ω,ψ) = k·π·(1 + √5) + n·2π/12 + log3(ν(λ)) + ω/432 + p² - q²
// Where p and q come from ψ (Plimpton triple)
// psi can be: a number (depthPrime), an object {p, q}, or null (will use default depthPrime=31)
function calculateTheta(n, k, lambda, omega, psi, depthPrime = 31) {
  const goldenRatio = (1 + Math.sqrt(5)) / 2; // (1 + √5)
  const PI = Math.PI;
  
  // k·π·(1 + √5)
  const term1 = k * PI * goldenRatio;
  
  // n·2π/12
  const term2 = n * 2 * PI / 12;
  
  // log3(ν(λ)) = log(ν(λ)) / log(3)
  const nuLambda = calculateNu(lambda);
  // Handle case where nuLambda might be 0 (would cause log(0) = -Infinity)
  const nuValue = nuLambda > 0 ? nuLambda : 1;
  const term3 = Math.log(nuValue) / Math.log(3);
  
  // ω/432 (omega in Hz, default 144000 if not provided, but formula uses ω/432)
  const omegaValue = omega || 144000;
  const term4 = omegaValue / 432;
  
  // p² - q² from Plimpton triple (psi)
  // Extract p and q from psi or depth prime
  let term5 = 0;
  if (psi && typeof psi === 'object' && psi.p && psi.q) {
    // If psi is an object with p and q
    term5 = psi.p * psi.p - psi.q * psi.q;
  } else if (typeof psi === 'number') {
    // If psi is a depth prime number, extract p and q
    const idx = PRIME_STOPS.indexOf(psi);
    const p = psi;
    const q = idx > 0 ? PRIME_STOPS[idx - 1] : 2;
    term5 = p * p - q * q;
  } else {
    // Default: use depthPrime parameter or fallback to 31
    const dp = depthPrime || 31;
    const idx = PRIME_STOPS.indexOf(dp);
    const p = dp;
    const q = idx > 0 ? PRIME_STOPS[idx - 1] : 2;
    term5 = p * p - q * q;
  }
  
  return term1 + term2 + term3 + term4 + term5;
}

// Z_n^(d) - The main lattice formula
// Formula: Z_n^(d) = 3^((n-1)·2π/12/ln3) · cos((n-1)·2π/12 · Φ_d)
// Exact formula from screenshots - no prime tower scaling
function calculateZ(n, d) {
  if (d < 0 || d >= PHI_D.length) return 0;
  
  const phi_d = PHI_D[d];
  
  // Exponent: (n-1)·2π/12/ln3
  const exponent = ((n - 1) * 2 * Math.PI / 12) / Math.log(3);
  
  // 3^exponent - direct calculation
  const baseValue = Math.pow(3, exponent);
  
  // Cosine argument: (n-1)·2π/12 · Φ_d
  const cosineArg = (n - 1) * 2 * Math.PI / 12 * phi_d;
  
  return baseValue * Math.cos(cosineArg);
}

// P_n^(d)(k) - Projection function
// Formula: P_n^(d)(k) = [12^(θ(k,n)/ln(12) - ln(3))] · Π_{i=1}^d cos(θ(k,n) · φ_i)
// Note: θ(k,n) means theta with k and n parameters (lambda=0, omega=144000, psi=null for basic version)
function calculateP(n, d, k, historicalPrices, lambda = 0, omega = 144000, psi = null) {
  if (d < 0 || d >= PHI_D.length) return 0;
  
  // Calculate theta: θ(k,n) - note the parameter order in formula is θ(k,n)
  const theta = calculateTheta(n, k, lambda, omega, psi);
  
  // Exponent: θ(k,n)/ln(12) - ln(3)
  const exponent = theta / Math.log(12) - Math.log(3);
  
  // 12^exponent - direct calculation, no prime tower scaling
  const baseTerm = Math.pow(12, exponent);
  
  // Product of cosines: Π_{i=1}^d cos(θ(k,n) · φ_i)
  let product = 1;
  for (let i = 0; i <= d && i < PHI_D.length; i++) {
    product *= Math.cos(theta * PHI_D[i]);
  }
  
  return baseTerm * product;
}

// L(n, d, k, λ) - Lattice Output function
// Formula: L(n,d,k,λ) = 3^(θ(n,k,λ)) · Π_{i=1}^d cos(θ(n,k,λ) · φ_i) · Γ(k) · ν(λ) · Γ(n,d)
// Exact formula from screenshots - no prime tower scaling, direct calculation
function calculateL(n, d, k, lambda, historicalPrices, omega = 144000, psi = null) {
  if (d < 0 || d >= PHI_D.length) return 0;
  
  // Calculate theta with all parameters
  const theta = calculateTheta(n, k, lambda, omega, psi);
  
  // 3^(θ(n,k,λ)) - direct exponentiation, no scaling
  const threeToTheta = Math.pow(3, theta);
  
  // Product of cosines: Π_{i=1}^d cos(θ(n,k,λ) · φ_i)
  let cosineProduct = 1;
  for (let i = 0; i <= d && i < PHI_D.length; i++) {
    cosineProduct *= Math.cos(theta * PHI_D[i]);
  }
  
  // Γ(k) = (-1)^k (Möbius duality twist)
  const gammaK = calculateMobiusGamma(k);
  
  // ν(λ) = 3^λ mod 3
  const nuLambda = calculateNu(lambda);
  
  // Γ(n,d) = log₂(count of primes in d / entropy of lattice points)
  const gammaND = calculateGamma(n, d, historicalPrices);
  
  // Complete formula: L(n,d,k,λ) = 3^θ · Π cos(θ·φ_i) · Γ(k) · ν(λ) · Γ(n,d)
  return threeToTheta * cosineProduct * gammaK * nuLambda * gammaND;
}

// C(n, d, k, λ, ω, ψ) - Complete Crystalline function
// Formula: C(n,d,k,λ,ω,ψ) = 3^(θ(n,k,λ,ω,ψ)) · Π_{i=1}^d [cos(θ(n,k,λ,ω,ψ) · φ_i)] · Γ(k) · ν(λ) · ω · Ψ(ψ) · Γ(n,d)
function calculateC(n, d, k, lambda, omega, psi, historicalPrices) {
  if (d < 0 || d >= PHI_D.length) return 0;
  
  // Calculate theta with all parameters
  const theta = calculateTheta(n, k, lambda, omega, psi);
  
  // 3^(θ(n,k,λ,ω,ψ))
  const threeToTheta = Math.pow(3, theta);
  
  // Product of cosines: Π_{i=1}^d [cos(θ(n,k,λ,ω,ψ) · φ_i)]
  let cosineProduct = 1;
  for (let i = 0; i <= d && i < PHI_D.length; i++) {
    cosineProduct *= Math.cos(theta * PHI_D[i]);
  }
  
  // Γ(k) = (-1)^k
  const gammaK = calculateMobiusGamma(k);
  
  // ν(λ) = 3^λ mod 3
  const nuLambda = calculateNu(lambda);
  
  // ω term (omega value, normalized)
  const omegaTerm = omega / 144000;
  
  // Ψ(ψ) - Plimpton triple generator
  // If psi is a number (from psiFromDepth), we need to extract p and q
  let psiValue = 1;
  if (typeof psi === 'number') {
    // psi is already (p² - q²) / (p² + q²) from psiPlimpton
    // For Ψ(ψ), we use the Plimpton ratio
    psiValue = psi;
  } else if (psi && typeof psi === 'object' && psi.p && psi.q) {
    // Calculate Plimpton ratio
    const p2 = psi.p * psi.p;
    const q2 = psi.q * psi.q;
    psiValue = (p2 - q2) / (p2 + q2);
  } else {
    // Default: use depth prime
    const depthPrime = 31;
    const idx = PRIME_STOPS.indexOf(depthPrime);
    const p = depthPrime;
    const q = idx > 0 ? PRIME_STOPS[idx - 1] : 2;
    const p2 = p * p;
    const q2 = q * q;
    psiValue = (p2 - q2) / (p2 + q2);
  }
  
  // Γ(n,d) = log₂(count of primes in d / entropy of lattice points)
  const gammaND = calculateGamma(n, d, historicalPrices);
  
  // Complete formula: C(n,d,k,λ,ω,ψ) = 3^θ · Π cos(θ·φ_i) · Γ(k) · ν(λ) · ω · Ψ(ψ) · Γ(n,d)
  return threeToTheta * cosineProduct * gammaK * nuLambda * omegaTerm * psiValue * gammaND;
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

// Recursive self-similar lattice calculation at depth level
// Uses correct L(n,d,k,λ) formula: 3^(θ(n,k,λ)) · Π_{i=1}^d cos(θ(n,k,λ) · φ_i) · Γ(k) · ν(λ) · Γ(n,d)
function recursiveLatticeLayer(n, d, k, lambda, depth, maxDepth, effectivePrimes, historicalPrices, omega = 144000, psi = null) {
  if (depth > maxDepth) return 1;
  
  // Self-similar scaling factor based on depth (fractal structure)
  const depthScale = Math.pow(2, -depth); // Each layer is half the scale (self-similar)
  
  // Calculate theta with correct formula: θ(n,k,λ,ω,ψ) = k·π·(1 + √5) + n·2π/12 + log3(ν(λ)) + ω/432 + p² - q²
  const baseTheta = calculateTheta(n, k, lambda, omega, psi);
  // Apply self-similar scaling at this depth
  const theta = baseTheta * depthScale;
  
  // 3^(θ(n,k,λ)) - direct exponentiation, no prime tower scaling
  const threeToTheta = Math.pow(3, theta);
  
  // Recursive cosine product with self-similar structure
  let cosineProduct = 1;
  for (let i = 0; i <= d && i < effectivePrimes.length; i++) {
    const phi = effectivePrimes[i];
    // Current layer contribution with self-similar scaling
    const layerContribution = Math.cos(theta * phi * depthScale);
    cosineProduct *= layerContribution;
    
      // Recursively calculate next layer if not at max depth (self-similar recursion)
      if (depth < maxDepth) {
        // Recursive layer uses same L(n,d,k,λ) formula with self-similar scaling
        const recursiveLayer = recursiveLatticeLayer(n, d, k, lambda, depth + 1, maxDepth, effectivePrimes, historicalPrices, omega, psi);
        // Multiply by recursive contribution (self-similar structure)
        cosineProduct *= recursiveLayer;
      }
  }
  
  // Apply gamma and nu with correct formulas
  const gammaK = calculateMobiusGamma(k);
  const nuLambda = calculateNu(lambda); // ν(λ) = 3^λ mod 3
  const gammaND = calculateGamma(n, d, historicalPrices);
  
  // Combine with recursive self-similar structure
  // Each layer contributes with its depth scale (fractal structure)
  // Using L(n,d,k,λ) formula: 3^θ · Π cos(θ·φ_i) · Γ(k) · ν(λ) · Γ(n,d)
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
          
          // Z calculation using exact formula: Z_n^(d) = 3^((n-1)·2π/12/ln3) · cos((n-1)·2π/12 · Φ_d)
          // No prime tower scaling - direct calculation as per FORMULA_REFINEMENTS.md
          const exponent = ((n_new - 1) * 2 * Math.PI / 12) / Math.log(3);
          const cosineArg = (n_new - 1) * 2 * Math.PI / 12 * phi_d + oscillationPhase;
          const baseValue = Math.pow(3, exponent); // Direct calculation, no scaling
          const zValue = baseValue * Math.cos(cosineArg);
          
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
          
          // P function using exact formula: P_n^(d)(k) = [12^(θ(k,n)/ln(12) - ln(3))] · Π_{i=1}^d cos(θ(k,n) · φ_i)
          // No prime tower scaling - direct calculation as per FORMULA_REFINEMENTS.md
          const thetaBase = calculateTheta(n_new, step, 0, 144000, 0);
          const theta = thetaBase + oscillationPhase * phi_d; // Modulate theta with oscillation
          const exponentP = theta / Math.log(12) - Math.log(3);
          const baseTerm = Math.pow(12, exponentP); // Direct calculation, no scaling
          
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
function calculatePrimeTetrationProjection(
  historicalPrices, 
  horizon, 
  base, 
  triads, 
  beta = 0.01,
  depthPrime = 31,
  baseOmegaHz = 432,
  useLambdaSchedule = true,
  useOmegaSchedule = false
) {
  if (historicalPrices.length < 2) {
    return { lines: [] };
  }

  const lastPrice = historicalPrices[historicalPrices.length - 1];
  const lines = [];

  // Build projections for each triad using improved crystalline engine
  for (let li = 0; li < triads.length; li++) {
    const triad = triads[li];
    const A72 = amplitudeFromTriad(base, triad);
    const aSym = amplitudeToSymmetric(A72); // [-1,1)

    // Use the improved crystalline projection engine
    // Vary omega for each projection if schedule is enabled
    const omegaHz = useOmegaSchedule 
      ? baseOmegaHz + (li * 96)  // 432, 528, 624, 720, ...
      : baseOmegaHz;              // Fixed frequency
    const decimals = 8;
    
    try {
      const projectionPoints = computeCrystallineProjection({
        lastPrice,
        depthPrime,
        omegaHz,
        triad,
        decimals,
        lambdaSchedule: useLambdaSchedule ? LAMBDA_DEFAULT : ['dub'],
        omegaSchedule: useOmegaSchedule ? [432, 528, 432, 528] : null,
        N: horizon
      });
      
      // Extract prices from points
      const prices = projectionPoints.map(pt => pt.y);
      const q8Points = prices.map(toQ8);
      
      // Calculate oscillation stats
      let zeroCross = 0;
      let extrema = 0;
      
      for (let n = 1; n < prices.length; n++) {
        const Z = latticeOscillatorZ(n);
        const prevZ = latticeOscillatorZ(n - 1);
        
        // Zero crossings
        if ((Z > 0 && prevZ <= 0) || (Z < 0 && prevZ >= 0)) {
          zeroCross++;
        }
        
        // Turning points (local extrema)
        if (n > 1 && n < prices.length - 1) {
          const prev = prices[n - 1];
          const curr = prices[n];
          const next = prices[n + 1];
          
          if ((curr > prev && curr > next) || (curr < prev && curr < next)) {
            extrema++;
          }
        }
      }

      lines.push({
        triad, // [p1, p2, p3]
        base, // 2 or 3
        aQ8: (A72 >> Q_FRAC_BITS).toString(), // truncated amplitude
        pointsQ8: q8Points, // projected prices in Q8 integers
        points: prices, // float prices for display
        zeroCrossings: zeroCross,
        turningPoints: extrema,
        omega: omegaHz, // Store omega used for this projection
        depthPrime // Store depth prime used
      });
    } catch (err) {
      console.error(`Failed to compute crystalline projection for triad ${triad}:`, err);
      // Fallback to simple projection
      let p = lastPrice;
      const q8Points = [];
      let zeroCross = 0;
      let extrema = 0;

      for (let n = 1; n <= horizon; n++) {
        const Z = latticeOscillatorZ(n);
        const delta = beta * aSym * Z;
        p = p * (1 + delta);
        const q8 = toQ8(p);
        q8Points.push(q8);

        if (n > 1) {
          const prevZ = latticeOscillatorZ(n - 1);
          if ((Z > 0 && prevZ <= 0) || (Z < 0 && prevZ >= 0)) zeroCross++;
        }
      }

      lines.push({
        triad,
        base,
        aQ8: (A72 >> Q_FRAC_BITS).toString(),
        pointsQ8: q8Points,
        points: q8Points.map(fromQ8),
        zeroCrossings: zeroCross,
        turningPoints: extrema
      });
    }
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
  const location = useLocation();
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
  const [projectionModel, setProjectionModel] = useState('primetetration'); // 'primetetration'
  const [modelParams, setModelParams] = useState(null);
  const [showModelInfo, setShowModelInfo] = useState(false);
  const [stabilizedModel, setStabilizedModel] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [showModelParams, setShowModelParams] = useState(false);
  // Prime Tetration controls
  const [primeDepthIndex, setPrimeDepthIndex] = useState(4); // Default to index 4 = 31
  const [primeDepthInput, setPrimeDepthInput] = useState(PRIME_STOPS[4] || 31); // Local state for input field
  const [base, setBase] = useState(3); // Default seed base 3
  const [projectionCount, setProjectionCount] = useState(12); // Default 12 projections
  const [snapshotData, setSnapshotData] = useState(null); // Stores snapshot with multiple lines
  const [beta, setBeta] = useState(0.01); // Calibration factor
  const [omegaHz, setOmegaHz] = useState(432); // Cymatic frequency (432Hz default)
  const [useOmegaSchedule, setUseOmegaSchedule] = useState(false); // Toggle omega schedule
  const [useLambdaSchedule, setUseLambdaSchedule] = useState(true); // Toggle lambda schedule
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [projectionLoaded, setProjectionLoaded] = useState(false);
  const [loadedProjectionId, setLoadedProjectionId] = useState(null);
  const inputRef = useRef(null);
  const chartDataRef = useRef(null);
  const historicalPricesRef = useRef(null);
  const chartRef = useRef(null);
  const originalYMin = useRef(null);
  const originalYMax = useRef(null);

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
      zoom: {
        zoom: {
          wheel: {
            enabled: true,
            speed: 0.1,
          },
          pinch: {
            enabled: true,
          },
          mode: 'xy',
        },
        pan: {
          enabled: true,
          mode: 'xy',
          modifierKey: null,
          threshold: 10,
        },
        limits: {
          x: { min: 'original', max: 'original' },
          y: { min: 'original', max: 'original' },
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
            return date.toLocaleTimeString('en-US', { 
              hour: '2-digit', 
              minute: '2-digit',
              timeZone: 'America/New_York'
            });
          } else {
            return date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              timeZone: 'America/New_York'
            });
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
      if (projectionModel === 'primetetration' && projectionHours) {
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
          const snapshotResult = calculatePrimeTetrationProjection(
            historicalPrices, 
            stepsToUse, 
            base, 
            triads, 
            beta, 
            depthPrime, 
            omegaHz,
            useLambdaSchedule,
            useOmegaSchedule
          );
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
      } else {
        // Fallback to simple projection if Prime Tetration fails
        projectedPrices = calculateSimpleProjection(historicalPrices, stepsToUse);
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
      } else {
        setModelParams(null);
      }
      
      // Generate future labels for projections (using step-based labels)
      const projectedLabels = [];
      for (let i = 1; i <= stepsToUse; i++) {
        projectedLabels.push(`Step ${i}`);
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
            label: `${symbol.toUpperCase()} Projected (Prime Tetration)`,
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
        
        // Store original min/max for reset zoom functionality
        originalYMin.current = Math.max(0, minValue - padding);
        originalYMax.current = maxValue + padding;
        
        // Update chart options with calculated min/max
        lineChartOptions.current.scales.y.min = originalYMin.current;
        lineChartOptions.current.scales.y.max = originalYMax.current;
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

  // Load saved projection if navigating from Data page
  useEffect(() => {
    if (location.state?.loadProjection) {
      const savedProjection = location.state.loadProjection;
      
      // Mark that a projection was loaded
      setProjectionLoaded(true);
      setLoadedProjectionId(savedProjection.id || null);
      
      // Load all configuration parameters
      setSymbol(savedProjection.symbol || '');
      setInterval(savedProjection.interval || '1D');
      setProjectionModel(savedProjection.projectionModel || 'primetetration');
      setProjectionSteps(savedProjection.projectionSteps || 20);
      setProjectionHours(savedProjection.projectionHours || 48);
      
      if (savedProjection.projectionModel === 'primetetration') {
        setBase(savedProjection.base || 3);
        setProjectionCount(savedProjection.projectionCount || 12);
        const loadedIndex = savedProjection.primeDepthIndex !== undefined ? savedProjection.primeDepthIndex : 4;
        setPrimeDepthIndex(loadedIndex);
        setPrimeDepthInput(PRIME_STOPS[loadedIndex] || 31);
        setOmegaHz(savedProjection.omegaHz || 432);
        setUseLambdaSchedule(savedProjection.useLambdaSchedule !== undefined ? savedProjection.useLambdaSchedule : true);
        setUseOmegaSchedule(savedProjection.useOmegaSchedule || false);
      }
      
      // Load saved chart data if available
      if (savedProjection.chartData) {
        // Set historical prices ref for calculations
        if (savedProjection.chartData.historicalPrices && Array.isArray(savedProjection.chartData.historicalPrices)) {
          historicalPricesRef.current = savedProjection.chartData.historicalPrices;
        }
        
        // Restore chart data with all datasets and labels
        if (savedProjection.chartData.labels && savedProjection.chartData.datasets) {
          const restoredChartData = {
            labels: savedProjection.chartData.labels || [],
            datasets: (savedProjection.chartData.datasets || []).map(dataset => ({
              ...dataset,
              data: Array.isArray(dataset.data) ? dataset.data.map(d => d !== null && d !== undefined ? Number(d) : null) : [],
            })),
            currentPrice: savedProjection.chartData.currentPrice !== undefined ? Number(savedProjection.chartData.currentPrice) : null,
            change: savedProjection.chartData.change !== undefined ? Number(savedProjection.chartData.change) : null,
            changePercent: savedProjection.chartData.changePercent !== undefined ? Number(savedProjection.chartData.changePercent) : null,
            projectedPrice: savedProjection.chartData.projectedPrice !== undefined ? Number(savedProjection.chartData.projectedPrice) : null,
            projectedChange: savedProjection.chartData.projectedChange !== undefined ? Number(savedProjection.chartData.projectedChange) : null,
            projectedChangePercent: savedProjection.chartData.projectedChangePercent !== undefined ? Number(savedProjection.chartData.projectedChangePercent) : null,
          };
          
          // Calculate and store original min/max for reset zoom
          const allDataPoints = restoredChartData.datasets.flatMap(dataset => 
            (dataset.data || []).filter(d => d !== null && d !== undefined && !isNaN(d) && typeof d === 'number' && d > 0)
          );
          
          if (allDataPoints.length > 0) {
            const minValue = Math.min(...allDataPoints);
            const maxValue = Math.max(...allDataPoints);
            const range = maxValue - minValue;
            const padding = Math.max(range * 0.05, minValue * 0.01);
            
            originalYMin.current = Math.max(0, minValue - padding);
            originalYMax.current = maxValue + padding;
            
            // Update chart options
            lineChartOptions.current.scales.y.min = originalYMin.current;
            lineChartOptions.current.scales.y.max = originalYMax.current;
          }
          
          // Set chart data to display the saved chart
          setChartData(restoredChartData);
          chartDataRef.current = restoredChartData;
        }
      }
      
      // Load snapshot data for Prime Tetration if available
      if (savedProjection.snapshotData && savedProjection.projectionModel === 'primetetration') {
        setSnapshotData(savedProjection.snapshotData);
      }
      
      // Clear the state to prevent reloading on re-render
      window.history.replaceState({}, document.title);
      
      // Auto-hide the loaded message after 5 seconds
      setTimeout(() => {
        setProjectionLoaded(false);
      }, 5000);
    }
  }, [location.state]);

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

  const handleSaveProjection = () => {
    if (!symbol || !symbol.trim()) {
      setError('Please enter a stock symbol first');
      return;
    }
    if (!chartData && !snapshotData) {
      setError('No projection data to save. Please load chart data first.');
      return;
    }

    setSaving(true);
    setSaveSuccess(false);

    try {
      const projectionData = {
        symbol: symbol.toUpperCase().trim(),
        projectionModel,
        interval,
        projectionSteps,
        projectionHours,
        // Prime Tetration specific
        base,
        projectionCount,
        primeDepth: PRIME_STOPS[primeDepthIndex] || 31,
        primeDepthIndex,
        omegaHz,
        useLambdaSchedule,
        useOmegaSchedule,
        beta,
        // Data - Deep clone to ensure all data is saved
        snapshotData: snapshotData ? JSON.parse(JSON.stringify(snapshotData)) : null,
        chartData: chartData ? (() => {
          // Deep clone chart data to ensure everything is saved
          const clonedChartData = JSON.parse(JSON.stringify({
            // Complete chart data for Price Projection Chart
            labels: chartData.labels || [],
            datasets: chartData.datasets ? chartData.datasets.map(dataset => ({
              label: dataset.label || '',
              data: Array.isArray(dataset.data) ? dataset.data.map(d => d !== null && d !== undefined ? Number(d) : null) : [],
              borderColor: dataset.borderColor || 'rgb(59, 130, 246)',
              backgroundColor: dataset.backgroundColor || 'rgba(59, 130, 246, 0.1)',
              borderWidth: dataset.borderWidth || 2,
              borderDash: dataset.borderDash || undefined,
              tension: dataset.tension !== undefined ? dataset.tension : 0.4,
              fill: dataset.fill !== undefined ? dataset.fill : false,
              pointRadius: dataset.pointRadius !== undefined ? dataset.pointRadius : 2,
              pointHoverRadius: dataset.pointHoverRadius !== undefined ? dataset.pointHoverRadius : 6,
              spanGaps: dataset.spanGaps !== undefined ? dataset.spanGaps : false,
              showLine: dataset.showLine !== undefined ? dataset.showLine : true,
              stepped: dataset.stepped !== undefined ? dataset.stepped : false,
            })) : [],
            // Price metrics
            currentPrice: chartData.currentPrice !== undefined ? Number(chartData.currentPrice) : null,
            change: chartData.change !== undefined ? Number(chartData.change) : null,
            changePercent: chartData.changePercent !== undefined ? Number(chartData.changePercent) : null,
            projectedPrice: chartData.projectedPrice !== undefined ? Number(chartData.projectedPrice) : null,
            projectedChange: chartData.projectedChange !== undefined ? Number(chartData.projectedChange) : null,
            projectedChangePercent: chartData.projectedChangePercent !== undefined ? Number(chartData.projectedChangePercent) : null,
            // Historical data for reference
            historicalPrices: historicalPricesRef.current ? historicalPricesRef.current.map(p => Number(p)) : [],
          }));
          return clonedChartData;
        })() : null,
        // Metadata
        savedAt: new Date().toISOString(),
      };

      saveProjection(projectionData);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error('Error saving projection:', error);
      setError('Failed to save projection: ' + error.message);
    } finally {
      setSaving(false);
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

  const handleResetZoom = () => {
    if (chartRef.current) {
      // react-chartjs-2 v4+ exposes chart instance via .chartInstance
      // Older versions might expose it directly
      let chart = null;
      if (chartRef.current.chartInstance) {
        chart = chartRef.current.chartInstance;
      } else if (chartRef.current.chart) {
        chart = chartRef.current.chart;
      } else if (chartRef.current) {
        chart = chartRef.current;
      }
      
      if (chart) {
        // Reset zoom using chartjs-plugin-zoom's resetZoom method
        if (typeof chart.resetZoom === 'function') {
          chart.resetZoom();
        }
        
        // Reset to original Y-axis bounds if available
        if (originalYMin.current !== null && originalYMax.current !== null) {
          if (chart.scales && chart.scales.y) {
            chart.scales.y.options.min = originalYMin.current;
            chart.scales.y.options.max = originalYMax.current;
            chart.update('none');
          } else if (chart.options && chart.options.scales && chart.options.scales.y) {
            chart.options.scales.y.min = originalYMin.current;
            chart.options.scales.y.max = originalYMax.current;
            chart.update('none');
          }
        }
      }
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
        <p className="text-gray-600 dark:text-gray-400">Prime Tetration Projections</p>
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
              Projection Steps
            </label>
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

        <div className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              Projection Model Configuration
            </h3>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Configure your projection parameters</p>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Projection Model
              </label>
              <div className="w-full px-4 py-3 border-2 border-purple-500 dark:border-purple-400 rounded-lg bg-purple-50 dark:bg-purple-900/20 transition-all text-sm font-medium">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-purple-700 dark:text-purple-300 font-semibold">Prime Tetration Projections</span>
                </div>
              </div>
            </div>

            {projectionModel === 'primetetration' && (
              <>
                <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4 flex items-center gap-2">
                    <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    Core Parameters
                  </h4>
                  
                  {/* Base, Omega, and Schedule Options Grouped Box */}
                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4 mb-6 border border-gray-200 dark:border-gray-700">
                    <h5 className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                      <svg className="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      Seed, Frequency & Schedules
                    </h5>
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                            Base (seed)
                          </label>
                          <label className="inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={base === 3}
                              onChange={() => {
                                const newBase = base === 3 ? 2 : 3;
                                setBase(newBase);
                                if (chartData) {
                                  setTimeout(() => loadChartData(), 100);
                                }
                              }}
                              className="sr-only peer" 
                            />
                            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            <span className="ms-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                              {base === 3 ? '3 (preferred)' : '2 (Enigma-style)'}
                            </span>
                          </label>
                        </div>

                        <div className="space-y-2">
                          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                            Ω (Omega Hz)
                          </label>
                          <label className="inline-flex items-center cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={omegaHz === 528}
                              onChange={() => {
                                const newOmegaHz = omegaHz === 432 ? 528 : 432;
                                setOmegaHz(newOmegaHz);
                                if (chartData) {
                                  setTimeout(() => loadChartData(), 100);
                                }
                              }}
                              className="sr-only peer" 
                            />
                            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 dark:peer-focus:ring-green-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                            <span className="ms-3 text-sm font-medium text-gray-700 dark:text-gray-300">
                              {omegaHz} Hz
                            </span>
                          </label>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
                        <div className="flex flex-wrap gap-6">
                          <label className="inline-flex items-center cursor-pointer group">
                            <input 
                              type="checkbox" 
                              checked={useLambdaSchedule}
                              onChange={(e) => {
                                setUseLambdaSchedule(e.target.checked);
                                if (chartData) {
                                  setTimeout(() => loadChartData(), 100);
                                }
                              }}
                              className="sr-only peer" 
                            />
                            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                            <span className="ms-3 text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                              Use λ Schedule (dub, kubt, k'anch)
                            </span>
                          </label>
                          <label className="inline-flex items-center cursor-pointer group">
                            <input 
                              type="checkbox" 
                              checked={useOmegaSchedule}
                              onChange={(e) => {
                                setUseOmegaSchedule(e.target.checked);
                                if (chartData) {
                                  setTimeout(() => loadChartData(), 100);
                                }
                              }}
                              className="sr-only peer" 
                            />
                            <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                            <span className="ms-3 text-sm font-medium text-gray-700 dark:text-gray-300 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                              Use Ω Schedule (vary frequencies)
                            </span>
                          </label>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label htmlFor="projectionCount" className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                        Projections Count
                      </label>
                      <input
                        type="number"
                        id="projectionCount"
                        min="1"
                        max="50"
                        step="1"
                        value={projectionCount}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          if (inputValue === '') {
                            // Allow empty input while typing
                            return;
                          }
                          const value = parseInt(inputValue, 10);
                          if (!isNaN(value) && value >= 1 && value <= 50) {
                            setProjectionCount(value);
                            if (chartData) {
                              setTimeout(() => loadChartData(), 100);
                            }
                          }
                        }}
                        onBlur={(e) => {
                          const inputValue = e.target.value;
                          if (inputValue === '' || isNaN(parseInt(inputValue, 10))) {
                            setProjectionCount(12);
                            if (chartData) {
                              setTimeout(() => loadChartData(), 100);
                            }
                          } else {
                            const value = parseInt(inputValue, 10);
                            if (value < 1) {
                              setProjectionCount(1);
                              if (chartData) {
                                setTimeout(() => loadChartData(), 100);
                              }
                            } else if (value > 50) {
                              setProjectionCount(50);
                              if (chartData) {
                                setTimeout(() => loadChartData(), 100);
                              }
                            }
                          }
                        }}
                        className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white transition-all text-sm font-medium bg-white"
                        placeholder="Enter number (1-50)"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">Range: 1-50 projections</p>
                    </div>

                    <div className="space-y-2">
                      <label htmlFor="primeDepth" className="block text-xs font-medium text-gray-600 dark:text-gray-400 uppercase tracking-wide">
                        Prime Depth
                      </label>
                      <input
                        type="number"
                        id="primeDepth"
                        min={PRIME_STOPS[0]}
                        max={PRIME_STOPS[PRIME_STOPS.length - 1]}
                        step="1"
                        value={primeDepthInput}
                        onChange={(e) => {
                          const inputValue = e.target.value;
                          setPrimeDepthInput(inputValue);
                          // Allow typing any number, validate on blur
                        }}
                        onBlur={(e) => {
                          const inputValue = e.target.value;
                          if (inputValue === '' || isNaN(parseInt(inputValue, 10))) {
                            // Reset to current valid prime
                            const currentPrime = PRIME_STOPS[primeDepthIndex] || 31;
                            setPrimeDepthInput(currentPrime);
                          } else {
                            const value = parseInt(inputValue, 10);
                            // Find closest valid prime
                            const closestPrime = PRIME_STOPS.reduce((prev, curr) => 
                              Math.abs(curr - value) < Math.abs(prev - value) ? curr : prev
                            );
                            const newIndex = PRIME_STOPS.indexOf(closestPrime);
                            setPrimeDepthIndex(newIndex);
                            setPrimeDepthInput(closestPrime);
                            if (chartData) {
                              setTimeout(() => loadChartData(), 100);
                            }
                          }
                        }}
                        className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:bg-gray-700 dark:text-white transition-all text-sm font-medium bg-white"
                        placeholder={`Enter prime (${PRIME_STOPS[0]}-${PRIME_STOPS[PRIME_STOPS.length - 1]})`}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400">Valid primes: {PRIME_STOPS.join(', ')}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
            
            <div className="border-t border-gray-200 dark:border-gray-700 pt-6 flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {saveSuccess ? (
                    <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Projection saved successfully!
                    </span>
                  ) : (
                    'Save this projection configuration to view it later on the Data page'
                  )}
                </p>
              </div>
              <button
                onClick={handleSaveProjection}
                disabled={saving || !symbol || !symbol.trim() || (!chartData && !snapshotData)}
                className="px-6 py-2.5 bg-gradient-to-r from-green-600 to-green-700 text-white text-sm font-semibold rounded-lg hover:from-green-700 hover:to-green-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed disabled:opacity-50 shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                title={!symbol || !symbol.trim() ? 'Enter a stock symbol first' : (!chartData && !snapshotData) ? 'Load chart data first' : 'Save projection to Data page'}
              >
                {saving ? (
                  <>
                    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Saving...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    <span>Save Projection</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {projectionLoaded && (
          <div className="mt-4 bg-green-50 dark:bg-green-900/20 border-l-4 border-green-500 rounded-lg p-4">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-green-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Projection loaded successfully! You can now edit the parameters and save changes.
                </p>
                <p className="text-xs text-green-600 dark:text-green-300 mt-1">
                  All saved data has been restored. Modify any settings and click "Save Projection" to update.
                </p>
              </div>
              <button
                onClick={() => setProjectionLoaded(false)}
                className="ml-2 text-green-500 hover:text-green-700 dark:hover:text-green-300"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        )}

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
                  Prime Tetration Parameters
                </h4>
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
              <span>{lastRefresh ? `Last updated: ${lastRefresh.toLocaleString('en-US', { timeZone: 'America/New_York' })}` : 'Ready to load data'}</span>
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
              <div className="flex items-center gap-4">
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
                <button
                  type="button"
                  onClick={handleResetZoom}
                  className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  title="Reset zoom and pan"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Reset Zoom
                </button>
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
                  About Prime Tetration Projections
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
                  Prime Tetration Projections use the full crystalline 12-dimensional lattice with triadic prime exponentiation towers. Each projection line represents a different prime triad [p1,p2,p3] with amplitude A = base^(p2^p3) mod 2^72. The lattice oscillator Z(n) aggregates all 12 φ_d dimensions without dimension sweeping. All calculations use Q8 fixed-point truncation (+8 guard bits).
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
                ref={chartRef}
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
