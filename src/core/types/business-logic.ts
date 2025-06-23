/**
 * 業務ロジック抽出・移行のための型定義
 */

export interface BusinessRule {
  type: 'validation' | 'calculation' | 'constraint' | 'workflow' | 'transformation';
  description: string;
  code: string;
  location: {
    file: string;
    line: number;
    function?: string;
  };
  dependencies: string[];
  complexity: 'low' | 'medium' | 'high';
  priority?: number;
}

export interface DataAccessPattern {
  operation: 'select' | 'insert' | 'update' | 'delete' | 'transaction';
  table: string;
  fields?: string[];
  conditions?: string[];
  complexity: 'low' | 'medium' | 'high';
  query?: string;
}

export interface BusinessWorkflow {
  name: string;
  steps: string[];
  complexity: 'low' | 'medium' | 'high';
  businessRules: string[];
  errorHandling?: string[];
  transactions?: boolean;
}

export interface ComplexityAnalysis {
  overall: 'low' | 'medium' | 'high';
  details: {
    cyclomaticComplexity?: number;
    cognitiveComplexity?: number;
    businessRules?: number;
    dataAccess?: number;
    workflows?: number;
  };
}

export interface BusinessLogicExtractResult {
  rules: BusinessRule[];
  dataAccess: DataAccessPattern[];
  workflows: BusinessWorkflow[];
  complexity: ComplexityAnalysis;
}

export interface MigratedBusinessLogic {
  domain_layer: {
    entities?: string[];
    valueObjects?: string[];
    businessRules?: string[];
    workflows?: string[];
    aggregates?: string[];
  };
  usecase_layer: {
    services?: string[];
    businessFlows?: string[];
    orchestrators?: string[];
    commands?: string[];
    queries?: string[];
  };
  infrastructure_layer?: {
    repositories?: string[];
    adapters?: string[];
    services?: string[];
  };
}

export interface LogicMigrationResult {
  migrated_code: MigratedBusinessLogic;
  preserved_logic: string[];
  fallback_used: boolean;
  confidence_score?: number;
  warnings?: string[];
}

export interface BusinessLogicValidationResult {
  validation_passed: boolean;
  coverage_percentage: number;
  missing_logic: string[];
  suggestions?: string[];
  confidence_score?: number;
}

export interface ClaudeCodeBusinessLogicRequest {
  originalCode: string;
  businessLogic: BusinessLogicExtractResult;
  targetBoundary: {
    name: string;
    description: string;
    dependencies: string[];
  };
  architecture: 'clean' | 'hexagonal' | 'onion';
  preserveMode?: 'strict' | 'adaptive' | 'optimized';
}

export interface ClaudeCodeBusinessLogicResponse {
  domainLayer: {
    entities: string[];
    valueObjects: string[];
    businessRules: string[];
    workflows?: string[];
  };
  usecaseLayer: {
    services: string[];
    businessFlows: string[];
    orchestrators?: string[];
  };
  preservedLogic: string[];
  confidence: number;
  warnings?: string[];
}

/**
 * 業務ロジック抽出のための設定
 */
export interface BusinessLogicExtractionConfig {
  // 抽出レベル
  extractionLevel: 'basic' | 'comprehensive' | 'deep';
  
  // 対象パターン
  patterns: {
    validations: boolean;
    calculations: boolean;
    workflows: boolean;
    dataAccess: boolean;
    errorHandling: boolean;
  };
  
  // 複雑度フィルター
  complexityThreshold: 'low' | 'medium' | 'high';
  
  // 言語固有の設定
  language: 'go' | 'typescript' | 'python';
  
  // Claude Code 設定
  claudeCode?: {
    enabled: boolean;
    maxTokens?: number;
    temperature?: number;
    model?: string;
  };
}

/**
 * 業務ロジック移行のためのコンテキスト
 */
export interface BusinessLogicMigrationContext {
  originalFile: string;
  targetBoundary: string;
  extractedLogic: BusinessLogicExtractResult;
  migrationStrategy: 'preserve' | 'optimize' | 'modernize';
  validationRequired: boolean;
  rollbackOnFailure: boolean;
}

/**
 * 業務ロジック移行エージェントの実行パラメータ
 */
export interface BusinessLogicMigrationExecuteRequest {
  projectPath: string;
  domainMapPath: string;
  planPath: string;
  aiEnabled: boolean;
  language: 'go' | 'typescript' | 'python';
  preserveMode: 'strict' | 'adaptive' | 'optimized';
  generateTests: boolean;
  generateDocumentation: boolean;
}

/**
 * 業務ロジック移行エージェントの実行結果
 */
export interface BusinessLogicMigrationExecuteResult {
  migratedBoundaries: Array<{
    name: string;
    files: number;
    extractedRules: number;
    migratedRules: number;
  }>;
  aiProcessedFiles: number;
  staticAnalysisFiles: number;
  totalBusinessRules: number;
  warnings: string[];
  errors: string[];
  outputPaths: {
    extractedLogic: string;
    migratedCode: string;
    validationReport: string;
  };
}

/**
 * テスト生成エージェントの実行パラメータ
 */
export interface TestSynthesisExecuteRequest {
  projectPath: string;
  language: 'go' | 'typescript' | 'python';
  outputPath: string;
  documentationPath: string;
  aiEnabled: boolean;
  generateDocumentation: boolean;
  localization: 'ja' | 'en';
}

/**
 * テスト生成エージェントの実行結果
 */
export interface TestSynthesisExecuteResult {
  generatedTests: Array<{
    filePath: string;
    testCases: number;
    coverage: string;
  }>;
  generatedDocuments: Array<{
    type: 'user-story' | 'specification' | 'test-strategy';
    filePath: string;
    title: string;
  }>;
  coverageImprovement?: {
    improvement: number;
    beforeCoverage: number;
    estimatedAfterCoverage: number;
  };
  warnings: string[];
  errors: string[];
}