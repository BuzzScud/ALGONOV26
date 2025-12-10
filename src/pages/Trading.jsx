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
    <div className="w-full max-w-[1800px] mx-auto px-4 flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="text-center mb-3 flex-shrink-0">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
          Charts
        </h1>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Real-time stock market data and analysis
        </p>
      </div>

      {/* Input Controls - Compact Row */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 border border-gray-200 dark:border-gray-700 mb-3 flex-shrink-0">
        <div className="flex flex-wrap items-end gap-3">
          {/* Symbol Input */}
          <div className="flex-1 min-w-[160px] relative">
            <label htmlFor="symbol" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Symbol
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
                placeholder="AAPL, TSLA, MSFT"
                className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
              />
              {symbol && (
                <button
                  type="button"
                  onClick={() => {
                    setSymbol('');
                    setShowRecentSearches(false);
                    inputRef.current?.focus();
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
              
              {/* Recent Searches Dropdown */}
              {showRecentSearches && recentSearches.length > 0 && !loading && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg max-h-32 overflow-y-auto">
                  <div className="px-2 py-1 text-xs font-semibold text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600">
                    Recent
                  </div>
                  {recentSearches.map((searchKey) => {
                    const [sym, int] = searchKey.split('-');
                    return (
                      <button
                        key={searchKey}
                        type="button"
                        onClick={() => handleRecentSearch(searchKey)}
                        className="w-full px-2 py-1.5 text-left hover:bg-gray-100 dark:hover:bg-gray-600 flex items-center justify-between transition-colors text-sm"
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

          {/* Time Interval */}
          <div className="min-w-[100px]">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Interval
            </label>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => handleIntervalChange('1D')}
                className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
                  interval === '1D'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                1D
              </button>
              <button
                type="button"
                onClick={() => handleIntervalChange('1H')}
                className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
                  interval === '1H'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                }`}
              >
                1H
              </button>
            </div>
          </div>

          {/* Search Button */}
          <button
            type="button"
            onClick={handleSearch}
            disabled={loading || !symbol || !symbol.trim()}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            {loading ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Loading...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                Search
              </>
            )}
          </button>
        </div>

        {/* Market Data Summary - Shows when data is loaded */}
        {chartData && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-gray-500 dark:text-gray-400">Symbol:</span>
                <span className="font-bold text-gray-900 dark:text-white">{symbol}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500 dark:text-gray-400">Current:</span>
                <span className="font-semibold text-gray-900 dark:text-white">${chartData?.currentPrice?.toFixed(2) || 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500 dark:text-gray-400">Change:</span>
                <span className={`font-semibold ${chartData?.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {chartData?.change >= 0 ? '+' : ''}${chartData?.change?.toFixed(2) || '0.00'} ({chartData?.changePercent >= 0 ? '+' : ''}{chartData?.changePercent?.toFixed(2) || '0.00'}%)
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500 dark:text-gray-400">Interval:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">{currentInterval || 'N/A'}</span>
              </div>
              {lastRefresh && (
                <div className="flex items-center gap-1">
                  <svg className="w-3 h-3 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-gray-500 dark:text-gray-400 text-[10px]">
                    {lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}
              {chartData && (
                <button
                  type="button"
                  onClick={handleRefresh}
                  disabled={loading}
                  className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 disabled:text-gray-400 transition-colors text-xs"
                >
                  <svg className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                  Refresh
                </button>
              )}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 rounded text-xs flex items-center gap-1.5">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        )}
      </div>

      {/* Main Content - Charts */}
      {!chartData && !loading ? (
        /* Initial State - Before Search */
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-8 text-center flex-1">
          <div className="max-w-md mx-auto">
            <svg className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Enter a Symbol to Get Started</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              Search for a stock symbol to view real-time price charts and trading volume.
            </p>
            <div className="flex flex-wrap justify-center gap-2">
              {['AAPL', 'TSLA', 'MSFT', 'QQQ', 'SPY', 'NVDA'].map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setSymbol(s);
                    setTimeout(() => handleSearch(), 100);
                  }}
                  className="px-3 py-1.5 text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded-lg hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
          {/* Price Chart Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col min-h-0" style={{ flex: '1 1 60%' }}>
            <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                Price Chart
                {symbol && (
                  <span className="text-xs font-normal text-gray-500 dark:text-gray-400 ml-1">
                    ({symbol.toUpperCase()})
                  </span>
                )}
              </h2>
              {chartData && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      try {
                        setChartType('line');
                      } catch (error) {
                        console.error('Error switching to line chart:', error);
                      }
                    }}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                      chartType === 'line'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
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
                        if (candlestickData && 
                            candlestickData.datasets && 
                            candlestickData.datasets[0] && 
                            candlestickData.datasets[0].data && 
                            candlestickData.datasets[0].data.length > 0) {
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
                        setChartType('line');
                      }
                    }}
                    disabled={!candlestickData || !candlestickData.datasets || !candlestickData.datasets[0] || !candlestickData.datasets[0].data || candlestickData.datasets[0].data.length === 0}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-all ${
                      chartType === 'candlestick'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    } disabled:opacity-50 disabled:cursor-not-allowed`}
                  >
                    Candlestick
                  </button>
                </div>
              )}
            </div>
            <div className="p-2 flex-1 min-h-0">
              <div className="w-full h-full relative">
                {chartData && chartData.labels && chartData.labels.length > 0 && chartData.datasets && chartData.datasets[0] && chartData.datasets[0].data && chartData.datasets[0].data.length > 0 ? (
                  <>
                    {loading && (
                      <div className="absolute inset-0 bg-white/90 dark:bg-gray-800/90 z-10 flex items-center justify-center backdrop-blur-sm rounded">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-200 border-t-blue-600 mx-auto"></div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Updating...</p>
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
                      <p className="text-gray-600 dark:text-gray-400 font-medium text-sm">Loading chart data...</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">Please wait</p>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <p className="text-sm text-gray-600 dark:text-gray-400 font-medium mb-1">No chart data available</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Please try searching again</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Volume Chart Section */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col min-h-0" style={{ flex: '1 1 40%' }}>
            <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Trading Volume
              </h2>
            </div>
            <div className="p-2 flex-1 min-h-0">
              <div className="w-full h-full relative">
                {volumeData && volumeData.labels && volumeData.labels.length > 0 ? (
                  <>
                    {loading && (
                      <div className="absolute inset-0 bg-white/80 dark:bg-gray-800/80 z-10 flex items-center justify-center backdrop-blur-sm rounded">
                        <div className="text-center">
                          <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-200 border-t-blue-600 mx-auto"></div>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Updating...</p>
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
                ) : loading ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-10 w-10 border-3 border-green-200 border-t-green-600 mx-auto mb-3"></div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Loading volume data...</p>
                    </div>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <p className="text-xs text-gray-500 dark:text-gray-400">No volume data available</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Trading;

