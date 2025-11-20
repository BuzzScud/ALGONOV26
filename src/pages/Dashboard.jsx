import { useState, useEffect } from 'react';
import { fetchYahooFinance } from '../services/monitorService';
import { calculateUniversalDayNumber, getNumerologyForecast } from '../utils/numerology';

// Helper function to check if US market is currently open
const isMarketOpen = () => {
  const now = new Date();
  const easternTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const day = easternTime.getDay(); // 0 = Sunday, 6 = Saturday
  const hours = easternTime.getHours();
  const minutes = easternTime.getMinutes();
  const timeInMinutes = hours * 60 + minutes;
  
  // Market is closed on weekends
  if (day === 0 || day === 6) {
    return false;
  }
  
  // Regular market hours: 9:30 AM - 4:00 PM ET (930 - 960 minutes)
  const marketOpen = 9 * 60 + 30; // 9:30 AM
  const marketClose = 16 * 60; // 4:00 PM
  
  return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
};

// Helper function to determine market state
const getMarketState = (meta, fallbackToTimeCheck = true) => {
  // First, try to use the marketState from the API
  if (meta.marketState) {
    const state = meta.marketState.toUpperCase();
    // Yahoo Finance uses: REGULAR, PRE, POST, CLOSED, PREPRE, POSTPOST
    if (state === 'REGULAR') return 'REGULAR';
    if (state === 'PRE' || state === 'PREPRE') return 'PRE';
    if (state === 'POST' || state === 'POSTPOST') return 'POST';
    if (state === 'CLOSED') return 'CLOSED';
  }
  
  // Fallback: check if market is open based on current time
  if (fallbackToTimeCheck) {
    const marketOpen = isMarketOpen();
    return marketOpen ? 'REGULAR' : 'CLOSED';
  }
  
  return 'UNKNOWN';
};


// Helper function to get current stock price
const getStockPrice = async (symbol) => {
  try {
    // Use 5m interval to get more recent data when market is open
    // This helps get the latest price instead of just previous close
    const interval = isMarketOpen() ? '5m' : '1d';
    const range = isMarketOpen() ? '1d' : '1d';
    
    const response = await fetchYahooFinance(symbol, interval, range);
    
    // fetchYahooFinance returns { data, source: 'yahoo' }
    if (!response || !response.data) {
      throw new Error('Invalid response format');
    }
    
    const data = response.data;
    
    if (!data?.chart?.result?.[0]) {
      throw new Error('Invalid data format: missing chart result');
    }
    
    const result = data.chart.result[0];
    
    if (!result.meta) {
      throw new Error('Invalid data format: missing meta data');
    }
    
    const meta = result.meta;
    const quotes = result.indicators?.quote?.[0];
    
    // Get previous close first (this should always be available)
    const previousClose = meta.previousClose || meta.close || 0;
    
    // Get current price - prioritize real-time data when market is open
    let currentPrice = 0;
    
    // Priority 1: Use regularMarketPrice if available (most accurate for current price)
    if (meta.regularMarketPrice && meta.regularMarketPrice > 0) {
      currentPrice = meta.regularMarketPrice;
    }
    
    // Priority 2: Try to get the most recent price from quote data
    if ((!currentPrice || currentPrice === 0) && quotes && quotes.close && quotes.close.length > 0) {
      // Get the last non-null close price from the array
      for (let i = quotes.close.length - 1; i >= 0; i--) {
        const price = quotes.close[i];
        if (price !== null && price !== undefined && price > 0) {
          currentPrice = price;
          break;
        }
      }
    }
    
    // Priority 3: Try chartPreviousClose or other meta fields
    if (!currentPrice || currentPrice === 0) {
      currentPrice = meta.chartPreviousClose || meta.close || 0;
    }
    
    // Priority 4: If still no current price, use previousClose as last resort
    // But only if we're sure it's different (market closed scenario)
    if (!currentPrice || currentPrice === 0) {
      currentPrice = previousClose || meta.close || 0;
    }
    
    if (!currentPrice || currentPrice === 0) {
      throw new Error('Invalid data format: no valid price data');
    }
    
    // Calculate change - always compare current price to previous close
    let change = 0;
    let changePercent = 0;
    
    if (previousClose && previousClose > 0) {
      change = currentPrice - previousClose;
      changePercent = (change / previousClose) * 100;
    }
    
    // Determine market state with fallback to time-based check
    const marketState = getMarketState(meta, true);
    
    // Get volume data
    let volume = 0;
    if (meta.regularMarketVolume && meta.regularMarketVolume > 0) {
      volume = meta.regularMarketVolume;
    } else if (quotes && quotes.volume && quotes.volume.length > 0) {
      // Get the most recent non-null volume
      for (let i = quotes.volume.length - 1; i >= 0; i--) {
        const vol = quotes.volume[i];
        if (vol !== null && vol !== undefined && vol > 0) {
          volume = vol;
          break;
        }
      }
    }
    
    return {
      symbol,
      price: currentPrice,
      change,
      changePercent,
      previousClose: previousClose,
      marketState: marketState,
      volume: volume,
    };
  } catch (error) {
    console.error(`Error fetching ${symbol}:`, error);
    
    // If API fails, try to determine market state from time
    const marketState = isMarketOpen() ? 'REGULAR' : 'CLOSED';
    
    return {
      symbol,
      price: null,
      change: 0,
      changePercent: 0,
      previousClose: 0,
      marketState: marketState,
      volume: 0,
      error: error.message || 'Invalid data format',
    };
  }
};

