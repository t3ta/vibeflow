import { 
  BusinessLogicExtractResult,
  ClaudeCodeBusinessLogicRequest,
  ClaudeCodeBusinessLogicResponse,
  BusinessLogicValidationResult
} from '../types/business-logic.js';
import { ClaudeCodeIntegration } from './claude-code-integration.js';
import { getErrorMessage } from './error-utils.js';

/**
 * Claude Code統合による業務ロジック分析・移行
 */
export class ClaudeCodeBusinessLogicIntegration {
  private claudeCode: ClaudeCodeIntegration;
  private config: {
    model: string;
    maxTokens: number;
    temperature: number;
  };

  constructor(config: {
    projectRoot: string;
    model?: string;
    maxTokens?: number;
    temperature?: number;
  }) {
    this.claudeCode = new ClaudeCodeIntegration({
      projectRoot: config.projectRoot
    });
    
    this.config = {
      model: config.model || 'claude-3-5-sonnet-20241022',
      maxTokens: config.maxTokens || 4096,
      temperature: config.temperature || 0.1
    };
  }

  /**
   * 複雑な業務ロジックの分析
   */
  async analyzeComplexBusinessLogic(
    code: string,
    options: {
      language: 'go' | 'typescript' | 'python';
      focusAreas: string[];
      includeRisks?: boolean;
      extractTestCases?: boolean;
    }
  ): Promise<{
    businessLogic: Array<{
      type: string;
      description: string;
      complexity: 'low' | 'medium' | 'high';
      businessImpact: 'low' | 'medium' | 'high' | 'critical';
      code?: string;
      dependencies?: string[];
    }>;
    dataAccess: Array<{
      pattern: string;
      complexity: 'low' | 'medium' | 'high';
      tables: string[];
      businessCriticality: 'low' | 'medium' | 'high';
      operation?: string;
      query?: string;
    }>;
    workflows?: Array<{
      name: string;
      steps: string[];
      complexity: 'low' | 'medium' | 'high';
      businessRules: string[];
    }>;
    complexity?: {
      overall: 'low' | 'medium' | 'high';
      cyclomatic?: number;
      cognitive?: number;
    };
    risks?: string[];
    recommendations?: string[];
  }> {
    console.log('🤖 Analyzing complex business logic with Claude Code...');
    
    try {
      const prompt = this.buildBusinessLogicAnalysisPrompt(code, options);
      
      const analysis = await this.claudeCode.analyzeCode(code);

      return this.parseBusinessLogicAnalysis(analysis);
    } catch (error) {
      console.error('❌ Claude Code business logic analysis failed:', getErrorMessage(error));
      return this.createFallbackAnalysis(code, options);
    }
  }

  /**
   * コンテキスト理解を含む業務ルール抽出
   */
  async extractBusinessRulesWithContext(
    filePath: string,
    options: {
      includeTestCases?: boolean;
      suggestArchitecture?: 'clean' | 'hexagonal' | 'onion';
      preserveBusinessContext?: boolean;
    }
  ): Promise<{
    extractedRules: Array<{
      id: string;
      type: string;
      name: string;
      description: string;
      businessContext: string;
      implementation: {
        originalCode: string;
        suggestedDomainCode?: string;
        suggestedUsecaseCode?: string;
      };
      dependencies: string[];
      testCases?: Array<{
        input: string;
        expected: any;
      }>;
    }>;
    workflows: Array<{
      id: string;
      name: string;
      description: string;
      steps: Array<{
        name: string;
        businessLogic: string[];
      }>;
      errorHandling: string[];
      businessRules: string[];
    }>;
  }> {
    console.log(`🔍 Extracting business rules with context from: ${filePath}`);
    
    try {
      const prompt = this.buildRuleExtractionPrompt(options);
      
      const extraction = await this.claudeCode.extractBusinessRules(filePath, {
        prompt,
        includeContext: options.preserveBusinessContext,
        generateTestCases: options.includeTestCases,
        targetArchitecture: options.suggestArchitecture
      });

      return this.parseRuleExtraction(extraction);
    } catch (error) {
      console.error('❌ Business rule extraction failed:', getErrorMessage(error));
      return { extractedRules: [], workflows: [] };
    }
  }

