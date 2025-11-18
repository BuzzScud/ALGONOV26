import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { Chart } from 'react-chartjs-2';
import { CandlestickController, CandlestickElement } from 'chartjs-chart-financial';
import { getPriceChartData } from '../services/monitorService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  CandlestickController,
  CandlestickElement
);

// Safe wrapper component for candlestick charts to prevent crashes
function CandlestickChartWrapper({ chartType, candlestickData, chartData, symbol, currentInterval, lineChartOptions, candlestickChartOptions }) {
  if (chartType === 'candlestick') {
    try {
      // Validate candlestick data exists and is valid
      if (!candlestickData || !candlestickData.datasets || !candlestickData.datasets[0] || !candlestickData.datasets[0].data || candlestickData.datasets[0].data.length === 0) {
        throw new Error('Candlestick data not available');
      }

      // Validate data structure
      const isValid = candlestickData.datasets[0].data.every(point => 
        point && 
        typeof point === 'object' && 
        'o' in point && 
        'h' in point && 
        'l' in point && 
        'c' in point &&
        !isNaN(Number(point.o)) &&
        !isNaN(Number(point.h)) &&
        !isNaN(Number(point.l)) &&
        !isNaN(Number(point.c))
      );

      if (!isValid) {
        throw new Error('Invalid candlestick data structure');
      }

      // Render candlestick chart
      return (
        <Chart
          key={`candlestick-${symbol}-${currentInterval}`}
          type="candlestick"
          data={candlestickData}
          options={candlestickChartOptions}
        />
      );
    } catch (error) {
      console.error('Candlestick chart error:', error);
      // Fallback to line chart
      if (chartData && chartData.datasets && chartData.datasets[0]) {
        return (
          <Line
            key={`line-fallback-${symbol}-${currentInterval}`}
            data={chartData}
            options={lineChartOptions}
          />
        );
      }
      return (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-red-500 dark:text-red-400 text-sm">Unable to display candlestick chart. Showing line chart instead.</p>
        </div>
      );
    }
  }

  // Default to line chart
  if (chartData && chartData.datasets && chartData.datasets[0]) {
    return (
      <Line
        key={`line-${symbol}-${currentInterval}`}
        data={chartData}
        options={lineChartOptions}
      />
    );
  }

  return null;
}

