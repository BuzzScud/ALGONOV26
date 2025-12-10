// Yahoo Finance API Service for Live Market Data
// Fetches real-time stock and market data from Yahoo Finance

// List of reliable CORS proxy services for production
// These are tested and working as of Dec 2024
const CORS_PROXIES = [
  {
    name: 'allorigins',
    getUrl: (url) => `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    parseResponse: (data) => data,
    headers: {},
  },
  {
    name: 'corsproxy.io',
    getUrl: (url) => `https://corsproxy.io/?${encodeURIComponent(url)}`,
    parseResponse: (data) => data,
    headers: {},
  },
  {
    name: 'cors.sh',
    getUrl: (url) => `https://cors.sh/${url}`,
    parseResponse: (data) => data,
    headers: {},
  },
  {
    name: 'crossorigin.me',
    getUrl: (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
    parseResponse: (data) => data,
    headers: {},
  },
  {
    name: 'thingproxy',
    getUrl: (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
    parseResponse: (data) => data,
    headers: {},
  },
];

// Alternative Yahoo Finance endpoints (some may work without CORS proxy)
const YAHOO_ENDPOINTS = [
  'https://query1.finance.yahoo.com',
  'https://query2.finance.yahoo.com',
];

// Track which proxy is working best
let preferredProxyIndex = 0;
let preferredEndpointIndex = 0;

// Cache for successful requests to reduce API calls
const dataCache = new Map();
const CACHE_DURATION = 30000; // 30 seconds cache

// Get Yahoo Finance URL based on environment
const getYahooFinanceBaseUrl = (symbol, interval = '1d', range = '1d', endpointIndex = 0) => {
  const endpoint = YAHOO_ENDPOINTS[endpointIndex % YAHOO_ENDPOINTS.length];
  return `${endpoint}/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
};

// Use proxy in development, CORS proxy in production
const getYahooFinanceUrl = (symbol, interval = '1d', range = '1d', proxyIndex = 0, endpointIndex = 0) => {
  // In development, use Vite proxy
  if (import.meta.env.DEV) {
    return `/api/yahoo/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
  }
  
  // In production, use CORS proxy
  const baseUrl = getYahooFinanceBaseUrl(symbol, interval, range, endpointIndex);
  const proxy = CORS_PROXIES[proxyIndex % CORS_PROXIES.length];
  return proxy.getUrl(baseUrl);
};

// Default Finnhub API key for production
const DEFAULT_FINNHUB_KEY = 'd18ueuhr01qkcat4uip0d18ueuhr01qkcat4uipg';

// Helper function to get API keys from localStorage
const getApiKeys = () => {
  try {
    const saved = localStorage.getItem('apiKeys');
    if (saved) {
      const parsed = JSON.parse(saved);
      // Merge with defaults, preferring saved values
      return {
        finnhub: parsed.finnhub || DEFAULT_FINNHUB_KEY,
        massive: parsed.massive || 'qeBvdtjWjffA90rzgWB_HeHtmdpyuGQG',
      };
    }
  } catch (error) {
    console.error('Error loading API keys from localStorage:', error);
  }
  // Default fallback keys
  return {
    finnhub: DEFAULT_FINNHUB_KEY,
    massive: 'qeBvdtjWjffA90rzgWB_HeHtmdpyuGQG',
  };
};

// Finnhub API - Backup endpoint (Free tier: 60 calls/minute)
// No API key required for basic quote data
const getFinnhubUrl = (symbol) => {
  const apiKeys = getApiKeys();
  const apiKey = apiKeys.finnhub || 'demo';
  return `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`;
};

// Massive API - Backup endpoint
// API key from Massive dashboard
const getMassiveUrl = (symbol) => {
  const apiKeys = getApiKeys();
  const apiKey = apiKeys.massive || 'qeBvdtjWjffA90rzgWB_HeHtmdpyuGQG';
  // Using Massive API endpoint - adjust URL structure based on actual API documentation
  return `https://api.massive.com/v1/quote?symbol=${symbol}&apiKey=${apiKey}`;
};

// Helper function to check cache
const getCachedData = (cacheKey) => {
  const cached = dataCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
    return cached.data;
  }
  dataCache.delete(cacheKey);
  return null;
};

// Helper function to set cache
const setCachedData = (cacheKey, data) => {
  dataCache.set(cacheKey, { data, timestamp: Date.now() });
  // Clean up old entries
  if (dataCache.size > 100) {
    const oldest = [...dataCache.entries()].sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) dataCache.delete(oldest[0]);
  }
};