  /**
   * 業務ロジックをClean Architectureに移行
   */
  async migrateBusinessLogicToArchitecture(
    request: ClaudeCodeBusinessLogicRequest
  ): Promise<ClaudeCodeBusinessLogicResponse> {
    console.log(`🔧 Migrating business logic to ${request.architecture} architecture...`);
    
    try {
      const prompt = this.buildMigrationPrompt(request);
      
      const migration = await this.claudeCode.migrateBusinessLogic(request.originalCode, {
        prompt,
        businessLogic: request.businessLogic,
        targetBoundary: request.targetBoundary,
        architecture: request.architecture,
        preserveMode: request.preserveMode || 'strict'
      });

      return this.parseMigrationResult(migration);
    } catch (error) {
      console.error('❌ Business logic migration failed:', getErrorMessage(error));
      return this.createFallbackMigrationResponse(request);
    }
  }

  /**
   * アーキテクチャコードの生成
   */
  async generateArchitectureCode(options: {
    businessLogic: BusinessLogicExtractResult;
    architecture: 'clean' | 'hexagonal' | 'onion';
    targetBoundary: string;
    preserveBusinessRules: boolean;
    generateTests?: boolean;
  }): Promise<{
    domainLayer: Record<string, string>;
    usecaseLayer: Record<string, string>;
    infrastructureLayer?: Record<string, string>;
    tests?: Record<string, string>;
  }> {
    console.log(`🏗️ Generating ${options.architecture} architecture code...`);
    
    try {
      const prompt = this.buildCodeGenerationPrompt(options);
      
      const codeGeneration = await this.claudeCode.generateCleanArchitectureCode({
        prompt,
        businessLogic: options.businessLogic,
        architecture: options.architecture,
        boundary: options.targetBoundary,
        preserveRules: options.preserveBusinessRules,
        includeTests: options.generateTests
      });

      return this.parseGeneratedCode(codeGeneration);
    } catch (error) {
      console.error('❌ Architecture code generation failed:', getErrorMessage(error));
      return { domainLayer: {}, usecaseLayer: {} };
    }
  }

  /**
   * 複雑なワークフローの移行
   */
  async migrateComplexWorkflow(options: {
    workflow: {
      name: string;
      steps: string[];
      businessRules: string[];
      errorHandling?: string[];
      complexity: 'low' | 'medium' | 'high';
    };
    targetArchitecture: 'clean' | 'hexagonal' | 'onion';
    preserveTransactionBoundaries?: boolean;
    generateErrorHandling?: boolean;
  }): Promise<{
    domainLayer: {
      workflows: string[];
      businessRules: string[];
    };
    usecaseLayer: {
      orchestrators: string[];
      businessFlows: string[];
      services: string[];
    };
    infrastructureLayer?: {
      repositories: string[];
      adapters: string[];
    };
    preservedLogic: string[];
  }> {
    console.log(`🔄 Migrating complex workflow: ${options.workflow.name}`);
    
    try {
      const prompt = this.buildWorkflowMigrationPrompt(options);
      
      const workflowMigration = await this.claudeCode.migrateComplexWorkflow({
        prompt,
        workflow: options.workflow,
        architecture: options.targetArchitecture,
        preserveTransactions: options.preserveTransactionBoundaries,
        generateErrorHandling: options.generateErrorHandling
      });

      return this.parseWorkflowMigration(workflowMigration);
    } catch (error) {
      console.error('❌ Complex workflow migration failed:', getErrorMessage(error));
      return {
        domainLayer: { workflows: [], businessRules: [] },
        usecaseLayer: { orchestrators: [], businessFlows: [], services: [] },
        preservedLogic: []
      };
    }
  }

