import { NavLink, Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import UserProfile from './UserProfile';

function Sidebar() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const navItems = [
    { path: '/', label: 'Dashboard' },
    { path: '/news', label: 'News' },
    { path: '/trading', label: 'Charts' },
    { path: '/projection', label: 'Projection' },
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

