// Fibonacci Calculator with Real-Time Market Data

// Use local proxy server to avoid CORS issues
const API_BASE_URL = '/api/quote/';

// Custom Fibonacci ratios based on user preferences
// Positive levels (above high) - in ascending order
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

// Negative levels (below low) - in descending order (most negative first)
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

// DOM Elements
const symbolInput = document.getElementById('symbol');
const calculateBtn = document.getElementById('calculateBtn');
const priceInfo = document.getElementById('priceInfo');
const errorMessage = document.getElementById('errorMessage');
const loading = document.getElementById('loading');
const levelsCard = document.getElementById('levelsCard');
const retracementLevels = document.getElementById('retracementLevels');
const extensionLevels = document.getElementById('extensionLevels');

// Price display elements
const symbolName = document.getElementById('symbolName');
const currentPrice = document.getElementById('currentPrice');
const highPrice = document.getElementById('highPrice');
const lowPrice = document.getElementById('lowPrice');
const rangeDisplay = document.getElementById('range');

// Fixed values (no longer dropdowns)
const period = 'ytd';
const anchorMode = 'first_day';
let precision = 2; // Default precision

// Toggle button functionality
const precisionToggle = document.getElementById('precisionToggle');
const toggleButtons = precisionToggle.querySelectorAll('.toggle-btn');

toggleButtons.forEach(button => {
    button.addEventListener('click', function() {
        // Remove active class from all buttons
        toggleButtons.forEach(btn => btn.classList.remove('active'));
        // Add active class to clicked button
        this.classList.add('active');
        // Update precision value
        precision = parseInt(this.dataset.value);
        console.log('Precision changed to:', precision);
    });
});

// Event Listeners
calculateBtn.addEventListener('click', fetchDataAndCalculate);
symbolInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        fetchDataAndCalculate();
    }
});

// Main function to fetch data and calculate Fibonacci levels
async function fetchDataAndCalculate() {
    const symbol = symbolInput.value.trim().toUpperCase();

    if (!symbol) {
        showError('Please enter a valid symbol');
        return;
    }

    // Show loading state
    showLoading();
    hideError();
    document.getElementById('levelsChartContainer').style.display = 'none';

    try {
        console.log('Fetching data for:', symbol, period, 'Anchor:', anchorMode, 'Precision:', precision);
        const data = await fetchMarketData(symbol, period, anchorMode);
        console.log('Data received:', data);
        
        displayPriceInfo(data, precision);
        calculateAndDisplayLevels(data.high, data.low, precision);
        
        // Show the container first
        document.getElementById('levelsChartContainer').style.display = 'grid';
        
        // Wait a bit for the container to render
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Reinitialize chart if needed
        if (!chart) {
            console.log('Chart not initialized, initializing now...');
            initializeChart();
        }
        
        // Update chart with data
        if (data.timestamps && data.quotes) {
            console.log('Updating chart...');
            updateChart(data.timestamps, data.quotes);
            addFibonacciLevelsToChart(data.high, data.low);
        } else {
            console.error('Missing chart data');
        }
        
    } catch (error) {
        console.error('Error in fetchDataAndCalculate:', error);
        showError(error.message);
    } finally {
        hideLoading();
    }
}

// Fetch market data from Yahoo Finance API via proxy
async function fetchMarketData(symbol, period, anchorMode) {
    try {
        const url = `${API_BASE_URL}${symbol}?period=${period}`;
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error('Failed to fetch market data. Please check the symbol and try again.');
        }

        const data = await response.json();
        
        if (!data.chart || !data.chart.result || data.chart.result.length === 0) {
            throw new Error('No data available for this symbol');
        }

        const result = data.chart.result[0];
        const meta = result.meta;
        const quotes = result.indicators.quote[0];
        const timestamps = result.timestamp;
        
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

        return {
            symbol: meta.symbol,
            current: current,
            high: high,
            low: low,
            currency: meta.currency || 'USD',
            timestamps: timestamps,
            quotes: quotes,
            anchorInfo: anchorInfo
        };
    } catch (error) {
        console.error('Error fetching market data:', error);
        throw new Error('Unable to fetch market data. Please verify the symbol and try again.');
    }
}

// Get appropriate interval based on period
function getInterval(period) {
    const intervalMap = {
        '1d': '5m',
        '5d': '15m',
        '1mo': '1d',
        '3mo': '1d',
        '6mo': '1d',
        '1y': '1wk'
    };
    return intervalMap[period] || '1d';
}

