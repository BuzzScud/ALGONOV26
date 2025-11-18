// Yahoo Finance API Service for Live Market Data
// Fetches real-time stock and market data from Yahoo Finance

// Use proxy in development, direct API in production (with CORS proxy fallback)
const getYahooFinanceUrl = (symbol, interval = '1d', range = '1d') => {
  // In development, use Vite proxy
  if (import.meta.env.DEV) {
    return `/api/yahoo/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
  }
  
  // In production, use CORS proxy as fallback
  // Using a public CORS proxy service
  const baseUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=${interval}&range=${range}`;
  return `https://api.allorigins.win/get?url=${encodeURIComponent(baseUrl)}`;
};

// Helper function to get API keys from localStorage
const getApiKeys = () => {
  try {
    const saved = localStorage.getItem('apiKeys');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch (error) {
    console.error('Error loading API keys from localStorage:', error);
  }
  // Default fallback keys
  return {
    finnhub: 'demo',
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

// Helper function to fetch from Yahoo Finance
export const fetchYahooFinance = async (symbol, interval = '1d', range = '1d') => {
  try {
    const url = getYahooFinanceUrl(symbol, interval, range);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Failed to fetch data for ${symbol}: ${response.status} ${response.statusText}. ${errorText}`);
    }
    
    let data = await response.json();
    
    // Handle CORS proxy response format
    if (data.contents) {
      try {
        data = typeof data.contents === 'string' ? JSON.parse(data.contents) : data.contents;
      } catch (parseError) {
        console.error('Error parsing CORS proxy response:', parseError);
        throw new Error('Failed to parse API response');
      }
    }
    
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
    
    return { data, source: 'yahoo' };
  } catch (error) {
    console.error(`Error fetching from Yahoo Finance ${symbol}:`, error);
    throw error;
  }
};

// Helper function to fetch from Finnhub (Backup API)
export const fetchFinnhub = async (symbol) => {
  try {
    const url = getFinnhubUrl(symbol);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
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
    
    if (data.c === null || data.c === undefined) {
      throw new Error('Invalid response: missing price data');
    }
    
    return { data, source: 'finnhub' };
  } catch (error) {
    console.error(`Error fetching from Finnhub ${symbol}:`, error);
    throw error;
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
export const fetchMarketData = async (symbol, interval = '1d', range = '1d') => {
  const preferredApi = getPreferredApi();
  
  // If user selected a specific API, try that first
  if (preferredApi === 'yahoo') {
    try {
      const result = await fetchYahooFinance(symbol, interval, range);
      return result;
    } catch (yahooError) {
      console.log(`Yahoo Finance failed for ${symbol}, trying fallback...`);
      // Fallback to other APIs
      try {
        const result = await fetchFinnhub(symbol);
        return result;
      } catch (finnhubError) {
        try {
          const result = await fetchMassive(symbol);
          return result;
        } catch (massiveError) {
          throw new Error(`Failed to fetch data: ${yahooError.message}`);
        }
      }
    }
  } else if (preferredApi === 'finnhub') {
    try {
      const result = await fetchFinnhub(symbol);
      return result;
    } catch (finnhubError) {
      console.log(`Finnhub failed for ${symbol}, trying fallback...`);
      // Fallback to other APIs
      try {
        const result = await fetchYahooFinance(symbol, interval, range);
        return result;
      } catch (yahooError) {
        try {
          const result = await fetchMassive(symbol);
          return result;
        } catch (massiveError) {
          throw new Error(`Failed to fetch data: ${finnhubError.message}`);
        }
      }
    }
  } else if (preferredApi === 'massive') {
    try {
      const result = await fetchMassive(symbol);
      return result;
    } catch (massiveError) {
      console.log(`Massive failed for ${symbol}, trying fallback...`);
      // Fallback to other APIs
      try {
        const result = await fetchYahooFinance(symbol, interval, range);
        return result;
      } catch (yahooError) {
        try {
          const result = await fetchFinnhub(symbol);
          return result;
        } catch (finnhubError) {
          throw new Error(`Failed to fetch data: ${massiveError.message}`);
        }
      }
    }
  } else {
    // Auto mode: Try Yahoo Finance first, then fallback
    try {
      const result = await fetchYahooFinance(symbol, interval, range);
      return result;
    } catch (yahooError) {
      console.log(`Yahoo Finance failed for ${symbol}, trying Finnhub backup...`);
      try {
        const result = await fetchFinnhub(symbol);
        return result;
      } catch (finnhubError) {
        console.log(`Finnhub failed for ${symbol}, trying Massive backup...`);
        try {
          const result = await fetchMassive(symbol);
          return result;
        } catch (massiveError) {
          console.error(`All APIs failed for ${symbol}`);
          throw new Error(`Failed to fetch data from all APIs: ${yahooError.message}`);
        }
      }
    }
  }
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

// Get price chart data for Trading page
export const getPriceChartData = async (symbol, interval = '1d') => {
  try {
    // Map intervals to Yahoo Finance format
    let yahooInterval = '1d';
    let range = '1mo'; // 1 month for daily data
    
    if (interval === '1H' || interval === '1h') {
      yahooInterval = '1h';
      range = '1d'; // 1 day for hourly data
    } else if (interval === '1D' || interval === '1d') {
      yahooInterval = '1d';
      range = '1mo'; // 1 month for daily data
    }
    
    const result = await fetchMarketData(symbol, yahooInterval, range);
    
    // Only Yahoo Finance provides historical chart data
    if (result.source === 'finnhub') {
      // For Finnhub, we can only get current quote, not historical
      // Return minimal data with current price
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
          volume: finnhubData.v || 0,
        }],
      };
    }
    
    const data = result.data;
    if (!data?.chart?.result?.[0]) {
      throw new Error('Invalid data format from API');
    }
    
    const chartResult = data.chart.result[0];
    const timestamps = chartResult.timestamp || [];
    const quotes = chartResult.indicators?.quote?.[0];
    
    if (!quotes) {
      throw new Error('No quote data available');
    }
    
    const closes = quotes.close || [];
    const opens = quotes.open || [];
    const highs = quotes.high || [];
    const lows = quotes.low || [];
    const volumes = quotes.volume || [];
    
    // Validate we have data
    if (timestamps.length === 0 || closes.length === 0) {
      throw new Error('No historical data available for this symbol');
    }
    
    // Get meta data for current price
    const meta = chartResult.meta;
    const currentPrice = meta?.regularMarketPrice || meta?.previousClose || closes[closes.length - 1] || 0;
    
    // Build data array, ensuring all arrays are aligned
    const chartData = [];
    const maxLength = Math.min(timestamps.length, closes.length);
    
    for (let i = 0; i < maxLength; i++) {
      const timestamp = timestamps[i];
      const close = closes[i];
      
      // Only include data points with valid timestamp and close price
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
  } catch (error) {
    console.error('Failed to fetch price chart data:', error);
    throw error;
  }
};
