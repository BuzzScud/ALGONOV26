import { useState, useEffect, useRef } from 'react';
import ApexCharts from 'apexcharts';
import { fetchMarketData } from '../services/monitorService';
import '../styles/FIB.css';

// Custom Fibonacci ratios
const RETRACEMENT_LEVELS = [
  { ratio: 0, label: '0.0' },
  { ratio: 0.5, label: '0.5' },
  { ratio: 1, label: '1.0' },
  { ratio: 1.382, label: '1.382' },
  { ratio: 1.618, label: '1.618' },
  { ratio: 2, label: '2.0' },
  { ratio: 2.382, label: '2.382' },
  { ratio: 2.618, label: '2.618' },
  { ratio: 3, label: '3.0' },
  { ratio: 3.382, label: '3.382' },
  { ratio: 3.618, label: '3.618' },
  { ratio: 4.24, label: '4.24' },
  { ratio: 5.08, label: '5.08' },
  { ratio: 6.86, label: '6.86' },
  { ratio: 11.01, label: '11.01' }
];

const EXTENSION_LEVELS = [
  { ratio: -11.01, label: '-11.01' },
  { ratio: -6.86, label: '-6.86' },
  { ratio: -5.08, label: '-5.08' },
  { ratio: -4.24, label: '-4.24' },
  { ratio: -3.618, label: '-3.618' },
  { ratio: -3.382, label: '-3.382' },
  { ratio: -3, label: '-3.0' },
  { ratio: -2.618, label: '-2.618' },
  { ratio: -2.382, label: '-2.382' },
  { ratio: -2, label: '-2.0' },
  { ratio: -1.618, label: '-1.618' },
  { ratio: -1.382, label: '-1.382' },
  { ratio: -1, label: '-1.0' },
  { ratio: -0.5, label: '-0.5' }
];