// Display price information
function displayPriceInfo(data, precision) {
    // Show anchor info in the symbol name
    const anchorText = data.anchorInfo ? data.anchorInfo.split('(')[0].trim() : 'Period High/Low';
    symbolName.textContent = `${data.symbol} - ${anchorText}`;
    
    currentPrice.textContent = `${data.currency} ${data.current.toFixed(precision)}`;
    highPrice.textContent = `${data.currency} ${data.high.toFixed(precision)}`;
    lowPrice.textContent = `${data.currency} ${data.low.toFixed(precision)}`;
    
    const range = data.high - data.low;
    const rangePercent = ((range / data.low) * 100).toFixed(2);
    rangeDisplay.textContent = `${data.currency} ${range.toFixed(precision)} (${rangePercent}%)`;
    
    // Log full anchor info to console for verification
    if (data.anchorInfo) {
        console.log('Anchor Info:', data.anchorInfo);
    }
    
    priceInfo.style.display = 'block';
}

// Calculate and display Fibonacci levels
// BULLISH candle: 0 = Low, 1 = High
// BEARISH candle: 0 = High, 1 = Low
// Note: 'high' and 'low' parameters are already adjusted based on candle direction
function calculateAndDisplayLevels(high, low, precision) {
    const range = high - low;
    
    console.log('Calculating Fibonacci levels:', {
        fibonacciHigh: high,
        fibonacciLow: low,
        range: range,
        note: 'Parameters already adjusted for candle direction'
    });
    
    // Clear previous levels
    retracementLevels.innerHTML = '';
    extensionLevels.innerHTML = '';
    
    // Calculate positive extension levels
    // Formula: low + (ratio * range)
    // For bullish: extends upward from actual low
    // For bearish: extends upward from actual high (which is stored as 'low')
    RETRACEMENT_LEVELS.forEach(level => {
        const price = low + (range * level.ratio);
        const levelElement = createLevelElement(level.label, price, precision);
        retracementLevels.appendChild(levelElement);
        console.log(`Level ${level.label}: ${price.toFixed(precision)}`);
    });
    
    // Calculate negative extension levels
    // Formula: low + (negative ratio * range)
    // For bullish: extends downward from actual low
    // For bearish: extends downward from actual high (which is stored as 'low')
    EXTENSION_LEVELS.forEach(level => {
        const price = low + (range * level.ratio);
        const levelElement = createLevelElement(level.label, price, precision);
        extensionLevels.appendChild(levelElement);
        console.log(`Level ${level.label}: ${price.toFixed(precision)}`);
    });
}

// Create a level display element
function createLevelElement(label, price, precision) {
    const div = document.createElement('div');
    div.className = 'level-item';
    
    const labelSpan = document.createElement('span');
    labelSpan.className = 'level-label';
    labelSpan.textContent = label;
    
    const valueSpan = document.createElement('span');
    valueSpan.className = 'level-value';
    valueSpan.textContent = price.toFixed(precision);
    
    div.appendChild(labelSpan);
    div.appendChild(valueSpan);
    
    return div;
}

// UI Helper Functions
function showLoading() {
    loading.style.display = 'block';
    calculateBtn.disabled = true;
    priceInfo.style.display = 'none';
}

function hideLoading() {
    loading.style.display = 'none';
    calculateBtn.disabled = false;
}

function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    priceInfo.style.display = 'none';
}

function hideError() {
    errorMessage.style.display = 'none';
}

// Chart instance
let chart = null;
let candlestickSeries = null;
let chartData = [];

// Initialize chart
function initializeChart() {
    const chartContainer = document.getElementById('chartContainer');
    
    if (!chartContainer) {
        console.error('Chart container not found');
        return;
    }
    
    console.log('Initializing chart...');
    
    try {
        // Get the actual dimensions of the container
        const containerWidth = chartContainer.clientWidth;
        const containerHeight = chartContainer.clientHeight;
        
        console.log('Chart container dimensions:', { width: containerWidth, height: containerHeight });
        
        chart = LightweightCharts.createChart(chartContainer, {
            width: containerWidth,
            height: containerHeight,
            layout: {
                background: { color: '#ffffff' },
                textColor: '#495057',
            },
            grid: {
                vertLines: { color: '#e0e0e0' },
                horzLines: { color: '#e0e0e0' },
            },
            crosshair: {
                mode: LightweightCharts.CrosshairMode.Normal,
            },
            rightPriceScale: {
                borderColor: '#e0e0e0',
                visible: true,
            },
            timeScale: {
                borderColor: '#e0e0e0',
                timeVisible: true,
                secondsVisible: false,
                visible: true,
            },
        });

        candlestickSeries = chart.addCandlestickSeries({
            upColor: '#22C55E',
            downColor: '#EF4444',
            borderUpColor: '#22C55E',
            borderDownColor: '#EF4444',
            wickUpColor: '#22C55E',
            wickDownColor: '#EF4444',
        });
        
        console.log('Chart initialized successfully');

        // Handle window resize
        const resizeObserver = new ResizeObserver(entries => {
            if (chart && chartContainer) {
                const width = chartContainer.clientWidth;
                const height = chartContainer.clientHeight;
                chart.applyOptions({ 
                    width: width,
                    height: height 
                });
                console.log('Chart resized to:', { width, height });
            }
        });
        
        resizeObserver.observe(chartContainer);
    } catch (error) {
        console.error('Error initializing chart:', error);
    }
}

