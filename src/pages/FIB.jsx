import { useState, useEffect, useRef } from 'react';
import ApexCharts from 'apexcharts';
import { fetchMarketData } from '../services/monitorService';

// Custom Fibonacci ratios - Positive levels (above anchor)
const RETRACEMENT_LEVELS = [
  { ratio: 0, label: '0.0', color: '#3B82F6' },
  { ratio: 0.5, label: '0.5', color: '#60A5FA' },
  { ratio: 1, label: '1.0', color: '#3B82F6' },
  { ratio: 1.382, label: '1.382', color: '#8B5CF6' },
  { ratio: 1.618, label: '1.618', color: '#A855F7' },
  { ratio: 2, label: '2.0', color: '#22C55E' },
  { ratio: 2.382, label: '2.382', color: '#10B981' },
  { ratio: 2.618, label: '2.618', color: '#14B8A6' },
  { ratio: 3, label: '3.0', color: '#06B6D4' },
  { ratio: 3.382, label: '3.382', color: '#0EA5E9' },
  { ratio: 3.618, label: '3.618', color: '#0284C7' },
  { ratio: 4.24, label: '4.24', color: '#7C3AED' },
  { ratio: 5.08, label: '5.08', color: '#9333EA' },
  { ratio: 6.86, label: '6.86', color: '#C026D3' },
  { ratio: 11.01, label: '11.01', color: '#DB2777' }
];

// Negative levels (below anchor)
const EXTENSION_LEVELS = [
  { ratio: -0.5, label: '-0.5', color: '#F97316' },
  { ratio: -1, label: '-1.0', color: '#EF4444' },
  { ratio: -1.382, label: '-1.382', color: '#DC2626' },
  { ratio: -1.618, label: '-1.618', color: '#B91C1C' },
  { ratio: -2, label: '-2.0', color: '#991B1B' },
  { ratio: -2.382, label: '-2.382', color: '#7F1D1D' },
  { ratio: -2.618, label: '-2.618', color: '#881337' },
  { ratio: -3, label: '-3.0', color: '#9F1239' },
  { ratio: -3.382, label: '-3.382', color: '#BE123C' },
  { ratio: -3.618, label: '-3.618', color: '#E11D48' },
  { ratio: -4.24, label: '-4.24', color: '#F43F5E' },
  { ratio: -5.08, label: '-5.08', color: '#FB7185' },
  { ratio: -6.86, label: '-6.86', color: '#FDA4AF' },
  { ratio: -11.01, label: '-11.01', color: '#FECDD3' }
];