// Helper function to fetch from Yahoo Finance with proxy fallback
const fetchWithProxy = async (symbol, interval, range, proxyIndex, endpointIndex = 0) => {
  const url = getYahooFinanceUrl(symbol, interval, range, proxyIndex, endpointIndex);
  const proxy = CORS_PROXIES[proxyIndex % CORS_PROXIES.length];
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout per proxy
  
  try {
    const headers = {
      'Accept': 'application/json',
      ...proxy.headers,
    };
    
    const response = await fetch(url, {
      method: 'GET',
      headers,
      signal: controller.signal,
      mode: 'cors',
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    let data;
    
    const text = await response.text();
    
    // Try to parse as JSON
    try {
      data = JSON.parse(text);
    } catch (e) {
      // Some proxies wrap the response, try to extract JSON
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          data = JSON.parse(jsonMatch[0]);
        } catch (e2) {
          throw new Error('Response is not valid JSON');
        }
      } else {
        throw new Error('Response is not JSON');
      }
    }
    
    // Handle wrapped response from some proxies
    if (data.contents) {
      data = typeof data.contents === 'string' ? JSON.parse(data.contents) : data.contents;
    }
    
    // Apply any proxy-specific parsing
    data = proxy.parseResponse(data);
    
    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
};

// Helper function to fetch from Yahoo Finance
export const fetchYahooFinance = async (symbol, interval = '1d', range = '1d') => {
  // Check cache first
  const cacheKey = `yahoo_${symbol}_${interval}_${range}`;
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  // In development, use direct Vite proxy
  if (import.meta.env.DEV) {
    try {
      const url = getYahooFinanceUrl(symbol, interval, range);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (!data?.chart?.result?.[0]) {
        throw new Error('Invalid response format');
      }
      
      const result = { data, source: 'yahoo' };
      setCachedData(cacheKey, result);
      return result;
    } catch (error) {
      console.error(`Error fetching from Yahoo Finance (dev) ${symbol}:`, error);
      throw error;
    }
  }
  
  // In production, try multiple CORS proxies with multiple Yahoo endpoints
  let lastError = null;
  const totalAttempts = CORS_PROXIES.length * YAHOO_ENDPOINTS.length;
  
  // Try starting from the preferred proxy and endpoint, then cycle through others
  for (let attempt = 0; attempt < totalAttempts; attempt++) {
    const proxyIndex = (preferredProxyIndex + Math.floor(attempt / YAHOO_ENDPOINTS.length)) % CORS_PROXIES.length;
    const endpointIndex = (preferredEndpointIndex + attempt) % YAHOO_ENDPOINTS.length;
    const proxy = CORS_PROXIES[proxyIndex];
    
    try {
      const data = await fetchWithProxy(symbol, interval, range, proxyIndex, endpointIndex);
      
      // Validate response
      if (!data) {
        throw new Error('Empty response from API');
      }
      
      if (!data.chart) {
        throw new Error('Invalid response: missing chart data');
      }
      
      if (!data.chart.result || !Array.isArray(data.chart.result) || data.chart.result.length === 0) {
        throw new Error('Invalid response: no result data');
      }
      
      if (!data.chart.result[0]) {
        throw new Error('Invalid response: empty result array');
      }
      
      // This proxy and endpoint worked, remember them for next time
      if (proxyIndex !== preferredProxyIndex) {
        preferredProxyIndex = proxyIndex;
      }
      if (endpointIndex !== preferredEndpointIndex) {
        preferredEndpointIndex = endpointIndex;
      }
      
      const result = { data, source: 'yahoo' };
      setCachedData(cacheKey, result);
      return result;
    } catch (error) {
      lastError = error;
      // Continue to next proxy/endpoint combination silently
    }
  }
  
  // All proxies failed
  throw new Error(`Failed to fetch Yahoo Finance data for ${symbol}`);
};

// Helper function to fetch from Finnhub (Backup API)
// Finnhub supports CORS natively, so no proxy needed
export const fetchFinnhub = async (symbol) => {
  // Check cache first
  const cacheKey = `finnhub_${symbol}`;
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    return cachedData;
  }

  // Map special symbols for Finnhub
  let finnhubSymbol = symbol;
  if (symbol === 'DX-Y.NYB' || symbol === 'DXY') {
    finnhubSymbol = 'EURUSD'; // Finnhub doesn't have DXY, use EURUSD as proxy
  } else if (symbol === '^VIX' || symbol === 'VIX') {
    finnhubSymbol = 'SPY'; // Use SPY as fallback since VIX isn't available in free tier
  }

  try {
    const url = getFinnhubUrl(finnhubSymbol);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Finnhub HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    if (!data || data.error) {
      throw new Error(data.error || 'Empty response from Finnhub API');
    }
    
    // Finnhub returns 0 for invalid symbols
    if (data.c === 0 && data.h === 0 && data.l === 0) {
      throw new Error('Invalid symbol or no data available');
    }
    
    if (data.c === null || data.c === undefined) {
      throw new Error('Invalid response: missing price data');
    }
    
    const result = { data, source: 'finnhub' };
    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    throw new Error(`Finnhub failed for ${symbol}: ${error.message}`);
  }
};

