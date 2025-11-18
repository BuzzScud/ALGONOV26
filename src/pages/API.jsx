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
import { getMonitors, createMonitor, updateMonitor, deleteMonitor, togglePauseMonitor } from '../services/monitorService';

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

  useEffect(() => {
    // Initialize success rate calculation
    calculateSuccessRate();
    
    loadMonitors();
    
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
      }
      
      // Update API status history
      const timestamp = new Date().toLocaleTimeString();
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
      
      // Record failed API call
      recordApiRequest(false);
      
      // Update API status history with failure
      const timestamp = new Date().toLocaleTimeString();
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
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Stock Market Monitoring</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Live data from <a href="https://finance.yahoo.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Yahoo Finance</a>, <a href="https://finnhub.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Finnhub</a>, and <a href="https://massive.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">Massive</a>
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Page Summary - Moved to Top */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700 mb-6">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
              apiConnected ? 'bg-green-100 dark:bg-green-900/20' : 'bg-red-100 dark:bg-red-900/20'
            }`}>
              <svg className={`w-6 h-6 ${apiConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Page Summary</h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Overview of monitoring system status and performance
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${apiConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
            <span className={`text-sm font-medium ${
              apiConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {apiConnected ? 'Operational' : 'Down'}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Overall Status</p>
            <p className={`text-lg font-semibold ${
              apiConnected ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
            }`}>
              {apiConnected ? 'Operational' : 'Down'}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Preferred API</p>
            <select
              value={preferredApi}
              onChange={(e) => handleApiSwitch(e.target.value)}
              disabled={switchingApi}
              className="w-full px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <option value="auto">Auto (Fallback)</option>
              <option value="yahoo">Yahoo Finance</option>
              <option value="finnhub">Finnhub</option>
              <option value="massive">Massive</option>
            </select>
            {switchingApi && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Switching...
              </p>
            )}
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
              Active: {activeApi === 'yahoo' ? 'Yahoo Finance' : activeApi === 'finnhub' ? 'Finnhub' : activeApi === 'massive' ? 'Massive' : 'None'}
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 md:col-span-2 lg:col-span-1">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Success Rate (24h)</p>
            
            <div className="mb-3">
              <p className={`text-3xl font-bold mb-1 ${
                successRate >= 99 ? 'text-green-600 dark:text-green-400' :
                successRate >= 95 ? 'text-blue-600 dark:text-blue-400' :
                successRate >= 90 ? 'text-yellow-600 dark:text-yellow-400' :
                'text-red-600 dark:text-red-400'
              }`}>
                {successRate.toFixed(2)}%
              </p>
              <div className="w-full bg-gray-200 dark:bg-gray-600 rounded-full h-2 mb-2">
                <div 
                  className={`h-2 rounded-full transition-all duration-300 ${
                    successRate >= 99 ? 'bg-green-500' :
                    successRate >= 95 ? 'bg-blue-500' :
                    successRate >= 90 ? 'bg-yellow-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(successRate, 100)}%` }}
                ></div>
              </div>
            </div>
            
            <div className="pt-2 border-t border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-500 dark:text-gray-400">Successful:</span>
                <span className="text-gray-900 dark:text-white font-semibold">{successfulRequests}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-gray-500 dark:text-gray-400">Total Requests:</span>
                <span className="text-gray-900 dark:text-white font-semibold">{totalRequests}</span>
              </div>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 md:col-span-2 lg:col-span-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">API Status</p>
            <div className="h-32">
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
                        pointRadius: 2,
                        pointHoverRadius: 4,
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
                        callbacks: {
                          label: function(context) {
                            return context.parsed.y === 1 ? 'Connected' : 'Disconnected';
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
                            return value === 1 ? 'Connected' : 'Disconnected';
                          },
                        },
                      },
                      x: {
                        ticks: {
                          maxTicksLimit: 8,
                          font: {
                            size: 10,
                          },
                        },
                      },
                    },
                  }}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                  No status data yet
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last Check</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {monitors.length > 0 && monitors[0]?.lastCheck 
                ? new Date(monitors[0].lastCheck).toLocaleString()
                : 'Never'
              }
            </p>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">API Endpoints</p>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              {yahooStatus === 'connected' ? 'Yahoo Finance' : finnhubStatus === 'connected' ? 'Finnhub' : massiveStatus === 'connected' ? 'Massive' : 'None'} Active
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-xs text-gray-500 dark:text-gray-400">
            Real-time stock market data with automatic fallback between Yahoo Finance, Finnhub, and Massive APIs
          </div>
          <button
            type="button"
            onClick={loadMonitors}
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

      {/* API Endpoints Status Boxes */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Yahoo Finance API Status Box */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                yahooStatus === 'connected' ? 'bg-green-100 dark:bg-green-900/20' : 
                yahooStatus === 'failed' ? 'bg-red-100 dark:bg-red-900/20' : 
                'bg-gray-100 dark:bg-gray-700/50'
              }`}>
                <svg className={`w-6 h-6 ${
                  yahooStatus === 'connected' ? 'text-green-600 dark:text-green-400' : 
                  yahooStatus === 'failed' ? 'text-red-600 dark:text-red-400' : 
                  'text-gray-600 dark:text-gray-400'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Yahoo Finance API</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <a href="https://finance.yahoo.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                    query1.finance.yahoo.com
                  </a>
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Primary Endpoint</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${
                yahooStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
                yahooStatus === 'failed' ? 'bg-red-500' : 
                'bg-gray-400'
              }`}></span>
              <span className={`text-sm font-medium ${
                yahooStatus === 'connected' ? 'text-green-600 dark:text-green-400' : 
                yahooStatus === 'failed' ? 'text-red-600 dark:text-red-400' : 
                'text-gray-600 dark:text-gray-400'
              }`}>
                {yahooStatus === 'connected' ? 'Active' : 
                 yahooStatus === 'failed' ? 'Failed' : 
                 'Standby'}
              </span>
            </div>
          </div>
        </div>

        {/* Finnhub API Status Box */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                finnhubStatus === 'connected' ? 'bg-green-100 dark:bg-green-900/20' : 
                finnhubStatus === 'failed' ? 'bg-red-100 dark:bg-red-900/20' : 
                'bg-blue-100 dark:bg-blue-900/20'
              }`}>
                <svg className={`w-6 h-6 ${
                  finnhubStatus === 'connected' ? 'text-green-600 dark:text-green-400' : 
                  finnhubStatus === 'failed' ? 'text-red-600 dark:text-red-400' : 
                  'text-blue-600 dark:text-blue-400'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Finnhub API</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <a href="https://finnhub.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                    finnhub.io
                  </a>
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Backup Endpoint</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${
                finnhubStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
                finnhubStatus === 'failed' ? 'bg-red-500' : 
                'bg-blue-500'
              }`}></span>
              <span className={`text-sm font-medium ${
                finnhubStatus === 'connected' ? 'text-green-600 dark:text-green-400' : 
                finnhubStatus === 'failed' ? 'text-red-600 dark:text-red-400' : 
                'text-blue-600 dark:text-blue-400'
              }`}>
                {finnhubStatus === 'connected' ? 'Active' : 
                 finnhubStatus === 'failed' ? 'Failed' : 
                 'Standby'}
              </span>
            </div>
          </div>
        </div>

        {/* Massive API Status Box */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                massiveStatus === 'connected' ? 'bg-green-100 dark:bg-green-900/20' : 
                massiveStatus === 'failed' ? 'bg-red-100 dark:bg-red-900/20' : 
                'bg-purple-100 dark:bg-purple-900/20'
              }`}>
                <svg className={`w-6 h-6 ${
                  massiveStatus === 'connected' ? 'text-green-600 dark:text-green-400' : 
                  massiveStatus === 'failed' ? 'text-red-600 dark:text-red-400' : 
                  'text-purple-600 dark:text-purple-400'
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Massive API</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  <a href="https://massive.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">
                    api.massive.com
                  </a>
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Backup Endpoint</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${
                massiveStatus === 'connected' ? 'bg-green-500 animate-pulse' : 
                massiveStatus === 'failed' ? 'bg-red-500' : 
                'bg-purple-500'
              }`}></span>
              <span className={`text-sm font-medium ${
                massiveStatus === 'connected' ? 'text-green-600 dark:text-green-400' : 
                massiveStatus === 'failed' ? 'text-red-600 dark:text-red-400' : 
                'text-purple-600 dark:text-purple-400'
              }`}>
                {massiveStatus === 'connected' ? 'Active' : 
                 massiveStatus === 'failed' ? 'Failed' : 
                 'Standby'}
              </span>
            </div>
          </div>
        </div>
      </div>


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

