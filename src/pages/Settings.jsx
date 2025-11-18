import { useState, useEffect } from 'react';
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

  // Save status
  const [saveStatus, setSaveStatus] = useState({ message: '', type: '' });
  
  // API Key visibility
  const [showApiKeys, setShowApiKeys] = useState({
    finnhub: false,
    massive: false,
  });

  // Load settings on mount
  useEffect(() => {
    const savedApiKeys = localStorage.getItem('apiKeys');
    if (savedApiKeys) {
      setApiKeys(JSON.parse(savedApiKeys));
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
  }, [darkMode]);

  // Save API Keys
  const handleSaveApiKeys = () => {
    localStorage.setItem('apiKeys', JSON.stringify(apiKeys));
    showSaveStatus('API keys saved successfully', 'success');
  };

  // Save Refresh Interval
  const handleSaveRefreshInterval = () => {
    localStorage.setItem('refreshInterval', refreshInterval.toString());
    showSaveStatus('Refresh interval saved successfully', 'success');
  };

  // Save Default Symbols
  const handleSaveDefaultSymbols = () => {
    localStorage.setItem('defaultSymbols', JSON.stringify(defaultSymbols));
    showSaveStatus('Default symbols saved successfully', 'success');
  };

  // Save Notification Settings
  const handleSaveNotifications = () => {
    localStorage.setItem('notificationSettings', JSON.stringify(notifications));
    showSaveStatus('Notification settings saved successfully', 'success');
  };

  // Save General Settings
  const handleSaveGeneral = () => {
    localStorage.setItem('generalSettings', JSON.stringify(generalSettings));
    showSaveStatus('General settings saved successfully', 'success');
  };

  // Show save status
  const showSaveStatus = (message, type) => {
    setSaveStatus({ message, type });
    setTimeout(() => {
      setSaveStatus({ message: '', type: '' });
    }, 3000);
  };

  // Add symbol
  const handleAddSymbol = () => {
    const symbol = newSymbol.toUpperCase().trim();
    if (symbol && !defaultSymbols.includes(symbol)) {
      setDefaultSymbols([...defaultSymbols, symbol]);
      setNewSymbol('');
    }
  };

  // Remove symbol
  const handleRemoveSymbol = (symbol) => {
    setDefaultSymbols(defaultSymbols.filter(s => s !== symbol));
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
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Settings</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage your application preferences and configuration
          </p>
        </div>
        <button
          onClick={handleResetDefaults}
          className="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 border border-red-300 dark:border-red-700 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
        >
          Reset to Defaults
        </button>
      </div>

      {/* Save Status Message */}
      {saveStatus.message && (
        <div className={`rounded-lg p-4 ${
          saveStatus.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
            : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
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
            <span>{saveStatus.message}</span>
          </div>
        </div>
      )}

      {/* Settings Grid - 2 Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Appearance Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Appearance</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Customize the look and feel of the application
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Dark Mode
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Switch between light and dark theme
              </p>
            </div>
            <button
              type="button"
              onClick={() => setDarkMode(!darkMode)}
              className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 dark:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
              role="switch"
              aria-checked={darkMode}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  darkMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* API Keys Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">API Keys</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Manage your API keys for different data sources
            </p>
          </div>
          <button
            onClick={handleSaveApiKeys}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Save API Keys
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Finnhub API Key
            </label>
            <div className="relative">
              <input
                type={showApiKeys.finnhub ? "text" : "password"}
                value={apiKeys.finnhub}
                onChange={(e) => setApiKeys({ ...apiKeys, finnhub: e.target.value })}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter Finnhub API key"
              />
              <button
                type="button"
                onClick={() => setShowApiKeys({ ...showApiKeys, finnhub: !showApiKeys.finnhub })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Get your free API key from <a href="https://finnhub.io" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">finnhub.io</a>
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Massive API Key
            </label>
            <div className="relative">
              <input
                type={showApiKeys.massive ? "text" : "password"}
                value={apiKeys.massive}
                onChange={(e) => setApiKeys({ ...apiKeys, massive: e.target.value })}
                className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter Massive API key"
              />
              <button
                type="button"
                onClick={() => setShowApiKeys({ ...showApiKeys, massive: !showApiKeys.massive })}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
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
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Manage your API key from <a href="https://massive.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 hover:underline">massive.com</a>
            </p>
          </div>
        </div>
      </div>

      {/* Data Refresh Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Data Refresh</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Configure how often data is refreshed
            </p>
          </div>
          <button
            onClick={handleSaveRefreshInterval}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Save Interval
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">
              Refresh Interval (seconds)
            </label>
            <input
              type="number"
              min="5"
              max="300"
              value={refreshInterval}
              onChange={(e) => setRefreshInterval(parseInt(e.target.value, 10) || 30)}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Data will refresh every {refreshInterval} seconds (minimum: 5, maximum: 300)
            </p>
          </div>
        </div>
      </div>

      {/* Default Symbols Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Default Symbols</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Configure default stock symbols to monitor
            </p>
          </div>
          <button
            onClick={handleSaveDefaultSymbols}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Save Symbols
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={newSymbol}
              onChange={(e) => setNewSymbol(e.target.value.toUpperCase())}
              onKeyPress={(e) => e.key === 'Enter' && handleAddSymbol()}
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter symbol (e.g., AAPL)"
              maxLength="10"
            />
            <button
              onClick={handleAddSymbol}
              className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {defaultSymbols.map((symbol) => (
              <div
                key={symbol}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 rounded-lg"
              >
                <span className="text-sm font-medium">{symbol}</span>
                <button
                  onClick={() => handleRemoveSymbol(symbol)}
                  className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>

          {defaultSymbols.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
              No symbols added. Add symbols to monitor by default.
            </p>
          )}
        </div>
      </div>

      {/* Notification Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Notifications</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Configure notification preferences
            </p>
          </div>
          <button
            onClick={handleSaveNotifications}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Save Notifications
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Price Alerts
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Get notified when prices reach your target
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNotifications({ ...notifications, priceAlerts: !notifications.priceAlerts })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                notifications.priceAlerts ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifications.priceAlerts ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                API Status Alerts
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Get notified when API endpoints change status
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNotifications({ ...notifications, apiStatusAlerts: !notifications.apiStatusAlerts })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                notifications.apiStatusAlerts ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifications.apiStatusAlerts ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Error Alerts
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Get notified when errors occur
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNotifications({ ...notifications, errorAlerts: !notifications.errorAlerts })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                notifications.errorAlerts ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifications.errorAlerts ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Sound Notifications
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Play sound when notifications appear
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNotifications({ ...notifications, soundEnabled: !notifications.soundEnabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                notifications.soundEnabled ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  notifications.soundEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* General Settings */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">General</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              General application preferences
            </p>
          </div>
          <button
            onClick={handleSaveGeneral}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            Save General
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Auto Refresh
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Automatically refresh data at configured intervals
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGeneralSettings({ ...generalSettings, autoRefresh: !generalSettings.autoRefresh })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                generalSettings.autoRefresh ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  generalSettings.autoRefresh ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Show Tooltips
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Display helpful tooltips throughout the application
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGeneralSettings({ ...generalSettings, showTooltips: !generalSettings.showTooltips })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                generalSettings.showTooltips ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  generalSettings.showTooltips ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
            <div>
              <label className="text-sm font-medium text-gray-900 dark:text-white">
                Compact Mode
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Use a more compact layout to fit more information
              </p>
            </div>
            <button
              type="button"
              onClick={() => setGeneralSettings({ ...generalSettings, compactMode: !generalSettings.compactMode })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                generalSettings.compactMode ? 'bg-blue-600' : 'bg-gray-200 dark:bg-gray-700'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  generalSettings.compactMode ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </div>
      </div>

        {/* Grid Generator */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4 border border-gray-200 dark:border-gray-700 lg:col-span-2">
          <div className="mb-4">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">CSS Grid Generator</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Create dynamic layouts by configuring your grid columns and rows, then drag elements to position them.
            </p>
          </div>
          <GridGenerator />
        </div>
      </div>
    </div>
  );
}

export default Settings;
