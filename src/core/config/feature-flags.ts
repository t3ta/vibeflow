/**
 * Feature flags for VibeFlow
 * Controls which features are enabled based on environment variables
 */

export const FeatureFlags = {
  // Core modes
  AI_MODE: !!process.env.CLAUDE_API_KEY,
  TEMPLATE_MODE: !process.env.CLAUDE_API_KEY,
  
  // Performance features
  PARALLEL_PROCESSING: process.env.ENABLE_PARALLEL === 'true',
  BATCH_SIZE: parseInt(process.env.BATCH_SIZE || '5'),
  
  // UI features
  DETAILED_PROGRESS: process.env.ENABLE_PROGRESS === 'true',
  COLORFUL_OUTPUT: process.env.NO_COLOR !== 'true',
  
  // Safety features
  AUTO_BACKUP: process.env.DISABLE_BACKUP !== 'true',
  DRY_RUN_DEFAULT: process.env.DRY_RUN_DEFAULT === 'true',
  
  // Development features
  DEBUG_MODE: process.env.DEBUG === 'true',
  VERBOSE_LOGGING: process.env.VERBOSE === 'true',
  
  // API settings
  CLAUDE_MODEL: process.env.CLAUDE_MODEL || 'claude-3-sonnet',
  MAX_TOKENS: parseInt(process.env.MAX_TOKENS || '4000'),
  TEMPERATURE: parseFloat(process.env.TEMPERATURE || '0.7'),
};

/**
 * Get feature flag value with fallback
 */
export function getFeatureFlag<T>(key: keyof typeof FeatureFlags, fallback: T): T {
  const value = FeatureFlags[key];
  return value !== undefined ? (value as T) : fallback;
}

/**
 * Check if running in production mode
 */
export function isProductionMode(): boolean {
  return process.env.NODE_ENV === 'production';
}

/**
 * Check if running in test mode
 */
export function isTestMode(): boolean {
  return process.env.NODE_ENV === 'test';
}

/**
 * Get current operation mode
 */
export function getOperationMode(): 'ai' | 'template' {
  return FeatureFlags.AI_MODE ? 'ai' : 'template';
}