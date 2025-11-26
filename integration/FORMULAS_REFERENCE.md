# Mathematical Formulas Reference

## Constants

```
PHI = [3, 7, 31, 12, 19, 5, 11, 13, 17, 23, 29, 31]  // 12 dimensions
TWO_PI = 2π
MOD_BITS = 72
MOD = 2^72
LAMBDA = 2^70 = 2^(72-2)
Q_FRAC_BITS = 8
OUTPUT_SCALE = 2^64
Q8 = 2^8 = 256
```

## Core Formulas

### 1. Modular Exponentiation
```
modPow(a, e, m):
  result = 1
  while e > 0:
    if e & 1: result = (result * a) mod m
    a = (a * a) mod m
    e = e >> 1
  return result
```

### 2. Triadic Prime Tower Amplitude
```
Given: base ∈ {2, 3}, triad = [p1, p2, p3] where p1, p2, p3 are primes

E = p2^p3 mod LAMBDA
E_eff = E + LAMBDA
A = base^E_eff mod MOD

Where:
  LAMBDA = 2^70
  MOD = 2^72
```

### 3. Amplitude to Symmetric Float
```
Given: A (72-bit BigInt amplitude)

aQ8 = A >> 8                    // Truncate 8 guard bits
aUnit = aQ8 / 2^64              // Normalize to [0, 1)
aSym = (aUnit * 2) - 1          // Map to [-1, 1)

Result: aSym ∈ [-1, 1)
```

### 4. Lattice Oscillator
```
Z(n) = (1/12) * Σ[i=0 to 11] cos((n-1) * (2π/12) * PHI[i])

Where:
  PHI[i] ∈ {3, 7, 31, 12, 19, 5, 11, 13, 17, 23, 29, 31}
  n = step number (1, 2, 3, ...)
  
Result: Z(n) ∈ [-1, 1]
```

### 5. Price Projection
```
Initial: P(0) = lastPrice

For n = 1 to horizon:
  Z(n) = latticeOscillatorZ(n)
  ΔP(n) = β * aSym * Z(n)
  P(n) = P(n-1) * (1 + ΔP(n))

Closed form:
  P(n) = P(0) * Π[k=1 to n] (1 + β * aSym * Z(k))

Where:
  β = beta (calibration factor, typically 0.01)
  aSym = symmetric amplitude from triadic tower
  Z(k) = lattice oscillator at step k
```

### 6. Fixed-Point Q8 Conversion

**Float to Q8:**
```
toQ8(x) = trunc(x * 256)
```

**Q8 to Float:**
```
fromQ8(q8) = q8 / 256
```

### 7. Prime Sieve (Sieve of Eratosthenes)
```
Given: N (number of primes needed), limit (upper bound)

1. Create boolean array sieve[2..limit], all false
2. For i from 2 to limit:
     if sieve[i] is false:
       primes.append(i)
       for j from i*2 to limit, step i:
         sieve[j] = true
3. Return first N primes
```

### 8. Triad Generation
```
Given: pDepth (depth prime), count (11, 12, or 13), primes (array)

idx = index of pDepth in primes
half = floor(count / 2)

For offset from -half to +half:
  i = clamp(idx + offset, 0, length(primes) - 3)
  triad = [primes[i], primes[i+1], primes[i+2]]
  triads.append(triad)

Return: array of count triads
```

### 9. Oscillation Statistics

**Zero Crossings:**
```
zeroCross = 0
For n = 2 to horizon:
  if (Z(n) > 0 && Z(n-1) <= 0) || (Z(n) < 0 && Z(n-1) >= 0):
    zeroCross++
```

**Turning Points:**
```
extrema = 0
For n = 2 to horizon:
  prevDelta = (P(n-1) - P(n-2)) / P(n-2)
  currDelta = ΔP(n)
  if sign(prevDelta) ≠ sign(currDelta):
    extrema++
```

## Complete Calculation Chain

### Step-by-Step Process

1. **Input Parameters:**
   ```
   symbol = "AAPL"
   base = 3
   depthPrime = 31
   horizon = 240
   count = 12
   beta = 0.01
   ```

2. **Get Current Price:**
   ```
   lastPrice = getQuote(symbol).regularMarketPrice
   ```

3. **Generate Triads:**
   ```
   primes = firstNPrimes(500)
   triads = generateTriadsAroundPrime(depthPrime, count, primes)
   ```

4. **For Each Triad [p1, p2, p3]:**
   
   a. **Calculate Amplitude:**
      ```
      E = modPow(p2, p3, LAMBDA)
      E_eff = E + LAMBDA
      A = modPow(base, E_eff, MOD)
      ```
   
   b. **Convert to Symmetric:**
      ```
      aQ8 = A >> 8
      aUnit = aQ8 / 2^64
      aSym = (aUnit * 2) - 1
      ```
   
   c. **Initialize Projection:**
      ```
      P(0) = lastPrice
      ```
   
   d. **Project Prices:**
      ```
      For n = 1 to horizon:
        Z(n) = (1/12) * Σ cos((n-1) * (π/6) * PHI[i])
        ΔP(n) = beta * aSym * Z(n)
        P(n) = P(n-1) * (1 + ΔP(n))
        P_Q8(n) = trunc(P(n) * 256)
      ```
   
   e. **Calculate Statistics:**
      ```
      zeroCrossings = count zero crossings of Z(n)
      turningPoints = count sign changes of ΔP(n)
      ```