function Trading() {
  const [symbol, setSymbol] = useState('QQQ');
  const [interval, setInterval] = useState('1D');
  const [chartData, setChartData] = useState(null);
  const [volumeData, setVolumeData] = useState(null);
  const [candlestickData, setCandlestickData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [currentInterval, setCurrentInterval] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [showRecentSearches, setShowRecentSearches] = useState(false);
  const [chartType, setChartType] = useState('line'); // 'line' or 'candlestick'
  const autoRefreshIntervalRef = useRef(null);
  const inputRef = useRef(null);
  const chartDataRef = useRef(null);
  const volumeDataRef = useRef(null);
  const candlestickDataRef = useRef(null);
  
  // Stable chart options to prevent re-renders
  const lineChartOptions = useRef({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
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
          display: false,
        },
        ticks: {
          maxTicksLimit: 10,
          font: {
            size: 11,
          },
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
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  });

  const barChartOptions = useRef({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
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
            const value = context.parsed.y;
            if (value >= 1000000) {
              return `Volume: ${(value / 1000000).toFixed(2)}M`;
            } else if (value >= 1000) {
              return `Volume: ${(value / 1000).toFixed(2)}K`;
            }
            return `Volume: ${value}`;
          },
        },
      },
    },
    scales: {
      x: {
        display: true,
        grid: {
          display: false,
        },
        ticks: {
          maxTicksLimit: 10,
          font: {
            size: 11,
          },
        },
      },
      y: {
        beginAtZero: true,
        grid: {
          color: 'rgba(0, 0, 0, 0.05)',
          drawBorder: false,
        },
        ticks: {
          callback: function(value) {
            if (value >= 1000000) {
              return (value / 1000000).toFixed(1) + 'M';
            } else if (value >= 1000) {
              return (value / 1000).toFixed(1) + 'K';
            }
            return value;
          },
          font: {
            size: 11,
          },
        },
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  });

  const candlestickChartOptions = useRef({
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
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
            const point = context.raw;
            if (point && typeof point === 'object' && 'o' in point && 'h' in point && 'l' in point && 'c' in point) {
              return [
                `Open: $${point.o.toFixed(2)}`,
                `High: $${point.h.toFixed(2)}`,
                `Low: $${point.l.toFixed(2)}`,
                `Close: $${point.c.toFixed(2)}`,
              ];
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
          display: false,
        },
        ticks: {
          maxTicksLimit: 10,
          font: {
            size: 11,
          },
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
      },
    },
    interaction: {
      mode: 'nearest',
      axis: 'x',
      intersect: false,
    },
  });

  const loadChartData = useCallback(async () => {
    if (!symbol || !symbol.trim()) {
      setError('Please enter a stock symbol');
      return;
    }

    // Prevent flashing by not clearing data immediately
    const previousChartData = chartData;
    const previousVolumeData = volumeData;
    
    setLoading(true);
    setError(null);
    
    try {
      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout. Please try again.')), 20000)
      );
      
      const dataPromise = getPriceChartData(symbol.toUpperCase().trim(), interval);
      const data = await Promise.race([dataPromise, timeoutPromise]);
      
      // Validate data structure
      if (!data) {
        throw new Error('No data received from API');
      }
      
      if (!data.data || !Array.isArray(data.data)) {
        throw new Error('Invalid data format: data.data is not an array');
      }
      
      if (data.data.length === 0) {
        throw new Error('No chart data available for this symbol');
      }
      
      // Filter out null/undefined values and ensure data integrity
      const validData = data.data.filter((d) => {
        if (!d || !d.timestamp) return false;
        const close = d.close;
        return close !== null && close !== undefined && !isNaN(close) && close > 0;
      });
      
      if (validData.length === 0) {
        throw new Error('No valid price data available. All data points are invalid.');
      }
      
      // Sort by timestamp to ensure chronological order
      validData.sort((a, b) => a.timestamp - b.timestamp);
      
      const labels = validData.map((d) => {
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
      
      const prices = validData.map((d) => {
        const price = Number(d.close);
        return isNaN(price) ? null : price;
      }).filter(price => price !== null);
      
      const volumes = validData.map((d) => {
        const vol = Number(d.volume) || 0;
        return isNaN(vol) ? 0 : vol;
      });
      
      // Ensure labels and prices arrays match
      const minLength = Math.min(labels.length, prices.length, volumes.length);
      const finalLabels = labels.slice(0, minLength);
      const finalPrices = prices.slice(0, minLength);
      const finalVolumes = volumes.slice(0, minLength);
      
      if (finalPrices.length === 0) {
        throw new Error('No valid price data to display after processing');
      }
      
      const firstPrice = finalPrices[0];
      const lastPrice = finalPrices[finalPrices.length - 1];
      const change = lastPrice - firstPrice;
      const changePercent = firstPrice !== 0 ? (change / firstPrice) * 100 : 0;
      
      // Create stable chart data objects
      const chartDataObj = {
        labels: finalLabels,
        datasets: [
          {
            label: `${symbol.toUpperCase()} Price`,
            data: finalPrices,
            borderColor: change >= 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
            backgroundColor: change >= 0 ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
            tension: 0.4,
            fill: true,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 2,
          },
        ],
        currentPrice: data.currentPrice || lastPrice,
        change: change,
        changePercent: changePercent,
      };
      
      const volumeDataObj = {
        labels: finalLabels,
        datasets: [
          {
            label: 'Volume',
            data: finalVolumes,
            backgroundColor: 'rgba(59, 130, 246, 0.5)',
            borderColor: 'rgba(59, 130, 246, 1)',
            borderWidth: 1,
          },
        ],
      };
      
      // Create candlestick data from OHLC data
      // chartjs-chart-financial expects data in format: {x, o, h, l, c}
      const candlestickDataPoints = validData.slice(0, minLength).map((d, idx) => {
        const open = Number(d.open) || Number(d.close) || 0;
        const high = Number(d.high) || Number(d.close) || 0;
        const low = Number(d.low) || Number(d.close) || 0;
        const close = Number(d.close) || 0;
        
        return {
          x: idx, // Use index for x-axis, labels will be used for display
          o: open,
          h: high,
          l: low,
          c: close,
        };
      });
      
      const candlestickDataObj = {
        labels: finalLabels,
        datasets: [
          {
            label: `${symbol.toUpperCase()} Candlestick`,
            data: candlestickDataPoints,
          },
        ],
      };
      
      // Update refs first for stable references
      chartDataRef.current = chartDataObj;
      volumeDataRef.current = volumeDataObj;
      candlestickDataRef.current = candlestickDataObj;
      
      // Update state with new data
      setChartData(chartDataObj);
      setVolumeData(volumeDataObj);
      setCandlestickData(candlestickDataObj);
      setCurrentInterval(interval);
      setLastRefresh(new Date());
      
      // Add to recent searches (update localStorage without causing re-render)
      const searchKey = `${symbol.toUpperCase()}-${interval}`;
      setRecentSearches(prev => {
        const filtered = prev.filter(s => s !== searchKey);
        const newSearches = [searchKey, ...filtered].slice(0, 5);
        localStorage.setItem('tradingRecentSearches', JSON.stringify(newSearches));
        return newSearches;
      });
    } catch (err) {
      const errorMessage = err.message || 'Failed to load chart data. Please check the symbol and try again.';
      setError(errorMessage);
      // Only clear data if we don't have previous data to prevent flashing
      if (!previousChartData) {
        setChartData(null);
        setVolumeData(null);
        setCandlestickData(null);
      }
    } finally {
      setLoading(false);
    }
  }, [symbol, interval]);

  // Load recent searches from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem('tradingRecentSearches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        // Silently fail
      }
    }
  }, []);

  // Auto-load QQQ on mount
  useEffect(() => {
    if (symbol === 'QQQ' && !chartData) {
      loadChartData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Safety: Reset to line chart if candlestick data is not available
  useEffect(() => {
    if (chartType === 'candlestick' && (!candlestickData || !candlestickData.datasets || !candlestickData.datasets[0] || !candlestickData.datasets[0].data || candlestickData.datasets[0].data.length === 0)) {
      console.warn('Candlestick data not available, resetting to line chart');
      setChartType('line');
    }
  }, [chartType, candlestickData]);

  const handleSearch = () => {
    if (symbol && symbol.trim()) {
      loadChartData();
      setShowRecentSearches(false);
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
      // Auto-search when interval changes if we have a symbol
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

  // Auto-refresh disabled - charts only refresh when user clicks refresh button

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (autoRefreshIntervalRef.current) {
        clearInterval(autoRefreshIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Trading Dashboard</h1>
        <p className="text-gray-600 dark:text-gray-400">Real-time stock market data and analysis</p>
      </div>

      {/* Search Section */}
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
                  // Delay hiding to allow click on recent searches
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
              
              {/* Recent Searches Dropdown */}
              {showRecentSearches && recentSearches.length > 0 && !loading && (
                <div className="absolute z-10 w-full mt-2 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-48 overflow-y-auto">
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
            <button
              type="button"
              onClick={handleSearch}
              disabled={loading || !symbol || !symbol.trim()}
              className="w-full lg:w-auto px-8 py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-700 hover:to-blue-800 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
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

        {/* Price Summary Card */}
        {(chartData || loading) && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Current Price</p>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                {loading && !chartData ? (
                  <span className="text-gray-400">Loading...</span>
                ) : (
                  `$${chartData?.currentPrice?.toFixed(2) || 'N/A'}`
                )}
              </p>
            </div>
            <div className={`rounded-lg p-4 border ${
              !chartData || chartData.change >= 0 
                ? 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800'
                : 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800'
            }`}>
              <p className="text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Change</p>
              <p className={`text-xl font-bold ${
                !chartData || chartData.change >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
              }`}>
                {loading && !chartData ? (
                  <span className="text-gray-400">--</span>
                ) : chartData ? (
                  `${chartData.change >= 0 ? '+' : ''}$${chartData.change.toFixed(2)}`
                ) : (
                  '--'
                )}
              </p>
            </div>
            <div className={`rounded-lg p-4 border ${
              !chartData || chartData.changePercent >= 0 
                ? 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-800'
                : 'bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 border-red-200 dark:border-red-800'
            }`}>
              <p className="text-xs font-medium mb-1 text-gray-600 dark:text-gray-400">Change %</p>
              <p className={`text-xl font-bold ${
                !chartData || chartData.changePercent >= 0 ? 'text-green-700 dark:text-green-300' : 'text-red-700 dark:text-red-300'
              }`}>
                {loading && !chartData ? (
                  <span className="text-gray-400">--</span>
                ) : chartData ? (
                  `${chartData.changePercent >= 0 ? '+' : ''}${chartData.changePercent.toFixed(2)}%`
                ) : (
                  '--'
                )}
              </p>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
              <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Interval</p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">
                {currentInterval || 'N/A'}
              </p>
            </div>
          </div>
        )}

        {/* Last Refresh Info */}
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

      {/* Price Chart Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Price Chart</h3>
            {symbol && currentInterval && (
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {symbol.toUpperCase()} - {currentInterval} interval
              </p>
            )}
          </div>
          {chartData && (
            <div className="flex gap-2 bg-gray-100 dark:bg-gray-700 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => {
                  try {
                    setChartType('line');
                  } catch (error) {
                    console.error('Error switching to line chart:', error);
                  }
                }}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  chartType === 'line'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                Line
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  try {
                    // Only allow candlestick if we have valid candlestick data
                    if (candlestickData && 
                        candlestickData.datasets && 
                        candlestickData.datasets[0] && 
                        candlestickData.datasets[0].data && 
                        candlestickData.datasets[0].data.length > 0) {
                      // Additional validation before switching
                      const firstPoint = candlestickData.datasets[0].data[0];
                      if (firstPoint && 'o' in firstPoint && 'h' in firstPoint && 'l' in firstPoint && 'c' in firstPoint) {
                        setChartType('candlestick');
                      } else {
                        console.warn('Candlestick data structure invalid, staying on line chart');
                        setChartType('line');
                      }
                    } else {
                      console.warn('Candlestick data not available, staying on line chart');
                      setChartType('line');
                    }
                  } catch (error) {
                    console.error('Error switching to candlestick chart:', error);
                    // Always fallback to line chart on error
                    setChartType('line');
                  }
                }}
                disabled={!candlestickData || !candlestickData.datasets || !candlestickData.datasets[0] || !candlestickData.datasets[0].data || candlestickData.datasets[0].data.length === 0}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                  chartType === 'candlestick'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                Candlestick
              </button>
            </div>
          )}
        </div>
        <div className="h-[500px] relative">
          {chartData && chartData.labels && chartData.labels.length > 0 && chartData.datasets && chartData.datasets[0] && chartData.datasets[0].data && chartData.datasets[0].data.length > 0 ? (
            <>
              {loading && (
                <div className="absolute inset-0 bg-white/90 dark:bg-gray-800/90 z-10 flex items-center justify-center backdrop-blur-sm">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-200 border-t-blue-600 mx-auto"></div>
                  </div>
                </div>
              )}
              <CandlestickChartWrapper
                chartType={chartType}
                candlestickData={candlestickData}
                chartData={chartData}
                symbol={symbol}
                currentInterval={currentInterval}
                lineChartOptions={lineChartOptions.current}
                candlestickChartOptions={candlestickChartOptions.current}
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

      {/* Volume Chart Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="mb-4">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white">Trading Volume</h3>
          {symbol && (
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {symbol.toUpperCase()} trading volume over time
            </p>
          )}
        </div>
        <div className="h-[350px] relative">
          {volumeData && volumeData.labels && volumeData.labels.length > 0 ? (
            <>
              {loading && (
                <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 z-10 flex items-center justify-center">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-200 border-t-blue-600 mx-auto"></div>
                  </div>
                </div>
              )}
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <Bar
                  data={volumeData}
                  options={barChartOptions.current}
                />
              </div>
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-500 dark:text-gray-400">No volume data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Trading;