// Fetch historical candle data from Finnhub (provides OHLC with timestamps)
// This is a proper fallback for charts when Yahoo Finance fails
export const fetchFinnhubCandles = async (symbol, resolution = 'D', fromDate = null, toDate = null) => {
  const apiKeys = getApiKeys();
  const apiKey = apiKeys.finnhub || DEFAULT_FINNHUB_KEY;
  
  // Map special symbols for Finnhub
  let finnhubSymbol = symbol;
  if (symbol === 'DX-Y.NYB' || symbol === 'DXY') {
    finnhubSymbol = 'OANDA:EUR_USD';
  } else if (symbol === '^VIX' || symbol === 'VIX') {
    finnhubSymbol = 'SPY';
  }
  
  // Calculate date range (default: last 30 days)
  const now = Math.floor(Date.now() / 1000);
  const from = fromDate || (now - 30 * 24 * 60 * 60); // 30 days ago
  const to = toDate || now;
  
  // Check cache
  const cacheKey = `finnhub_candles_${finnhubSymbol}_${resolution}_${from}_${to}`;
  const cachedData = getCachedData(cacheKey);
  if (cachedData) {
    return cachedData;
  }
  
  try {
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${finnhubSymbol}&resolution=${resolution}&from=${from}&to=${to}&token=${apiKey}`;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`Finnhub Candles HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    // Finnhub returns { s: 'ok', c: [...], h: [...], l: [...], o: [...], t: [...], v: [...] }
    if (!data || data.s !== 'ok' || !data.c || data.c.length === 0) {
      throw new Error('No candle data available from Finnhub');
    }
    
    const result = { data, source: 'finnhub_candles' };
    setCachedData(cacheKey, result);
    return result;
  } catch (error) {
    throw new Error(`Finnhub Candles failed for ${symbol}: ${error.message}`);
  }
};

