import { useState, useEffect, useCallback } from 'react';
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

  const loadMonitors = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getMonitors();
      setMonitors(data || []);
      setConnectionStatus('connected');
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
    const interval = setInterval(loadMonitors, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [loadMonitors]);

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
      await loadMonitors();
    } catch (err) {
      console.error('Failed to delete monitor:', err);
      setError(err.message || 'Failed to delete monitor');
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

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMonitor(null);
  };

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">API Monitoring</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionStatus === 'connected'
                    ? 'bg-green-500'
                    : connectionStatus === 'disconnected'
                    ? 'bg-red-500'
                    : 'bg-yellow-500'
                }`}
              />
              <span className="text-sm text-gray-600 dark:text-gray-400">
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
        <p className="text-gray-600 dark:text-gray-400">
          Monitor stock prices and API status in real-time
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg p-4">
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
              <button
                type="button"
                onClick={() => setError(null)}
                className="text-xs text-red-600 dark:text-red-300 mt-1 underline hover:no-underline"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Monitors Grid */}
      {loading && monitors.length === 0 ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-200 border-t-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400 font-medium">Loading monitors...</p>
        </div>
      ) : monitors.length === 0 ? (
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
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">No monitors yet</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Get started by adding your first stock monitor
          </p>
          <button
            type="button"
            onClick={handleAddMonitor}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Add Monitor
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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