5. **Output:**
   ```
   {
     symbol: "AAPL",
     lastPriceQ8: trunc(lastPrice * 256),
     beta: 0.01,
     horizon: 240,
     primesDepthUsed: 31,
     phi: [3, 7, 31, 12, 19, 5, 11, 13, 17, 23, 29, 31],
     lines: [
       {
         triad: [p1, p2, p3],
         base: 3,
         aQ8: (A >> 8).toString(),
         pointsQ8: [P_Q8(1), P_Q8(2), ..., P_Q8(240)],
         zeroCrossings: count,
         turningPoints: count
       },
       ...
     ]
   }
   ```

## Mathematical Properties

### Amplitude Range
```
A ∈ [0, 2^72 - 1]  (BigInt)
aSym ∈ [-1, 1)     (Float)
```

### Lattice Oscillator Range
```
Z(n) ∈ [-1, 1]     (Average of 12 cosines)
```

### Price Change Range
```
ΔP(n) = β * aSym * Z(n)

Since:
  β ∈ [0.001, 1.0]  (typically 0.01)
  aSym ∈ [-1, 1)
  Z(n) ∈ [-1, 1]

Then:
  |ΔP(n)| ≤ β
  ΔP(n) ∈ [-β, β]
```

### Price Projection Range
```
P(n) = P(0) * Π[k=1 to n] (1 + β * aSym * Z(k))

Since each factor (1 + β * aSym * Z(k)) ∈ [1 - β, 1 + β]:

  P(n) ∈ [P(0) * (1 - β)^n, P(0) * (1 + β)^n]
```

### Q8 Precision
```
Resolution: 1/256 = 0.00390625
Max value: (2^64 - 1) / 256 ≈ 7.03 × 10^16
Min value: 0
```

## Computational Complexity

### Modular Exponentiation
```
Time: O(log e)
Space: O(1)
```

### Amplitude Calculation
```
Time: O(log(p2^p3)) ≈ O(p3 * log(p2))
Space: O(1)
```

### Lattice Oscillator
```
Time: O(12) = O(1) per step
Space: O(1)
```

### Price Projection
```
Time: O(horizon * 12) = O(horizon)
Space: O(horizon) for storing points
```

### Prime Sieve
```
Time: O(n log log n) where n = limit
Space: O(n)
```

## Parameter Relationships

### Beta Sensitivity
```
Small β (0.001):  Small price changes, smooth projections
Medium β (0.01):  Moderate changes, typical use case
Large β (0.1+):   Large price swings, volatile projections
```

### Horizon Impact
```
Short horizon (10-50):   Near-term projections
Medium horizon (100-300): Standard projections
Long horizon (500+):     Long-term trends
```

### Count (Number of Lines)
```
11 lines: Fewer projections, faster computation
12 lines: Balanced (default)
13 lines: More projections, slower computation
```

### Depth Prime Selection
```
Small primes (11-17):    Lower amplitude values
Medium primes (29-47):   Balanced (default: 31)
Large primes (59-101):   Higher amplitude values
```

## Example Calculations

### Example 1: Single Step Projection

Given:
- base = 3
- triad = [11, 13, 17]
- lastPrice = 150.00
- beta = 0.01
- n = 1

Calculate:
```
1. E = 13^17 mod 2^70
2. A = 3^E mod 2^72
3. aSym = ((A >> 8) / 2^64) * 2 - 1
4. Z(1) = (1/12) * Σ cos(0 * (π/6) * PHI[i]) = (1/12) * Σ cos(0) = 1
5. ΔP(1) = 0.01 * aSym * 1 = 0.01 * aSym
6. P(1) = 150.00 * (1 + 0.01 * aSym)
7. P_Q8(1) = trunc(P(1) * 256)
```

### Example 2: Amplitude Calculation

Given:
- base = 3
- triad = [29, 31, 37]

Calculate:
```
1. E = 31^37 mod 2^70
   (This is a very large exponentiation, computed via modPow)
   
2. E_eff = E + 2^70
   (Ensures correct range for odd base)

3. A = 3^E_eff mod 2^72
   (Result is a 72-bit BigInt)

4. aQ8 = A >> 8
   (64-bit integer)

5. aSym = (aQ8 / 2^64) * 2 - 1
   (Float in range [-1, 1))
```

### Example 3: Lattice Oscillator

Given:
- n = 5
- PHI = [3, 7, 31, 12, 19, 5, 11, 13, 17, 23, 29, 31]

Calculate:
```
k = n - 1 = 4

Z(5) = (1/12) * [
  cos(4 * (π/6) * 3) +
  cos(4 * (π/6) * 7) +
  cos(4 * (π/6) * 31) +
  cos(4 * (π/6) * 12) +
  cos(4 * (π/6) * 19) +
  cos(4 * (π/6) * 5) +
  cos(4 * (π/6) * 11) +
  cos(4 * (π/6) * 13) +
  cos(4 * (π/6) * 17) +
  cos(4 * (π/6) * 23) +
  cos(4 * (π/6) * 29) +
  cos(4 * (π/6) * 31)
]

Z(5) = (1/12) * [
  cos(2π) + cos(14π/3) + cos(124π/3) + ... + cos(124π/3)
]
```

## Notes

1. **BigInt Operations**: All modular arithmetic uses BigInt to handle large numbers
2. **Truncation**: Q8 conversion uses truncation (not rounding) for deterministic results
3. **Modular Reduction**: Uses Carmichael function (λ) for efficient exponent reduction
4. **Fixed-Point**: Q8 format provides 1/256 precision, sufficient for price projections
5. **Guard Bits**: +8 guard bits prevent overflow during intermediate calculations