// World Clock Component
function WorldClock({ timezone, city, country }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const formatted = formatter.formatToParts(time);
  const timeStr = formatted.find(p => p.type === 'hour').value + ':' + 
                  formatted.find(p => p.type === 'minute').value + ':' + 
                  formatted.find(p => p.type === 'second').value + ' ' + 
                  formatted.find(p => p.type === 'dayPeriod').value;
  const dateStr = formatted.find(p => p.type === 'month').value + ' ' + 
                  formatted.find(p => p.type === 'day').value + ', ' + 
                  formatted.find(p => p.type === 'year').value;

  // Calculate numerology for the date in this timezone
  // Extract date components from the formatted parts
  const monthName = formatted.find(p => p.type === 'month').value;
  const day = parseInt(formatted.find(p => p.type === 'day').value);
  const year = parseInt(formatted.find(p => p.type === 'year').value);
  
  // Convert month name to number (Jan=1, Feb=2, etc.)
  const monthMap = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
    'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
  };
  const month = monthMap[monthName] || 1;
  
  // Create a date object for numerology calculation
  const localDate = new Date(year, month - 1, day);
  const universalDayNumber = calculateUniversalDayNumber(localDate);
  const forecast = getNumerologyForecast(universalDayNumber);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">{city}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">{country}</p>
        <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2 font-mono">
          {timeStr}
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {dateStr}
        </div>
        
        {/* Daily Global Numerology Forecast */}
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center gap-2 mb-2">
            <span className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {forecast.number}
            </span>
            <span className="text-sm font-semibold text-gray-900 dark:text-white">
              {forecast.title}
            </span>
          </div>
          <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
            {forecast.description}
          </p>
        </div>
      </div>
    </div>
  );
}

// Volume Tooltip Component
function VolumeTooltip({ volume, symbol }) {
  if (!volume || volume === 0) {
    return null;
  }

  // Format volume with appropriate suffix
  const formatVolume = (vol) => {
    if (vol >= 1000000000) {
      return `${(vol / 1000000000).toFixed(2)}B`;
    } else if (vol >= 1000000) {
      return `${(vol / 1000000).toFixed(2)}M`;
    } else if (vol >= 1000) {
      return `${(vol / 1000).toFixed(2)}K`;
    }
    return vol.toLocaleString();
  };

  return (
    <div className="absolute z-50 w-56 p-4 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-200 bottom-full left-1/2 transform -translate-x-1/2 mb-3">
      <div className="text-xs font-semibold mb-2 text-gray-500 dark:text-gray-400 uppercase tracking-wide">{symbol} Volume</div>
      <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{formatVolume(volume)}</div>
      <div className="text-xs text-gray-600 dark:text-gray-400">Total shares traded</div>
      {/* Arrow pointing down */}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 -mt-px">
        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-white dark:border-t-gray-800"></div>
        <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-gray-200 dark:border-t-gray-700 absolute top-[1px]"></div>
      </div>
    </div>
  );
}

