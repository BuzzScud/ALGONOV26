import { useState, useEffect } from 'react';

function AddMonitorModal({ isOpen, onClose, onSave, monitor }) {
  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    url: '',
    type: 'http',
  });

  useEffect(() => {
    if (monitor) {
      setFormData({
        name: monitor.name || '',
        symbol: monitor.symbol || monitor.id || '',
        url: monitor.url || '',
        type: monitor.type || 'http',
      });
    } else {
      setFormData({
        name: '',
        symbol: '',
        url: '',
        type: 'http',
      });
    }
  }, [monitor, isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] overflow-x-hidden overflow-y-auto"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity"></div>
      
      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-lg transform transition-all">
          {/* Header */}
          <div className="flex justify-between items-center py-4 px-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white">
              {monitor ? 'Edit Monitor' : 'Add Monitor'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="flex justify-center items-center w-7 h-7 text-sm font-semibold rounded-full border border-transparent text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              aria-label="Close"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Stock Symbol <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) =>
                    setFormData({ ...formData, symbol: e.target.value.toUpperCase() })
                  }
                  className="py-2.5 px-3 block w-full border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-colors"
                  placeholder="AAPL, GOOGL, MSFT, etc."
                  required
                  autoFocus
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Enter a stock ticker symbol (e.g., AAPL, GOOGL, TSLA)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="py-2.5 px-3 block w-full border border-gray-300 dark:border-gray-600 rounded-lg text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white transition-colors"
                  placeholder="Leave empty to use stock name"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Custom name for this monitor (optional)
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end items-center gap-3 py-4 px-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-4 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-2 px-4 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700 shadow-sm hover:shadow-md transition-all"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {monitor ? 'Update Monitor' : 'Create Monitor'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default AddMonitorModal;
