/**
 * Production-safe logger utility
 * In production, only errors and warnings are logged
 * In development, all logs are shown
 */
const isDevelopment = import.meta.env.DEV;

export const logger = {
  log: (...args) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },
  error: (...args) => {
    console.error(...args);
  },
  warn: (...args) => {
    console.warn(...args);
  },
  info: (...args) => {
    if (isDevelopment) {
      console.info(...args);
    }
  },
  debug: (...args) => {
    if (isDevelopment) {
      console.debug(...args);
    }
  },
};

export default logger;



