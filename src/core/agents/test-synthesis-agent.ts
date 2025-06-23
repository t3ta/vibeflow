import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  BusinessLogicExtractResult,
  BusinessRule,
  BusinessWorkflow,
  DataAccessPattern,
  TestSynthesisExecuteRequest,
  TestSynthesisExecuteResult
} from '../types/business-logic.js';
import { ClaudeCodeBusinessLogicIntegration } from '../utils/claude-code-business-logic-integration.js';
import { getErrorMessage } from '../utils/error-utils.js';

/**
 * テスト未存在時のユーザーストーリー・テストケース生成結果
 */
export interface UserStoryExtractionResult {
  userStories: Array<{
    id: string;
    title: string;
    description: string;
    acceptanceCriteria: string[];
    businessValue: 'low' | 'medium' | 'high' | 'critical';
    complexity: 'low' | 'medium' | 'high';
    relatedCode: {
      functions: string[];
      files: string[];
      businessRules: string[];
    };
  }>;
  testScenarios: Array<{
    id: string;
    userStoryId: string;
    scenario: string;
    given: string[];
    when: string[];
    then: string[];
    testData: any[];
    priority: 'low' | 'medium' | 'high' | 'critical';
  }>;
  businessContext: {
    domain: string;
    purpose: string;
    keyEntities: string[];
    workflows: string[];
    constraints: string[];
  };
}

/**
 * 生成されたテストケース
 */
export interface GeneratedTestCase {
  id: string;
  name: string;
  functionName: string;
  description: string;
  category: 'unit' | 'integration' | 'business_rule' | 'workflow';
  language: 'go' | 'typescript' | 'python';
  framework: string;
  code: string;
  testData: any[];
  expectedBehavior: string[];
  businessRule?: string;
  userStoryId?: string;
}

/**
 * 人間向けドキュメント
 */
export interface HumanReadableDocumentation {
  businessRulesDocument: {
    title: string;
    sections: Array<{
      name: string;
      content: string;
      rules: Array<{
        name: string;
        description: string;
        examples: string[];
        violations: string[];
      }>;
    }>;
  };
  userStoryDocument: {
    title: string;
    overview: string;
    stories: Array<{
      epic: string;
      story: string;
      details: string;
      testCases: string[];
    }>;
  };
  testStrategy: {
    approach: string;
    coverage: string;
    scenarios: string[];
    riskAreas: string[];
  };
}

/**
 * テスト生成エージェント
 * 
 * テストが存在しない場合に：
 * 1. コードからユーザーストーリーを抽出
 * 2. ビジネスルールを理解・文書化
 * 3. テストケースを自動生成
 * 4. 人間向けドキュメントを作成
 */
export class TestSynthesisAgent {
  private projectRoot: string;
  private claudeCodeIntegration?: ClaudeCodeBusinessLogicIntegration;
  private useAI: boolean;

  constructor(projectRoot: string, config?: {
    claudeCode?: {
      enabled?: boolean;
      model?: string;
      maxTokens?: number;
    };
  }) {
    this.projectRoot = projectRoot;
    
    try {
      this.claudeCodeIntegration = new ClaudeCodeBusinessLogicIntegration({
        projectRoot: this.projectRoot,
        model: config?.claudeCode?.model || 'claude-3-sonnet',
        maxTokens: config?.claudeCode?.maxTokens || 4096
      });
      this.useAI = config?.claudeCode?.enabled !== false;
      console.log('🧪 Test synthesis with Claude Code enabled');
    } catch (error) {
      this.useAI = false;
      console.log('📋 Test synthesis in template mode');
    }
  }