  /**
   * 移行された業務ロジックの検証
   */
  async validateMigratedBusinessLogic(options: {
    originalBusinessLogic: BusinessLogicExtractResult;
    migratedCode: any;
    validationCriteria: {
      checkCompleteness?: boolean;
      checkBusinessRuleCoverage?: boolean;
      checkWorkflowCoverage?: boolean;
      requireFullCoverage?: boolean;
    };
  }): Promise<{
    completeness: {
      score: number;
      missing: string[];
      preserved: string[];
    };
    businessRuleCoverage: {
      total: number;
      covered: number;
      percentage: number;
    };
    workflowCoverage?: {
      total: number;
      covered: number;
      percentage: number;
    };
    criticalMissing?: Array<{
      type: string;
      name: string;
      impact: 'low' | 'medium' | 'high' | 'critical';
      reason: string;
    }>;
    suggestions: string[];
    confidence: number;
  }> {
    console.log('✅ Validating migrated business logic with Claude Code...');
    
    try {
      const prompt = this.buildValidationPrompt(options);
      
      const validation = await this.claudeCode.validateBusinessLogicMigration({
        prompt,
        originalLogic: options.originalBusinessLogic,
        migratedCode: options.migratedCode,
        criteria: options.validationCriteria
      });

      return this.parseValidationResult(validation);
    } catch (error) {
      console.error('❌ Business logic validation failed:', getErrorMessage(error));
      return this.createFallbackValidationResult();
    }
  }

  /**
   * フォールバック付きの業務ロジック移行
   */
  async migrateBusinessLogicWithFallback(
    request: ClaudeCodeBusinessLogicRequest
  ): Promise<ClaudeCodeBusinessLogicResponse & {
    fallbackUsed: boolean;
    error?: string;
  }> {
    try {
      const result = await this.migrateBusinessLogicToArchitecture(request);
      return { ...result, fallbackUsed: false };
    } catch (error) {
      console.warn('⚠️ Using fallback migration due to error:', getErrorMessage(error));
      
      const fallbackResult = this.createFallbackMigrationResponse(request);
      return {
        ...fallbackResult,
        fallbackUsed: true,
        error: getErrorMessage(error)
      };
    }
  }

  /**
   * 使用統計とコスト追跡
   */
  async getUsageStatistics(): Promise<{
    sessionUsage: {
      totalTokens: number;
      totalCost: number;
      requestCount: number;
      averageTokensPerRequest: number;
    };
    apiLimits: {
      dailyTokenLimit: number;
      remainingTokens: number;
      rateLimitStatus: 'healthy' | 'warning' | 'critical';
    };
    recommendations: string[];
  }> {
    try {
      const usage = await this.claudeCode.getDetailedUsage();
      return this.parseUsageStats(usage);
    } catch (error) {
      console.error('❌ Failed to get usage statistics:', getErrorMessage(error));
      return this.createDefaultUsageStats();
    }
  }

  // プライベートヘルパーメソッド群

  private buildBusinessLogicAnalysisPrompt(
    code: string,
    options: {
      language: string;
      focusAreas: string[];
      includeRisks?: boolean;
      extractTestCases?: boolean;
    }
  ): string {
    return `
Analyze the following ${options.language} code for business logic patterns:

Focus Areas: ${options.focusAreas.join(', ')}
${options.includeRisks ? 'Include risk assessment' : ''}
${options.extractTestCases ? 'Extract test cases' : ''}

Please identify:
1. Business validation rules
2. Complex calculations and algorithms
3. Business workflows and processes
4. Data access patterns
5. Business constraints and policies

Provide detailed analysis with complexity assessment and business impact.

Code:
\`\`\`${options.language}
${code}
\`\`\`
`;
  }

  private buildRuleExtractionPrompt(options: {
    includeTestCases?: boolean;
    suggestArchitecture?: string;
    preserveBusinessContext?: boolean;
  }): string {
    return `
Extract business rules with context understanding:

${options.preserveBusinessContext ? 'Preserve business context and reasoning' : ''}
${options.suggestArchitecture ? `Suggest ${options.suggestArchitecture} architecture mapping` : ''}
${options.includeTestCases ? 'Generate comprehensive test cases' : ''}

Focus on:
- Business rule identification and naming
- Context and business reasoning
- Dependencies and relationships
- Test scenarios and edge cases
`;
  }

