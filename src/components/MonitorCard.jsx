import { useState } from 'react';
import MonitorChart from './MonitorChart';

function MonitorCard({ monitor, onEdit, onDelete, onTogglePause, onSelect, selected }) {
  const [showChart, setShowChart] = useState(false);

  // UptimeKit status calculation based on response time
  // Operational: < 1000ms, Degraded: 1000-5000ms, Down: > 5000ms or unavailable
  const getStatus = () => {
    if (monitor.paused) {
      return { color: 'gray', text: 'Paused' };
    }
    
    const responseTime = monitor.responseTime || monitor.avgResponseTime || 0;
    const isUp = monitor.status === 'up' || monitor.isUp;
    
    if (!isUp || responseTime === 0) {
      return { color: 'red', text: 'Down' };
    }
    
    if (responseTime < 1000) {
      return { color: 'green', text: 'Operational' };
    } else if (responseTime < 5000) {
      return { color: 'yellow', text: 'Degraded' };
    } else {
      return { color: 'red', text: 'Down' };
    }
  };

  const status = getStatus();
  const statusColor = status.color;
  const statusText = status.text;

  return (
    <div className={`bg-white dark:bg-gray-800 rounded-lg shadow p-4 transition-all ${selected ? 'ring-2 ring-blue-500 dark:ring-blue-400' : ''} ${onSelect ? 'cursor-pointer hover:shadow-lg' : ''}`} onClick={onSelect}>
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-800 dark:text-white mb-1">
            {monitor.name}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{monitor.url}</p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex items-center gap-x-1.5 py-1 px-2 rounded-full text-xs font-medium ${
              statusColor === 'green'
                ? 'bg-green-100 text-green-800'
                : statusColor === 'yellow'
                ? 'bg-yellow-100 text-yellow-800'
                : statusColor === 'red'
                ? 'bg-red-100 text-red-800'
                : 'bg-gray-100 text-gray-800'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                statusColor === 'green'
                  ? 'bg-green-600'
                  : statusColor === 'yellow'
                  ? 'bg-yellow-600'
                  : statusColor === 'red'
                  ? 'bg-red-600'
                  : 'bg-gray-600'
              }`}
            />
            {statusText}
          </span>
        </div>
      </div>

      {monitor.price !== undefined ? (
        <>
          <div className="mb-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Current Price</p>
            <p className="text-xl font-bold text-gray-800 dark:text-white">
              ${monitor.price.toFixed(2)}
            </p>
            {monitor.change !== undefined && (
              <p className={`text-xs font-semibold mt-1 ${monitor.change >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {monitor.change >= 0 ? '+' : ''}${monitor.change.toFixed(2)} ({monitor.changePercent >= 0 ? '+' : ''}{monitor.changePercent.toFixed(2)}%)
              </p>
            )}
          </div>
          {monitor.volume && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Volume</p>
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200">
                {monitor.volume.toLocaleString()}
              </p>
            </div>
          )}
          {monitor.marketState && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Market Status</p>
              <p className="text-xs font-medium text-gray-800 dark:text-gray-200 capitalize">
                {monitor.marketState === 'REGULAR' ? 'Open' : monitor.marketState.toLowerCase()}
              </p>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Response Time</p>
              <p className="text-base font-semibold text-gray-800 dark:text-white">
                {monitor.responseTime || monitor.avgResponseTime || 0}ms
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Uptime</p>
              <p className="text-base font-semibold text-gray-800 dark:text-white">
                {monitor.uptime || monitor.uptimePercent || 0}%
              </p>
            </div>
          </div>
          {monitor.lastCheck && (
            <div className="mb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last Check</p>
              <p className="text-xs text-gray-700 dark:text-gray-300">
                {new Date(monitor.lastCheck).toLocaleString('en-US', { timeZone: 'America/New_York' })}
              </p>
            </div>
          )}
        </>
      )}
      
      {monitor.lastCheck && monitor.price === undefined && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Last Check</p>
          <p className="text-xs text-gray-700 dark:text-gray-300">
            {new Date(monitor.lastCheck).toLocaleString('en-US', { timeZone: 'America/New_York' })}
          </p>
        </div>
      )}

      {showChart && (
        <div className="mb-4">
          <MonitorChart monitorId={monitor.id} />
        </div>
      )}

      <div className="flex gap-2 flex-wrap" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowChart(!showChart);
          }}
          className="flex-1 min-w-[100px] py-1.5 px-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {showChart ? 'Hide Chart' : 'Show Chart'}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTogglePause(monitor.id);
          }}
          className="py-1.5 px-2 text-xs font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
        >
          {monitor.paused ? 'Resume' : 'Pause'}
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(monitor);
          }}
          className="py-1.5 px-2 text-xs font-medium text-blue-700 dark:text-blue-300 bg-blue-100 dark:bg-blue-900/30 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
        >
          Edit
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(monitor.id);
          }}
          className="py-1.5 px-2 text-xs font-medium text-red-700 dark:text-red-300 bg-red-100 dark:bg-red-900/30 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
        >
          Delete
        </button>
      </div>
    </div>
  );
}

export default MonitorCard;

