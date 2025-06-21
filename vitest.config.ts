import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // Enable globals so we don't need to import describe, it, expect
    globals: true,
    
    // Test environment
    environment: 'node',
    
    // Include test files
    include: [
      'tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'
    ],
    
    // Exclude files
    exclude: [
      'node_modules',
      'dist',
      '.vibeflow'
    ],
    
    // Coverage settings
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: [
        'src/**/*.{js,ts}'
      ],
      exclude: [
        'src/**/*.test.{js,ts}',
        'src/**/*.spec.{js,ts}',
        'src/**/types/**',
        'src/**/templates/**'
      ],
      thresholds: {
        global: {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80
        }
      }
    },
    
    // Setup files
    setupFiles: [
      './tests/setup.ts'
    ],
    
    // Test timeout
    testTimeout: 10000,
    
    // Mock settings
    clearMocks: true,
    restoreMocks: true,
    
    // Reporter options
    reporter: ['verbose', 'json'],
    
    // Output options  
    outputFile: {
      json: './tests/results/test-results.json'
    }
  },
  
  // Resolve settings for imports
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@tests': path.resolve(__dirname, './tests')
    }
  },
  
  // ESBuild settings for TypeScript
  esbuild: {
    target: 'node18'
  }
});