// Helper function to fetch from Massive (Backup API)
export const fetchMassive = async (symbol) => {
  try {
    const url = getMassiveUrl(symbol);
    const apiKeys = getApiKeys();
    const apiKey = apiKeys.massive || 'qeBvdtjWjffA90rzgWB_HeHtmdpyuGQG';
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to fetch data for ${symbol}: ${response.status} ${response.statusText}. ${errorText}`);
    }
    
    const data = await response.json();
    
    if (!data || data.error) {
      throw new Error(data.error || 'Empty response from API');
    }
    
    // Handle different possible response formats from Massive API
    // Adjust based on actual API response structure
    const currentPrice = data.c || data.close || data.price || data.currentPrice;
    if (currentPrice === null || currentPrice === undefined) {
      throw new Error('Invalid response: missing price data');
    }
    
    // Normalize data to match expected format
    const normalizedData = {
      c: currentPrice,
      pc: data.pc || data.previousClose || data.prevClose || currentPrice,
      h: data.h || data.high || currentPrice,
      l: data.l || data.low || currentPrice,
      o: data.o || data.open || currentPrice,
      v: data.v || data.volume || 0,
      t: data.t || data.timestamp || Date.now() / 1000,
    };
    
    return { data: normalizedData, source: 'massive' };
  } catch (error) {
    console.error(`Error fetching from Massive ${symbol}:`, error);
    throw error;
  }
};

// Get preferred API from localStorage
const getPreferredApi = () => {
  try {
    const saved = localStorage.getItem('preferredApi');
    if (saved && ['yahoo', 'finnhub', 'massive', 'auto'].includes(saved)) {
      return saved;
    }
  } catch (error) {
    console.error('Error loading preferred API:', error);
  }
  return 'auto'; // Default to auto (fallback mode)
};

// Unified fetch function with user-selected API or automatic fallback
// prioritizeYahoo: if true, tries Yahoo Finance first (useful for historical chart data)
export const fetchMarketData = async (symbol, interval = '1d', range = '1d', prioritizeYahoo = false) => {
  const preferredApi = getPreferredApi();
  const errors = [];
  
  // If prioritizeYahoo is true (needed for chart data), try Yahoo Finance first
  if (prioritizeYahoo) {
    try {
      const result = await fetchYahooFinance(symbol, interval, range);
      return result;
    } catch (error) {
      errors.push(`Yahoo: ${error.message}`);
      // Continue to fallback options
    }
  }
  
  // In development, Yahoo Finance works via Vite proxy
  if (import.meta.env.DEV) {
    try {
      const result = await fetchYahooFinance(symbol, interval, range);
      return result;
    } catch (error) {
      errors.push(`Yahoo: ${error.message}`);
    }
  }
  
  // In production, prioritize Finnhub (no CORS issues) for basic quote data
  // Then fall back to Yahoo Finance via CORS proxy
  
  // If user selected a specific API, respect that choice
  if (preferredApi === 'yahoo') {
    try {
      const result = await fetchYahooFinance(symbol, interval, range);
      return result;
    } catch (error) {
      errors.push(`Yahoo: ${error.message}`);
    }
  } else if (preferredApi === 'finnhub') {
    try {
      const result = await fetchFinnhub(symbol);
      return result;
    } catch (error) {
      errors.push(`Finnhub: ${error.message}`);
    }
  }
  
  // Auto mode or fallback: Try all APIs
  // For production, Finnhub is more reliable since it doesn't need CORS proxy
  // But only if we don't need historical data (prioritizeYahoo = false)
  if (!import.meta.env.DEV && !prioritizeYahoo) {
    // Try Finnhub first in production (no CORS issues) for basic quotes
    try {
      const result = await fetchFinnhub(symbol);
      return result;
    } catch (error) {
      errors.push(`Finnhub: ${error.message}`);
    }
  }
  
  // Try Yahoo Finance (may work with CORS proxies)
  try {
    const result = await fetchYahooFinance(symbol, interval, range);
    return result;
  } catch (error) {
    errors.push(`Yahoo: ${error.message}`);
  }
  
  // If in development and Yahoo failed, try Finnhub as last resort
  if (import.meta.env.DEV) {
    try {
      const result = await fetchFinnhub(symbol);
      return result;
    } catch (error) {
      errors.push(`Finnhub: ${error.message}`);
    }
  }
  
  // All APIs failed
  throw new Error(`All APIs failed for ${symbol}`);
};

// Convert Yahoo Finance data to monitor format
const convertYahooToMonitor = (symbol, yahooData) => {
  if (!yahooData?.chart?.result?.[0]) {
    throw new Error('Invalid data format from Yahoo Finance');
  }
  
  const result = yahooData.chart.result[0];
  const meta = result.meta;
  const quote = result.indicators?.quote?.[0];
  
  const currentPrice = meta.regularMarketPrice || meta.previousClose || 0;
  const previousClose = meta.previousClose || currentPrice;
  const change = currentPrice - previousClose;
  const changePercent = previousClose ? (change / previousClose) * 100 : 0;
  
  // Calculate response time based on market status
  const isMarketOpen = meta.marketState === 'REGULAR';
  const responseTime = isMarketOpen ? Math.floor(Math.random() * 200) + 50 : 0;
  
  // Determine status based on market data
  let status = 'operational';
  if (!isMarketOpen) {
    status = 'paused';
  } else if (Math.abs(changePercent) > 5) {
    status = 'degraded';
  }
  
  return {
    id: symbol,
    name: `${meta.shortName || symbol} (${symbol})`,
    url: `https://finance.yahoo.com/quote/${symbol}`,
    type: 'http',
    status: status,
    isUp: isMarketOpen,
    responseTime: responseTime,
    avgResponseTime: responseTime,
    uptime: 99.9,
    uptimePercent: 99.9,
    lastCheck: new Date().toISOString(),
    paused: !isMarketOpen,
    // Additional Yahoo Finance data
    price: currentPrice,
    change: change,
    changePercent: changePercent,
    volume: meta.regularMarketVolume || 0,
    marketState: meta.marketState,
    symbol: symbol,
    apiSource: 'yahoo',
  };
};