  private buildMigrationPrompt(request: ClaudeCodeBusinessLogicRequest): string {
    return `
Migrate business logic to ${request.architecture} architecture:

Target Boundary: ${request.targetBoundary.name}
Description: ${request.targetBoundary.description}
Dependencies: ${request.targetBoundary.dependencies.join(', ')}
Preserve Mode: ${request.preserveMode}

Requirements:
1. Preserve all business logic semantics
2. Map to appropriate architectural layers
3. Maintain data consistency
4. Generate clean, testable code
5. Include comprehensive error handling

Business Logic to migrate:
- ${request.businessLogic.rules.length} business rules
- ${request.businessLogic.dataAccess.length} data access patterns
- ${request.businessLogic.workflows.length} workflows
`;
  }

  private buildCodeGenerationPrompt(options: {
    businessLogic: BusinessLogicExtractResult;
    architecture: string;
    targetBoundary: string;
    preserveBusinessRules: boolean;
  }): string {
    return `
Generate ${options.architecture} architecture code for boundary: ${options.targetBoundary}

${options.preserveBusinessRules ? 'Strictly preserve all business rules' : ''}

Generate:
1. Domain entities and value objects
2. Business rule implementations
3. Use case services
4. Repository interfaces
5. Infrastructure adapters

Ensure:
- Type safety and validation
- Comprehensive error handling
- Clean separation of concerns
- Testable design patterns
`;
  }

  private buildWorkflowMigrationPrompt(options: {
    workflow: any;
    targetArchitecture: string;
    preserveTransactionBoundaries?: boolean;
    generateErrorHandling?: boolean;
  }): string {
    return `
Migrate complex workflow to ${options.targetArchitecture} architecture:

Workflow: ${options.workflow.name}
Steps: ${options.workflow.steps.join(' → ')}
Business Rules: ${options.workflow.businessRules.join(', ')}
Complexity: ${options.workflow.complexity}

${options.preserveTransactionBoundaries ? 'Preserve transaction boundaries' : ''}
${options.generateErrorHandling ? 'Generate comprehensive error handling' : ''}

Map to:
- Domain workflows
- Use case orchestrators
- Infrastructure adapters
- Error recovery patterns
`;
  }

  private buildValidationPrompt(options: {
    originalBusinessLogic: BusinessLogicExtractResult;
    migratedCode: any;
    validationCriteria: any;
  }): string {
    return `
Validate business logic migration completeness:

Original Logic:
- ${options.originalBusinessLogic.rules.length} business rules
- ${options.originalBusinessLogic.workflows.length} workflows
- ${options.originalBusinessLogic.dataAccess.length} data access patterns

Validation Criteria:
${JSON.stringify(options.validationCriteria, null, 2)}

Check:
1. All business rules preserved
2. Workflow completeness
3. Data access pattern coverage
4. Business semantics integrity
5. Critical missing elements
`;
  }

  // パース用のヘルパーメソッド群

  private parseBusinessLogicAnalysis(analysis: any): any {
    // Claude Code APIの実際のレスポンス形式に応じて実装
    const businessLogic = analysis?.businessRules || analysis?.businessLogic || [];
    const dataAccess = analysis?.dataPatterns || analysis?.dataAccess || [];
    const workflows = analysis?.workflows || [];
    
    return {
      businessLogic: Array.isArray(businessLogic) ? businessLogic : [],
      dataAccess: Array.isArray(dataAccess) ? dataAccess : [],
      workflows: Array.isArray(workflows) ? workflows : [],
      complexity: analysis?.complexity || { overall: 'medium' },
      risks: analysis?.risks || [],
      recommendations: analysis?.recommendations || []
    };
  }

  private parseRuleExtraction(extraction: any): any {
    return {
      extractedRules: extraction.rules || [],
      workflows: extraction.workflows || []
    };
  }

