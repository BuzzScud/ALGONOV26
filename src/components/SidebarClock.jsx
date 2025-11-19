import { useState, useEffect } from 'react';
import { calculateUniversalDayNumber, getNumerologyForecast } from '../utils/numerology';

function SidebarClock({ timezone = 'America/New_York', city = 'New York', country = 'United States', onRemove }) {
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const formatted = formatter.formatToParts(time);
  const timeStr = formatted.find(p => p.type === 'hour').value + ':' + 
                  formatted.find(p => p.type === 'minute').value + ':' + 
                  formatted.find(p => p.type === 'second').value + ' ' + 
                  formatted.find(p => p.type === 'dayPeriod').value;
  const dateStr = formatted.find(p => p.type === 'month').value + ' ' + 
                  formatted.find(p => p.type === 'day').value + ', ' + 
                  formatted.find(p => p.type === 'year').value;

  // Calculate numerology for the date in this timezone
  const monthName = formatted.find(p => p.type === 'month').value;
  const day = parseInt(formatted.find(p => p.type === 'day').value);
  const year = parseInt(formatted.find(p => p.type === 'year').value);
  
  // Convert month name to number (Jan=1, Feb=2, etc.)
  const monthMap = {
    'Jan': 1, 'Feb': 2, 'Mar': 3, 'Apr': 4, 'May': 5, 'Jun': 6,
    'Jul': 7, 'Aug': 8, 'Sep': 9, 'Oct': 10, 'Nov': 11, 'Dec': 12
  };
  const month = monthMap[monthName] || 1;
  
  // Create a date object for numerology calculation
  const localDate = new Date(year, month - 1, day);
  const universalDayNumber = calculateUniversalDayNumber(localDate);
  const forecast = getNumerologyForecast(universalDayNumber);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 border border-gray-200 dark:border-gray-700 relative">
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 transition-colors"
          title="Remove clock"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
      <div className="text-center">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">{city}</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{country}</p>
        <div className="text-xl font-bold text-gray-900 dark:text-white mb-1 font-mono">
          {timeStr}
        </div>
        <div className="text-xs text-gray-600 dark:text-gray-400 mb-3">
          {dateStr}
        </div>
        
        {/* Daily Global Numerology Forecast */}
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-center gap-2">
            <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
              {forecast.number}
            </span>
            <span className="text-xs font-semibold text-gray-900 dark:text-white">
              {forecast.title}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SidebarClock;

