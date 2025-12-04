/**
 * Production environment utilities
 */

export const isProduction = import.meta.env.PROD;
export const isDevelopment = import.meta.env.DEV;
export const mode = import.meta.env.MODE;

/**
 * Check if running in production
 */
export const checkProduction = () => {
  return isProduction;
};

/**
 * Get environment variable safely
 */
export const getEnvVar = (key, defaultValue = '') => {
  return import.meta.env[key] || defaultValue;
};

/**
 * Production-safe feature flags
 */
export const features = {
  // Enable debug mode only in development
  debug: isDevelopment,
  // Enable verbose logging only in development
  verboseLogging: isDevelopment,
  // Enable performance monitoring
  performanceMonitoring: true,
};

export default {
  isProduction,
  isDevelopment,
  mode,
  checkProduction,
  getEnvVar,
  features,
};

