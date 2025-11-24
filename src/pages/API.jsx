import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import MonitorCard from '../components/MonitorCard';
import AddMonitorModal from '../components/AddMonitorModal';
import { getMonitors, createMonitor, updateMonitor, deleteMonitor, togglePauseMonitor, fetchMarketData, getPriceChartData } from '../services/monitorService';
import { fetchFibhubNews } from '../services/newsService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

function API() {
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState(null);
  const [apiConnected, setApiConnected] = useState(false);
  const [error, setError] = useState(null);
  const [yahooStatus, setYahooStatus] = useState('unknown');
  const [finnhubStatus, setFinnhubStatus] = useState('unknown');
  const [massiveStatus, setMassiveStatus] = useState('unknown');
  const [fibhubStatus, setFibhubStatus] = useState('unknown');
  const [activeApi, setActiveApi] = useState('yahoo');
  const [preferredApi, setPreferredApi] = useState(() => {
    try {
      const saved = localStorage.getItem('preferredApi');
      return saved && ['yahoo', 'finnhub', 'massive', 'auto'].includes(saved) ? saved : 'auto';
    } catch {
      return 'auto';
    }
  });
  const [apiStatusHistory, setApiStatusHistory] = useState([]);
  const [successRate, setSuccessRate] = useState(100);
  const [totalRequests, setTotalRequests] = useState(0);
  const [successfulRequests, setSuccessfulRequests] = useState(0);
  const [switchingApi, setSwitchingApi] = useState(false);
  const [dashboardStatus, setDashboardStatus] = useState('unknown');
  const [chartsStatus, setChartsStatus] = useState('unknown');
  const [projectionStatus, setProjectionStatus] = useState('unknown');
  const maxHistoryLength = 30;

  // Calculate API success rate
  const calculateSuccessRate = () => {
    try {
      // Get request history from localStorage
      const saved = localStorage.getItem('apiRequestHistory');
      let requestHistory = [];
      
      if (saved) {
        try {
          requestHistory = JSON.parse(saved);
        } catch (e) {
          console.error('Error parsing request history:', e);
        }
      }
      
      // Filter to last 24 hours
      const now = Date.now();
      const oneDayAgo = now - (24 * 60 * 60 * 1000);
      const recentRequests = requestHistory.filter(req => req.timestamp > oneDayAgo);
      
      if (recentRequests.length === 0) {
        setSuccessRate(100);
        setTotalRequests(0);
        setSuccessfulRequests(0);
        return;
      }
      
      const successful = recentRequests.filter(req => req.success).length;
      const total = recentRequests.length;
      const rate = total > 0 ? (successful / total) * 100 : 100;
      
      setSuccessRate(rate);
      setTotalRequests(total);
      setSuccessfulRequests(successful);
      
      // Clean up old requests (keep only last 7 days)
      const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000);
      const cleanedHistory = requestHistory.filter(req => req.timestamp > sevenDaysAgo);
      localStorage.setItem('apiRequestHistory', JSON.stringify(cleanedHistory));
    } catch (error) {
      console.error('Error calculating success rate:', error);
      setSuccessRate(100);
      setTotalRequests(0);
      setSuccessfulRequests(0);
    }
  };
  
  // Record API request result
  const recordApiRequest = (success) => {
    try {
      const saved = localStorage.getItem('apiRequestHistory');
      let requestHistory = [];
      
      if (saved) {
        try {
          requestHistory = JSON.parse(saved);
        } catch (e) {
          console.error('Error parsing request history:', e);
        }
      }
      
      requestHistory.push({
        timestamp: Date.now(),
        success: success
      });
      
      // Keep only last 1000 requests
      if (requestHistory.length > 1000) {
        requestHistory = requestHistory.slice(-1000);
      }
      
      localStorage.setItem('apiRequestHistory', JSON.stringify(requestHistory));
      calculateSuccessRate();
    } catch (error) {
      console.error('Error recording API request:', error);
    }
  };

  // Check page API status
  const checkPageStatus = async () => {
    // Check Dashboard Page (uses fetchMarketData)
    try {
      const dashboardResult = await fetchMarketData('AAPL', '1d', '1d');
      setDashboardStatus(dashboardResult && dashboardResult.data ? 'operational' : 'down');
    } catch (error) {
      console.error('Dashboard API check failed:', error);
      setDashboardStatus('down');
    }

    // Check Charts Page (uses getPriceChartData)
    try {
      const chartsResult = await getPriceChartData('AAPL', '1D');
      setChartsStatus(chartsResult && chartsResult.data && chartsResult.data.length > 0 ? 'operational' : 'down');
    } catch (error) {
      console.error('Charts API check failed:', error);
      setChartsStatus('down');
    }

    // Check Projection Page (uses getPriceChartData)
    try {
      const projectionResult = await getPriceChartData('AAPL', '1D');
      setProjectionStatus(projectionResult && projectionResult.data && projectionResult.data.length > 0 ? 'operational' : 'down');
    } catch (error) {
      console.error('Projection API check failed:', error);
      setProjectionStatus('down');
    }

    // Check Fibhub News API
    try {
      const fibhubResult = await fetchFibhubNews('general');
      setFibhubStatus(fibhubResult && fibhubResult.length > 0 ? 'operational' : 'down');
    } catch (error) {
      console.error('Fibhub API check failed:', error);
      setFibhubStatus('down');
    }
  };

  useEffect(() => {
    // Initialize success rate calculation
    calculateSuccessRate();
    
    loadMonitors();
    checkPageStatus();
    
    // Get refresh interval from localStorage or use default 30 seconds
    const getRefreshInterval = () => {
      try {
        const saved = localStorage.getItem('refreshInterval');
        return saved ? parseInt(saved, 10) : 30;
      } catch (error) {
        return 30;
      }
    };
    
    const refreshInterval = getRefreshInterval();
    const interval = setInterval(() => {
      loadMonitors();
      calculateSuccessRate();
      checkPageStatus();
    }, refreshInterval * 1000);
    return () => clearInterval(interval);
  }, []);

  const loadMonitors = async () => {
    try {
      const data = await getMonitors();
      setMonitors(data);
      setApiConnected(true);
      setError(null);
      
      // Calculate success rate
      calculateSuccessRate();
      
      // Record successful API call
      recordApiRequest(true);
      
      // Determine which API was used based on monitor data
      const apiSources = data.map(m => m.apiSource).filter(Boolean);
      let currentStatus = 'disconnected';
      
      // Count API usage
      const apiCounts = {
        yahoo: apiSources.filter(s => s === 'yahoo').length,
        finnhub: apiSources.filter(s => s === 'finnhub').length,
        massive: apiSources.filter(s => s === 'massive').length,
      };
      
      // Determine primary API (most used)
      let primarySource = 'yahoo';
      if (apiCounts.finnhub > apiCounts.yahoo && apiCounts.finnhub > apiCounts.massive) {
        primarySource = 'finnhub';
      } else if (apiCounts.massive > apiCounts.yahoo && apiCounts.massive > apiCounts.finnhub) {
        primarySource = 'massive';
      } else if (apiCounts.yahoo > 0) {
        primarySource = 'yahoo';
      } else if (apiCounts.finnhub > 0) {
        primarySource = 'finnhub';
      } else if (apiCounts.massive > 0) {
        primarySource = 'massive';
      }
      
      if (apiSources.length > 0) {
        setActiveApi(primarySource);
        currentStatus = 'connected';
        
        // Set status for each API
        setYahooStatus(apiCounts.yahoo > 0 ? 'connected' : (apiCounts.finnhub > 0 || apiCounts.massive > 0 ? 'standby' : 'unknown'));
        setFinnhubStatus(apiCounts.finnhub > 0 ? 'connected' : (apiCounts.yahoo > 0 || apiCounts.massive > 0 ? 'standby' : 'unknown'));
        setMassiveStatus(apiCounts.massive > 0 ? 'connected' : (apiCounts.yahoo > 0 || apiCounts.finnhub > 0 ? 'standby' : 'unknown'));
      } else {
        setYahooStatus('failed');
        setFinnhubStatus('failed');
        setMassiveStatus('failed');
        setFibhubStatus('unknown');
      }
      
      // Update API status history
      const timestamp = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
      setApiStatusHistory(prev => {
        const newHistory = [...prev, { time: timestamp, status: currentStatus === 'connected' ? 1 : 0 }];
        return newHistory.slice(-maxHistoryLength);
      });
    } catch (error) {
      console.error('Failed to load monitors:', error);
      setApiConnected(false);
      setError('Unable to fetch live data from all APIs. Please check your internet connection.');
      setMonitors([]);
      setYahooStatus('failed');
      setFinnhubStatus('failed');
      setMassiveStatus('failed');
      setFibhubStatus('failed');
      
      // Record failed API call
      recordApiRequest(false);
      
      // Update API status history with failure
      const timestamp = new Date().toLocaleTimeString('en-US', { timeZone: 'America/New_York' });
      setApiStatusHistory(prev => {
        const newHistory = [...prev, { time: timestamp, status: 0 }];
        return newHistory.slice(-maxHistoryLength);
      });
    } finally {
      setLoading(false);
    }
  };

  const handleApiSwitch = async (newApi) => {
    if (newApi === preferredApi) return;
    
    setSwitchingApi(true);
    try {
      // Save preference to localStorage
      localStorage.setItem('preferredApi', newApi);
      setPreferredApi(newApi);
      
      // Reload monitors with new API preference
      await loadMonitors();
    } catch (error) {
      console.error('Failed to switch API:', error);
      setError('Failed to switch API endpoint: ' + error.message);
    } finally {
      setSwitchingApi(false);
    }
  };

  const handleAddMonitor = () => {
    setEditingMonitor(null);
    setIsModalOpen(true);
  };

  const handleEditMonitor = (monitor) => {
    setEditingMonitor(monitor);
    setIsModalOpen(true);
  };

  const handleSaveMonitor = async (monitorData) => {
    try {
      if (editingMonitor) {
        await updateMonitor(editingMonitor.id, monitorData);
      } else {
        await createMonitor(monitorData);
      }
      setIsModalOpen(false);
      setEditingMonitor(null);
      await loadMonitors();
    } catch (error) {
      console.error('Failed to save monitor:', error);
      alert(`Failed to save monitor: ${error.message || 'Unknown error'}`);
    }
  };

  const handleDeleteMonitor = async (id) => {
    if (window.confirm('Are you sure you want to delete this monitor?')) {
      try {
        await deleteMonitor(id);
        await loadMonitors();
      } catch (error) {
        console.error('Failed to delete monitor:', error);
        alert(`Failed to delete monitor: ${error.message || 'Unknown error'}`);
      }
    }
  };

  const handleTogglePause = async (id) => {
    try {
      await togglePauseMonitor(id);
      await loadMonitors();
    } catch (error) {
      console.error('Failed to toggle pause:', error);
      alert(`Failed to toggle pause: ${error.message || 'Unknown error'}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-600">Loading monitors...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <div className="flex justify-between items-start mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">API Status & Monitoring</h1>
            <p className="text-base text-gray-600 dark:text-gray-400">
              Monitor API health, performance metrics, and manage your stock market data sources
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              loadMonitors();
              checkPageStatus();
            }}
            disabled={loading}
            className="px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            {loading ? 'Refreshing...' : 'Refresh All'}
          </button>
        </div>
        
        {/* Quick Info Bar */}
        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>Data Sources: <a href="https://finance.yahoo.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">Yahoo Finance</a>, <a href="https://finnhub.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">Finnhub</a>, <a href="https://massive.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">Massive</a></span>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg p-4 shadow-sm">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-500 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3 flex-1">
              <h3 className="text-sm font-semibold text-red-800 dark:text-red-300 mb-1">Connection Error</h3>
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* System Overview Section */}
      <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-900 rounded-2xl shadow-xl p-8 border border-gray-200 dark:border-gray-700 mb-8">
        <div className="flex items-start justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg ${
              apiConnected ? 'bg-gradient-to-br from-green-400 to-green-600' : 'bg-gradient-to-br from-red-400 to-red-600'
            }`}>
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">System Overview</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Real-time status of all API endpoints and page functionality
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3 px-4 py-2 bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <span className={`w-3 h-3 rounded-full ${apiConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              <span className={`text-base font-semibold ${
                apiConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {apiConnected ? 'All Systems Operational' : 'System Down'}
              </span>
            </div>
          </div>
        </div>

        {/* Page Status Cards */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Page Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {/* Dashboard Page Status */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                  </svg>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Dashboard</p>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${
                  dashboardStatus === 'operational' ? 'bg-green-500 animate-pulse' : 
                  dashboardStatus === 'down' ? 'bg-red-500' : 
                  'bg-gray-400'
                }`}></span>
              </div>
              <p className={`text-xl font-bold mb-1 ${
                dashboardStatus === 'operational' ? 'text-green-600 dark:text-green-400' : 
                dashboardStatus === 'down' ? 'text-red-600 dark:text-red-400' : 
                'text-gray-600 dark:text-gray-400'
              }`}>
                {dashboardStatus === 'operational' ? 'Operational' : 
                 dashboardStatus === 'down' ? 'Down' : 
                 'Checking...'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Real-time market data</p>
            </div>
            
            {/* Charts Page Status */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Charts</p>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${
                  chartsStatus === 'operational' ? 'bg-green-500 animate-pulse' : 
                  chartsStatus === 'down' ? 'bg-red-500' : 
                  'bg-gray-400'
                }`}></span>
              </div>
              <p className={`text-xl font-bold mb-1 ${
                chartsStatus === 'operational' ? 'text-green-600 dark:text-green-400' : 
                chartsStatus === 'down' ? 'text-red-600 dark:text-red-400' : 
                'text-gray-600 dark:text-gray-400'
              }`}>
                {chartsStatus === 'operational' ? 'Operational' : 
                 chartsStatus === 'down' ? 'Down' : 
                 'Checking...'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Price charts & analysis</p>
            </div>
            
            {/* Projection Page Status */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                  </svg>
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Projection</p>
                </div>
                <span className={`w-2.5 h-2.5 rounded-full ${
                  projectionStatus === 'operational' ? 'bg-green-500 animate-pulse' : 
                  projectionStatus === 'down' ? 'bg-red-500' : 
                  'bg-gray-400'
                }`}></span>
              </div>
              <p className={`text-xl font-bold mb-1 ${
                projectionStatus === 'operational' ? 'text-green-600 dark:text-green-400' : 
                projectionStatus === 'down' ? 'text-red-600 dark:text-red-400' : 
                'text-gray-600 dark:text-gray-400'
              }`}>
                {projectionStatus === 'operational' ? 'Operational' : 
                 projectionStatus === 'down' ? 'Down' : 
                 'Checking...'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Price projections & forecasts</p>
            </div>
          </div>
        </div>

        {/* API Configuration */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            API Configuration
          </h3>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Preferred Data Source
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  Choose your primary API endpoint. Auto mode will automatically switch between available sources.
                </p>
                <select
                  value={preferredApi}
                  onChange={(e) => handleApiSwitch(e.target.value)}
                  disabled={switchingApi}
                  className="w-full md:w-auto min-w-[200px] px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-700 border-2 border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                >
                  <option value="auto">🔄 Auto (Smart Fallback)</option>
                  <option value="yahoo">📊 Yahoo Finance</option>
                  <option value="finnhub">🔷 Finnhub</option>
                  <option value="massive">🔐 Massive</option>
                </select>
                {switchingApi && (
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2 flex items-center gap-1">
                    <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Switching API endpoint...
                  </p>
                )}
              </div>
              <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <span className="text-xs text-gray-500 dark:text-gray-400">Currently Active:</span>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {activeApi === 'yahoo' ? '📊 Yahoo Finance' : activeApi === 'finnhub' ? '🔷 Finnhub' : activeApi === 'massive' ? '🔐 Massive' : '❌ None'}
                </span>
              </div>
            </div>
          </div>
        </div>
        {/* Performance Metrics */}
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Performance Metrics
          </h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Success Rate Card */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Success Rate (Last 24 Hours)</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">API request success percentage</p>
                </div>
                <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                  successRate >= 99 ? 'bg-green-100 dark:bg-green-900/20' :
                  successRate >= 95 ? 'bg-blue-100 dark:bg-blue-900/20' :
                  successRate >= 90 ? 'bg-yellow-100 dark:bg-yellow-900/20' :
                  'bg-red-100 dark:bg-red-900/20'
                }`}>
                  <svg className={`w-6 h-6 ${
                    successRate >= 99 ? 'text-green-600 dark:text-green-400' :
                    successRate >= 95 ? 'text-blue-600 dark:text-blue-400' :
                    successRate >= 90 ? 'text-yellow-600 dark:text-yellow-400' :
                    'text-red-600 dark:text-red-400'
                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              
              <div className="mb-4">
                <p className={`text-4xl font-bold mb-3 ${
                  successRate >= 99 ? 'text-green-600 dark:text-green-400' :
                  successRate >= 95 ? 'text-blue-600 dark:text-blue-400' :
                  successRate >= 90 ? 'text-yellow-600 dark:text-yellow-400' :
                  'text-red-600 dark:text-red-400'
                }`}>
                  {successRate.toFixed(1)}%
                </p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 overflow-hidden">
                  <div 
                    className={`h-full rounded-full transition-all duration-500 ${
                      successRate >= 99 ? 'bg-gradient-to-r from-green-400 to-green-600' :
                      successRate >= 95 ? 'bg-gradient-to-r from-blue-400 to-blue-600' :
                      successRate >= 90 ? 'bg-gradient-to-r from-yellow-400 to-yellow-600' :
                      'bg-gradient-to-r from-red-400 to-red-600'
                    }`}
                    style={{ width: `${Math.min(successRate, 100)}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Successful Requests</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{successfulRequests.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Total Requests</p>
                  <p className="text-lg font-bold text-gray-900 dark:text-white">{totalRequests.toLocaleString()}</p>
                </div>
              </div>
            </div>

            {/* API Status History Chart */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
              <div className="mb-4">
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">Connection Status History</p>
                <p className="text-xs text-gray-500 dark:text-gray-500">Real-time API connectivity over time</p>
              </div>
              <div className="h-48">
                {apiStatusHistory.length > 0 ? (
                  <Line
                    data={{
                      labels: apiStatusHistory.map(item => item.time),
                      datasets: [
                        {
                          label: 'API Status',
                          data: apiStatusHistory.map(item => item.status),
                          borderColor: apiConnected ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
                          backgroundColor: apiConnected ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                          tension: 0.4,
                          fill: true,
                          pointRadius: 3,
                          pointHoverRadius: 5,
                          pointBackgroundColor: apiConnected ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
                          pointBorderColor: '#fff',
                          pointBorderWidth: 2,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: {
                        legend: {
                          display: false,
                        },
                        tooltip: {
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          padding: 12,
                          titleFont: { size: 12, weight: 'bold' },
                          bodyFont: { size: 11 },
                          callbacks: {
                            label: function(context) {
                              return context.parsed.y === 1 ? '✅ Connected' : '❌ Disconnected';
                            },
                          },
                        },
                      },
                      scales: {
                        y: {
                          beginAtZero: true,
                          max: 1,
                          ticks: {
                            stepSize: 1,
                            callback: function(value) {
                              return value === 1 ? '✓' : '✗';
                            },
                            font: { size: 11 },
                          },
                          grid: {
                            color: 'rgba(0, 0, 0, 0.05)',
                          },
                        },
                        x: {
                          ticks: {
                            maxTicksLimit: 8,
                            font: { size: 10 },
                          },
                          grid: {
                            display: false,
                          },
                        },
                      },
                    }}
                  />
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-gray-400">
                    <svg className="w-12 h-12 mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p className="text-sm">No status data yet</p>
                    <p className="text-xs mt-1">Data will appear after first API check</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Last System Check</p>
            </div>
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              {monitors.length > 0 && monitors[0]?.lastCheck 
                ? new Date(monitors[0].lastCheck).toLocaleString('en-US', { 
                    timeZone: 'America/New_York',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })
                : 'Never'
              }
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
              </svg>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400">Active Endpoint</p>
            </div>
            <p className="text-base font-semibold text-gray-900 dark:text-white">
              {yahooStatus === 'connected' ? '📊 Yahoo Finance' : 
               finnhubStatus === 'connected' ? '🔷 Finnhub' : 
               massiveStatus === 'connected' ? '🔐 Massive' : 
               '❌ None'}
            </p>
          </div>
        </div>
      </div>

      {/* API Endpoints Status Section */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
          </svg>
          API Endpoints
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Monitor the status of all available data sources. The system automatically switches between endpoints for optimal reliability.
        </p>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          {/* Yahoo Finance API Status Box */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-md ${
                yahooStatus === 'connected' ? 'bg-gradient-to-br from-green-400 to-green-600' : 
                yahooStatus === 'failed' ? 'bg-gradient-to-br from-red-400 to-red-600' : 
                'bg-gradient-to-br from-gray-300 to-gray-500 dark:from-gray-600 dark:to-gray-700'
              }`}>
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div className="flex flex-col items-end">
                <span className={`w-3 h-3 rounded-full mb-1 ${
                  yahooStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
                  yahooStatus === 'failed' ? 'bg-red-500' : 
                  'bg-gray-400'
                }`}></span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  yahooStatus === 'connected' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                  yahooStatus === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 
                  'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                }`}>
                  {yahooStatus === 'connected' ? 'Active' : 
                   yahooStatus === 'failed' ? 'Failed' : 
                   'Standby'}
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Yahoo Finance</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                <a href="https://finance.yahoo.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  query1.finance.yahoo.com
                </a>
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md font-medium">
                  Primary
                </span>
                <span className="text-gray-500 dark:text-gray-400">Real-time quotes</span>
              </div>
            </div>
          </div>

          {/* Finnhub API Status Box */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-md ${
                finnhubStatus === 'connected' ? 'bg-gradient-to-br from-green-400 to-green-600' : 
                finnhubStatus === 'failed' ? 'bg-gradient-to-br from-red-400 to-red-600' : 
                'bg-gradient-to-br from-blue-400 to-blue-600'
              }`}>
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div className="flex flex-col items-end">
                <span className={`w-3 h-3 rounded-full mb-1 ${
                  finnhubStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
                  finnhubStatus === 'failed' ? 'bg-red-500' : 
                  'bg-blue-500'
                }`}></span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  finnhubStatus === 'connected' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                  finnhubStatus === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 
                  'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                }`}>
                  {finnhubStatus === 'connected' ? 'Active' : 
                   finnhubStatus === 'failed' ? 'Failed' : 
                   'Standby'}
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Finnhub</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                <a href="https://finnhub.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  finnhub.io
                </a>
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-md font-medium">
                  Backup
                </span>
                <span className="text-gray-500 dark:text-gray-400">Market data</span>
              </div>
            </div>
          </div>

          {/* Massive API Status Box */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-md ${
                massiveStatus === 'connected' ? 'bg-gradient-to-br from-green-400 to-green-600' : 
                massiveStatus === 'failed' ? 'bg-gradient-to-br from-red-400 to-red-600' : 
                'bg-gradient-to-br from-purple-400 to-purple-600'
              }`}>
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div className="flex flex-col items-end">
                <span className={`w-3 h-3 rounded-full mb-1 ${
                  massiveStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
                  massiveStatus === 'failed' ? 'bg-red-500' : 
                  'bg-purple-500'
                }`}></span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  massiveStatus === 'connected' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                  massiveStatus === 'failed' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 
                  'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                }`}>
                  {massiveStatus === 'connected' ? 'Active' : 
                   massiveStatus === 'failed' ? 'Failed' : 
                   'Standby'}
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Massive</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                <a href="https://massive.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  api.massive.com
                </a>
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-md font-medium">
                  Backup
                </span>
                <span className="text-gray-500 dark:text-gray-400">Secure API</span>
              </div>
            </div>
          </div>

          {/* Fibhub News API Status Box */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600 transition-all">
            <div className="flex items-start justify-between mb-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-md ${
                fibhubStatus === 'operational' ? 'bg-gradient-to-br from-green-400 to-green-600' : 
                fibhubStatus === 'down' ? 'bg-gradient-to-br from-red-400 to-red-600' : 
                'bg-gradient-to-br from-orange-400 to-orange-600'
              }`}>
                <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
                </svg>
              </div>
              <div className="flex flex-col items-end">
                <span className={`w-3 h-3 rounded-full mb-1 ${
                  fibhubStatus === 'operational' ? 'bg-green-500 animate-pulse' : 
                  fibhubStatus === 'down' ? 'bg-red-500' : 
                  'bg-orange-500'
                }`}></span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                  fibhubStatus === 'operational' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 
                  fibhubStatus === 'down' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 
                  'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400'
                }`}>
                  {fibhubStatus === 'operational' ? 'Operational' : 
                   fibhubStatus === 'down' ? 'Down' : 
                   'Checking...'}
                </span>
              </div>
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">Fibhub News</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                <a href="https://fibhub.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline font-medium">
                  api.fibhub.io
                </a>
              </p>
              <div className="flex items-center gap-2 text-xs">
                <span className="px-2 py-1 bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 rounded-md font-medium">
                  News
                </span>
                <span className="text-gray-500 dark:text-gray-400">Market news</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Monitors Section */}
      {monitors.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
                Active Monitors ({monitors.length})
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Track your stock symbols and monitor their performance
              </p>
            </div>
            <button
              type="button"
              onClick={handleAddMonitor}
              className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Monitor
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monitors.map((monitor) => (
              <MonitorCard
                key={monitor.id}
                monitor={monitor}
                onEdit={handleEditMonitor}
                onDelete={handleDeleteMonitor}
                onTogglePause={handleTogglePause}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty State - No Monitors */}
      {monitors.length === 0 && !loading && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-12 border border-gray-200 dark:border-gray-700 text-center">
          <div className="max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No Monitors Yet</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
              Start monitoring your favorite stocks by adding your first monitor. Track prices, changes, and get real-time updates.
            </p>
            <button
              type="button"
              onClick={handleAddMonitor}
              className="px-6 py-3 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg shadow-md hover:shadow-lg transition-all inline-flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Your First Monitor
            </button>
          </div>
        </div>
      )}

      <AddMonitorModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingMonitor(null);
        }}
        onSave={handleSaveMonitor}
        monitor={editingMonitor}
      />
    </div>
  );
}

export default API;