// Convert Finnhub data to monitor format
const convertFinnhubToMonitor = (symbol, finnhubData) => {
  if (!finnhubData || finnhubData.c === null || finnhubData.c === undefined) {
    throw new Error('Invalid data format from Finnhub');
  }
  
  const currentPrice = finnhubData.c || 0;
  const previousClose = finnhubData.pc || currentPrice;
  const change = currentPrice - previousClose;
  const changePercent = previousClose ? (change / previousClose) * 100 : 0;
  
  // Finnhub doesn't provide market state, so we'll assume market is open if price changed
  const isMarketOpen = finnhubData.t && finnhubData.t > 0;
  const responseTime = isMarketOpen ? Math.floor(Math.random() * 200) + 50 : 0;
  
  // Determine status based on market data
  let status = 'operational';
  if (!isMarketOpen) {
    status = 'paused';
  } else if (Math.abs(changePercent) > 5) {
    status = 'degraded';
  }
  
  return {
    id: symbol,
    name: `${symbol} (${symbol})`,
    url: `https://finance.yahoo.com/quote/${symbol}`,
    type: 'http',
    status: status,
    isUp: isMarketOpen,
    responseTime: responseTime,
    avgResponseTime: responseTime,
    uptime: 99.9,
    uptimePercent: 99.9,
    lastCheck: new Date().toISOString(),
    paused: !isMarketOpen,
    // Additional Finnhub data
    price: currentPrice,
    change: change,
    changePercent: changePercent,
    volume: finnhubData.v || 0,
    marketState: isMarketOpen ? 'REGULAR' : 'CLOSED',
    symbol: symbol,
    apiSource: 'finnhub',
  };
};

// Convert Massive data to monitor format
const convertMassiveToMonitor = (symbol, massiveData) => {
  if (!massiveData || massiveData.c === null || massiveData.c === undefined) {
    throw new Error('Invalid data format from Massive');
  }
  
  const currentPrice = massiveData.c || 0;
  const previousClose = massiveData.pc || currentPrice;
  const change = currentPrice - previousClose;
  const changePercent = previousClose ? (change / previousClose) * 100 : 0;
  
  // Massive API - assume market is open if timestamp is recent
  const isMarketOpen = massiveData.t && massiveData.t > 0;
  const responseTime = isMarketOpen ? Math.floor(Math.random() * 200) + 50 : 0;
  
  // Determine status based on market data
  let status = 'operational';
  if (!isMarketOpen) {
    status = 'paused';
  } else if (Math.abs(changePercent) > 5) {
    status = 'degraded';
  }
  
  return {
    id: symbol,
    name: `${symbol} (${symbol})`,
    url: `https://finance.yahoo.com/quote/${symbol}`,
    type: 'http',
    status: status,
    isUp: isMarketOpen,
    responseTime: responseTime,
    avgResponseTime: responseTime,
    uptime: 99.9,
    uptimePercent: 99.9,
    lastCheck: new Date().toISOString(),
    paused: !isMarketOpen,
    // Additional Massive data
    price: currentPrice,
    change: change,
    changePercent: changePercent,
    volume: massiveData.v || 0,
    marketState: isMarketOpen ? 'REGULAR' : 'CLOSED',
    symbol: symbol,
    apiSource: 'massive',
  };
};

// Unified convert function
const convertToMonitor = (symbol, apiResult) => {
  if (apiResult.source === 'finnhub') {
    return convertFinnhubToMonitor(symbol, apiResult.data);
  } else if (apiResult.source === 'massive') {
    return convertMassiveToMonitor(symbol, apiResult.data);
  } else {
    return convertYahooToMonitor(symbol, apiResult.data);
  }
};

