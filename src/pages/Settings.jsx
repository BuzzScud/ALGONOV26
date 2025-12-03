import { useState, useEffect, useCallback } from 'react';
import GridGenerator from '../components/GridGenerator';

function Settings() {
  // Appearance Settings
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  // API Keys Settings
  const [apiKeys, setApiKeys] = useState({
    finnhub: 'demo',
    massive: 'qeBvdtjWjffA90rzgWB_HeHtmdpyuGQG',
    fibhub: '',
  });

  // Data Refresh Settings
  const [refreshInterval, setRefreshInterval] = useState(() => {
    const saved = localStorage.getItem('refreshInterval');
    return saved ? parseInt(saved, 10) : 30;
  });

  // Default Symbols Settings
  const [defaultSymbols, setDefaultSymbols] = useState(() => {
    const saved = localStorage.getItem('defaultSymbols');
    return saved ? JSON.parse(saved) : ['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN'];
  });
  const [newSymbol, setNewSymbol] = useState('');

  // Notification Settings
  const [notifications, setNotifications] = useState(() => {
    const saved = localStorage.getItem('notificationSettings');
    return saved ? JSON.parse(saved) : {
      priceAlerts: true,
      apiStatusAlerts: true,
      errorAlerts: true,
      soundEnabled: false,
    };
  });

  // General Settings
  const [generalSettings, setGeneralSettings] = useState(() => {
    const saved = localStorage.getItem('generalSettings');
    return saved ? JSON.parse(saved) : {
      autoRefresh: true,
      showTooltips: true,
      compactMode: false,
    };
  });

  // UI State
  const [activeTab, setActiveTab] = useState('appearance');
  const [saveStatus, setSaveStatus] = useState({ message: '', type: '' });
  const [showApiKeys, setShowApiKeys] = useState({
    finnhub: false,
    massive: false,
    fibhub: false,
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load settings on mount
  useEffect(() => {
    const savedApiKeys = localStorage.getItem('apiKeys');
    if (savedApiKeys) {
      try {
        const parsed = JSON.parse(savedApiKeys);
        setApiKeys({ ...apiKeys, ...parsed });
      } catch (e) {
        console.error('Error loading API keys:', e);
      }
    }
  }, []);

  // Apply dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
    showSaveStatus('Dark mode updated', 'success');
  }, [darkMode]);

  // Auto-save functionality
  const autoSave = useCallback((key, value, message) => {
    try {
      localStorage.setItem(key, typeof value === 'object' ? JSON.stringify(value) : value);
      showSaveStatus(message || 'Settings saved', 'success');
      setHasUnsavedChanges(false);
    } catch (error) {
      showSaveStatus('Failed to save settings', 'error');
      console.error('Save error:', error);
    }
  }, []);

  // Show save status
  const showSaveStatus = (message, type) => {
    setSaveStatus({ message, type });
    setTimeout(() => {
      setSaveStatus({ message: '', type: '' });
    }, 3000);
  };

  // Handle API Keys change
  const handleApiKeyChange = (key, value) => {
    setApiKeys({ ...apiKeys, [key]: value });
    setHasUnsavedChanges(true);
  };

  const handleSaveApiKeys = () => {
    autoSave('apiKeys', apiKeys, 'API keys saved successfully');
  };

  // Handle Refresh Interval change
  const handleRefreshIntervalChange = (value) => {
    const numValue = parseInt(value, 10) || 30;
    setRefreshInterval(Math.max(5, Math.min(300, numValue)));
    autoSave('refreshInterval', numValue.toString(), 'Refresh interval updated');
  };

  // Handle Default Symbols
  const handleAddSymbol = () => {
    const symbol = newSymbol.toUpperCase().trim();
    if (symbol && !defaultSymbols.includes(symbol) && symbol.length <= 10) {
      const updated = [...defaultSymbols, symbol];
      setDefaultSymbols(updated);
      setNewSymbol('');
      autoSave('defaultSymbols', updated, 'Symbol added');
    }
  };

  const handleRemoveSymbol = (symbol) => {
    const updated = defaultSymbols.filter(s => s !== symbol);
    setDefaultSymbols(updated);
    autoSave('defaultSymbols', updated, 'Symbol removed');
  };

  // Handle Notification Settings
  const handleNotificationChange = (key, value) => {
    const updated = { ...notifications, [key]: value };
    setNotifications(updated);
    autoSave('notificationSettings', updated, 'Notification settings updated');
  };

  // Handle General Settings
  const handleGeneralSettingChange = (key, value) => {
    const updated = { ...generalSettings, [key]: value };
    setGeneralSettings(updated);
    autoSave('generalSettings', updated, 'General settings updated');
  };

  // Reset to defaults
  const handleResetDefaults = () => {
    if (window.confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
      localStorage.removeItem('apiKeys');
      localStorage.removeItem('refreshInterval');
      localStorage.removeItem('defaultSymbols');
      localStorage.removeItem('notificationSettings');
      localStorage.removeItem('generalSettings');
      
      setApiKeys({
        finnhub: 'demo',
        massive: 'qeBvdtjWjffA90rzgWB_HeHtmdpyuGQG',
        fibhub: '',
      });
      setRefreshInterval(30);
      setDefaultSymbols(['AAPL', 'GOOGL', 'MSFT', 'TSLA', 'AMZN']);
      setNotifications({
        priceAlerts: true,
        apiStatusAlerts: true,
        errorAlerts: true,
        soundEnabled: false,
      });
      setGeneralSettings({
        autoRefresh: true,
        showTooltips: true,
        compactMode: false,
      });
      showSaveStatus('All settings reset to defaults', 'success');
      setHasUnsavedChanges(false);
    }
  };

  const tabs = [
    { id: 'appearance', label: 'Appearance' },
    { id: 'api', label: 'API Keys' },
    { id: 'data', label: 'Data & Refresh' },
    { id: 'notifications', label: 'Notifications' },
    { id: 'general', label: 'General' },
    { id: 'tools', label: 'Tools' },
  ];

  return (
    <div className="w-full max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Settings</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Manage your application preferences and configuration
            </p>
          </div>
          <div className="flex items-center gap-3">
            {hasUnsavedChanges && (
              <span className="text-sm text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                Unsaved changes
              </span>
            )}
            <button
              onClick={handleResetDefaults}
              className="px-4 py-2 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Reset All
            </button>
          </div>
        </div>

        {/* Save Status Message */}
        {saveStatus.message && (
          <div className={`rounded-lg p-4 mb-4 border ${
            saveStatus.type === 'success' 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
              : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {saveStatus.type === 'success' ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
              <span className="font-medium">{saveStatus.message}</span>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex space-x-8 overflow-x-auto" aria-label="Tabs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {/* Appearance Tab */}
        {activeTab === 'appearance' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Appearance Settings</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Customize the look and feel of the application
              </p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <label className="text-base font-semibold text-gray-900 dark:text-white">
                      Dark Mode
                    </label>
                    <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded">
                      Recommended
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Switch between light and dark theme for better viewing experience
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDarkMode(!darkMode)}
                  className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                    darkMode ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  role="switch"
                  aria-checked={darkMode}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
                      darkMode ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <div className="flex items-start gap-3">
                  <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <div>
                    <p className="text-sm font-medium text-blue-900 dark:text-blue-100">Theme Tip</p>
                    <p className="text-sm text-blue-800 dark:text-blue-200 mt-1">
                      Dark mode reduces eye strain in low-light environments and can help save battery on OLED displays.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API Keys Tab */}
        {activeTab === 'api' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">API Keys</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Manage your API keys for different data sources. Keys are stored locally in your browser.
              </p>
            </div>

            <div className="space-y-6">
              {/* Finnhub */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Finnhub API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKeys.finnhub ? "text" : "password"}
                    value={apiKeys.finnhub}
                    onChange={(e) => handleApiKeyChange('finnhub', e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter your Finnhub API key"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKeys({ ...showApiKeys, finnhub: !showApiKeys.finnhub })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                    title={showApiKeys.finnhub ? "Hide" : "Show"}
                  >
                    {showApiKeys.finnhub ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <a href="https://finnhub.io/register" target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Get free API key
                  </a>
                  <span className="text-xs text-gray-500 dark:text-gray-400">• Free tier: 60 calls/minute</span>
                </div>
              </div>

              {/* Massive */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Massive API Key
                </label>
                <div className="relative">
                  <input
                    type={showApiKeys.massive ? "text" : "password"}
                    value={apiKeys.massive}
                    onChange={(e) => handleApiKeyChange('massive', e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter your Massive API key"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKeys({ ...showApiKeys, massive: !showApiKeys.massive })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    {showApiKeys.massive ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Optional backup API source
                </p>
              </div>

              {/* Fibhub */}
              <div>
                <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-2">
                  Fibhub API Key (Optional)
                </label>
                <div className="relative">
                  <input
                    type={showApiKeys.fibhub ? "text" : "password"}
                    value={apiKeys.fibhub || ''}
                    onChange={(e) => handleApiKeyChange('fibhub', e.target.value)}
                    className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="Enter your Fibhub API key (optional)"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKeys({ ...showApiKeys, fibhub: !showApiKeys.fibhub })}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                  >
                    {showApiKeys.fibhub ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  For news and additional data sources
                </p>
              </div>

              {hasUnsavedChanges && (
                <div className="flex justify-end">
                  <button
                    onClick={handleSaveApiKeys}
                    className="px-6 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 shadow-md hover:shadow-lg transition-all flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Save API Keys
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Data & Refresh Tab */}
        {activeTab === 'data' && (
          <div className="space-y-6">
            {/* Refresh Interval */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Data Refresh</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Configure how often data is automatically refreshed
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-900 dark:text-white mb-3">
                    Refresh Interval: <span className="text-blue-600 dark:text-blue-400 font-bold">{refreshInterval} seconds</span>
                  </label>
                  <input
                    type="range"
                    min="5"
                    max="300"
                    step="5"
                    value={refreshInterval}
                    onChange={(e) => handleRefreshIntervalChange(e.target.value)}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700 accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mt-1">
                    <span>5s (Fast)</span>
                    <span>150s (Balanced)</span>
                    <span>300s (Slow)</span>
                  </div>
                </div>

                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-sm text-blue-900 dark:text-blue-100">
                    <strong>Tip:</strong> Lower intervals provide more real-time data but may consume more API quota. 
                    Recommended: 30-60 seconds for most use cases.
                  </p>
                </div>
              </div>
            </div>

            {/* Default Symbols */}
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Default Stock Symbols</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Configure default stock symbols to monitor automatically
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newSymbol}
                    onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddSymbol()}
                    className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter symbol (e.g., AAPL, TSLA)"
                    maxLength="10"
                  />
                  <button
                    onClick={handleAddSymbol}
                    disabled={!newSymbol.trim() || defaultSymbols.includes(newSymbol.toUpperCase().trim())}
                    className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Add
                  </button>
                </div>

                {defaultSymbols.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {defaultSymbols.map((symbol) => (
                      <div
                        key={symbol}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-lg border border-blue-200 dark:border-blue-800"
                      >
                        <span className="text-sm font-semibold">{symbol}</span>
                        <button
                          onClick={() => handleRemoveSymbol(symbol)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200 transition-colors"
                          title="Remove symbol"
                        >
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <svg className="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <p>No symbols added yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Notification Settings</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Configure what notifications you want to receive
              </p>
            </div>

            <div className="space-y-4">
              {[
                { key: 'priceAlerts', label: 'Price Alerts', desc: 'Get notified when prices reach your target levels' },
                { key: 'apiStatusAlerts', label: 'API Status Alerts', desc: 'Get notified when API endpoints change status' },
                { key: 'errorAlerts', label: 'Error Alerts', desc: 'Get notified when errors occur in the application' },
                { key: 'soundEnabled', label: 'Sound Notifications', desc: 'Play sound when notifications appear' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex-1">
                    <label className="text-base font-semibold text-gray-900 dark:text-white block mb-1">
                      {label}
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {desc}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNotificationChange(key, !notifications[key])}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      notifications[key] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
                        notifications[key] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* General Tab */}
        {activeTab === 'general' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">General Settings</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                General application preferences and behavior
              </p>
            </div>

            <div className="space-y-4">
              {[
                { key: 'autoRefresh', label: 'Auto Refresh', desc: 'Automatically refresh data at configured intervals' },
                { key: 'showTooltips', label: 'Show Tooltips', desc: 'Display helpful tooltips throughout the application' },
                { key: 'compactMode', label: 'Compact Mode', desc: 'Use a more compact layout to fit more information' },
              ].map(({ key, label, desc }) => (
                <div key={key} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
                  <div className="flex-1">
                    <label className="text-base font-semibold text-gray-900 dark:text-white block mb-1">
                      {label}
                    </label>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {desc}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleGeneralSettingChange(key, !generalSettings[key])}
                    className={`relative inline-flex h-7 w-12 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      generalSettings[key] ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                    }`}
                  >
                    <span
                      className={`inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-transform ${
                        generalSettings[key] ? 'translate-x-6' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tools Tab */}
        {activeTab === 'tools' && (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">CSS Grid Generator</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Create dynamic layouts by configuring your grid columns and rows, then drag elements to position them.
              </p>
            </div>
            <GridGenerator />
          </div>
        )}
      </div>
    </div>
  );
}

export default Settings;