// Update chart with market data
function updateChart(timestamps, quotes) {
    if (!candlestickSeries || !timestamps || !quotes) {
        console.error('Chart or data not available');
        return;
    }
    
    console.log('Updating chart with data:', { timestamps: timestamps.length, quotes });
    
    const chartData = [];
    
    for (let i = 0; i < timestamps.length; i++) {
        if (quotes.open[i] !== null && quotes.high[i] !== null && 
            quotes.low[i] !== null && quotes.close[i] !== null) {
            chartData.push({
                time: timestamps[i],
                open: parseFloat(quotes.open[i]),
                high: parseFloat(quotes.high[i]),
                low: parseFloat(quotes.low[i]),
                close: parseFloat(quotes.close[i])
            });
        }
    }
    
    console.log('Chart data prepared:', chartData.length, 'candles');
    
    if (chartData.length > 0) {
        candlestickSeries.setData(chartData);
        chart.timeScale().fitContent();
        console.log('Chart updated successfully');
    } else {
        console.error('No valid chart data');
    }
}

// Add Fibonacci levels to chart
// BULLISH candle: 0 = Low, 1 = High
// BEARISH candle: 0 = High, 1 = Low
function addFibonacciLevelsToChart(high, low) {
    if (!chart || !candlestickSeries) {
        console.error('Chart not initialized');
        return;
    }
    
    console.log('Adding Fibonacci levels to chart:', { 
        fibonacciHigh: high, 
        fibonacciLow: low,
        note: 'Parameters already adjusted for candle direction'
    });
    
    const range = high - low;
    
    // Add key positive levels (BLUE)
    const keyPositiveLevels = [
        { ratio: 0, label: '0.0' },
        { ratio: 1, label: '1.0' },
        { ratio: 1.618, label: '1.618' },
        { ratio: 2.618, label: '2.618' },
        { ratio: 4.24, label: '4.24' }
    ];
    
    keyPositiveLevels.forEach(level => {
        const price = low + (range * level.ratio);
        try {
            candlestickSeries.createPriceLine({
                price: price,
                color: '#3B82F6', // Blue for positive levels
                lineWidth: level.ratio === 0 || level.ratio === 1 ? 2 : 1,
                lineStyle: level.ratio === 0 || level.ratio === 1 ? LightweightCharts.LineStyle.Solid : LightweightCharts.LineStyle.Dashed,
                axisLabelVisible: true,
                title: level.label,
            });
            console.log(`Chart line added (BLUE): ${level.label} at ${price.toFixed(2)}`);
        } catch (e) {
            console.error('Error adding positive level:', e);
        }
    });
    
    // Add key negative levels (RED)
    const keyNegativeLevels = [
        { ratio: -0.5, label: '-0.5' },
        { ratio: -1, label: '-1.0' },
        { ratio: -1.618, label: '-1.618' },
        { ratio: -2.618, label: '-2.618' },
        { ratio: -4.24, label: '-4.24' },
        { ratio: -5.08, label: '-5.08' },
        { ratio: -6.86, label: '-6.86' },
        { ratio: -11.01, label: '-11.01' }
    ];
    
    keyNegativeLevels.forEach(level => {
        const price = low + (range * level.ratio);
        try {
            candlestickSeries.createPriceLine({
                price: price,
                color: '#EF4444', // Red for negative levels
                lineWidth: 1,
                lineStyle: LightweightCharts.LineStyle.Dashed,
                axisLabelVisible: true,
                title: level.label,
            });
            console.log(`Chart line added (RED): ${level.label} at ${price.toFixed(2)}`);
        } catch (e) {
            console.error('Error adding negative level:', e);
        }
    });
    
    console.log('Fibonacci levels added to chart');
}

// Initialize with default calculation on page load
window.addEventListener('load', () => {
    console.log('Page loaded, checking for Lightweight Charts...');
    if (typeof LightweightCharts === 'undefined') {
        console.error('Lightweight Charts library not loaded!');
        showError('Chart library failed to load. Please refresh the page.');
    } else {
        console.log('Lightweight Charts loaded successfully');
        // Don't initialize chart yet, wait for data
        fetchDataAndCalculate();
    }
});