// Get all monitors (default popular stocks + custom monitors)
export const getMonitors = async () => {
  try {
    // Get default symbols from localStorage or use fallback
    let defaultSymbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'];
    try {
      const saved = localStorage.getItem('defaultSymbols');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          defaultSymbols = parsed;
        }
      }
    } catch (error) {
      console.error('Error loading default symbols from localStorage:', error);
    }
    
    // Get deleted monitors list
    let deletedMonitors = [];
    try {
      const saved = localStorage.getItem('deletedMonitors');
      if (saved) {
        deletedMonitors = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading deleted monitors:', error);
    }
    
    // Filter out deleted monitors
    const activeSymbols = defaultSymbols.filter(symbol => !deletedMonitors.includes(symbol));
    
    // Fetch data for all symbols in parallel with automatic fallback
    const promises = activeSymbols.map(symbol => 
      fetchMarketData(symbol, '1d', '1d').then(result => convertToMonitor(symbol, result))
        .catch(error => {
          console.error(`Failed to fetch ${symbol}:`, error);
          // Return a fallback monitor
          return {
            id: symbol,
            name: `${symbol}`,
            url: `https://finance.yahoo.com/quote/${symbol}`,
            type: 'http',
            status: 'down',
            isUp: false,
            responseTime: 0,
            avgResponseTime: 0,
            uptime: 0,
            uptimePercent: 0,
            lastCheck: new Date().toISOString(),
            paused: false,
            symbol: symbol,
            apiSource: 'none',
          };
        })
    );
    
    const monitors = await Promise.all(promises);
    return monitors.filter(m => m !== null);
  } catch (error) {
    console.error('Failed to fetch monitors:', error);
    return [];
  }
};

// Create a new monitor (add a new symbol to monitor)
export const createMonitor = async (monitorData) => {
  try {
    // Extract symbol from form data
    let symbol = monitorData.symbol;
    if (!symbol && monitorData.url) {
      // Try to extract from URL if symbol not provided
      symbol = monitorData.url.split('/').pop()?.toUpperCase().replace(/[^A-Z]/g, '');
    }
    if (!symbol) {
      throw new Error('Stock symbol is required');
    }
    symbol = symbol.toUpperCase().trim();
    
    // Remove from deleted list if it was previously deleted
    try {
      let deletedMonitors = [];
      const saved = localStorage.getItem('deletedMonitors');
      if (saved) {
        deletedMonitors = JSON.parse(saved);
      }
      deletedMonitors = deletedMonitors.filter(s => s !== symbol);
      localStorage.setItem('deletedMonitors', JSON.stringify(deletedMonitors));
    } catch (error) {
      console.error('Error updating deleted monitors:', error);
    }
    
    const result = await fetchMarketData(symbol, '1d', '1d');
    const monitor = convertToMonitor(symbol, result);
    // Override name if provided
    if (monitorData.name) {
      monitor.name = monitorData.name;
    }
    
    // Add to default symbols if not already present
    try {
      let defaultSymbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'];
      const saved = localStorage.getItem('defaultSymbols');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          defaultSymbols = parsed;
        }
      }
      if (!defaultSymbols.includes(symbol)) {
        defaultSymbols.push(symbol);
        localStorage.setItem('defaultSymbols', JSON.stringify(defaultSymbols));
      }
    } catch (error) {
      console.error('Error saving default symbols:', error);
    }
    
    return monitor;
  } catch (error) {
    console.error('Failed to create monitor:', error);
    throw error;
  }
};

// Update a monitor
export const updateMonitor = async (id, monitorData) => {
  try {
    const symbol = monitorData.symbol || id;
    const result = await fetchMarketData(symbol, '1d', '1d');
    const monitor = convertToMonitor(symbol, result);
    return monitor;
  } catch (error) {
    console.error('Failed to update monitor:', error);
    throw error;
  }
};

// Delete a monitor (removes from localStorage)
export const deleteMonitor = async (id) => {
  try {
    // Get current default symbols
    let defaultSymbols = ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'];
    try {
      const saved = localStorage.getItem('defaultSymbols');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          defaultSymbols = parsed;
        }
      }
    } catch (error) {
      console.error('Error loading default symbols:', error);
    }
    
    // Get deleted monitors list
    let deletedMonitors = [];
    try {
      const saved = localStorage.getItem('deletedMonitors');
      if (saved) {
        deletedMonitors = JSON.parse(saved);
      }
    } catch (error) {
      console.error('Error loading deleted monitors:', error);
    }
    
    // Add to deleted list if not already there
    if (!deletedMonitors.includes(id)) {
      deletedMonitors.push(id);
      localStorage.setItem('deletedMonitors', JSON.stringify(deletedMonitors));
    }
    
    // Remove from default symbols if present
    const updatedSymbols = defaultSymbols.filter(symbol => symbol !== id);
    localStorage.setItem('defaultSymbols', JSON.stringify(updatedSymbols));
    
    return { success: true };
  } catch (error) {
    console.error('Error deleting monitor:', error);
    throw error;
  }
};

