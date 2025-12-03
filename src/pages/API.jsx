import { useState, useEffect, useCallback, useMemo } from 'react';
import MonitorCard from '../components/MonitorCard';
import AddMonitorModal from '../components/AddMonitorModal';
import { getMonitors, createMonitor, updateMonitor, deleteMonitor, togglePauseMonitor } from '../services/monitorService';

function API() {
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMonitor, setEditingMonitor] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('checking');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('name'); // name, price, change, status
  const [filterStatus, setFilterStatus] = useState('all'); // all, operational, degraded, down, paused
  const [viewMode, setViewMode] = useState('grid'); // grid, list
  const [selectedMonitors, setSelectedMonitors] = useState([]);
  const [showStats, setShowStats] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(30); // seconds

  const loadMonitors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMonitors();
      setMonitors(data || []);
      setConnectionStatus('connected');
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Failed to load monitors:', err);
      setError(err.message || 'Failed to load monitors');
      setConnectionStatus('disconnected');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMonitors();
  }, [loadMonitors]);

  // Auto-refresh functionality
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadMonitors();
    }, refreshInterval * 1000);
    
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, loadMonitors]);

  // Filtered and sorted monitors
  const filteredMonitors = useMemo(() => {
    let filtered = [...monitors];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(monitor => 
        monitor.name?.toLowerCase().includes(query) ||
        monitor.symbol?.toLowerCase().includes(query) ||
        monitor.id?.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (filterStatus !== 'all') {
      filtered = filtered.filter(monitor => {
        if (filterStatus === 'operational') {
          const responseTime = monitor.responseTime || monitor.avgResponseTime || 0;
          return monitor.isUp && responseTime > 0 && responseTime < 1000;
        } else if (filterStatus === 'degraded') {
          const responseTime = monitor.responseTime || monitor.avgResponseTime || 0;
          return monitor.isUp && responseTime >= 1000 && responseTime < 5000;
        } else if (filterStatus === 'down') {
          return !monitor.isUp || (monitor.responseTime || monitor.avgResponseTime || 0) === 0;
        } else if (filterStatus === 'paused') {
          return monitor.paused;
        }
        return true;
      });
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'price':
          return (b.price || 0) - (a.price || 0);
        case 'change':
          return (b.changePercent || 0) - (a.changePercent || 0);
        case 'status':
          const aStatus = a.paused ? 'paused' : (!a.isUp ? 'down' : 'operational');
          const bStatus = b.paused ? 'paused' : (!b.isUp ? 'down' : 'operational');
          return aStatus.localeCompare(bStatus);
        case 'name':
        default:
          return (a.name || a.id || '').localeCompare(b.name || b.id || '');
      }
    });

    return filtered;
  }, [monitors, searchQuery, filterStatus, sortBy]);

  // Statistics
  const stats = useMemo(() => {
    const total = monitors.length;
    const operational = monitors.filter(m => {
      const rt = m.responseTime || m.avgResponseTime || 0;
      return m.isUp && rt > 0 && rt < 1000 && !m.paused;
    }).length;
    const degraded = monitors.filter(m => {
      const rt = m.responseTime || m.avgResponseTime || 0;
      return m.isUp && rt >= 1000 && rt < 5000 && !m.paused;
    }).length;
    const down = monitors.filter(m => !m.isUp || (m.responseTime || m.avgResponseTime || 0) === 0 || m.paused).length;
    const totalValue = monitors.reduce((sum, m) => sum + (m.price || 0), 0);
    const avgChange = monitors.length > 0 
      ? monitors.reduce((sum, m) => sum + (m.changePercent || 0), 0) / monitors.length 
      : 0;

    return { total, operational, degraded, down, totalValue, avgChange };
  }, [monitors]);

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
    } catch (err) {
      console.error('Failed to save monitor:', err);
      setError(err.message || 'Failed to save monitor');
    }
  };

  const handleDeleteMonitor = async (id) => {
    if (!window.confirm('Are you sure you want to delete this monitor?')) {
      return;
    }
    try {
      await deleteMonitor(id);
      setSelectedMonitors(prev => prev.filter(m => m !== id));
      await loadMonitors();
    } catch (err) {
      console.error('Failed to delete monitor:', err);
      setError(err.message || 'Failed to delete monitor');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedMonitors.length === 0) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedMonitors.length} monitor(s)?`)) {
      return;
    }
    try {
      await Promise.all(selectedMonitors.map(id => deleteMonitor(id)));
      setSelectedMonitors([]);
      await loadMonitors();
    } catch (err) {
      console.error('Failed to delete monitors:', err);
      setError(err.message || 'Failed to delete monitors');
    }
  };

  const handleTogglePause = async (id) => {
    try {
      await togglePauseMonitor(id);
      await loadMonitors();
    } catch (err) {
      console.error('Failed to toggle pause:', err);
      setError(err.message || 'Failed to toggle pause');
    }
  };

  const handleBulkPause = async (pause) => {
    if (selectedMonitors.length === 0) return;
    try {
      await Promise.all(selectedMonitors.map(id => {
        const monitor = monitors.find(m => m.id === id);
        if (monitor && monitor.paused !== pause) {
          return togglePauseMonitor(id);
        }
        return Promise.resolve();
      }));
      await loadMonitors();
    } catch (err) {
      console.error('Failed to bulk pause/resume:', err);
      setError(err.message || 'Failed to bulk pause/resume');
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMonitor(null);
  };

  const toggleSelectMonitor = (id) => {
    setSelectedMonitors(prev => 
      prev.includes(id) 
        ? prev.filter(m => m !== id)
        : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedMonitors.length === filteredMonitors.length) {
      setSelectedMonitors([]);
    } else {
      setSelectedMonitors(filteredMonitors.map(m => m.id));
    }
  };

  const exportData = () => {
    const dataStr = JSON.stringify(monitors, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `monitors-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">API Monitoring Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Monitor stock prices, API status, and performance metrics in real-time
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-green-500 animate-pulse'
                    : connectionStatus === 'disconnected'
                    ? 'bg-red-500'
                    : 'bg-yellow-500'
                }`}
              />
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {connectionStatus === 'connected'
                  ? 'Connected'
                  : connectionStatus === 'disconnected'
                  ? 'Disconnected'
                  : 'Checking...'}
              </span>
            </div>
            <button
              type="button"
              onClick={handleAddMonitor}
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Monitor
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        {showStats && monitors.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl p-4 border border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-blue-700 dark:text-blue-300">Total</span>
                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.total}</p>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 rounded-xl p-4 border border-green-200 dark:border-green-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-green-700 dark:text-green-300">Operational</span>
                <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-green-900 dark:text-green-100">{stats.operational}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-50 to-yellow-100 dark:from-yellow-900/20 dark:to-yellow-800/20 rounded-xl p-4 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">Degraded</span>
                <svg className="w-4 h-4 text-yellow-600 dark:text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-yellow-900 dark:text-yellow-100">{stats.degraded}</p>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-red-100 dark:from-red-900/20 dark:to-red-800/20 rounded-xl p-4 border border-red-200 dark:border-red-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-red-700 dark:text-red-300">Down</span>
                <svg className="w-4 h-4 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-red-900 dark:text-red-100">{stats.down}</p>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl p-4 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-purple-700 dark:text-purple-300">Total Value</span>
                <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                ${(stats.totalValue / 1000).toFixed(1)}K
              </p>
            </div>
            <div className="bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300">Avg Change</span>
                <svg className="w-4 h-4 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <p className={`text-2xl font-bold ${stats.avgChange >= 0 ? 'text-indigo-900 dark:text-indigo-100' : 'text-red-600 dark:text-red-400'}`}>
                {stats.avgChange >= 0 ? '+' : ''}{stats.avgChange.toFixed(2)}%
              </p>
            </div>
          </div>
        )}

        {/* Controls Bar */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search monitors by name or symbol..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Filters and Controls */}
            <div className="flex flex-wrap items-center gap-3">
              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
              >
                <option value="all">All Status</option>
                <option value="operational">Operational</option>
                <option value="degraded">Degraded</option>
                <option value="down">Down</option>
                <option value="paused">Paused</option>
              </select>

              {/* Sort */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white text-sm"
              >
                <option value="name">Sort by Name</option>
                <option value="price">Sort by Price</option>
                <option value="change">Sort by Change</option>
                <option value="status">Sort by Status</option>
              </select>

              {/* View Mode */}
              <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
                  title="Grid View"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm' : ''}`}
                  title="List View"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>

              {/* Refresh Controls */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadMonitors}
                  disabled={loading}
                  className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                  title="Refresh Now"
                >
                  <svg className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded"
                  />
                  <span>Auto</span>
                </label>
              </div>

              {/* Export */}
              <button
                type="button"
                onClick={exportData}
                className="px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors flex items-center gap-2"
                title="Export Data"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Export
              </button>

              {/* Toggle Stats */}
              <button
                type="button"
                onClick={() => setShowStats(!showStats)}
                className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                title={showStats ? "Hide Statistics" : "Show Statistics"}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </button>
            </div>
          </div>

          {/* Bulk Actions */}
          {selectedMonitors.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedMonitors.length} monitor(s) selected
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleBulkPause(false)}
                  className="px-3 py-1.5 text-sm font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg transition-colors"
                >
                  Resume All
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkPause(true)}
                  className="px-3 py-1.5 text-sm font-medium text-yellow-700 dark:text-yellow-300 bg-yellow-100 dark:bg-yellow-900/30 hover:bg-yellow-200 dark:hover:bg-yellow-900/50 rounded-lg transition-colors"
                >
                  Pause All
                </button>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="px-3 py-1.5 text-sm font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-colors"
                >
                  Delete All
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedMonitors([])}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Last Refresh Info */}
          {lastRefresh && (
            <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400">
              Last refreshed: {lastRefresh.toLocaleTimeString('en-US', { timeZone: 'America/New_York' })}
              {autoRefresh && ` • Auto-refresh every ${refreshInterval}s`}
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start">
              <svg className="w-5 h-5 text-red-500 mr-2 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
              <div>
                <p className="text-sm font-medium text-red-800 dark:text-red-200">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-red-600 dark:text-red-300 hover:text-red-800 dark:hover:text-red-100"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Monitors Display */}
      {loading && monitors.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading monitors...</p>
        </div>
      ) : filteredMonitors.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
          <svg
            className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
            />
          </svg>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {searchQuery || filterStatus !== 'all' ? 'No monitors found' : 'No monitors yet'}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {searchQuery || filterStatus !== 'all' 
              ? 'Try adjusting your search or filter criteria'
              : 'Get started by adding your first stock monitor'}
          </p>
          {(!searchQuery && filterStatus === 'all') && (
            <button
              type="button"
              onClick={handleAddMonitor}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Add Monitor
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Select All Checkbox */}
          {filteredMonitors.length > 0 && (
            <div className="mb-4 flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedMonitors.length === filteredMonitors.length && filteredMonitors.length > 0}
                onChange={toggleSelectAll}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label className="text-sm text-gray-600 dark:text-gray-400">
                Select all ({filteredMonitors.length})
              </label>
            </div>
          )}

          {/* Grid/List View */}
          <div className={viewMode === 'grid' 
            ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
            : 'space-y-4'
          }>
            {filteredMonitors.map((monitor) => (
              <div key={monitor.id} className="relative">
                {viewMode === 'list' && (
                  <input
                    type="checkbox"
                    checked={selectedMonitors.includes(monitor.id)}
                    onChange={() => toggleSelectMonitor(monitor.id)}
                    className="absolute top-4 left-4 z-10 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                )}
                <MonitorCard
                  monitor={monitor}
                  onEdit={handleEditMonitor}
                  onDelete={handleDeleteMonitor}
                  onTogglePause={handleTogglePause}
                  onSelect={viewMode === 'list' ? () => toggleSelectMonitor(monitor.id) : null}
                  selected={selectedMonitors.includes(monitor.id)}
                />
              </div>
            ))}
          </div>

          {/* Results Count */}
          {filteredMonitors.length !== monitors.length && (
            <div className="mt-4 text-center text-sm text-gray-500 dark:text-gray-400">
              Showing {filteredMonitors.length} of {monitors.length} monitors
            </div>
          )}
        </>
      )}

      {/* Add/Edit Monitor Modal */}
      <AddMonitorModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSave={handleSaveMonitor}
        monitor={editingMonitor}
      />
    </div>
  );
}

export default API;