function FIB() {
  const [symbol, setSymbol] = useState('AAPL');
  const [precision, setPrecision] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [priceInfo, setPriceInfo] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  // Fetch market data using the monitorService (properly handles Yahoo Finance API)
  const fetchFIBMarketData = async (symbolValue, period, anchorMode) => {
    try {
      // Map period to Yahoo Finance range and interval
      // For YTD, we need range='ytd' and interval='1d'
      const range = period === 'ytd' ? 'ytd' : '1y';
      const interval = '1d'; // Daily data for YTD
      
      // Use the monitorService fetchMarketData which properly handles the API
      const result = await fetchMarketData(symbolValue, interval, range);
      
      // Check if we got Yahoo Finance data (required for historical chart data)
      if (result.source !== 'yahoo') {
        throw new Error('Yahoo Finance data is required for chart display. Please try again.');
      }
      
      const data = result.data;
      
      if (!data || !data.chart || !data.chart.result || data.chart.result.length === 0) {
        throw new Error('No data available for this symbol');
      }

      const chartResult = data.chart.result[0];
      const meta = chartResult.meta;
      const quotes = chartResult.indicators?.quote?.[0];
      const timestamps = chartResult.timestamp;
      
      if (!quotes) {
        throw new Error('No quote data available for this symbol');
      }
      
      if (!timestamps || timestamps.length === 0) {
        throw new Error('No timestamp data available');
      }
      
      // Get high and low based on anchor mode
      let high, low, anchorInfo;
      
      if (anchorMode === 'first_day') {
        // Find first trading day of the year (January 2, 2025 or first available)
        const currentYear = new Date().getFullYear();
        
        // Find all candles from current year
        const currentYearCandles = [];
        for (let i = 0; i < timestamps.length; i++) {
          const date = new Date(timestamps[i] * 1000);
          if (date.getFullYear() === currentYear) {
            currentYearCandles.push({
              index: i,
              date: date,
              timestamp: timestamps[i],
              high: quotes.high[i],
              low: quotes.low[i],
              open: quotes.open[i],
              close: quotes.close[i]
            });
          }
        }
        
        if (currentYearCandles.length === 0) {
          throw new Error('No data available for current year');
        }
        
        // Sort by date to get the earliest (first trading day)
        currentYearCandles.sort((a, b) => a.timestamp - b.timestamp);
        
        const firstCandle = currentYearCandles[0];
        
        // Verify we have valid data
        if (firstCandle.high === null || firstCandle.low === null || 
            firstCandle.open === null || firstCandle.close === null) {
          throw new Error('Invalid data for first trading day');
        }
        
        // Determine if candle is bullish or bearish
        const isBullish = firstCandle.close > firstCandle.open;
        
        // For BULLISH candle: 0 = Low, 1 = High
        // For BEARISH candle: 0 = High, 1 = Low
        if (isBullish) {
          high = firstCandle.high;
          low = firstCandle.low;
        } else {
          // Swap for bearish candle
          high = firstCandle.low;
          low = firstCandle.high;
        }
        
        const firstDayDate = firstCandle.date;
        const candleType = isBullish ? 'BULLISH' : 'BEARISH';
        anchorInfo = `First Trading Day: ${firstDayDate.toLocaleDateString()} (${candleType} - Open: ${firstCandle.open.toFixed(2)}, High: ${firstCandle.high.toFixed(2)}, Low: ${firstCandle.low.toFixed(2)}, Close: ${firstCandle.close.toFixed(2)})`;
        
        console.log('First trading day anchor:', { 
          date: firstDayDate.toLocaleDateString(), 
          dateTime: firstDayDate.toLocaleString(),
          candleType: candleType,
          actualHigh: firstCandle.high,
          actualLow: firstCandle.low,
          open: firstCandle.open,
          close: firstCandle.close,
          fibonacciHigh: high,
          fibonacciLow: low,
          note: isBullish ? '0=Low, 1=High' : '0=High, 1=Low',
          totalCandlesInYear: currentYearCandles.length
        });
      } else {
        // Use period high/low (default behavior)
        const highs = quotes.high.filter(h => h !== null);
        const lows = quotes.low.filter(l => l !== null);
        
        if (highs.length === 0 || lows.length === 0) {
          throw new Error('Insufficient data for this period');
        }
        
        high = Math.max(...highs);
        low = Math.min(...lows);
        anchorInfo = 'Period High/Low';
      }
      
      const closes = quotes.close.filter(c => c !== null);
      const current = closes[closes.length - 1];

      // Convert data format for lightweight-charts
      // lightweight-charts accepts Unix timestamps (numbers) for daily data
      const chartData = [];
      
      for (let i = 0; i < timestamps.length; i++) {
        if (quotes.open[i] !== null && quotes.high[i] !== null && 
            quotes.low[i] !== null && quotes.close[i] !== null) {
          // Use Unix timestamp directly (in seconds) - ensure it's a number
          const timeValue = Math.floor(Number(timestamps[i]));
          
          // Convert all values to numbers explicitly (not strings)
          const open = Number(quotes.open[i]);
          const high = Number(quotes.high[i]);
          const low = Number(quotes.low[i]);
          const close = Number(quotes.close[i]);
          
          // Only add if all values are valid numbers
          if (!isNaN(open) && !isNaN(high) && !isNaN(low) && !isNaN(close) &&
              open > 0 && high > 0 && low > 0 && close > 0 &&
              timeValue > 0 &&
              high >= low &&
              high >= Math.max(open, close) &&
              low <= Math.min(open, close)) {
            chartData.push({
              time: timeValue,
              open: open,
              high: high,
              low: low,
              close: close
            });
          }
        }
      }
      
      // Sort by time to ensure chronological order
      chartData.sort((a, b) => a.time - b.time);
      
      console.log('Chart data prepared:', {
        totalCandles: chartData.length,
        firstCandle: chartData[0],
        lastCandle: chartData[chartData.length - 1],
        sampleData: chartData.slice(0, 3) // Show first 3 candles for debugging
      });
      
      if (chartData.length === 0) {
        throw new Error('No valid chart data points found. Please check the symbol and try again.');
      }

      return {
        symbol: meta.symbol,
        current: current,
        high: high,
        low: low,
        currency: meta.currency || 'USD',
        timestamps: timestamps,
        quotes: quotes,
        anchorInfo: anchorInfo,
        chartData: chartData
      };
    } catch (error) {
      console.error('Error fetching market data:', error);
      console.error('Error stack:', error.stack);
      throw new Error(error.message || 'Unable to fetch market data. Please verify the symbol and try again.');
    }
  };

  // Fetch market data and calculate Fibonacci levels
  const fetchDataAndCalculate = async () => {
    const symbolValue = symbol.trim().toUpperCase();
    
    if (!symbolValue) {
      setError('Please enter a valid symbol');
      return;
    }

    setLoading(true);
    setError(null);
    setShowResults(false);

    try {
      console.log('Fetching data for:', symbolValue, 'ytd', 'Anchor: first_day', 'Precision:', precision);
      const data = await fetchFIBMarketData(symbolValue, 'ytd', 'first_day');
      console.log('Data received:', data);
      
      setPriceInfo(data);
      setShowResults(true);
      
    } catch (err) {
      console.error('Error in fetchDataAndCalculate:', err);
      setError(err.message || 'Unable to fetch market data. Please verify the symbol and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Calculate Fibonacci levels for annotations
  const calculateFibonacciAnnotations = (high, low, precision = 2) => {
    if (!high || !low || high <= low) return [];
    
    const range = high - low;
    const annotations = [];
    
    // All positive levels (BLUE) - solid lines for 0.0 and 1.0, dashed for others
    RETRACEMENT_LEVELS.forEach(level => {
      const isKey = level.ratio === 0 || level.ratio === 1;
      const price = low + (range * level.ratio);
      annotations.push({
        y: price,
        borderColor: '#3B82F6',
        strokeDashArray: isKey ? 0 : [5, 5],
        borderWidth: isKey ? 2 : 1,
        opacity: isKey ? 1 : 0.7,
        label: {
          borderColor: '#3B82F6',
          style: {
            color: '#fff',
            background: '#3B82F6',
            fontSize: '11px',
            fontWeight: 600
          },
          text: `${level.label} (${price.toFixed(precision)})`,
          position: 'right'
        }
      });
    });
    
    // All negative levels (RED) - all dashed
    EXTENSION_LEVELS.forEach(level => {
      const price = low + (range * level.ratio);
      annotations.push({
        y: price,
        borderColor: '#EF4444',
        strokeDashArray: [5, 5],
        borderWidth: 1,
        opacity: 0.7,
        label: {
          borderColor: '#EF4444',
          style: {
            color: '#fff',
            background: '#EF4444',
            fontSize: '11px',
            fontWeight: 600
          },
          text: `${level.label} (${price.toFixed(precision)})`,
          position: 'right'
        }
      });
    });
    
    return annotations;
  };

  // Initialize ApexCharts inline candles chart
  const initializeChart = (chartData, high, low, precisionValue = 2) => {
    if (!chartContainerRef.current || !chartData || chartData.length === 0) {
      console.error('Chart container ref is null or no data');
      return false;
    }
    
    // Clean up existing chart if any
    if (chartRef.current) {
      try {
        chartRef.current.destroy();
      } catch (e) {
        console.warn('Error destroying existing chart:', e);
      }
      chartRef.current = null;
    }
    
    const chartContainer = chartContainerRef.current;
    const isDarkMode = document.documentElement.classList.contains('dark');
    
    // Get container dimensions
    const containerWidth = chartContainer.clientWidth || chartContainer.offsetWidth || 800;
    const containerHeight = chartContainer.clientHeight || chartContainer.offsetHeight || 600;
    
    // Format data for ApexCharts candlestick
    const formattedData = chartData.map(item => {
      // ApexCharts expects timestamp in milliseconds
      const timestamp = item.time * 1000;
      return {
        x: timestamp,
        y: [item.open, item.high, item.low, item.close]
      };
    });
    
    // Calculate Fibonacci annotations
    const fibonacciAnnotations = high && low ? calculateFibonacciAnnotations(high, low, precisionValue) : [];
    
    console.log('Fibonacci annotations calculated:', {
      count: fibonacciAnnotations.length,
      high,
      low,
      range: high - low,
      sample: fibonacciAnnotations.slice(0, 3)
    });
    
    // Debug: Verify annotations are valid
    if (fibonacciAnnotations.length > 0) {
      console.log('First annotation structure:', JSON.stringify(fibonacciAnnotations[0], null, 2));
      console.log('Last annotation structure:', JSON.stringify(fibonacciAnnotations[fibonacciAnnotations.length - 1], null, 2));
    }
    
    try {
      const options = {
        series: [{
          name: 'Price',
          data: formattedData
        }],
        chart: {
          type: 'candlestick',
          width: containerWidth,
          height: containerHeight,
          toolbar: {
            show: true,
            tools: {
              download: true,
              selection: true,
              zoom: true,
              zoomin: true,
              zoomout: true,
              pan: true,
              reset: true
            }
          },
          zoom: {
            enabled: true,
            type: 'x',
            autoScaleYaxis: true
          }
        },
        plotOptions: {
          candlestick: {
            colors: {
              upward: '#22C55E',
              downward: '#EF4444'
            }
          }
        },
        xaxis: {
          type: 'datetime',
          labels: {
            show: true,
            style: {
              colors: isDarkMode ? '#9ca3af' : '#6b7280',
              fontSize: '12px',
              fontFamily: 'Inter, ui-sans-serif',
              fontWeight: 400
            },
            datetimeUTC: false,
            format: 'MMM dd'
          },
          axisBorder: {
            show: false
          },
          axisTicks: {
            show: false
          }
        },
        yaxis: {
          labels: {
            style: {
              colors: isDarkMode ? '#9ca3af' : '#6b7280',
              fontSize: '12px',
              fontFamily: 'Inter, ui-sans-serif',
              fontWeight: 400
            }
          }
        },
        grid: {
          borderColor: isDarkMode ? '#374151' : '#e5e7eb',
          strokeDashArray: 2
        },
        ...(fibonacciAnnotations.length > 0 && {
          annotations: {
            yaxis: fibonacciAnnotations
          }
        }),
        tooltip: {
          enabled: true,
          theme: isDarkMode ? 'dark' : 'light',
          custom: function({ seriesIndex, dataPointIndex, w }) {
            const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
            const date = new Date(data.x);
            const dateStr = date.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            });
            const [open, high, low, close] = data.y;
            const precision = 2; // Use the component's precision state if needed
            return `
              <div class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg">
                <div class="text-xs font-semibold text-gray-900 dark:text-white mb-1">${dateStr}</div>
                <div class="text-xs text-gray-600 dark:text-gray-400">
                  <div>Open: <span class="font-semibold">${open.toFixed(precision)}</span></div>
                  <div>High: <span class="font-semibold text-green-600">${high.toFixed(precision)}</span></div>
                  <div>Low: <span class="font-semibold text-red-600">${low.toFixed(precision)}</span></div>
                  <div>Close: <span class="font-semibold">${close.toFixed(precision)}</span></div>
                </div>
              </div>
            `;
          }
        }
      };
      
      const chart = new ApexCharts(chartContainer, options);
      
      // Store reference before rendering
      chartRef.current = chart;
      
      // Render the chart
      chart.render().then(() => {
        console.log('ApexCharts rendered successfully with', fibonacciAnnotations.length, 'Fibonacci annotations');
        if (fibonacciAnnotations.length > 0) {
          console.log('First annotation:', fibonacciAnnotations[0]);
        }
      }).catch((error) => {
        console.error('Error rendering ApexCharts:', error);
      });
      
      console.log('ApexCharts inline candles chart initialized successfully');
      return true;
    } catch (error) {
      console.error('Error initializing ApexCharts:', error);
      return false;
    }
  };

  // Update chart with market data
  const updateChart = (chartData, high, low, precisionValue = 2) => {
    if (!Array.isArray(chartData) || chartData.length === 0) {
      console.warn('No price data to show');
      return false;
    }
    
    // Validate and format data
    const formattedData = chartData
      .map(item => {
        // Convert time to number (Unix timestamp in seconds)
        let timeValue;
        if (typeof item.time === 'number') {
          timeValue = Math.floor(item.time);
        } else if (typeof item.time === 'string') {
          const date = new Date(item.time);
          timeValue = Math.floor(date.getTime() / 1000);
          if (isNaN(timeValue)) {
            return null;
          }
        } else if (item.timestamp) {
          timeValue = Math.floor(Number(item.timestamp));
        } else {
          return null;
        }
        
        // Convert all price values to numbers
        const open = Number(item.open);
        const high = Number(item.high);
        const low = Number(item.low);
        const close = Number(item.close);
        
        // Validate all values are valid numbers
        if (isNaN(open) || isNaN(high) || isNaN(low) || isNaN(close) ||
            open <= 0 || high <= 0 || low <= 0 || close <= 0 ||
            timeValue <= 0) {
          return null;
        }
        
        // Validate candlestick logic
        if (high < low || high < Math.max(open, close) || low > Math.min(open, close)) {
          return null;
        }
        
        return {
          time: timeValue,
          open: open,
          high: high,
          low: low,
          close: close
        };
      })
      .filter(item => item !== null)
      .sort((a, b) => a.time - b.time);
    
    if (formattedData.length === 0) {
      console.error('No valid price data after formatting');
      return false;
    }
    
    // Reinitialize chart with new data and Fibonacci levels
    return initializeChart(formattedData, high, low, precisionValue);
  };


  // Calculate Fibonacci levels
  const calculateLevels = (high, low) => {
    const range = high - low;
    
    const positiveLevels = RETRACEMENT_LEVELS.map(level => ({
      ...level,
      price: low + (range * level.ratio)
    }));
    
    const negativeLevels = EXTENSION_LEVELS.map(level => ({
      ...level,
      price: low + (range * level.ratio)
    }));
    
    return { positiveLevels, negativeLevels };
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      fetchDataAndCalculate();
    }
  };

  // Initialize and update chart when showResults becomes true and priceInfo is available
  useEffect(() => {
    // Clean up chart when hiding results or when priceInfo is cleared
    if (!showResults || !priceInfo || !priceInfo.chartData || !Array.isArray(priceInfo.chartData) || priceInfo.chartData.length === 0) {
      if (chartRef.current) {
        try {
          chartRef.current.destroy();
        } catch (e) {
          // Silent cleanup
        }
        chartRef.current = null;
      }
      setChartReady(false);
      return;
    }
    
    let isMounted = true;
    let timeoutId = null;
    let retryCount = 0;
    const maxRetries = 20; // Max 2 seconds of retries
    
    const initializeAndUpdateChart = () => {
      if (!isMounted) return;
      
      retryCount++;
      if (retryCount > maxRetries) {
        console.error('Max retries reached for chart initialization');
        setChartReady(false);
        return;
      }
      
      // Check if container exists and has dimensions
      if (!chartContainerRef.current) {
        console.log('Container not ready, retrying...', retryCount);
        timeoutId = setTimeout(initializeAndUpdateChart, 100);
        return;
      }
      
      const container = chartContainerRef.current;
      const containerWidth = container.clientWidth || container.offsetWidth;
      const containerHeight = container.clientHeight || container.offsetHeight;
      
      if (!containerWidth || containerWidth === 0 || !containerHeight || containerHeight === 0) {
        console.log('Container has no dimensions, retrying...', { containerWidth, containerHeight, retryCount });
        timeoutId = setTimeout(initializeAndUpdateChart, 100);
        return;
      }
      
      console.log('Container ready, initializing chart...', { containerWidth, containerHeight });
      
      // Update chart with data (this will initialize if needed)
      if (priceInfo.chartData && priceInfo.chartData.length > 0) {
        console.log('Updating chart with', priceInfo.chartData.length, 'data points');
        
        const success = updateChart(priceInfo.chartData, priceInfo.high, priceInfo.low, precision);
        
        if (success) {
          // Mark chart as ready
          setChartReady(true);
          console.log('Chart ready and displayed with Fibonacci levels');
        } else {
          console.error('Failed to update chart with data');
          setChartReady(false);
        }
      }
    };
    
    // Start initialization with a small delay to ensure DOM is ready
    timeoutId = setTimeout(initializeAndUpdateChart, 50);
    
    return () => {
      isMounted = false;
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [showResults, priceInfo?.chartData?.length, priceInfo?.high, priceInfo?.low, precision]);

  // Auto-load on mount (like standalone version)
  useEffect(() => {
    // Auto-calculate with default symbol on mount after a short delay
    // This matches the standalone version's window.load behavior
    let mounted = true;
    const timer = setTimeout(() => {
      if (mounted && symbol) {
        fetchDataAndCalculate();
      }
    }, 500); // Increased delay to ensure DOM is ready
    
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Cleanup chart on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        try {
          chartRef.current.destroy();
        } catch (e) {
          console.warn('Error destroying chart on unmount:', e);
        }
        chartRef.current = null;
      }
    };
  }, []);

  const { positiveLevels = [], negativeLevels = [] } = priceInfo 
    ? calculateLevels(priceInfo.high, priceInfo.low)
    : {};

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          📈 Fibonacci Retracement Calculator
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Calculate Fibonacci levels with real-time market data
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Input Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 pb-3 border-b border-gray-200 dark:border-gray-700">
            Market Data Input
          </h2>
          
          <div className="mb-5">
            <label htmlFor="symbol" className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Symbol (Stock/Crypto)
            </label>
            <input
              type="text"
              id="symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="e.g., AAPL, TSLA, BTC-USD"
              className="w-full px-4 py-2.5 border-2 border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800 transition-colors"
            />
          </div>

          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Time Period
            </label>
            <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-2 border-blue-500 dark:border-blue-400 rounded-lg text-center text-base font-semibold text-blue-600 dark:text-blue-400">
              Year to Date (YTD)
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Fibonacci Anchor
            </label>
            <div className="px-4 py-2.5 bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-2 border-blue-500 dark:border-blue-400 rounded-lg text-center text-base font-semibold text-blue-600 dark:text-blue-400">
              First Trading Day of Year
            </div>
          </div>

          <div className="mb-5">
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Decimal Precision
            </label>
            <div className="flex gap-2">
              {[2, 3].map(val => (
                <button
                  key={val}
                  className={`flex-1 px-4 py-2.5 rounded-lg font-semibold transition-all ${
                    precision === val
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border-2 border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400'
                  }`}
                  onClick={() => setPrecision(val)}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          <button 
            className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-md hover:shadow-lg transition-all disabled:opacity-60 disabled:cursor-not-allowed mt-2"
            onClick={fetchDataAndCalculate}
            disabled={loading}
          >
            {loading ? 'Calculating...' : 'Calculate Fibonacci Levels'}
          </button>

          <div className="mt-5 p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400 rounded">
            <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
              <strong>How to use:</strong> Enter a stock symbol (e.g., AAPL, GOOGL) or crypto symbol (e.g., BTC-USD, ETH-USD) and click calculate. Fibonacci levels will be anchored to the first trading day of the current year.
            </p>
          </div>
        </div>

        {/* Results Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 pb-3 border-b border-gray-200 dark:border-gray-700">
            Current Market Data
          </h2>
          {priceInfo && (
            <div className="bg-gray-50 dark:bg-gray-700/50 p-5 rounded-lg border border-gray-200 dark:border-gray-600 mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {priceInfo.symbol} - {priceInfo.anchorInfo?.split('(')[0].trim() || 'Period High/Low'}
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Current Price:</span>
                  <span className="text-base font-semibold text-gray-900 dark:text-white">
                    {priceInfo.currency} {priceInfo.current.toFixed(precision)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Period High:</span>
                  <span className="text-base font-semibold text-gray-900 dark:text-white">
                    {priceInfo.currency} {priceInfo.high.toFixed(precision)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-600">
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Period Low:</span>
                  <span className="text-base font-semibold text-gray-900 dark:text-white">
                    {priceInfo.currency} {priceInfo.low.toFixed(precision)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm font-semibold text-gray-600 dark:text-gray-400">Range:</span>
                  <span className="text-base font-semibold text-gray-900 dark:text-white">
                    {priceInfo.currency} {(priceInfo.high - priceInfo.low).toFixed(precision)} 
                    ({(((priceInfo.high - priceInfo.low) / priceInfo.low) * 100).toFixed(2)}%)
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 rounded text-sm mb-4">
              {error}
            </div>
          )}
          {loading && (
            <div className="text-center py-6 text-blue-600 dark:text-blue-400 font-medium">
              Fetching market data...
            </div>
          )}
        </div>
      </div>

      {/* Main Layout with Levels and Chart */}
      {showResults && priceInfo && (
        <div className="grid grid-cols-1 xl:grid-cols-[450px_1fr] gap-6 mb-6">
          {/* Fibonacci Levels Display */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 pb-3 border-b border-gray-200 dark:border-gray-700">
              Fibonacci Extension Levels
            </h2>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <h3 className="text-blue-600 dark:text-blue-400 font-semibold mb-3 text-sm">📈 Positive Levels</h3>
                <div className="space-y-2">
                  {positiveLevels.map((level, index) => (
                    <div key={index} className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{level.label}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{level.price.toFixed(precision)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-blue-600 dark:text-blue-400 font-semibold mb-3 text-sm">📉 Negative Levels</h3>
                <div className="space-y-2">
                  {negativeLevels.map((level, index) => (
                    <div key={index} className="flex justify-between items-center px-3 py-2 bg-gray-50 dark:bg-gray-700/50 rounded border border-gray-200 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 transition-colors">
                      <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">{level.label}</span>
                      <span className="text-sm font-semibold text-gray-900 dark:text-white">{level.price.toFixed(precision)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500 dark:border-blue-400 rounded">
              <p className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed">
                <strong>Fibonacci Anchoring:</strong> BULLISH candle: 0 = Low, 1 = High. BEARISH candle: 0 = High, 1 = Low. Levels extend from these anchor points.
              </p>
            </div>
          </div>

          {/* Price Chart */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 pb-3 border-b border-gray-200 dark:border-gray-700">
              Price Chart
            </h2>
            {loading && (
              <div className="text-center py-6 text-blue-600 dark:text-blue-400 font-medium">
                Loading chart data...
              </div>
            )}
            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 text-red-700 dark:text-red-400 rounded text-sm mb-4">
                {error}
              </div>
            )}
            {showResults && priceInfo && priceInfo.chartData && (
              <div className="w-full">
                <div 
                  ref={chartContainerRef} 
                  id="hs-sparklines-candles-chart"
                  className="w-full"
                  style={{ 
                    height: '600px',
                    minHeight: '600px',
                    position: 'relative'
                  }}
                >
                  {!chartReady && (
                    <div 
                      className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-gray-400 z-10 bg-white dark:bg-gray-800 rounded"
                      style={{ 
                        zIndex: 10,
                        pointerEvents: 'none'
                      }}
                    >
                      <div className="text-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-blue-200 border-t-blue-600 mx-auto mb-2"></div>
                        <p>Initializing chart...</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default FIB;