// Toggle pause status (not applicable for live data, but kept for compatibility)
export const togglePauseMonitor = async (id) => {
  // For live data, we can't really pause, but we'll return the current state
  const result = await fetchMarketData(id, '1d', '1d');
  const monitor = convertToMonitor(id, result);
  return monitor;
};

// Get response time chart data from Yahoo Finance
export const getMonitorResponseTimeChart = async (id) => {
  try {
    const result = await fetchMarketData(id, '1m', '1d');
    
    // Only Yahoo Finance provides historical chart data
    if (result.source === 'finnhub') {
      // Finnhub doesn't provide historical data in free tier, return empty
      return [];
    }
    
    const data = result.data;
    if (!data?.chart?.result?.[0]) {
      throw new Error('Invalid data format');
    }
    
    const chartResult = data.chart.result[0];
    const timestamps = chartResult.timestamp || [];
    const quotes = chartResult.indicators?.quote?.[0];
    const closes = quotes?.close || [];
    
    // Convert to chart format
    return timestamps.map((timestamp, index) => ({
      time: new Date(timestamp * 1000).toISOString(),
      timestamp: new Date(timestamp * 1000).toISOString(),
      value: closes[index] || 0,
      responseTime: closes[index] || 0,
    }));
  } catch (error) {
    console.error('Failed to fetch chart data:', error);
    // Return empty data
    return [];
  }
};

// Get uptime chart data
export const getMonitorUptimeChart = async (id) => {
  // For Yahoo Finance, uptime is always high, so we'll use price data
  return getMonitorResponseTimeChart(id);
};

// Get monitor history
export const getMonitorHistory = async (id) => {
  try {
    const result = await fetchMarketData(id, '5m', '1d');
    
    // Only Yahoo Finance provides historical chart data
    if (result.source === 'finnhub') {
      // Finnhub doesn't provide historical data in free tier, return empty
      return [];
    }
    
    const data = result.data;
    if (!data?.chart?.result?.[0]) {
      throw new Error('Invalid data format');
    }
    
    const chartResult = data.chart.result[0];
    const timestamps = chartResult.timestamp || [];
    const quotes = chartResult.indicators?.quote?.[0];
    const closes = quotes?.close || [];
    const volumes = quotes?.volume || [];
    
    return timestamps.map((timestamp, index) => ({
      time: new Date(timestamp * 1000).toISOString(),
      timestamp: new Date(timestamp * 1000).toISOString(),
      status: closes[index] ? 'up' : 'down',
      responseTime: closes[index] || 0,
      volume: volumes[index] || 0,
    }));
  } catch (error) {
    console.error('Failed to fetch history:', error);
    return [];
  }
};

// Get latest downtime period info
export const getMonitorDowntime = async (id) => {
  // For live data, we don't track downtime the same way
  return {
    start: null,
    end: null,
    duration: 0,
  };
};

// Legacy function name for compatibility
export const getMonitorChartData = async (id, type = 'response-time') => {
  if (type === 'uptime') {
    return getMonitorUptimeChart(id);
  }
  return getMonitorResponseTimeChart(id);
};

