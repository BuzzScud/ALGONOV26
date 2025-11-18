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

  return (
    <div
      id="add-monitor-modal"
      className={`hs-overlay fixed inset-0 z-[80] overflow-x-hidden overflow-y-auto ${isOpen ? 'hs-overlay-open' : 'hidden'}`}
    >
      <div className="hs-overlay-open:mt-7 hs-overlay-open:opacity-100 hs-overlay-open:duration-500 mt-0 opacity-0 ease-out transition-all sm:max-w-lg sm:w-full m-3 sm:mx-auto">
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
          <div className="flex justify-between items-center py-3 px-4 border-b">
            <h3 className="font-bold text-gray-800">
              {monitor ? 'Edit Monitor' : 'Add Monitor'}
            </h3>
            <button
              type="button"
              onClick={onClose}
              className="flex justify-center items-center size-7 text-sm font-semibold rounded-full border border-transparent text-gray-800 hover:bg-gray-100"
            >
              <span className="sr-only">Close</span>
              <svg
                className="flex-shrink-0 size-4"
                xmlns="http://www.w3.org/2000/svg"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m18 6-12 12" />
                <path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Stock Symbol
                </label>
                <input
                  type="text"
                  value={formData.symbol}
                  onChange={(e) =>
                    setFormData({ ...formData, symbol: e.target.value.toUpperCase() })
                  }
                  className="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="AAPL, GOOGL, MSFT, etc."
                  required
                />
                <p className="text-xs text-gray-500 mt-1">Enter a stock ticker symbol (e.g., AAPL, GOOGL, TSLA)</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="py-2 px-3 block w-full border border-gray-200 rounded-lg text-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Leave empty to use stock name"
                />
              </div>
            </div>
            <div className="flex justify-end items-center gap-x-2 py-3 px-4 border-t">
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-medium rounded-lg border border-gray-200 bg-white text-gray-800 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="py-2 px-3 inline-flex items-center gap-x-2 text-sm font-semibold rounded-lg border border-transparent bg-blue-600 text-white hover:bg-blue-700"
              >
                {monitor ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
      <div className="hs-overlay-backdrop fixed inset-0 z-[79] bg-gray-900 bg-opacity-50"></div>
    </div>
  );
}


export default AddMonitorModal;

