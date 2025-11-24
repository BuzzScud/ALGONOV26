import { NavLink, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import UserProfile from './UserProfile';
import SidebarClock from './SidebarClock';

// Common timezones for easy selection
const COMMON_TIMEZONES = [
  { timezone: 'America/New_York', city: 'New York', country: 'United States' },
  { timezone: 'America/Los_Angeles', city: 'Los Angeles', country: 'United States' },
  { timezone: 'America/Chicago', city: 'Chicago', country: 'United States' },
  { timezone: 'Europe/London', city: 'London', country: 'United Kingdom' },
  { timezone: 'Europe/Paris', city: 'Paris', country: 'France' },
  { timezone: 'Europe/Berlin', city: 'Berlin', country: 'Germany' },
  { timezone: 'Asia/Tokyo', city: 'Tokyo', country: 'Japan' },
  { timezone: 'Asia/Shanghai', city: 'Shanghai', country: 'China' },
  { timezone: 'Asia/Hong_Kong', city: 'Hong Kong', country: 'Hong Kong' },
  { timezone: 'Asia/Dubai', city: 'Dubai', country: 'UAE' },
  { timezone: 'Asia/Singapore', city: 'Singapore', country: 'Singapore' },
  { timezone: 'Australia/Sydney', city: 'Sydney', country: 'Australia' },
  { timezone: 'America/Toronto', city: 'Toronto', country: 'Canada' },
  { timezone: 'America/Sao_Paulo', city: 'São Paulo', country: 'Brazil' },
  { timezone: 'America/Mexico_City', city: 'Mexico City', country: 'Mexico' },
];

function Sidebar() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  const [clocks, setClocks] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebarClocks');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (error) {
      console.error('Error loading clocks from localStorage:', error);
    }
    // Default clock
    return [{ timezone: 'America/New_York', city: 'New York', country: 'United States', id: Date.now() }];
  });

  const [showAddClock, setShowAddClock] = useState(false);
  const [selectedTimezone, setSelectedTimezone] = useState(COMMON_TIMEZONES[0].timezone);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('sidebarClocks', JSON.stringify(clocks));
  }, [clocks]);

  const addClock = () => {
    const selected = COMMON_TIMEZONES.find(tz => tz.timezone === selectedTimezone);
    if (selected) {
      // Check if clock already exists
      const exists = clocks.some(clock => clock.timezone === selected.timezone);
      if (exists) {
        alert('This clock is already added');
        return;
      }
      const newClock = {
        ...selected,
        id: Date.now()
      };
      setClocks([...clocks, newClock]);
      setShowAddClock(false);
      setSelectedTimezone(COMMON_TIMEZONES[0].timezone);
    }
  };

  const removeClock = (id) => {
    if (clocks.length <= 1) {
      alert('You must have at least one clock');
      return;
    }
    setClocks(clocks.filter(clock => clock.id !== id));
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/news', label: 'News' },
    { path: '/trading', label: 'Charts' },
    { path: '/projection', label: 'Projection' },
    { path: '/projection/fib', label: 'FIB' },
    { path: '/data', label: 'Data' },
    { path: '/api', label: 'API' },
    { path: '/settings', label: 'Settings' },
  ];

  return (
    <>
      <div
        id="application-sidebar"
        className="hs-overlay hs-overlay-open:translate-x-0 -translate-x-full transition-all duration-300 transform hidden fixed top-0 start-0 bottom-0 z-[60] w-64 bg-white dark:bg-gray-900 border-e border-gray-200 dark:border-gray-700 pt-7 pb-10 overflow-y-auto lg:translate-x-0 lg:static lg:end-auto lg:bottom-0 lg:z-[60] lg:block lg:border-e-0 lg:pt-0 lg:w-64"
      >
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <Link
              className="flex-none text-xl font-semibold text-gray-800 dark:text-white hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              to="/"
              aria-label="Brand"
            >
              App
            </Link>
            <button
              type="button"
              className="lg:hidden text-gray-500 dark:text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              data-hs-overlay="#application-sidebar"
            >
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
        </div>

      <nav
        className="hs-accordion-group p-6 w-full flex flex-col flex-wrap"
        data-hs-accordion-always-open
      >
        <ul className="space-y-1.5">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-x-3.5 py-2 px-2.5 text-sm text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 ${
                    isActive ? 'bg-gray-100 dark:bg-gray-800' : ''
                  }`
                }
              >
                <span>{item.label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

        <div className="absolute bottom-0 left-0 right-0 p-6 space-y-4">
          {/* Sidebar Clocks with Numerology */}
          <div className="space-y-3 mb-4 max-h-[400px] overflow-y-auto">
            {clocks.map((clock) => (
              <SidebarClock
                key={clock.id}
                timezone={clock.timezone}
                city={clock.city}
                country={clock.country}
                onRemove={clocks.length > 1 ? () => removeClock(clock.id) : null}
              />
            ))}
          </div>

          {/* Add Clock Button */}
          {!showAddClock ? (
            <button
              type="button"
              onClick={() => setShowAddClock(true)}
              className="w-full px-3 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-700 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Clock
            </button>
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-3 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Timezone
                </label>
                <select
                  value={selectedTimezone}
                  onChange={(e) => setSelectedTimezone(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz.timezone} value={tz.timezone}>
                      {tz.city}, {tz.country}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={addClock}
                  className="flex-1 px-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddClock(false);
                    setSelectedTimezone(COMMON_TIMEZONES[0].timezone);
                  }}
                  className="flex-1 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          
          <div className="flex items-center justify-between p-3 bg-gray-100 dark:bg-gray-800 rounded-lg">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {darkMode ? 'Dark Mode' : 'Light Mode'}
            </span>
            <button
              type="button"
              onClick={toggleDarkMode}
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
          <UserProfile />
        </div>
      </div>
      <div className="hs-overlay-backdrop fixed inset-0 z-[59] bg-gray-900 bg-opacity-50 hidden"></div>
    </>
  );
}

export default Sidebar;