  private parseMigrationResult(migration: any): ClaudeCodeBusinessLogicResponse {
    const domainLayer = migration?.domain || migration?.domainLayer || {};
    const usecaseLayer = migration?.usecase || migration?.usecaseLayer || {};
    
    return {
      domainLayer: {
        entities: domainLayer.entities || [],
        valueObjects: domainLayer.valueObjects || [],
        businessRules: domainLayer.businessRules || [],
        workflows: domainLayer.workflows
      },
      usecaseLayer: {
        services: usecaseLayer.services || [],
        businessFlows: usecaseLayer.businessFlows || [],
        orchestrators: usecaseLayer.orchestrators
      },
      preservedLogic: migration?.preserved || migration?.preservedLogic || [],
      confidence: migration?.confidence || 0.8,
      warnings: migration?.warnings
    };
  }

  private parseGeneratedCode(codeGeneration: any): any {
    return {
      domainLayer: codeGeneration.domain || {},
      usecaseLayer: codeGeneration.usecase || {},
      infrastructureLayer: codeGeneration.infrastructure,
      tests: codeGeneration.tests
    };
  }

  private parseWorkflowMigration(workflowMigration: any): any {
    return {
      domainLayer: workflowMigration.domain || { workflows: [], businessRules: [] },
      usecaseLayer: workflowMigration.usecase || { orchestrators: [], businessFlows: [], services: [] },
      infrastructureLayer: workflowMigration.infrastructure,
      preservedLogic: workflowMigration.preserved || []
    };
  }

  private parseValidationResult(validation: any): any {
    return {
      completeness: validation.completeness || { score: 0, missing: [], preserved: [] },
      businessRuleCoverage: validation.ruleCoverage || { total: 0, covered: 0, percentage: 0 },
      workflowCoverage: validation.workflowCoverage,
      criticalMissing: validation.critical || [],
      suggestions: validation.suggestions || [],
      confidence: validation.confidence || 0.5
    };
  }

  private parseUsageStats(usage: any): any {
    return {
      sessionUsage: usage.session || { totalTokens: 0, totalCost: 0, requestCount: 0, averageTokensPerRequest: 0 },
      apiLimits: usage.limits || { dailyTokenLimit: 100000, remainingTokens: 100000, rateLimitStatus: 'healthy' },
      recommendations: usage.recommendations || []
    };
  }

  // フォールバック用のヘルパーメソッド群

  private createFallbackAnalysis(code: string, options: any): any {
    const lineCount = code.split('\n').length;
    const complexity = lineCount > 100 ? 'high' : lineCount > 50 ? 'medium' : 'low';
    
    return {
      businessLogic: [
        {
          type: 'validation',
          description: 'Validation logic detected',
          complexity,
          businessImpact: 'medium'
        }
      ],
      dataAccess: [],
      workflows: [],
      complexity: { overall: complexity },
      risks: ['Analysis performed with limited static analysis'],
      recommendations: ['Manual review recommended for complete analysis']
    };
  }

  private createFallbackMigrationResponse(request: ClaudeCodeBusinessLogicRequest): ClaudeCodeBusinessLogicResponse {
    return {
      domainLayer: {
        entities: [request.targetBoundary.name],
        valueObjects: [],
        businessRules: ['BusinessRuleValidator']
      },
      usecaseLayer: {
        services: [`${request.targetBoundary.name}Service`],
        businessFlows: ['StandardBusinessFlow']
      },
      preservedLogic: ['Business logic preserved in template format'],
      confidence: 0.5,
      warnings: ['Fallback template used due to AI service unavailability']
    };
  }

  private createFallbackValidationResult(): any {
    return {
      completeness: { score: 0.5, missing: ['Unknown - validation failed'], preserved: [] },
      businessRuleCoverage: { total: 1, covered: 0, percentage: 0 },
      suggestions: ['Manual validation required'],
      confidence: 0.3
    };
  }

  private createDefaultUsageStats(): any {
    return {
      sessionUsage: { totalTokens: 0, totalCost: 0, requestCount: 0, averageTokensPerRequest: 0 },
      apiLimits: { dailyTokenLimit: 100000, remainingTokens: 100000, rateLimitStatus: 'healthy' as const },
      recommendations: ['Usage statistics unavailable']
    };
  }
}