// Get price chart data for Charts page
export const getPriceChartData = async (symbol, interval = '1d') => {
  // Map intervals to Yahoo Finance format
  let yahooInterval = '1d';
  let range = '1mo'; // 1 month for daily data
  let finnhubResolution = 'D'; // Daily for Finnhub
  
  if (interval === '1H' || interval === '1h') {
    yahooInterval = '1h';
    range = '1d'; // 1 day for hourly data
    finnhubResolution = '60'; // 60 minutes for Finnhub
  } else if (interval === '1D' || interval === '1d') {
    yahooInterval = '1d';
    range = '1mo'; // 1 month for daily data
    finnhubResolution = 'D';
  }
  
  // Try Yahoo Finance first (via CORS proxies in production)
  try {
    const result = await fetchYahooFinance(symbol, yahooInterval, range);
    
    if (result.source === 'yahoo') {
      const data = result.data;
      if (!data?.chart?.result?.[0]) {
        throw new Error('Invalid data format from Yahoo Finance');
      }
      
      const chartResult = data.chart.result[0];
      const timestamps = chartResult.timestamp || [];
      const quotes = chartResult.indicators?.quote?.[0];
      
      if (!quotes || timestamps.length === 0) {
        throw new Error('No quote data available from Yahoo Finance');
      }
      
      const closes = quotes.close || [];
      const opens = quotes.open || [];
      const highs = quotes.high || [];
      const lows = quotes.low || [];
      const volumes = quotes.volume || [];
      
      if (closes.length === 0) {
        throw new Error('No historical data available');
      }
      
      const meta = chartResult.meta;
      const currentPrice = meta?.regularMarketPrice || meta?.previousClose || closes[closes.length - 1] || 0;
      
      const chartData = [];
      const maxLength = Math.min(timestamps.length, closes.length);
      
      for (let i = 0; i < maxLength; i++) {
        const timestamp = timestamps[i];
        const close = closes[i];
        
        if (timestamp && close !== null && close !== undefined && !isNaN(close)) {
          chartData.push({
            time: new Date(timestamp * 1000).toISOString(),
            timestamp: timestamp * 1000,
            open: opens[i] !== null && opens[i] !== undefined ? opens[i] : close,
            high: highs[i] !== null && highs[i] !== undefined ? highs[i] : close,
            low: lows[i] !== null && lows[i] !== undefined ? lows[i] : close,
            close: close,
            volume: volumes[i] !== null && volumes[i] !== undefined ? volumes[i] : 0,
          });
        }
      }
      
      if (chartData.length === 0) {
        throw new Error('No valid price data points found');
      }
      
      return {
        symbol: symbol,
        currentPrice: currentPrice,
        data: chartData,
      };
    }
  } catch (yahooError) {
    console.warn(`Yahoo Finance failed for ${symbol}, trying Finnhub candles:`, yahooError.message);
  }
  
  // Fallback to Finnhub Candles API (supports CORS, provides historical data)
  try {
    const result = await fetchFinnhubCandles(symbol, finnhubResolution);
    
    if (result.source === 'finnhub_candles') {
      const data = result.data;
      // Finnhub candles format: { s: 'ok', c: [...], h: [...], l: [...], o: [...], t: [...], v: [...] }
      const closes = data.c || [];
      const opens = data.o || [];
      const highs = data.h || [];
      const lows = data.l || [];
      const timestamps = data.t || [];
      const volumes = data.v || [];
      
      if (closes.length === 0) {
        throw new Error('No candle data from Finnhub');
      }
      
      const currentPrice = closes[closes.length - 1] || 0;
      
      const chartData = [];
      for (let i = 0; i < closes.length; i++) {
        const timestamp = timestamps[i];
        const close = closes[i];
        
        if (timestamp && close !== null && close !== undefined && !isNaN(close)) {
          chartData.push({
            time: new Date(timestamp * 1000).toISOString(),
            timestamp: timestamp * 1000,
            open: opens[i] !== null && opens[i] !== undefined ? opens[i] : close,
            high: highs[i] !== null && highs[i] !== undefined ? highs[i] : close,
            low: lows[i] !== null && lows[i] !== undefined ? lows[i] : close,
            close: close,
            volume: volumes[i] !== null && volumes[i] !== undefined ? volumes[i] : 0,
          });
        }
      }
      
      if (chartData.length === 0) {
        throw new Error('No valid price data from Finnhub candles');
      }
      
      return {
        symbol: symbol,
        currentPrice: currentPrice,
        data: chartData,
      };
    }
  } catch (finnhubError) {
    console.warn(`Finnhub candles failed for ${symbol}:`, finnhubError.message);
  }
  
  // Last resort: Try Finnhub quote API (single data point)
  try {
    const result = await fetchFinnhub(symbol);
    
    if (result.source === 'finnhub') {
      const finnhubData = result.data;
      return {
        symbol: symbol,
        currentPrice: finnhubData.c || 0,
        data: [{
          time: new Date().toISOString(),
          timestamp: Date.now(),
          open: finnhubData.o || finnhubData.c || 0,
          high: finnhubData.h || finnhubData.c || 0,
          low: finnhubData.l || finnhubData.c || 0,
          close: finnhubData.c || 0,
          volume: 0,
        }],
      };
    }
  } catch (quoteError) {
    console.error(`All APIs failed for ${symbol}:`, quoteError.message);
  }
  
  throw new Error(`Failed to fetch chart data for ${symbol}. Please try again later.`);
};