// Stock Info Card Component
function StockInfoCard({ symbol, data, loading, onRemove }) {
  if (loading) {
    return (
      <div className="relative group bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{symbol}</h3>
          <div className="flex items-center gap-2">
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-200 border-t-blue-600"></div>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Remove symbol"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">Loading...</p>
      </div>
    );
  }

  if (data?.error || data?.price === null) {
    return (
      <div className="relative group bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{symbol}</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 rounded">
              Error
            </span>
            {onRemove && (
              <button
                type="button"
                onClick={onRemove}
                className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                title="Remove symbol"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          {data?.error || 'Unable to fetch data'}
        </p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="relative group bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{symbol}</h3>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Remove symbol"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <p className="text-gray-500 dark:text-gray-400 text-sm">No data available</p>
      </div>
    );
  }

  const isPositive = data.change >= 0;
  
  // DXY and VIX don't use dollar signs
  const isIndex = symbol === 'DXY' || symbol === 'VIX';
  const pricePrefix = isIndex ? '' : '$';
  
  // Determine market status with better logic
  let marketStatus = 'Closed';
  let statusColor = 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
  
  if (data.marketState === 'REGULAR') {
    marketStatus = 'Open';
    statusColor = 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400';
  } else if (data.marketState === 'PRE' || data.marketState === 'PREPRE') {
    marketStatus = 'Pre-Market';
    statusColor = 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400';
  } else if (data.marketState === 'POST' || data.marketState === 'POSTPOST') {
    marketStatus = 'After Hours';
    statusColor = 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400';
  } else if (data.marketState === 'CLOSED') {
    marketStatus = 'Closed';
    statusColor = 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
  } else {
    // Fallback: check if market should be open based on time
    const marketOpen = isMarketOpen();
    if (marketOpen) {
      marketStatus = 'Open';
      statusColor = 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400';
    } else {
      marketStatus = 'Closed';
      statusColor = 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
    }
  }

  return (
    <div className="relative group bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      {/* Volume Tooltip */}
      {data && data.volume > 0 && (
        <VolumeTooltip volume={data.volume} symbol={symbol} />
      )}
      
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white">{symbol}</h3>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded ${statusColor}`}>
            {marketStatus}
          </span>
          {onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
              title="Remove symbol"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      <div className="mb-4">
        <p className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          {pricePrefix}{data.price.toFixed(2)}
        </p>
        <div className="flex items-center gap-2">
          <span className={`text-lg font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {data.change !== 0 ? (
              `${isPositive ? '+' : ''}${pricePrefix}${Math.abs(data.change).toFixed(2)}`
            ) : (
              `${pricePrefix}0.00`
            )}
          </span>
          <span className={`text-lg font-semibold ${isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
            {data.changePercent !== 0 ? (
              `(${isPositive ? '+' : ''}${Math.abs(data.changePercent).toFixed(2)}%)`
            ) : (
              '(0.00%)'
            )}
          </span>
        </div>
      </div>

      <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">Previous Close</span>
          <span className="text-gray-900 dark:text-white font-medium">
            {pricePrefix}{(data.previousClose || (data.price - data.change)).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  // Default symbols with their display names and API symbols
  const defaultSymbols = [
    { display: 'QQQ', api: 'QQQ' },
    { display: 'SPY', api: 'SPY' },
    { display: 'DXY', api: 'DX-Y.NYB' },
    { display: 'VIX', api: '^VIX' },
  ];

  // Load symbols from localStorage or use defaults
  const [symbols, setSymbols] = useState(() => {
    try {
      const saved = localStorage.getItem('dashboardSymbols');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Error loading symbols from localStorage:', error);
    }
    return defaultSymbols;
  });

  const [stockData, setStockData] = useState({});
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [newSymbolInput, setNewSymbolInput] = useState('');
  const [addingSymbol, setAddingSymbol] = useState(false);

  // Save symbols to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('dashboardSymbols', JSON.stringify(symbols));
  }, [symbols]);

  const loadStockData = async () => {
    setLoading(true);
    try {
      // Fetch all symbols in parallel with timeout
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );
      
      const dataPromises = symbols.map(symbolConfig => 
        getStockPrice(symbolConfig.api).then(data => ({
          ...data,
          displaySymbol: symbolConfig.display,
        })).catch(error => ({
          symbol: symbolConfig.display,
          displaySymbol: symbolConfig.display,
          price: null,
          change: 0,
          changePercent: 0,
          previousClose: 0,
          marketState: isMarketOpen() ? 'REGULAR' : 'CLOSED',
          error: 'Failed to fetch data. Please try again.',
        }))
      );
      
      const results = await Promise.race([
        Promise.all(dataPromises),
        timeoutPromise
      ]);
      
      // Convert results to object keyed by display symbol
      const dataMap = {};
      results.forEach((data, index) => {
        const displaySymbol = symbols[index].display;
        dataMap[displaySymbol] = {
          ...data,
          symbol: displaySymbol,
        };
      });
      
      setStockData(dataMap);
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error loading stock data:', error);
      // Set error state for any missing data
      const errorData = {};
      symbols.forEach(symbolConfig => {
        if (!stockData[symbolConfig.display]) {
          errorData[symbolConfig.display] = {
            symbol: symbolConfig.display,
            price: null,
            change: 0,
            changePercent: 0,
            previousClose: 0,
            marketState: isMarketOpen() ? 'REGULAR' : 'CLOSED',
            error: 'Failed to fetch data. Please try again.',
          };
        }
      });
      setStockData(prev => ({ ...prev, ...errorData }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStockData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadStockData, 30000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [symbols.length]); // Reload when symbols count changes

  const addSymbol = async () => {
    const symbolToAdd = newSymbolInput.trim().toUpperCase();
    if (!symbolToAdd) {
      return;
    }

    // Check if symbol already exists
    if (symbols.some(s => s.display === symbolToAdd || s.api === symbolToAdd)) {
      alert('Symbol already exists');
      setNewSymbolInput('');
      return;
    }

    setAddingSymbol(true);
    try {
      // Test if symbol is valid by trying to fetch it
      const testData = await getStockPrice(symbolToAdd);
      if (testData.error || testData.price === null) {
        alert(`Invalid symbol: ${symbolToAdd}. Please check the symbol and try again.`);
        setAddingSymbol(false);
        return;
      }

      // Add the symbol
      const newSymbol = { display: symbolToAdd, api: symbolToAdd };
      setSymbols([...symbols, newSymbol]);
      setNewSymbolInput('');
      
      // Immediately fetch data for the new symbol
      const newData = await getStockPrice(symbolToAdd);
      setStockData(prev => ({
        ...prev,
        [symbolToAdd]: {
          ...newData,
          symbol: symbolToAdd,
        },
      }));
    } catch (error) {
      console.error('Error adding symbol:', error);
      alert(`Failed to add symbol: ${symbolToAdd}. Please check the symbol and try again.`);
    } finally {
      setAddingSymbol(false);
    }
  };

  const removeSymbol = (displaySymbol) => {
    if (symbols.length <= 1) {
      alert('You must have at least one symbol on the dashboard');
      return;
    }
    setSymbols(symbols.filter(s => s.display !== displaySymbol));
    setStockData(prev => {
      const updated = { ...prev };
      delete updated[displaySymbol];
      return updated;
    });
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !addingSymbol) {
      addSymbol();
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Real-time market data and world clocks</p>
      </div>

      {/* World Clocks Section */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">World Clocks</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <WorldClock timezone="America/New_York" city="New York" country="United States" />
          <WorldClock timezone="Europe/London" city="London" country="United Kingdom" />
          <WorldClock timezone="Asia/Tokyo" city="Tokyo" country="Japan" />
          <WorldClock timezone="Australia/Sydney" city="Sydney" country="Australia" />
        </div>
      </div>

      {/* Stock Prices Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Market</h2>
          <div className="flex items-center gap-4">
            {lastUpdate && (
              <span className="text-xs text-gray-500 dark:text-gray-400">
                Last updated: {lastUpdate.toLocaleTimeString('en-US', { timeZone: 'America/New_York' })}
              </span>
            )}
            <button
              type="button"
              onClick={loadStockData}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
        
        {/* Add Symbol Input */}
        <div className="mb-4 flex gap-2">
          <input
            type="text"
            value={newSymbolInput}
            onChange={(e) => setNewSymbolInput(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            placeholder="Enter symbol (e.g., AAPL, TSLA, MSFT)"
            disabled={addingSymbol}
            className="flex-1 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={addSymbol}
            disabled={addingSymbol || !newSymbolInput.trim()}
            className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {addingSymbol ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Adding...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add Symbol
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {symbols.map((symbolConfig) => (
            <StockInfoCard
              key={symbolConfig.display}
              symbol={symbolConfig.display}
              data={stockData[symbolConfig.display] || null}
              loading={loading && !stockData[symbolConfig.display]}
              onRemove={symbols.length > 1 ? () => removeSymbol(symbolConfig.display) : null}
            />
          ))}
        </div>
      </div>

      {/* To-Do List Section */}
      <TodoList />
    </div>
  );
}

// To-Do List Component
function TodoList() {
  const [todos, setTodos] = useState([]);
  const [inputValue, setInputValue] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');

  // Load todos from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('dashboardTodos');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Filter out todos from previous days
        const today = new Date().toDateString();
        const todayTodos = parsed.filter(todo => {
          const todoDate = new Date(todo.createdAt).toDateString();
          return todoDate === today;
        });
        setTodos(todayTodos);
        // Update localStorage with filtered todos
        if (todayTodos.length !== parsed.length) {
          localStorage.setItem('dashboardTodos', JSON.stringify(todayTodos));
        }
      } catch (e) {
        console.error('Error loading todos:', e);
      }
    }
  }, []);

  // Save todos to localStorage whenever they change
  useEffect(() => {
    if (todos.length > 0 || localStorage.getItem('dashboardTodos')) {
      localStorage.setItem('dashboardTodos', JSON.stringify(todos));
    }
  }, [todos]);

  const addTodo = () => {
    if (inputValue.trim()) {
      const newTodo = {
        id: Date.now(),
        text: inputValue.trim(),
        completed: false,
        createdAt: new Date().toISOString(),
      };
      setTodos([...todos, newTodo]);
      setInputValue('');
    }
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const startEdit = (todo) => {
    setEditingId(todo.id);
    setEditValue(todo.text);
  };

  const saveEdit = () => {
    if (editValue.trim()) {
      setTodos(todos.map(todo =>
        todo.id === editingId ? { ...todo, text: editValue.trim() } : todo
      ));
      setEditingId(null);
      setEditValue('');
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const handleKeyPress = (e, action) => {
    if (e.key === 'Enter') {
      action();
    } else if (e.key === 'Escape' && action === cancelEdit) {
      cancelEdit();
    }
  };

  const completedCount = todos.filter(todo => todo.completed).length;
  const totalCount = todos.length;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Today's To-Do List</h2>
          {totalCount > 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {completedCount} of {totalCount} completed
            </p>
          )}
        </div>
        {totalCount > 0 && (
          <button
            type="button"
            onClick={() => setTodos([])}
            className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      {/* Add Todo Input */}
      <div className="flex gap-2 mb-6">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={(e) => handleKeyPress(e, addTodo)}
          placeholder="Add a new task..."
          className="flex-1 px-4 py-2 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white transition-all"
        />
        <button
          type="button"
          onClick={addTodo}
          className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add
        </button>
      </div>

      {/* Todo List */}
      {todos.length === 0 ? (
        <div className="text-center py-12">
          <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-500 dark:text-gray-400">No tasks for today. Add one above to get started!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {todos.map((todo) => (
            <div
              key={todo.id}
              className={`flex items-center gap-3 p-4 rounded-lg border transition-all ${
                todo.completed
                  ? 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleTodo(todo.id)}
                className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                  todo.completed
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-300 dark:border-gray-600 hover:border-green-500'
                }`}
              >
                {todo.completed && (
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>

              {editingId === todo.id ? (
                <div className="flex-1 flex gap-2">
                  <input
                    type="text"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    onKeyPress={(e) => handleKeyPress(e, saveEdit)}
                    onKeyDown={(e) => handleKeyPress(e, cancelEdit)}
                    className="flex-1 px-3 py-1 border-2 border-blue-500 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={saveEdit}
                    className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={cancelEdit}
                    className="px-3 py-1 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-400 dark:hover:bg-gray-500 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <span
                    className={`flex-1 text-gray-900 dark:text-white cursor-pointer ${
                      todo.completed ? 'line-through text-gray-500 dark:text-gray-400' : ''
                    }`}
                    onDoubleClick={() => startEdit(todo)}
                  >
                    {todo.text}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(todo)}
                      className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteTodo(todo.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dashboard;
