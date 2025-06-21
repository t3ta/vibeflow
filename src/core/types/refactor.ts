export interface RefactoredFile {
  refactored_files: {
    path: string;
    content: string;
    description: string;
  }[];
  interfaces: {
    name: string;
    path: string;
    content: string;
  }[];
  tests: {
    path: string;
    content: string;
  }[];
}

export interface RefactorResult {
  applied_patches: string[];
  failed_patches: { file: string; error: string }[];
  created_files: string[];
  modified_files: string[];
  deleted_files: string[];
  outputPath: string;
  aiEnhanced?: boolean;
  tokenUsage?: {
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
    estimatedCost: number;
  };
}

export interface ClaudeCodeConfig {
  cwd: string;
  maxTurns: number;
  systemPrompt: string;
}

export interface CompileResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

export interface TestResult {
  success: boolean;
  passed: number;
  failed: number;
  failedTests: string[];
  coverage?: number;
}

export interface PerformanceResult {
  improvement?: string;
  metrics: {
    responseTime?: number;
    memory?: number;
    cpu?: number;
  };
}