  /**
   * コードからユーザーストーリーとテストシナリオを抽出
   */
  async extractUserStoriesFromCode(filePath: string): Promise<UserStoryExtractionResult> {
    console.log(`📖 Extracting user stories from: ${filePath}`);
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      
      if (this.useAI && this.claudeCodeIntegration) {
        return await this.extractUserStoriesWithAI(content, filePath);
      }
      
      return await this.extractUserStoriesWithStaticAnalysis(content, filePath);
    } catch (error) {
      console.error(`❌ Failed to extract user stories from ${filePath}:`, getErrorMessage(error));
      return this.createEmptyUserStoryResult();
    }
  }

  /**
   * AIを使ったユーザーストーリー抽出
   */
  private async extractUserStoriesWithAI(content: string, filePath: string): Promise<UserStoryExtractionResult> {
    console.log('  🤖 Using AI to extract user stories and business context...');
    
    try {
      const analysis = await this.claudeCodeIntegration!.analyzeComplexBusinessLogic(content, {
        language: this.detectLanguage(filePath),
        focusAreas: ['user_scenarios', 'business_flows', 'acceptance_criteria', 'business_value'],
        includeRisks: true,
        extractTestCases: true
      });

      // AIレスポンスをユーザーストーリー形式に変換
      const userStories = this.convertToUserStories(analysis, filePath);
      const testScenarios = this.generateTestScenariosFromAnalysis(analysis, userStories);
      const businessContext = this.extractBusinessContext(analysis, content);

      return {
        userStories,
        testScenarios,
        businessContext
      };
    } catch (error) {
      console.warn('  ⚠️  AI user story extraction failed, falling back to static analysis');
      return await this.extractUserStoriesWithStaticAnalysis(content, filePath);
    }
  }

  /**
   * 静的解析によるユーザーストーリー抽出
   */
  private async extractUserStoriesWithStaticAnalysis(content: string, filePath: string): Promise<UserStoryExtractionResult> {
    console.log('  📋 Using static analysis for user story extraction...');
    
    const functions = this.extractFunctionSignatures(content);
    const comments = this.extractCommentsAndDocstrings(content);
    
    const userStories = this.inferUserStoriesFromCode(functions, comments, filePath);
    const testScenarios = this.generateBasicTestScenarios(userStories);
    const businessContext = this.inferBusinessContext(functions, comments);

    return {
      userStories,
      testScenarios,
      businessContext
    };
  }

  /**
   * ビジネスルールからテストケースを生成
   */
  async generateTestCasesFromBusinessLogic(
    businessLogic: BusinessLogicExtractResult,
    options: {
      testFramework?: string;
      includeIntegrationTests?: boolean;
      generateUserStoryTests?: boolean;
      language: 'go' | 'typescript' | 'python';
    }
  ): Promise<GeneratedTestCase[]> {
    console.log('🧪 Generating test cases from business logic...');
    
    const testCases: GeneratedTestCase[] = [];
    
    // ビジネスルールからテスト生成
    for (const rule of businessLogic.rules) {
      const ruleTests = await this.generateTestsForBusinessRule(rule, options);
      testCases.push(...ruleTests);
    }
    
    // ワークフローからテスト生成
    for (const workflow of businessLogic.workflows) {
      const workflowTests = await this.generateTestsForWorkflow(workflow, options);
      testCases.push(...workflowTests);
    }
    
    // データアクセスパターンからテスト生成
    for (const dataAccess of businessLogic.dataAccess) {
      const dataTests = await this.generateTestsForDataAccess(dataAccess, options);
      testCases.push(...dataTests);
    }

    console.log(`✅ Generated ${testCases.length} test cases`);
    return testCases;
  }

  /**
   * 人間向けドキュメントを生成
   */
  async generateHumanReadableDocumentation(
    userStories: UserStoryExtractionResult,
    businessLogic: BusinessLogicExtractResult,
    testCases: GeneratedTestCase[]
  ): Promise<HumanReadableDocumentation> {
    console.log('📚 Generating human-readable documentation...');
    
    const businessRulesDocument = this.createBusinessRulesDocument(businessLogic);
    const userStoryDocument = this.createUserStoryDocument(userStories);
    const testStrategy = this.createTestStrategyDocument(testCases, businessLogic);

    return {
      businessRulesDocument,
      userStoryDocument,
      testStrategy
    };
  }

  /**
   * テスト未存在プロジェクトの完全テスト生成
   */
  async synthesizeCompleteTestSuite(filePaths: string[]): Promise<{
    userStories: UserStoryExtractionResult;
    testCases: GeneratedTestCase[];
    documentation: HumanReadableDocumentation;
    recommendations: string[];
  }> {
    console.log('🏗️ Synthesizing complete test suite...');
    
    const allUserStories: UserStoryExtractionResult = {
      userStories: [],
      testScenarios: [],
      businessContext: {
        domain: 'Unknown',
        purpose: 'To be determined',
        keyEntities: [],
        workflows: [],
        constraints: []
      }
    };
    
    const allTestCases: GeneratedTestCase[] = [];
    
    // 各ファイルからユーザーストーリーとテストを抽出
    for (const filePath of filePaths) {
      try {
        const userStories = await this.extractUserStoriesFromCode(filePath);
        allUserStories.userStories.push(...userStories.userStories);
        allUserStories.testScenarios.push(...userStories.testScenarios);
        
        // 業務ロジックを抽出してテスト生成
        const language = this.detectLanguage(filePath);
        const content = await fs.readFile(filePath, 'utf8');
        
        // 簡易的な業務ロジック抽出
        const businessLogic = await this.extractBusinessLogicForTesting(content, filePath);
        const testCases = await this.generateTestCasesFromBusinessLogic(businessLogic, {
          language,
          testFramework: this.getDefaultTestFramework(language),
          includeIntegrationTests: true,
          generateUserStoryTests: true
        });
        
        allTestCases.push(...testCases);
      } catch (error) {
        console.warn(`⚠️ Failed to process ${filePath}:`, getErrorMessage(error));
      }
    }
    
    // ドキュメント生成
    const businessLogic = await this.consolidateBusinessLogic(allUserStories);
    const documentation = await this.generateHumanReadableDocumentation(
      allUserStories,
      businessLogic,
      allTestCases
    );
    
    const recommendations = this.generateTestingRecommendations(
      allUserStories,
      allTestCases,
      businessLogic
    );

    return {
      userStories: allUserStories,
      testCases: allTestCases,
      documentation,
      recommendations
    };
  }

  // プライベートヘルパーメソッド群

  private detectLanguage(filePath: string): 'go' | 'typescript' | 'python' {
    const ext = path.extname(filePath);
    switch (ext) {
      case '.go': return 'go';
      case '.ts': case '.tsx': return 'typescript';
      case '.py': return 'python';
      default: return 'go';
    }
  }

  private extractFunctionSignatures(content: string): Array<{
    name: string;
    parameters: string[];
    returnType?: string;
    visibility: 'public' | 'private';
  }> {
    const functions: Array<any> = [];
    
    // Go関数の抽出
    const goFunctionRegex = /func\s+(\w+)\s*\(([^)]*)\)\s*([^{]*)\s*{/g;
    let match;
    
    while ((match = goFunctionRegex.exec(content)) !== null) {
      const name = match[1];
      const params = match[2].split(',').map(p => p.trim()).filter(p => p);
      const returnType = match[3].trim();
      const visibility = name[0] === name[0].toUpperCase() ? 'public' : 'private';
      
      functions.push({ name, parameters: params, returnType, visibility });
    }
    
    return functions;
  }

  private extractCommentsAndDocstrings(content: string): string[] {
    const comments: string[] = [];
    
    // 単行コメント
    const singleLineComments = content.match(/\/\/.*$/gm) || [];
    comments.push(...singleLineComments.map(c => c.replace('//', '').trim()));
    
    // 複数行コメント
    const multiLineComments = content.match(/\/\*[\s\S]*?\*\//g) || [];
    comments.push(...multiLineComments.map(c => c.replace(/\/\*|\*\//g, '').trim()));
    
    return comments.filter(c => c.length > 0);
  }

  private inferUserStoriesFromCode(
    functions: any[],
    comments: string[],
    filePath: string
  ): UserStoryExtractionResult['userStories'] {
    const userStories: UserStoryExtractionResult['userStories'] = [];
    
    // 関数名とコメントから推測
    for (const func of functions) {
      if (!func.visibility || func.visibility === 'public') {
        const story = this.createUserStoryFromFunction(func, comments, filePath);
        if (story) {
          userStories.push(story);
        }
      }
    }
    
    return userStories;
  }

  private createUserStoryFromFunction(func: any, comments: string[], filePath: string): any {
    const funcName = func.name || 'anonymous';
    
    // 一般的な動詞から推測
    let action = 'perform an action';
    let purpose = 'achieve a business goal';
    
    if (funcName && funcName.toLowerCase().includes('create')) {
      action = 'create a new resource';
      purpose = 'add new data to the system';
    } else if (funcName && funcName.toLowerCase().includes('update')) {
      action = 'update existing resource';
      purpose = 'modify existing data';
    } else if (funcName && funcName.toLowerCase().includes('delete')) {
      action = 'delete a resource';
      purpose = 'remove data from the system';
    } else if (funcName && funcName.toLowerCase().includes('validate')) {
      action = 'validate input';
      purpose = 'ensure data integrity';
    }
    
    return {
      id: `story_${funcName}_${Date.now()}`,
      title: `As a user, I want to ${action}`,
      description: `The system should allow users to ${action} so that they can ${purpose}`,
      acceptanceCriteria: [
        `Given valid input parameters`,
        `When ${funcName} is called`,
        `Then the operation should complete successfully`
      ],
      businessValue: 'medium' as const,
      complexity: func.parameters.length > 3 ? 'high' as const : 'medium' as const,
      relatedCode: {
        functions: [funcName],
        files: [filePath],
        businessRules: []
      }
    };
  }

  private generateBasicTestScenarios(userStories: any[]): any[] {
    return userStories.map(story => ({
      id: `scenario_${story.id}`,
      userStoryId: story.id,
      scenario: `Test ${story.title}`,
      given: ['System is initialized', 'User has required permissions'],
      when: [`User performs ${story.relatedCode.functions[0]}`],
      then: ['Operation completes successfully', 'System state is updated'],
      testData: [{ example: 'test data' }],
      priority: story.businessValue
    }));
  }

  private inferBusinessContext(functions: any[], comments: string[]): any {
    const domain = 'Business Domain';
    const purpose = 'Support business operations';
    const keyEntities = [...new Set(functions.map(f => f.name.replace(/^(Create|Update|Delete|Get)/, '')))];
    
    return {
      domain,
      purpose,
      keyEntities,
      workflows: functions.filter(f => f.name.toLowerCase().includes('process')).map(f => f.name),
      constraints: comments.filter(c => c.toLowerCase().includes('constraint') || c.toLowerCase().includes('rule'))
    };
  }

  private convertToUserStories(analysis: any, filePath: string): any[] {
    const businessLogic = analysis.businessLogic || [];
    const workflows = analysis.workflows || [];
    
    const stories: any[] = [];
    
    // ビジネスロジックから
    for (const logic of businessLogic) {
      stories.push({
        id: `ai_story_${logic.type}_${Date.now()}`,
        title: `As a user, I want to ${logic.description}`,
        description: logic.description,
        acceptanceCriteria: [`System should ${logic.description}`, 'Validation should pass', 'Business rules should be enforced'],
        businessValue: logic.businessImpact || 'medium',
        complexity: logic.complexity || 'medium',
        relatedCode: {
          functions: [logic.code || ''],
          files: [filePath],
          businessRules: [logic.description]
        }
      });
    }
    
    return stories;
  }

  private generateTestScenariosFromAnalysis(analysis: any, userStories: any[]): any[] {
    return userStories.map(story => ({
      id: `ai_scenario_${story.id}`,
      userStoryId: story.id,
      scenario: `Validate ${story.title}`,
      given: ['Valid system state', 'Required data exists'],
      when: ['Business logic is executed'],
      then: ['Expected outcome is achieved', 'Business rules are satisfied'],
      testData: [{ scenario: 'test data' }],
      priority: story.businessValue
    }));
  }

  private extractBusinessContext(analysis: any, content: string): any {
    return {
      domain: 'Extracted Domain',
      purpose: 'Business logic execution',
      keyEntities: analysis.businessLogic?.map((l: any) => l.type) || [],
      workflows: analysis.workflows?.map((w: any) => w.name) || [],
      constraints: analysis.risks || []
    };
  }

  private async generateTestsForBusinessRule(rule: BusinessRule, options: any): Promise<GeneratedTestCase[]> {
    const testCases: GeneratedTestCase[] = [];
    
    const testCase: GeneratedTestCase = {
      id: `test_rule_${rule.type}_${Date.now()}`,
      name: `Test${rule.type.charAt(0).toUpperCase() + rule.type.slice(1)}Rule`,
      functionName: rule.location?.function || 'UnknownFunction',
      description: `Test ${rule.description}`,
      category: 'business_rule',
      language: options.language,
      framework: options.testFramework || this.getDefaultTestFramework(options.language),
      code: this.generateTestCode(rule, options),
      testData: [{ valid: 'test@example.com', invalid: 'invalid-email' }],
      expectedBehavior: [rule.description],
      businessRule: rule.description
    };
    
    testCases.push(testCase);
    return testCases;
  }

  private async generateTestsForWorkflow(workflow: BusinessWorkflow, options: any): Promise<GeneratedTestCase[]> {
    const testCases: GeneratedTestCase[] = [];
    
    const testCase: GeneratedTestCase = {
      id: `test_workflow_${workflow.name}_${Date.now()}`,
      name: `Test${workflow.name}Workflow`,
      functionName: workflow.name || 'UnknownWorkflow',
      description: `Test ${workflow.name} workflow execution`,
      category: 'workflow',
      language: options.language,
      framework: options.testFramework || this.getDefaultTestFramework(options.language),
      code: this.generateWorkflowTestCode(workflow, options),
      testData: [{ workflowData: 'test data' }],
      expectedBehavior: [`${workflow.name} workflow completes successfully`]
    };
    
    testCases.push(testCase);
    return testCases;
  }

  private async generateTestsForDataAccess(dataAccess: DataAccessPattern, options: any): Promise<GeneratedTestCase[]> {
    const testCases: GeneratedTestCase[] = [];
    
    const testCase: GeneratedTestCase = {
      id: `test_data_${dataAccess.operation}_${Date.now()}`,
      name: `Test${dataAccess.operation.charAt(0).toUpperCase() + dataAccess.operation.slice(1)}${dataAccess.table}`,
      functionName: `${dataAccess.operation}${dataAccess.table}`,
      description: `Test ${dataAccess.operation} operation on ${dataAccess.table}`,
      category: 'integration',
      language: options.language,
      framework: options.testFramework || this.getDefaultTestFramework(options.language),
      code: this.generateDataAccessTestCode(dataAccess, options),
      testData: [{ table: dataAccess.table, operation: dataAccess.operation }],
      expectedBehavior: [`${dataAccess.operation} on ${dataAccess.table} should work correctly`]
    };
    
    testCases.push(testCase);
    return testCases;
  }

  private generateTestCode(rule: BusinessRule, options: any): string {
    if (options.language === 'go') {
      return `
func Test${rule.type.charAt(0).toUpperCase() + rule.type.slice(1)}Rule(t *testing.T) {
    // Test ${rule.description}
    testCases := []struct {
        name     string
        input    interface{}
        expected bool
    }{
        {"valid case", "valid input", true},
        {"invalid case", "invalid input", false},
    }
    
    for _, tc := range testCases {
        t.Run(tc.name, func(t *testing.T) {
            result := validateBusinessRule(tc.input)
            assert.Equal(t, tc.expected, result)
        })
    }
}`;
    }
    
    return `// Test code for ${rule.description}`;
  }

  private generateWorkflowTestCode(workflow: BusinessWorkflow, options: any): string {
    if (options.language === 'go') {
      return `
func Test${workflow.name}Workflow(t *testing.T) {
    // Test ${workflow.name} workflow
    ctx := context.Background()
    
    workflow := &${workflow.name}Workflow{}
    result, err := workflow.Execute(ctx, testData)
    
    assert.NoError(t, err)
    assert.NotNil(t, result)
    // Verify workflow steps completed
}`;
    }
    
    return `// Workflow test for ${workflow.name}`;
  }

  private generateDataAccessTestCode(dataAccess: DataAccessPattern, options: any): string {
    if (options.language === 'go') {
      return `
func Test${dataAccess.operation.charAt(0).toUpperCase() + dataAccess.operation.slice(1)}${dataAccess.table}(t *testing.T) {
    // Test ${dataAccess.operation} on ${dataAccess.table}
    db := setupTestDB(t)
    defer db.Close()
    
    repo := New${dataAccess.table.charAt(0).toUpperCase() + dataAccess.table.slice(1)}Repository(db)
    
    // Execute operation
    err := repo.${dataAccess.operation.charAt(0).toUpperCase() + dataAccess.operation.slice(1)}(testData)
    assert.NoError(t, err)
}`;
    }
    
    return `// Data access test for ${dataAccess.operation} on ${dataAccess.table}`;
  }

  private getDefaultTestFramework(language: string): string {
    switch (language) {
      case 'go': return 'testify';
      case 'typescript': return 'vitest';
      case 'python': return 'pytest';
      default: return 'unknown';
    }
  }

  private createBusinessRulesDocument(businessLogic: BusinessLogicExtractResult): any {
    return {
      title: '業務ルール仕様書',
      sections: [
        {
          name: 'バリデーションルール',
          content: '入力データの検証に関する業務ルール',
          rules: businessLogic.rules.filter(r => r.type === 'validation').map(r => ({
            name: r.description,
            description: r.description,
            examples: ['有効な例: test@example.com', '無効な例: invalid-email'],
            violations: ['空文字列', '不正なフォーマット']
          }))
        }
      ]
    };
  }

  private createUserStoryDocument(userStories: UserStoryExtractionResult): any {
    return {
      title: 'ユーザーストーリー仕様書',
      overview: userStories.businessContext.purpose,
      stories: userStories.userStories.map(story => ({
        epic: 'メイン機能',
        story: story.title,
        details: story.description,
        testCases: story.acceptanceCriteria
      }))
    };
  }

  private createTestStrategyDocument(testCases: GeneratedTestCase[], businessLogic: BusinessLogicExtractResult): any {
    return {
      approach: 'ビジネスロジック重視のテスト戦略',
      coverage: `${testCases.length}個のテストケースで業務ルールをカバー`,
      scenarios: testCases.map(tc => tc.description),
      riskAreas: businessLogic.rules.filter(r => r.complexity === 'high').map(r => r.description)
    };
  }

  private async extractBusinessLogicForTesting(content: string, filePath: string): Promise<BusinessLogicExtractResult> {
    // 簡易的な業務ロジック抽出
    return {
      rules: [],
      dataAccess: [],
      workflows: [],
      complexity: { overall: 'medium', details: {} }
    };
  }

  private async consolidateBusinessLogic(userStories: UserStoryExtractionResult): Promise<BusinessLogicExtractResult> {
    return {
      rules: [],
      dataAccess: [],
      workflows: [],
      complexity: { overall: 'medium', details: {} }
    };
  }

  private generateTestingRecommendations(
    userStories: UserStoryExtractionResult,
    testCases: GeneratedTestCase[],
    businessLogic: BusinessLogicExtractResult
  ): string[] {
    return [
      'ビジネスルールのテストを優先的に実装してください',
      'エッジケースのテストケースを追加検討してください',
      '統合テストでワークフロー全体をテストしてください'
    ];
  }

  private createEmptyUserStoryResult(): UserStoryExtractionResult {
    return {
      userStories: [],
      testScenarios: [],
      businessContext: {
        domain: 'Unknown',
        purpose: 'To be determined',
        keyEntities: [],
        workflows: [],
        constraints: []
      }
    };
  }

  /**
   * テスト合成エージェントの完全実行フロー
   */
  async execute(request: TestSynthesisExecuteRequest): Promise<TestSynthesisExecuteResult> {
    console.log('🧪 Starting test synthesis execution...');
    
    const result: TestSynthesisExecuteResult = {
      generatedTests: [],
      generatedDocuments: [],
      warnings: [],
      errors: []
    };

    try {
      // 1. プロジェクトファイルの探索
      const projectFiles = await this.findProjectFiles(request.projectPath, request.language);
      console.log(`🔍 Found ${projectFiles.length} ${request.language} files to analyze`);

      // 2. 出力ディレクトリの作成
      await fs.mkdir(request.outputPath, { recursive: true });
      await fs.mkdir(request.documentationPath, { recursive: true });

      // 3. 各ファイルからユーザーストーリーとテストケースを生成
      for (const filePath of projectFiles) {
        try {
          console.log(`\n📁 Processing: ${path.relative(request.projectPath, filePath)}`);
          
          const content = await fs.readFile(filePath, 'utf8');
          
          // テストが存在するかチェック
          const hasExistingTests = await this.checkForExistingTests(filePath, request.projectPath);
          
          if (!hasExistingTests) {
            console.log('  📋 No existing tests found, generating from code...');
            
            // ユーザーストーリーとテストケースを生成
            const userStories = await this.extractUserStoriesFromCode(filePath);
            const businessLogic = await this.extractBusinessLogicForTesting(content, filePath);
            const testCases = await this.generateTestCasesFromBusinessLogic(businessLogic, {
              language: request.language,
              testFramework: this.getDefaultTestFramework(request.language),
              includeIntegrationTests: true,
              generateUserStoryTests: true
            });
            
            if (userStories.userStories.length > 0 || testCases.length > 0) {
              // テストファイルの生成
              const testFileName = this.generateTestFileName(filePath, request.language);
              const testFilePath = path.join(request.outputPath, testFileName);
              
              const testContent = await this.generateTestFileContent(testCases, request.language);
              await fs.writeFile(testFilePath, testContent);
              
              result.generatedTests.push({
                filePath: testFilePath,
                testCases: testCases.length,
                coverage: `${testCases.length} test cases covering business logic`
              });

              // ドキュメント生成
              if (request.generateDocumentation && userStories.userStories.length > 0) {
                const docFileName = this.generateDocumentFileName(filePath);
                const docFilePath = path.join(request.documentationPath, docFileName);
                
                const docContent = await this.generateUserStoryDocument(userStories, request.localization);
                await fs.writeFile(docFilePath, docContent);
                
                result.generatedDocuments.push({
                  type: 'user-story',
                  filePath: docFilePath,
                  title: `User Stories for ${path.basename(filePath)}`
                });
              }
              
              console.log(`  ✅ Generated ${testCases.length} test cases and ${userStories.userStories.length} user stories`);
            }
          } else {
            console.log('  ✅ Tests already exist, skipping generation');
          }
          
        } catch (error) {
          const errorMsg = `Failed to process ${filePath}: ${getErrorMessage(error)}`;
          result.errors.push(errorMsg);
          console.error(`❌ ${errorMsg}`);
        }
      }

      // 4. カバレッジ改善推定
      if (result.generatedTests.length > 0) {
        result.coverageImprovement = {
          improvement: result.generatedTests.length * 2, // 簡易推定
          beforeCoverage: 20, // 推定値
          estimatedAfterCoverage: 20 + (result.generatedTests.length * 2)
        };
      }

      console.log('✅ Test synthesis execution completed');
      console.log(`   🧪 Generated tests: ${result.generatedTests.length}`);
      console.log(`   📚 Generated docs: ${result.generatedDocuments.length}`);

      return result;

    } catch (error) {
      const errorMsg = `Test synthesis execution failed: ${getErrorMessage(error)}`;
      result.errors.push(errorMsg);
      console.error(`❌ ${errorMsg}`);
      throw error;
    }
  }

  private async findProjectFiles(projectPath: string, language: string): Promise<string[]> {
    const extensions: Record<string, string[]> = {
      'go': ['.go'],
      'typescript': ['.ts', '.tsx'],
      'python': ['.py']
    };

    const ext = extensions[language] || ['.go'];
    const files: string[] = [];

    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.') && !['node_modules', 'vendor', '__generated__'].includes(entry.name)) {
            await scanDirectory(fullPath);
          } else if (entry.isFile() && ext.some(e => entry.name.endsWith(e))) {
            files.push(fullPath);
          }
        }
      } catch (error) {
        console.warn(`Warning: Could not scan directory ${dir}: ${getErrorMessage(error)}`);
      }
    };

    await scanDirectory(projectPath);
    return files;
  }

  private async checkForExistingTests(filePath: string, projectPath: string): Promise<boolean> {
    const testPatterns = ['_test.go', '.test.ts', '.test.js', '_test.py', 'test_*.py'];
    const fileName = path.basename(filePath, path.extname(filePath));
    
    for (const pattern of testPatterns) {
      const testFileName = pattern.startsWith('test_') ? 
        pattern.replace('*', fileName) : 
        fileName + pattern;
      
      const testFilePath = path.join(path.dirname(filePath), testFileName);
      
      try {
        await fs.access(testFilePath);
        return true;
      } catch {
        // ファイルが存在しない
      }
    }
    
    return false;
  }

  private generateTestFileName(originalPath: string, language: string): string {
    const baseName = path.basename(originalPath, path.extname(originalPath));
    const extensions: Record<string, string> = {
      'go': '_test.go',
      'typescript': '.test.ts',
      'python': '_test.py'
    };
    
    return baseName + (extensions[language] || '_test.go');
  }

  private generateDocumentFileName(originalPath: string): string {
    const baseName = path.basename(originalPath, path.extname(originalPath));
    return `${baseName}-user-stories.md`;
  }

  private async generateTestFileContent(testCases: GeneratedTestCase[], language: string): Promise<string> {
    const templates: Record<string, string> = {
      'go': this.generateGoTestTemplate(testCases),
      'typescript': this.generateTypeScriptTestTemplate(testCases),
      'python': this.generatePythonTestTemplate(testCases)
    };
    
    return templates[language] || templates['go'];
  }

  private generateGoTestTemplate(testCases: GeneratedTestCase[]): string {
    return `package main

import (
	"testing"
)

// Generated test cases from business logic analysis
${testCases.map(tc => `
func Test${tc.functionName}(t *testing.T) {
	// ${tc.description}
	// TODO: Implement test logic
	${tc.expectedBehavior.map(behavior => `\t// ${behavior}`).join('\n')}
	
	t.Skip("Generated test - needs implementation")
}`).join('\n')}
`;
  }

  private generateTypeScriptTestTemplate(testCases: GeneratedTestCase[]): string {
    return `import { describe, it, expect } from 'vitest';

// Generated test cases from business logic analysis
${testCases.map(tc => `
describe('${tc.functionName}', () => {
  it('${tc.description}', () => {
    // ${tc.expectedBehavior.join('\n    // ')}
    
    // TODO: Implement test logic
    expect(true).toBe(false); // Remove this when implementing
  });
});`).join('\n')}
`;
  }

  private generatePythonTestTemplate(testCases: GeneratedTestCase[]): string {
    return `import unittest

class TestGeneratedCases(unittest.TestCase):
    """Generated test cases from business logic analysis"""
    
${testCases.map(tc => `
    def test_${tc.functionName.toLowerCase()}(self):
        """${tc.description}"""
        # ${tc.expectedBehavior.join('\n        # ')}
        
        # TODO: Implement test logic
        self.skipTest("Generated test - needs implementation")`).join('\n')}

if __name__ == '__main__':
    unittest.main()
`;
  }

  private async generateUserStoryDocument(userStories: UserStoryExtractionResult, localization: string): Promise<string> {
    const isJapanese = localization === 'ja';
    
    return `# ${isJapanese ? 'ユーザーストーリー' : 'User Stories'}

${isJapanese ? '## 概要' : '## Overview'}
${isJapanese ? 
  `このドキュメントは、コードから抽出された業務要件をユーザーストーリー形式で記載しています。` :
  `This document contains business requirements extracted from code in user story format.`
}

${isJapanese ? '## ドメイン情報' : '## Domain Information'}
- **${isJapanese ? 'ドメイン' : 'Domain'}**: ${userStories.businessContext.domain}
- **${isJapanese ? '目的' : 'Purpose'}**: ${userStories.businessContext.purpose}
- **${isJapanese ? 'キーエンティティ' : 'Key Entities'}**: ${userStories.businessContext.keyEntities.join(', ')}

${isJapanese ? '## ユーザーストーリー' : '## User Stories'}

${userStories.userStories.map(story => `
### ${story.title}

**${isJapanese ? '説明' : 'Description'}**: ${story.description}

**${isJapanese ? '受け入れ条件' : 'Acceptance Criteria'}**:
${story.acceptanceCriteria.map(criteria => `- ${criteria}`).join('\n')}

**${isJapanese ? 'ビジネス価値' : 'Business Value'}**: ${story.businessValue}
**${isJapanese ? '複雑度' : 'Complexity'}**: ${story.complexity}

**${isJapanese ? '関連コード' : 'Related Code'}**:
- ${isJapanese ? '関数' : 'Functions'}: ${story.relatedCode.functions.join(', ')}
- ${isJapanese ? 'ファイル' : 'Files'}: ${story.relatedCode.files.join(', ')}
`).join('\n')}

${isJapanese ? '## テストシナリオ' : '## Test Scenarios'}

${userStories.testScenarios.map(scenario => `
### ${scenario.scenario}

**Given**: ${scenario.given.join(', ')}
**When**: ${scenario.when.join(', ')}
**Then**: ${scenario.then.join(', ')}

**${isJapanese ? '優先度' : 'Priority'}**: ${scenario.priority}
`).join('\n')}
`;
  }
}