function FIB() {
  const [symbol, setSymbol] = useState('AAPL');
  const [precision, setPrecision] = useState(2);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [priceInfo, setPriceInfo] = useState(null);
  const [showResults, setShowResults] = useState(false);
  const [chartReady, setChartReady] = useState(false);
  const [fibSearchTerm, setFibSearchTerm] = useState('');
  const [highlightedLevel, setHighlightedLevel] = useState(null);
  
  const chartContainerRef = useRef(null);
  const chartRef = useRef(null);

  // Fetch market data using the monitorService (properly handles Yahoo Finance API)
  const fetchFIBMarketData = async (symbolValue, period, anchorMode) => {
    try {
      // Map period to Yahoo Finance range and interval
      // For YTD, we need range='ytd' and interval='1d'
      const range = period === 'ytd' ? 'ytd' : '1y';
      const interval = '1d'; // Daily data for YTD
      
      // For FIB calculations, we need historical chart data, so prioritize Yahoo Finance
      // Use fetchMarketData with prioritizeYahoo=true to ensure we get chart data
      const result = await fetchMarketData(symbolValue, interval, range, true);
      
      // Verify we got Yahoo Finance data (required for historical chart data)
      if (result.source !== 'yahoo') {
        throw new Error('Historical chart data is required for Fibonacci calculations. Yahoo Finance API is currently unavailable. Please try again later or check your internet connection.');
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

  // Calculate Fibonacci levels for annotations on chart
  const calculateFibonacciAnnotations = (high, low, precision = 2) => {
    if (!high || !low || high <= low) return [];
    
    const range = high - low;
    const annotations = [];
    
    // Only show key levels on chart to avoid clutter (0, 0.5, 1, 1.618, 2, 2.618, 3, 3.618)
    const keyPositiveLevels = RETRACEMENT_LEVELS.filter(l => 
      [0, 0.5, 1, 1.382, 1.618, 2, 2.618, 3, 3.618].includes(l.ratio)
    );
    
    const keyNegativeLevels = EXTENSION_LEVELS.filter(l => 
      [-0.5, -1, -1.618, -2, -2.618, -3, -3.618].includes(l.ratio)
    );
    
    // Positive levels
    keyPositiveLevels.forEach(level => {
      const isKey = level.ratio === 0 || level.ratio === 1;
      const price = low + (range * level.ratio);
      annotations.push({
        y: price,
        y2: null,
        borderColor: level.color,
        fillColor: level.color,
        strokeDashArray: isKey ? 0 : 5,
        borderWidth: isKey ? 3 : 2,
        label: {
          borderColor: level.color,
          borderWidth: 0,
          borderRadius: 3,
          text: `${level.label}: ${price.toFixed(precision)}`,
          textAnchor: 'start',
          position: 'left',
          offsetX: 5,
          offsetY: 0,
          style: {
            color: '#ffffff',
            background: level.color,
            fontSize: '10px',
            fontWeight: '600',
            fontFamily: 'Inter, sans-serif',
            cssClass: 'fib-annotation-label',
            padding: {
              left: 5,
              right: 5,
              top: 2,
              bottom: 2
            }
          }
        }
      });
    });
    
    // Negative levels
    keyNegativeLevels.forEach(level => {
      const price = low + (range * level.ratio);
      annotations.push({
        y: price,
        y2: null,
        borderColor: level.color,
        fillColor: level.color,
        strokeDashArray: 5,
        borderWidth: 2,
        label: {
          borderColor: level.color,
          borderWidth: 0,
          borderRadius: 3,
          text: `${level.label}: ${price.toFixed(precision)}`,
          textAnchor: 'start',
          position: 'left',
          offsetX: 5,
          offsetY: 0,
          style: {
            color: '#ffffff',
            background: level.color,
            fontSize: '10px',
            fontWeight: '600',
            fontFamily: 'Inter, sans-serif',
            cssClass: 'fib-annotation-label',
            padding: {
              left: 5,
              right: 5,
              top: 2,
              bottom: 2
            }
          }
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
    
    // Get container dimensions - use full available height
    const containerWidth = chartContainer.clientWidth || chartContainer.offsetWidth || 800;
    const containerHeight = chartContainer.clientHeight || chartContainer.offsetHeight || 600;
    
    // Ensure minimum height
    const finalHeight = Math.max(containerHeight, 500);
    
    // Format data for ApexCharts candlestick
    const formattedData = chartData.map(item => {
      const timestamp = item.time * 1000;
      return {
        x: timestamp,
        y: [item.open, item.high, item.low, item.close]
      };
    });
    
    // Calculate price range for Y-axis scaling
    const allPrices = chartData.flatMap(d => [d.high, d.low]);
    const dataMin = Math.min(...allPrices);
    const dataMax = Math.max(...allPrices);
    
    // Calculate Fibonacci annotations
    const fibonacciAnnotations = high && low ? calculateFibonacciAnnotations(high, low, precisionValue) : [];
    
    // Calculate Y-axis range to show relevant Fibonacci levels
    const range = high - low;
    
    // Calculate key fib prices that should be visible on chart
    const fib0 = low; // 0.0 level
    const fib1618 = low + (range * 1.618); // 1.618 level
    const fib2618 = low + (range * 2.618); // 2.618 level
    const fibNeg1618 = low + (range * -1.618); // -1.618 level
    
    // Y-axis range: show from -1.618 level to 2.618 level (or data bounds if larger)
    const yMin = Math.min(dataMin * 0.98, fibNeg1618, fib0) - (range * 0.05);
    const yMax = Math.max(dataMax * 1.02, fib2618, fib1618) + (range * 0.05);
    
    console.log('Fibonacci annotations calculated:', {
      count: fibonacciAnnotations.length,
      high,
      low,
      range: high - low,
      yAxisRange: { yMin, yMax },
      annotations: fibonacciAnnotations.map(a => ({ y: a.y, color: a.borderColor, text: a.label?.text }))
    });
    
    try {
      const options = {
        series: [{
          name: 'Price',
          data: formattedData
        }],
        chart: {
          type: 'candlestick',
          width: containerWidth,
          height: finalHeight,
          background: 'transparent',
          fontFamily: 'Inter, ui-sans-serif',
          toolbar: {
            show: true,
            offsetX: 0,
            offsetY: 0,
            tools: {
              download: true,
              selection: true,
              zoom: true,
              zoomin: true,
              zoomout: true,
              pan: true,
              reset: true
            },
            autoSelected: 'zoom'
          },
          zoom: {
            enabled: true,
            type: 'xy',
            autoScaleYaxis: false
          },
          animations: {
            enabled: true,
            speed: 500,
            animateGradually: {
              enabled: true,
              delay: 50
            }
          },
          events: {
            mounted: function(chartContext, config) {
              console.log('Chart mounted with annotations:', fibonacciAnnotations.length);
            },
            dataPointSelection: function(event, chartContext, config) {
              console.log('Data point selected');
            }
          }
        },
        plotOptions: {
          candlestick: {
            colors: {
              upward: '#22C55E',
              downward: '#EF4444'
            },
            wick: {
              useFillColor: true
            }
          }
        },
        xaxis: {
          type: 'datetime',
          labels: {
            show: true,
            rotate: -45,
            rotateAlways: false,
            style: {
              colors: isDarkMode ? '#9ca3af' : '#6b7280',
              fontSize: '11px',
              fontFamily: 'Inter, ui-sans-serif',
              fontWeight: 500
            },
            datetimeUTC: false,
            format: 'MMM dd'
          },
          axisBorder: {
            show: true,
            color: isDarkMode ? '#374151' : '#e5e7eb'
          },
          axisTicks: {
            show: true,
            color: isDarkMode ? '#374151' : '#e5e7eb'
          },
          crosshairs: {
            show: true,
            width: 1,
            position: 'back',
            stroke: {
              color: isDarkMode ? '#6b7280' : '#9ca3af',
              width: 1,
              dashArray: 3
            }
          }
        },
        yaxis: {
          min: yMin,
          max: yMax,
          tickAmount: 15,
          labels: {
            style: {
              colors: isDarkMode ? '#9ca3af' : '#6b7280',
              fontSize: '11px',
              fontFamily: 'Inter, ui-sans-serif',
              fontWeight: 500
            },
            formatter: function(val) {
              return val.toFixed(precisionValue);
            },
            offsetX: -10
          },
          crosshairs: {
            show: true,
            position: 'back',
            stroke: {
              color: isDarkMode ? '#6b7280' : '#9ca3af',
              width: 1,
              dashArray: 3
            }
          },
          tooltip: {
            enabled: true
          },
          forceNiceScale: false
        },
        grid: {
          show: true,
          borderColor: isDarkMode ? '#374151' : '#e5e7eb',
          strokeDashArray: 3,
          position: 'back',
          xaxis: {
            lines: {
              show: true
            }
          },
          yaxis: {
            lines: {
              show: true
            }
          },
          padding: {
            top: 10,
            right: 25,
            bottom: 10,
            left: 15
          }
        },
        annotations: {
          yaxis: fibonacciAnnotations.length > 0 ? fibonacciAnnotations : []
        },
        tooltip: {
          enabled: true,
          theme: isDarkMode ? 'dark' : 'light',
          shared: false,
          intersect: true,
          custom: function({ seriesIndex, dataPointIndex, w }) {
            const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
            const date = new Date(data.x);
            const dateStr = date.toLocaleDateString('en-US', { 
              weekday: 'short',
              month: 'short', 
              day: 'numeric',
              year: 'numeric'
            });
            const [open, high, low, close] = data.y;
            const change = close - open;
            const changePercent = ((change / open) * 100).toFixed(2);
            const isPositive = change >= 0;
            const bgColor = isDarkMode ? '#1f2937' : '#ffffff';
            const textColor = isDarkMode ? '#f3f4f6' : '#111827';
            const mutedColor = isDarkMode ? '#9ca3af' : '#6b7280';
            
            return `
              <div style="background: ${bgColor}; border: 1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}; border-radius: 8px; padding: 12px; min-width: 180px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
                <div style="font-size: 12px; font-weight: 600; color: ${textColor}; margin-bottom: 8px; padding-bottom: 6px; border-bottom: 1px solid ${isDarkMode ? '#374151' : '#e5e7eb'};">${dateStr}</div>
                <div style="display: grid; grid-template-columns: auto 1fr; gap: 4px 12px; font-size: 11px;">
                  <span style="color: ${mutedColor};">Open:</span>
                  <span style="color: ${textColor}; font-weight: 600; text-align: right;">${open.toFixed(precisionValue)}</span>
                  <span style="color: ${mutedColor};">High:</span>
                  <span style="color: #22c55e; font-weight: 600; text-align: right;">${high.toFixed(precisionValue)}</span>
                  <span style="color: ${mutedColor};">Low:</span>
                  <span style="color: #ef4444; font-weight: 600; text-align: right;">${low.toFixed(precisionValue)}</span>
                  <span style="color: ${mutedColor};">Close:</span>
                  <span style="color: ${textColor}; font-weight: 600; text-align: right;">${close.toFixed(precisionValue)}</span>
                </div>
                <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid ${isDarkMode ? '#374151' : '#e5e7eb'}; font-size: 11px; display: flex; justify-content: space-between;">
                  <span style="color: ${mutedColor};">Change:</span>
                  <span style="color: ${isPositive ? '#22c55e' : '#ef4444'}; font-weight: 600;">${isPositive ? '+' : ''}${change.toFixed(precisionValue)} (${isPositive ? '+' : ''}${changePercent}%)</span>
                </div>
              </div>
            `;
          }
        },
        states: {
          hover: {
            filter: {
              type: 'lighten',
              value: 0.1
            }
          },
          active: {
            filter: {
              type: 'darken',
              value: 0.1
            }
          }
        }
      };
      
      const chart = new ApexCharts(chartContainer, options);
      chartRef.current = chart;
      
      chart.render().then(() => {
        console.log('ApexCharts rendered successfully');
        
        // Add annotations after chart is rendered using updateOptions
        if (fibonacciAnnotations.length > 0 && chartRef.current) {
          console.log('Adding', fibonacciAnnotations.length, 'Fibonacci annotations to chart');
          
          // Use setTimeout to ensure chart is fully rendered before adding annotations
          setTimeout(() => {
            if (chartRef.current) {
              try {
                // Update annotations using updateOptions for better compatibility
                chartRef.current.updateOptions({
                  annotations: {
                    yaxis: fibonacciAnnotations
                  }
                }, true, true); // redrawPaths=true, animate=true
                
                console.log('Fibonacci level lines added to chart successfully');
              } catch (e) {
                console.error('Error adding annotations:', e);
                
                // Fallback: try adding individually
                try {
                  chartRef.current.clearAnnotations();
                  fibonacciAnnotations.forEach((ann) => {
                    chartRef.current.addYaxisAnnotation(ann, false);
                  });
                  console.log('Annotations added via fallback method');
                } catch (e2) {
                  console.error('Fallback annotation method also failed:', e2);
                }
              }
            }
          }, 100);
        }
      }).catch((error) => {
        console.error('Error rendering ApexCharts:', error);
      });
      
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


  // Calculate Fibonacci levels with additional metrics
  const calculateLevels = (high, low, current) => {
    const range = high - low;
    
    const positiveLevels = RETRACEMENT_LEVELS.map(level => {
      const price = low + (range * level.ratio);
      const distance = price - current;
      const distancePercent = current !== 0 ? (distance / current) * 100 : 0;
      const isKeyLevel = [0, 0.5, 1, 1.382, 1.618, 2, 2.618, 3, 3.618].includes(level.ratio);
      
      let significance = '';
      if (level.ratio === 0) significance = 'Anchor Low';
      else if (level.ratio === 0.5) significance = 'Midpoint';
      else if (level.ratio === 1) significance = 'Anchor High';
      else if (level.ratio === 1.382) significance = 'Extension';
      else if (level.ratio === 1.618) significance = 'Golden Ratio';
      else if (level.ratio === 2) significance = 'Double';
      else if (level.ratio === 2.618) significance = 'Key Extension';
      else if (level.ratio === 3.618) significance = 'Strong Extension';
      
      return {
        ...level,
        price,
        distance,
        distancePercent,
        isKeyLevel,
        significance
      };
    });
    
    const negativeLevels = EXTENSION_LEVELS.map(level => {
      const price = low + (range * level.ratio);
      const distance = price - current;
      const distancePercent = current !== 0 ? (distance / current) * 100 : 0;
      const isKeyLevel = [-0.5, -1, -1.382, -1.618, -2, -2.618, -3, -3.618].includes(level.ratio);
      
      let significance = '';
      if (level.ratio === -1) significance = 'Full Retrace';
      else if (level.ratio === -1.618) significance = 'Golden Retrace';
      else if (level.ratio === -2.618) significance = 'Deep Retrace';
      
      return {
        ...level,
        price,
        distance,
        distancePercent,
        isKeyLevel,
        significance
      };
    });
    
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
          
          // Update chart size after a brief delay to ensure it fills container
          setTimeout(() => {
            if (chartRef.current && container) {
              const newWidth = container.clientWidth || container.offsetWidth;
              const newHeight = container.clientHeight || container.offsetHeight;
              if (newWidth > 0 && newHeight > 0) {
                chartRef.current.updateOptions({
                  chart: {
                    width: newWidth,
                    height: Math.max(newHeight, 500)
                  }
                }, false, false, false);
              }
            }
          }, 100);
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

  // Handle window resize to update chart dimensions
  useEffect(() => {
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current && chartReady) {
        const container = chartContainerRef.current;
        const newWidth = container.clientWidth || container.offsetWidth;
        const newHeight = container.clientHeight || container.offsetHeight;
        if (newWidth > 0 && newHeight > 0) {
          chartRef.current.updateOptions({
            chart: {
              width: newWidth,
              height: Math.max(newHeight, 500)
            }
          }, false, false, false);
        }
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [chartReady]);

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
    ? calculateLevels(priceInfo.high, priceInfo.low, priceInfo.current)
    : {};

  // Filter levels based on search term
  const filterLevels = (levels) => {
    if (!fibSearchTerm.trim()) return levels;
    const searchLower = fibSearchTerm.toLowerCase();
    return levels.filter(level => 
      level.label.toLowerCase().includes(searchLower) ||
      level.price.toFixed(precision).includes(searchLower) ||
      (level.significance && level.significance.toLowerCase().includes(searchLower))
    );
  };

  const filteredPositiveLevels = filterLevels(positiveLevels);
  const filteredNegativeLevels = filterLevels(negativeLevels);

  return (
    <div className="w-full max-w-[1800px] mx-auto px-4 flex flex-col h-full min-h-0 overflow-hidden">
      {/* Header */}
      <div className="text-center mb-3 flex-shrink-0">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white">
          📈 Fibonacci Calculator
        </h1>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Calculate and visualize Fibonacci extension levels with real-time market data
        </p>
      </div>

      {/* Input Controls - Compact Row */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-3 border border-gray-200 dark:border-gray-700 mb-3 flex-shrink-0">
        <div className="flex flex-wrap items-end gap-3">
          {/* Symbol Input */}
          <div className="flex-1 min-w-[160px]">
            <label htmlFor="symbol" className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Symbol
            </label>
            <input
              type="text"
              id="symbol"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="AAPL, BTC-USD"
              className="w-full px-2.5 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
            />
          </div>

          {/* Time Period - Fixed */}
          <div className="min-w-[80px]">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Period
            </label>
            <div className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg text-center text-xs font-medium text-blue-600 dark:text-blue-400">
              YTD
            </div>
          </div>

          {/* Anchor - Fixed */}
          <div className="min-w-[130px]">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Anchor
            </label>
            <div className="px-2.5 py-1.5 bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-lg text-center text-xs font-medium text-blue-600 dark:text-blue-400">
              First Day of Year
            </div>
          </div>

          {/* Precision Toggle */}
          <div className="min-w-[80px]">
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
              Decimals
            </label>
            <div className="flex gap-1">
              {[2, 3].map(val => (
                <button
                  key={val}
                  className={`flex-1 px-2 py-1.5 rounded text-xs font-medium transition-all ${
                    precision === val
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                  onClick={() => setPrecision(val)}
                >
                  {val}
                </button>
              ))}
            </div>
          </div>

          {/* Calculate Button */}
          <button 
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm hover:shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed flex items-center gap-1.5"
            onClick={fetchDataAndCalculate}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Loading...
              </>
            ) : (
              <>
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
                Calculate
              </>
            )}
          </button>
        </div>

        {/* Market Data Summary - Shows when data is loaded */}
        {priceInfo && (
          <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
              <div className="flex items-center gap-1">
                <span className="text-gray-500 dark:text-gray-400">Symbol:</span>
                <span className="font-bold text-gray-900 dark:text-white">{priceInfo.symbol}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500 dark:text-gray-400">Current:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{priceInfo.currency} {priceInfo.current.toFixed(precision)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500 dark:text-gray-400">Anchor High:</span>
                <span className="font-semibold text-green-600 dark:text-green-400">{priceInfo.high.toFixed(precision)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500 dark:text-gray-400">Anchor Low:</span>
                <span className="font-semibold text-red-600 dark:text-red-400">{priceInfo.low.toFixed(precision)}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500 dark:text-gray-400">Range:</span>
                <span className="font-semibold text-blue-600 dark:text-blue-400">
                  {(priceInfo.high - priceInfo.low).toFixed(precision)} ({(((priceInfo.high - priceInfo.low) / priceInfo.low) * 100).toFixed(2)}%)
                </span>
              </div>
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

      {/* Main Content - Chart with Fibonacci Levels */}
      {showResults && priceInfo && (
        <div className="flex flex-col gap-3 flex-1 min-h-0 overflow-hidden">
          {/* Price Chart with Fibonacci Levels */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col min-h-0" style={{ flex: '1 1 60%' }}>
            <div className="px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between flex-shrink-0">
              <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                <svg className="w-4 h-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                Price Chart with Fibonacci Levels
              </h2>
              <div className="flex items-center gap-3 text-[10px]">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded bg-green-500"></div>
                  <span className="text-gray-500 dark:text-gray-400">Bullish</span>
                </div>
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded bg-red-500"></div>
                  <span className="text-gray-500 dark:text-gray-400">Bearish</span>
                </div>
              </div>
            </div>
            
            <div className="p-2 flex-1 min-h-0">
              {priceInfo.chartData && (
                <div className="w-full h-full relative">
                  <div 
                    ref={chartContainerRef} 
                    id="fib-price-chart"
                    className="w-full h-full"
                    style={{ 
                      position: 'relative'
                    }}
                  >
                    {!chartReady && (
                      <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-gray-800 rounded z-10">
                        <div className="text-center">
                          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin mx-auto mb-2"></div>
                          <p className="text-xs text-gray-500 dark:text-gray-400">Loading chart...</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Fibonacci Levels Panel */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden flex flex-col min-h-0" style={{ flex: '1 1 40%' }}>
            <div className="px-3 py-2.5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex-shrink-0">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Fibonacci Levels
                </h2>
              </div>
              {/* Search Input */}
              <div className="relative">
                <input
                  type="text"
                  value={fibSearchTerm}
                  onChange={(e) => setFibSearchTerm(e.target.value)}
                  placeholder="Search levels..."
                  className="w-full px-2.5 py-1.5 pl-8 text-xs border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                />
                <svg className="w-3.5 h-3.5 absolute left-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {fibSearchTerm && (
                  <button
                    onClick={() => setFibSearchTerm('')}
                    className="absolute right-2.5 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden min-h-0">
              <div className="grid grid-cols-2 gap-2 h-full overflow-hidden">
                {/* Positive Levels */}
                <div className="p-2 overflow-y-auto border-r border-gray-200 dark:border-gray-700">
                  <h3 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Extension Levels (Upside)
                    <span className="ml-auto text-[9px] font-normal text-gray-400 dark:text-gray-500">
                      {filteredPositiveLevels.length} / {positiveLevels.length}
                    </span>
                  </h3>
                  
                  {/* Table Header - Hidden for 2-column layout */}
                  
                  <div className="grid grid-cols-2 gap-1.5">
                    {filteredPositiveLevels.map((level, index) => {
                      const levelConfig = RETRACEMENT_LEVELS.find(l => l.label === level.label);
                      const isHighlighted = highlightedLevel === level.label;
                      const isNearCurrent = Math.abs(level.distancePercent) < 5;
                      
                      return (
                        <div 
                          key={index} 
                          onMouseEnter={() => setHighlightedLevel(level.label)}
                          onMouseLeave={() => setHighlightedLevel(null)}
                          className={`flex flex-col px-2 py-1.5 rounded transition-all cursor-pointer border ${
                            isHighlighted 
                              ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' 
                              : 'bg-gray-50 dark:bg-gray-700/20 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/40'
                          } ${isNearCurrent ? 'ring-1 ring-yellow-300 dark:ring-yellow-700' : ''}`}
                          style={{ borderLeft: `3px solid ${levelConfig?.color || '#3B82F6'}` }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span 
                              className="text-[10px] font-bold"
                              style={{ color: levelConfig?.color || '#3B82F6' }}
                            >
                              {level.label}
                              {level.isKeyLevel && (
                                <span className="ml-0.5 text-[8px] text-yellow-600 dark:text-yellow-400">★</span>
                              )}
                            </span>
                            <div className="font-mono text-xs font-semibold text-gray-900 dark:text-white">
                              {level.price.toFixed(precision)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[9px]">
                            <span className={`font-medium ${
                              level.distance >= 0 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {level.distance >= 0 ? '+' : ''}{level.distance.toFixed(precision)}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {level.distancePercent >= 0 ? '+' : ''}{level.distancePercent.toFixed(2)}%
                            </span>
                          </div>
                          {level.significance && (
                            <div className="mt-1 pt-1 border-t border-gray-200 dark:border-gray-600">
                              <span className="text-[8px] font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">
                                {level.significance}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filteredPositiveLevels.length === 0 && (
                      <div className="col-span-2 text-center py-4 text-xs text-gray-400 dark:text-gray-500">
                        No levels match your search
                      </div>
                    )}
                  </div>
                </div>

                {/* Negative Levels */}
                <div className="p-2 overflow-y-auto">
                  <h3 className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-red-500"></span>
                    Extension Levels (Downside)
                    <span className="ml-auto text-[9px] font-normal text-gray-400 dark:text-gray-500">
                      {filteredNegativeLevels.length} / {negativeLevels.length}
                    </span>
                  </h3>
                  
                  {/* Table Header - Hidden for 2-column layout */}
                  
                  <div className="grid grid-cols-2 gap-1.5">
                    {filteredNegativeLevels.map((level, index) => {
                      const levelConfig = EXTENSION_LEVELS.find(l => l.label === level.label);
                      const isHighlighted = highlightedLevel === level.label;
                      const isNearCurrent = Math.abs(level.distancePercent) < 5;
                      
                      return (
                        <div 
                          key={index} 
                          onMouseEnter={() => setHighlightedLevel(level.label)}
                          onMouseLeave={() => setHighlightedLevel(null)}
                          className={`flex flex-col px-2 py-1.5 rounded transition-all cursor-pointer border ${
                            isHighlighted 
                              ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                              : 'bg-gray-50 dark:bg-gray-700/20 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/40'
                          } ${isNearCurrent ? 'ring-1 ring-yellow-300 dark:ring-yellow-700' : ''}`}
                          style={{ borderLeft: `3px solid ${levelConfig?.color || '#EF4444'}` }}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span 
                              className="text-[10px] font-bold"
                              style={{ color: levelConfig?.color || '#EF4444' }}
                            >
                              {level.label}
                              {level.isKeyLevel && (
                                <span className="ml-0.5 text-[8px] text-yellow-600 dark:text-yellow-400">★</span>
                              )}
                            </span>
                            <div className="font-mono text-xs font-semibold text-gray-900 dark:text-white">
                              {level.price.toFixed(precision)}
                            </div>
                          </div>
                          <div className="flex items-center justify-between text-[9px]">
                            <span className={`font-medium ${
                              level.distance >= 0 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {level.distance >= 0 ? '+' : ''}{level.distance.toFixed(precision)}
                            </span>
                            <span className="text-gray-500 dark:text-gray-400">
                              {level.distancePercent >= 0 ? '+' : ''}{level.distancePercent.toFixed(2)}%
                            </span>
                          </div>
                          {level.significance && (
                            <div className="mt-1 pt-1 border-t border-gray-200 dark:border-gray-600">
                              <span className="text-[8px] font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded">
                                {level.significance}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {filteredNegativeLevels.length === 0 && (
                      <div className="col-span-2 text-center py-4 text-xs text-gray-400 dark:text-gray-500">
                        No levels match your search
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Initial State - Before Calculation */}
      {!showResults && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-200 dark:border-gray-700 p-8 text-center flex-1">
          <div className="max-w-md mx-auto">
            <svg className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
            </svg>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-2">Enter a Symbol to Get Started</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Enter a stock or crypto symbol and click Calculate to see Fibonacci extension levels.
            </p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {['AAPL', 'TSLA', 'NVDA', 'BTC-USD'].map(s => (
                <button
                  key={s}
                  onClick={() => {
                    setSymbol(s);
                    setTimeout(() => fetchDataAndCalculate(), 100);
                  }}
                  className="px-2 py-1 text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 rounded hover:bg-blue-100 hover:text-blue-600 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FIB;
