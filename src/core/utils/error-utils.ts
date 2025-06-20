/**
 * Error handling utilities for VibeFlow
 */

export class VibeFlowError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: any
  ) {
    super(message);
    this.name = 'VibeFlowError';
  }
}

export class RefactorError extends VibeFlowError {
  constructor(
    message: string,
    public readonly file: string,
    public readonly boundary?: string,
    details?: any
  ) {
    super(message, 'REFACTOR_ERROR', details);
    this.name = 'RefactorError';
  }
}

export class ValidationError extends VibeFlowError {
  constructor(message: string, details?: any) {
    super(message, 'VALIDATION_ERROR', details);
    this.name = 'ValidationError';
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unknown error occurred';
}

export function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

export function logError(context: string, error: unknown): void {
  const message = getErrorMessage(error);
  const stack = getErrorStack(error);
  
  console.error(`❌ Error in ${context}: ${message}`);
  if (stack && process.env.DEBUG) {
    console.error('Stack trace:', stack);
  }
  
  if (error instanceof VibeFlowError) {
    if (error.details) {
      console.error('Error details:', JSON.stringify(error.details, null, 2));
    }
  }
}