# Prime Tetration Trading Application - Complete Integration Guide

## Table of Contents
1. [Application Overview](#application-overview)
2. [Architecture](#architecture)
3. [Mathematical Formulas & Calculations](#mathematical-formulas--calculations)
4. [API Endpoints](#api-endpoints)
5. [Frontend Components](#frontend-components)
6. [Data Flow](#data-flow)
7. [Integration Steps](#integration-steps)
8. [Dependencies](#dependencies)

---

## Application Overview

**Prime Tetration Trading** is a web application that generates price projections for financial instruments using advanced mathematical models based on:
- Prime tetration towers (exponentiation of primes)
- 12-dimensional crystalline lattice oscillators
- Fixed-point arithmetic with Q8 precision
- Modular arithmetic with BigInt operations

The application fetches real-time stock data from Yahoo Finance and generates multiple projection lines (11-13) that visualize potential future price movements based on mathematical models.

---

## Architecture

### Technology Stack
- **Backend**: Node.js 18+ with Express.js
- **Frontend**: Vanilla JavaScript with Chart.js
- **UI Framework**: Tailwind CSS + Preline UI
- **Data Source**: Yahoo Finance API (via `yahoo-finance2` library)
- **Charting**: Chart.js 4.4.1 with zoom plugin

### File Structure
```
NINJA/
├── server.mjs          # Express server with API endpoints
├── index.html          # Frontend UI and chart visualization
├── package.json        # Dependencies and scripts
├── start.sh            # Startup script
└── node_modules/       # Dependencies
```

### Server Configuration
- Default port: 8080 (auto-increments if in use)
- Static file serving: Serves HTML, CSS, JS from root directory
- CORS: Enabled for cross-origin requests
- JSON parsing: Express JSON middleware enabled

---

## Mathematical Formulas & Calculations

### 1. Constants

```javascript
PHI = [3, 7, 31, 12, 19, 5, 11, 13, 17, 23, 29, 31]  // 12-dimensional crystalline lattice dimensions
TWO_PI = 2π ≈ 6.283185307179586
MOD_BITS = 72                                         // 64 + 8 guard bits
MOD = 2^72                                            // Modular base (BigInt)
LAMBDA = 2^(72-2) = 2^70                             // Carmichael function for odd base cycles
Q_FRAC_BITS = 8                                       // Fractional bits for Q8 arithmetic
OUTPUT_SCALE = 2^64                                   // Final output scaling
Q8 = 256 = 2^8                                        // Q8 fixed-point scale factor
```

### 2. Modular Exponentiation

**Function**: `modPow(a, e, m)`
- **Purpose**: Compute `a^e mod m` using binary exponentiation
- **Algorithm**: Right-to-left binary method
- **Formula**: 
  ```
  result = 1
  while e > 0:
    if e is odd: result = (result * a) mod m
    a = (a * a) mod m
    e = e / 2
  return result
  ```
- **Complexity**: O(log e)

### 3. Triadic Prime Tower Amplitude

**Function**: `amplitudeFromTriad(base, triad)`
- **Purpose**: Compute amplitude from triadic prime tower
- **Input**: 
  - `base`: Base seed (typically 2 or 3)
  - `triad`: Array [p1, p2, p3] where p1, p2, p3 are primes
- **Formula**:
  ```
  E = p2^p3 mod LAMBDA
  E_eff = E + LAMBDA
  A = base^E_eff mod MOD
  ```
- **Mathematical Expression**:
  ```
  A = base^(p2^p3 mod λ(2^72)) mod 2^72
  ```
- **Output**: BigInt value in range [0, 2^72 - 1]

### 4. Amplitude to Symmetric Float

**Function**: `amplitudeToSymmetric(A72)`
- **Purpose**: Convert 72-bit amplitude to symmetric float in range [-1, 1)
- **Formula**:
  ```
  aQ8 = A72 >> 8                    // Drop 8 guard bits
  aUnit = aQ8 / 2^64                // Normalize to [0, 1)
  aSym = (aUnit * 2) - 1            // Map to [-1, 1)
  ```
- **Mathematical Expression**:
  ```
  aSym = ((A72 >> 8) / 2^64) * 2 - 1
  ```

### 5. Lattice Oscillator

**Function**: `latticeOscillatorZ(n)`
- **Purpose**: Aggregate cosine of all 12 φ dimensions
- **Formula**:
  ```
  k = n - 1
  Z(n) = (1/12) * Σ[i=0 to 11] cos(k * (2π/12) * PHI[i])
  ```
- **Mathematical Expression**:
  ```
  Z(n) = (1/12) * Σ cos((n-1) * (π/6) * φᵢ)
  ```
  where φᵢ ∈ {3, 7, 31, 12, 19, 5, 11, 13, 17, 23, 29, 31}
- **Output**: Average value in range [-1, 1]

### 6. Fixed-Point Q8 Conversion

**Function**: `toQ8(xFloat)`
- **Purpose**: Convert float to Q8 fixed-point integer
- **Formula**:
  ```
  q8 = trunc(xFloat * 256)
  ```
- **Precision**: 8 fractional bits (1/256 resolution)

**Function**: `fromQ8(q8int)`
- **Purpose**: Convert Q8 fixed-point integer to float
- **Formula**:
  ```
  xFloat = q8int / 256
  ```

### 7. Price Projection Calculation

**Function**: Price projection loop (in `/api/snapshot` endpoint)
- **Purpose**: Generate future price projections
- **Initialization**:
  ```
  P(0) = lastPrice  // Current market price from Yahoo Finance
  ```
- **Iteration Formula** (for n = 1 to horizon):
  ```
  Z(n) = latticeOscillatorZ(n)
  ΔP(n) = β * aSym * Z(n)
  P(n) = P(n-1) * (1 + ΔP(n))
  ```
- **Mathematical Expression**:
  ```
  P(n) = P(0) * Π[k=1 to n] (1 + β * aSym * Z(k))
  ```
- **Where**:
  - `β` (beta): Calibration factor (default: 0.01)
  - `aSym`: Symmetric amplitude from triadic tower
  - `Z(n)`: Lattice oscillator value at step n
  - `P(n)`: Projected price at step n

### 8. Prime Sieve Algorithm

**Function**: `firstNPrimes(N)`
- **Purpose**: Generate first N prime numbers using Sieve of Eratosthenes
- **Algorithm**:
  ```
  1. Create boolean array sieve[2..limit]
  2. For i from 2 to limit:
     - If sieve[i] is false (prime):
       - Add i to primes list
       - Mark all multiples of i as composite
  3. Return first N primes
  ```
- **Default**: Generates 500 primes (limit = 4000)

### 9. Triad Generation

**Function**: `generateTriadsAroundPrime(pDepth, count, primes)`
- **Purpose**: Generate triadic prime sets centered around depth prime
- **Formula**:
  ```
  idx = index of pDepth in primes array
  half = floor(count / 2)
  For offset from -half to +half:
    i = clamp(idx + offset, 0, primes.length - 3)
    triad = [primes[i], primes[i+1], primes[i+2]]
  ```
- **Output**: Array of `count` triads (11, 12, or 13)

### 10. Oscillation Statistics

**Zero Crossings**:
- Count when `Z(n)` changes sign:
  ```
  zeroCross++ if (Z(n) > 0 && Z(n-1) <= 0) || (Z(n) < 0 && Z(n-1) >= 0)
  ```

**Turning Points**:
- Count when sign of price change flips:
  ```
  prevDelta = (P(n-1) - P(n-2)) / P(n-2)
  currDelta = ΔP(n)
  extrema++ if sign(prevDelta) ≠ sign(currDelta)
  ```

---

## API Endpoints

### 1. GET `/api/quote`
**Purpose**: Get current stock quote

**Query Parameters**:
- `symbol` (required): Stock ticker symbol (e.g., "AAPL", "TSLA")

**Response**:
```json
{
  "regularMarketPrice": 150.25,
  "regularMarketTime": 1234567890,
  "currency": "USD",
  ...
}
```

**Error Response**:
```json
{
  "error": "quote failed",
  "details": "Error message"
}
```

### 2. GET `/api/history`
**Purpose**: Get historical price data

**Query Parameters**:
- `symbol` (required): Stock ticker symbol
- `range` (optional): Time range - "1mo", "3mo", "1y", "5d" (default: "1mo")
- `interval` (optional): Data interval - "1d" (default: "1d")

**Response**:
```json
{
  "result": [{
    "timestamp": [1234567890, 1234654290, ...],
    "indicators": {
      "quote": [{
        "close": [150.25, 151.30, ...]
      }]
    }
  }]
}
```

**Error Response**:
```json
{
  "error": "history failed",
  "details": "Error message"
}
```

### 3. POST `/api/snapshot`
**Purpose**: Generate prime tetration projections

**Request Body**:
```json
{
  "symbol": "AAPL",
  "base": 3,
  "triads": [[11, 13, 17], [13, 17, 19], ...],  // Optional
  "depthPrime": 31,
  "horizon": 240,
  "count": 12,
  "beta": 0.01
}
```

**Parameters**:
- `symbol` (required): Stock ticker symbol
- `base` (optional): Base seed for towers (default: 3, options: 2 or 3)
- `triads` (optional): Array of triadic prime sets (auto-generated if not provided)
- `depthPrime` (optional): Prime depth for triad generation (default: 31)
- `horizon` (optional): Number of future steps (default: 240)
- `count` (required): Number of projection lines - must be 11, 12, or 13
- `beta` (optional): Calibration factor (default: 0.01)

**Response**:
```json
{
  "symbol": "AAPL",
  "lastPriceQ8": 38400,
  "beta": 0.01,
  "horizon": 240,
  "primesDepthUsed": 31,
  "phi": [3, 7, 31, 12, 19, 5, 11, 13, 17, 23, 29, 31],
  "lines": [
    {
      "triad": [11, 13, 17],
      "base": 3,
      "aQ8": "12345678901234567890",
      "pointsQ8": [38400, 38450, 38500, ...],
      "zeroCrossings": 45,
      "turningPoints": 23
    },
    ...
  ]
}
```

**Response Fields**:
- `lastPriceQ8`: Last price in Q8 fixed-point format (multiply by 256 to get actual price)
- `lines`: Array of projection lines, each containing:
  - `triad`: [p1, p2, p3] prime triple
  - `base`: Base seed used
  - `aQ8`: Amplitude in Q8 format (as string to preserve BigInt)
  - `pointsQ8`: Array of projected prices in Q8 format
  - `zeroCrossings`: Number of oscillator zero crossings
  - `turningPoints`: Number of price turning points

**Error Response**:
```json
{
  "error": "snapshot failed"
}
```

---

## Frontend Components

### 1. UI Layout
- **Sidebar** (left, 384px wide on large screens):
  - Stock symbol input
  - Projection settings panel
  - Action buttons
  - Status display
  - System information
- **Main Content** (right, flexible):
  - Chart header with zoom controls
  - Chart.js canvas container
  - Instructions overlay (hidden when data loaded)

### 2. User Controls

**Stock Symbol Input**:
- Text input field
- Default: "AAPL"
- Accepts any valid ticker symbol

**Base Seed Selector**:
- Dropdown with options: 3 (preferred) or 2 (Enigma-style)
- Default: 3

**Prime Depth Slider**:
- Range: 0-9 (maps to primes: 11, 13, 17, 29, 31, 47, 59, 61, 97, 101)
- Default: 4 (prime 31)
- Real-time label update

**Number of Projections**:
- Dropdown: 11, 12, or 13
- Default: 12

**Horizon Input**:
- Number input: 10-1000
- Default: 240
- Represents future time steps

**Beta Input**:
- Number input: 0.001-1, step 0.001
- Default: 0.01
- Controls projection sensitivity

### 3. Chart Visualization

**Chart Configuration**:
- Type: Line chart (Chart.js)
- Responsive: Yes
- Maintain aspect ratio: No (fills container)
- Interaction mode: Nearest point
- Dark theme with gray color scheme

**Datasets**:
1. **Historical Data**: Gray line showing past prices (up to 60 points)
2. **Last Price Reference**: Dashed white line at current price
3. **Projection Lines**: 11-13 colored lines, one per triad

**Color Scheme**:
- 13 distinct hues: [210, 0, 40, 90, 140, 260, 300, 20, 170, 200, 280, 320, 45]
- Format: `hsla(hue, 85%, 60%, alpha)`
- Alpha: 0.9 for lines, 0.18 for fills

**Zoom & Pan**:
- Mouse wheel: Zoom in/out
- Click and drag: Pan chart
- Zoom buttons: Programmatic zoom
- Reset button: Restore original view

### 4. Data Processing

**Historical Data Fetching**:
```javascript
// Fetch last 30 days of data
GET /api/history?symbol=AAPL&range=1mo&interval=1d
// Extract close prices and timestamps
// Limit to last 60 points for display
```

**Projection Generation**:
```javascript
// POST request with user parameters
POST /api/snapshot
// Convert Q8 points to floats: pointsQ8.map(q8 => q8 / 256)
// Create datasets for each projection line
```

**Chart Update**:
- Labels: Historical dates + future steps ("+1", "+2", ...)
- Datasets: Historical + reference + projections
- Update mode: 'none' (no animation)

---

## Data Flow

### 1. User Input Flow
```
User enters symbol → User adjusts settings → User clicks "Generate Snapshot"
```

### 2. Snapshot Generation Flow
```
1. Fetch current price from Yahoo Finance
2. Generate triadic prime sets (if not provided)
3. For each triad:
   a. Calculate amplitude: base^(p2^p3) mod 2^72
   b. Convert to symmetric float: [-1, 1)
   c. Initialize price: P(0) = lastPrice
   d. For n = 1 to horizon:
      - Calculate Z(n) = lattice oscillator
      - Calculate ΔP(n) = β * aSym * Z(n)
      - Update P(n) = P(n-1) * (1 + ΔP(n))
      - Convert to Q8: trunc(P(n) * 256)
   e. Calculate statistics (zero crossings, turning points)
4. Return all projection lines
```

### 3. Chart Rendering Flow
```
1. Fetch historical data (optional)
2. Generate snapshot projections
3. Convert Q8 points to floats
4. Create chart datasets:
   - Historical data (if available)
   - Last price reference line
   - Projection lines (one per triad)
5. Update Chart.js instance
6. Display status message
```

---

## Integration Steps

### Step 1: Install Dependencies

```bash
npm install express cors yahoo-finance2
```

For frontend (if not using CDN):
```bash
npm install chart.js chartjs-plugin-zoom
```

### Step 2: Copy Core Functions

Copy these functions from `server.mjs` to your backend:

1. **Constants** (lines 23-30)
2. **modPow** (lines 32-42)
3. **amplitudeFromTriad** (lines 44-54)
4. **amplitudeToSymmetric** (lines 56-61)
5. **latticeOscillatorZ** (lines 63-72)
6. **toQ8 / fromQ8** (lines 74-84)
7. **generateTriadsAroundPrime** (lines 86-100)
8. **firstNPrimes** (lines 102-115)

### Step 3: Create API Endpoints

Implement the three endpoints in your existing Express app:

```javascript
// GET /api/quote
app.get('/api/quote', async (req, res) => {
  // Implementation from server.mjs lines 120-131
});

// GET /api/history
app.get('/api/history', async (req, res) => {
  // Implementation from server.mjs lines 133-200
});

// POST /api/snapshot
app.post('/api/snapshot', async (req, res) => {
  // Implementation from server.mjs lines 202-296
});
```

### Step 4: Frontend Integration

**Option A: Standalone Component**
- Copy the chart container HTML from `index.html`
- Copy the JavaScript chart initialization and event handlers
- Include Chart.js from CDN or npm

**Option B: React/Vue Component**
- Convert the chart logic to a component
- Use Chart.js React wrapper or Vue wrapper
- Maintain the same API calls and data processing

**Option C: API Integration Only**
- Keep your existing UI
- Call the `/api/snapshot` endpoint from your frontend
- Process the response data as needed

### Step 5: Configuration

**Environment Variables**:
```bash
PORT=8080  # Optional, defaults to 8080
```

**CORS Configuration** (if needed):
```javascript
app.use(cors({
  origin: 'https://yourdomain.com',
  credentials: true
}));
```

### Step 6: Testing

Test each endpoint:
```bash
# Test quote endpoint
curl http://localhost:8080/api/quote?symbol=AAPL

# Test history endpoint
curl http://localhost:8080/api/history?symbol=AAPL&range=1mo

# Test snapshot endpoint
curl -X POST http://localhost:8080/api/snapshot \
  -H "Content-Type: application/json" \
  -d '{"symbol":"AAPL","base":3,"depthPrime":31,"horizon":240,"count":12,"beta":0.01}'
```

---

## Dependencies

### Backend Dependencies
```json
{
  "express": "^4.18.2",        // Web server framework
  "cors": "^2.8.5",             // Cross-origin resource sharing
  "yahoo-finance2": "^2.4.0"    // Yahoo Finance API client
}
```

### Frontend Dependencies (CDN)
- **Tailwind CSS**: `https://cdn.tailwindcss.com`
- **Chart.js**: `https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js`
- **Chart.js Zoom Plugin**: `https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js`
- **Preline UI**: `https://cdn.jsdelivr.net/npm/preline@2.0.3/dist/preline.js` (optional)

### Node.js Requirements
- **Node.js**: 18.0.0 or higher
- **Package Type**: ES Modules (`"type": "module"` in package.json)

---

## Key Integration Points

### 1. Price Data Source
The application uses Yahoo Finance via `yahoo-finance2`. To use a different source:
- Replace `yahooFinance.quote()` calls with your API
- Ensure response format matches expected structure
- Update error handling for your API's error format

### 2. Projection Algorithm
The core projection algorithm is in the `/api/snapshot` endpoint (lines 238-281). To customize:
- Modify the `beta` parameter for sensitivity
- Adjust `horizon` for projection length
- Change `count` for number of projection lines
- Modify `PHI` array for different lattice dimensions

### 3. Fixed-Point Arithmetic
All prices are stored in Q8 format (multiply by 256). To use floating-point:
- Remove `toQ8()` calls
- Remove `fromQ8()` conversions
- Update response format to use floats instead of integers

### 4. Chart Visualization
Chart.js is used for visualization. To use a different library:
- Replace Chart.js initialization code
- Adapt dataset format to your library
- Implement zoom/pan functionality if needed

---

## Mathematical Summary

### Core Formula Chain

1. **Amplitude Calculation**:
   ```
   A = base^(p2^p3 mod λ(2^72)) mod 2^72
   aSym = ((A >> 8) / 2^64) * 2 - 1  // Range: [-1, 1)
   ```

2. **Lattice Oscillator**:
   ```
   Z(n) = (1/12) * Σ cos((n-1) * (π/6) * φᵢ)
   ```

3. **Price Projection**:
   ```
   P(n) = P(0) * Π[k=1 to n] (1 + β * aSym * Z(k))
   ```

4. **Fixed-Point Conversion**:
   ```
   P_Q8(n) = trunc(P(n) * 256)
   ```

### Parameter Ranges

- **base**: 2 or 3 (integer)
- **depthPrime**: 11, 13, 17, 29, 31, 47, 59, 61, 97, 101 (primes)
- **count**: 11, 12, or 13 (integer)
- **horizon**: 10-1000 (integer, typically 240)
- **beta**: 0.001-1.0 (float, typically 0.01)
- **PHI**: Fixed array of 12 dimensions

---

## Error Handling

### Backend Errors
- **Quote errors**: Returns 500 with error message
- **History errors**: Falls back to single-point data
- **Snapshot errors**: Returns 500 with generic error
- **Validation errors**: Returns 400 with specific error message

### Frontend Errors
- **API failures**: Displayed in status panel
- **Chart errors**: Console warnings, graceful degradation
- **Missing data**: Shows instructions overlay

---

## Performance Considerations

1. **BigInt Operations**: Modular exponentiation is computationally expensive
   - Consider caching amplitudes for common triads
   - Use worker threads for parallel computation

2. **Prime Generation**: Sieve algorithm runs once at startup
   - 500 primes generated in ~1ms
   - Consider pre-computing and storing

3. **Chart Rendering**: Chart.js can be slow with many points
   - Limit historical data to 60 points
   - Consider data decimation for large horizons

4. **API Rate Limits**: Yahoo Finance has rate limits
   - Implement request caching
   - Add retry logic with exponential backoff

---

## Security Considerations

1. **Input Validation**: Validate all user inputs
   - Symbol: Sanitize to prevent injection
   - Numeric parameters: Validate ranges
   - Triads: Ensure valid prime arrays

2. **CORS**: Configure CORS appropriately for production
   - Restrict origins to your domain
   - Disable credentials if not needed

3. **Error Messages**: Don't expose internal errors
   - Generic error messages for users
   - Detailed errors in server logs only

---

## Example Integration Code

### Minimal Backend Integration

```javascript
import express from 'express';
import cors from 'cors';
import YahooFinance from 'yahoo-finance2';

const app = express();
app.use(cors());
app.use(express.json());

// Copy all mathematical functions from server.mjs
// ... (constants, modPow, amplitudeFromTriad, etc.)

const yahooFinance = new YahooFinance();

// Add endpoints
app.get('/api/quote', async (req, res) => {
  // ... implementation
});

app.get('/api/history', async (req, res) => {
  // ... implementation
});

app.post('/api/snapshot', async (req, res) => {
  // ... implementation
});

app.listen(8080);
```

### Minimal Frontend Integration

```javascript
async function generateProjections(symbol, base = 3, depthPrime = 31, 
                                   horizon = 240, count = 12, beta = 0.01) {
  const response = await fetch('/api/snapshot', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ symbol, base, depthPrime, horizon, count, beta })
  });
  
  const data = await response.json();
  
  // Convert Q8 points to floats
  const projections = data.lines.map(line => ({
    triad: line.triad,
    points: line.pointsQ8.map(q8 => q8 / 256)
  }));
  
  return projections;
}
```

---

## Conclusion

This application provides a sophisticated mathematical model for price projection using prime tetration and lattice oscillators. The core algorithms are modular and can be integrated into any existing web application with minimal modifications.

Key integration points:
1. Copy mathematical functions to your backend
2. Implement the three API endpoints
3. Integrate the frontend chart component or use the API directly
4. Configure dependencies and environment variables

For questions or issues, refer to the source code in `server.mjs` and `index.html` for detailed implementations.

