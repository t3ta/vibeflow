import * as fs from 'fs/promises';
import * as path from 'path';
import { 
  UserStoryExtractionResult,
  GeneratedTestCase,
  HumanReadableDocumentation
} from '../agents/test-synthesis-agent.js';
import { BusinessLogicExtractResult } from '../types/business-logic.js';
import { getErrorMessage } from './error-utils.js';

/**
 * ドキュメント出力形式
 */
export type DocumentationFormat = 'markdown' | 'html' | 'json' | 'confluence';

/**
 * ドキュメント生成オプション
 */
export interface DocumentationOptions {
  format: DocumentationFormat;
  outputDir: string;
  includeCodeSamples: boolean;
  includeTestCases: boolean;
  includeUserStories: boolean;
  includeBIusinessRules: boolean;
  language: 'ja' | 'en';
  template?: string;
}

/**
 * 生成されたドキュメントファイル
 */
export interface GeneratedDocument {
  filePath: string;
  title: string;
  content: string;
  format: DocumentationFormat;
  size: number;
}

/**
 * ドキュメント生成器
 * 
 * ユーザーストーリー、テストケース、ビジネスルールから
 * 人間が読みやすいドキュメントを自動生成する
 */
export class DocumentationGenerator {
  private options: DocumentationOptions;

  constructor(options: DocumentationOptions) {
    this.options = {
      ...options,
      language: options.language || 'ja',
      includeCodeSamples: options.includeCodeSamples !== false,
      includeTestCases: options.includeTestCases !== false,
      includeUserStories: options.includeUserStories !== false,
      includeBIusinessRules: options.includeBIusinessRules !== false
    };
  }

  /**
   * 完全なドキュメントセットを生成
   */
  async generateCompleteDocumentationSet(data: {
    userStories: UserStoryExtractionResult;
    businessLogic: BusinessLogicExtractResult;
    testCases: GeneratedTestCase[];
    documentation: HumanReadableDocumentation;
    projectName?: string;
  }): Promise<GeneratedDocument[]> {
    console.log('📚 Generating complete documentation set...');
    
    const documents: GeneratedDocument[] = [];
    
    try {
      // 出力ディレクトリの作成
      await fs.mkdir(this.options.outputDir, { recursive: true });
      
      // 各種ドキュメントを生成
      if (this.options.includeUserStories) {
        const userStoryDoc = await this.generateUserStoryDocument(data.userStories, data.projectName);
        documents.push(userStoryDoc);
      }
      
      if (this.options.includeBIusinessRules) {
        const businessRulesDoc = await this.generateBusinessRulesDocument(data.businessLogic);
        documents.push(businessRulesDoc);
      }
      
      if (this.options.includeTestCases) {
        const testCasesDoc = await this.generateTestCasesDocument(data.testCases);
        documents.push(testCasesDoc);
      }
      
      // 統合ドキュメント
      const overviewDoc = await this.generateProjectOverviewDocument(data);
      documents.push(overviewDoc);
      
      // テスト戦略ドキュメント
      const testStrategyDoc = await this.generateTestStrategyDocument(data.documentation.testStrategy, data.testCases);
      documents.push(testStrategyDoc);
      
      console.log(`✅ Generated ${documents.length} documentation files`);
      return documents;
      
    } catch (error) {
      console.error('❌ Failed to generate documentation:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * ユーザーストーリードキュメントの生成
   */
  async generateUserStoryDocument(
    userStories: UserStoryExtractionResult,
    projectName?: string
  ): Promise<GeneratedDocument> {
    console.log('📖 Generating user story document...');
    
    const title = this.getText('user_story_title', projectName || 'Project');
    
    let content = '';
    
    if (this.options.format === 'markdown') {
      content = this.generateUserStoryMarkdown(userStories, title);
    } else if (this.options.format === 'html') {
      content = this.generateUserStoryHTML(userStories, title);
    } else if (this.options.format === 'confluence') {
      content = this.generateUserStoryConfluence(userStories, title);
    } else {
      content = JSON.stringify(userStories, null, 2);
    }
    
    return await this.writeDocument('user-stories', title, content);
  }

  /**
   * ビジネスルールドキュメントの生成
   */
  async generateBusinessRulesDocument(businessLogic: BusinessLogicExtractResult): Promise<GeneratedDocument> {
    console.log('📋 Generating business rules document...');
    
    const title = this.getText('business_rules_title');
    
    let content = '';
    
    if (this.options.format === 'markdown') {
      content = this.generateBusinessRulesMarkdown(businessLogic, title);
    } else if (this.options.format === 'html') {
      content = this.generateBusinessRulesHTML(businessLogic, title);
    } else if (this.options.format === 'confluence') {
      content = this.generateBusinessRulesConfluence(businessLogic, title);
    } else {
      content = JSON.stringify(businessLogic, null, 2);
    }
    
    return await this.writeDocument('business-rules', title, content);
  }

  /**
   * テストケースドキュメントの生成
   */
  async generateTestCasesDocument(testCases: GeneratedTestCase[]): Promise<GeneratedDocument> {
    console.log('🧪 Generating test cases document...');
    
    const title = this.getText('test_cases_title');
    
    let content = '';
    
    if (this.options.format === 'markdown') {
      content = this.generateTestCasesMarkdown(testCases, title);
    } else if (this.options.format === 'html') {
      content = this.generateTestCasesHTML(testCases, title);
    } else if (this.options.format === 'confluence') {
      content = this.generateTestCasesConfluence(testCases, title);
    } else {
      content = JSON.stringify(testCases, null, 2);
    }
    
    return await this.writeDocument('test-cases', title, content);
  }

  /**
   * プロジェクト概要ドキュメントの生成
   */
  async generateProjectOverviewDocument(data: {
    userStories: UserStoryExtractionResult;
    businessLogic: BusinessLogicExtractResult;
    testCases: GeneratedTestCase[];
    documentation: HumanReadableDocumentation;
    projectName?: string;
  }): Promise<GeneratedDocument> {
    console.log('🏗️ Generating project overview document...');
    
    const title = this.getText('project_overview_title', data.projectName || 'Project');
    
    let content = '';
    
    if (this.options.format === 'markdown') {
      content = this.generateProjectOverviewMarkdown(data, title);
    } else if (this.options.format === 'html') {
      content = this.generateProjectOverviewHTML(data, title);
    } else if (this.options.format === 'confluence') {
      content = this.generateProjectOverviewConfluence(data, title);
    } else {
      content = JSON.stringify({
        summary: {
          userStories: data.userStories.userStories.length,
          businessRules: data.businessLogic.rules.length,
          testCases: data.testCases.length,
          workflows: data.businessLogic.workflows.length
        }
      }, null, 2);
    }
    
    return await this.writeDocument('project-overview', title, content);
  }

  /**
   * テスト戦略ドキュメントの生成
   */
  async generateTestStrategyDocument(
    testStrategy: any,
    testCases: GeneratedTestCase[]
  ): Promise<GeneratedDocument> {
    console.log('🎯 Generating test strategy document...');
    
    const title = this.getText('test_strategy_title');
    
    let content = '';
    
    if (this.options.format === 'markdown') {
      content = this.generateTestStrategyMarkdown(testStrategy, testCases, title);
    } else if (this.options.format === 'html') {
      content = this.generateTestStrategyHTML(testStrategy, testCases, title);
    } else if (this.options.format === 'confluence') {
      content = this.generateTestStrategyConfluence(testStrategy, testCases, title);
    } else {
      content = JSON.stringify({ testStrategy, testCases }, null, 2);
    }
    
    return await this.writeDocument('test-strategy', title, content);
  }

  // Markdownフォーマット生成メソッド群

  private generateUserStoryMarkdown(userStories: UserStoryExtractionResult, title: string): string {
    let md = `# ${title}\n\n`;
    
    md += `## ${this.getText('business_context')}\n\n`;
    md += `**${this.getText('domain')}:** ${userStories.businessContext.domain}\n\n`;
    md += `**${this.getText('purpose')}:** ${userStories.businessContext.purpose}\n\n`;
    
    if (userStories.businessContext.keyEntities.length > 0) {
      md += `**${this.getText('key_entities')}:** ${userStories.businessContext.keyEntities.join(', ')}\n\n`;
    }
    
    md += `## ${this.getText('user_stories')}\n\n`;
    
    for (const story of userStories.userStories) {
      md += `### ${story.title}\n\n`;
      md += `**${this.getText('description')}:** ${story.description}\n\n`;
      md += `**${this.getText('business_value')}:** ${story.businessValue}\n\n`;
      md += `**${this.getText('complexity')}:** ${story.complexity}\n\n`;
      
      md += `**${this.getText('acceptance_criteria')}:**\n\n`;
      for (const criteria of story.acceptanceCriteria) {
        md += `- ${criteria}\n`;
      }
      md += '\n';
      
      if (story.relatedCode.functions.length > 0) {
        md += `**${this.getText('related_functions')}:** ${story.relatedCode.functions.join(', ')}\n\n`;
      }
    }
    
    md += `## ${this.getText('test_scenarios')}\n\n`;
    
    for (const scenario of userStories.testScenarios) {
      md += `### ${scenario.scenario}\n\n`;
      md += `**Given:** ${scenario.given.join(', ')}\n\n`;
      md += `**When:** ${scenario.when.join(', ')}\n\n`;
      md += `**Then:** ${scenario.then.join(', ')}\n\n`;
      md += `**${this.getText('priority')}:** ${scenario.priority}\n\n`;
    }
    
    return md;
  }

  private generateBusinessRulesMarkdown(businessLogic: BusinessLogicExtractResult, title: string): string {
    let md = `# ${title}\n\n`;
    
    md += `## ${this.getText('overview')}\n\n`;
    md += `${this.getText('business_rules_overview_text')}\n\n`;
    
    // 複雑度サマリー
    md += `**${this.getText('overall_complexity')}:** ${businessLogic.complexity.overall}\n\n`;
    
    // カテゴリ別ルール
    const rulesByType = this.groupRulesByType(businessLogic.rules);
    
    for (const [type, rules] of Object.entries(rulesByType)) {
      md += `## ${this.getTypeDisplayName(type)}\n\n`;
      
      for (const rule of rules) {
        md += `### ${rule.description}\n\n`;
        md += `**${this.getText('type')}:** ${rule.type}\n\n`;
        md += `**${this.getText('complexity')}:** ${rule.complexity}\n\n`;
        md += `**${this.getText('location')}:** ${rule.location.file}:${rule.location.line}\n\n`;
        
        if (this.options.includeCodeSamples && rule.code) {
          md += `**${this.getText('code_sample')}:**\n\n`;
          md += '```\n';
          md += rule.code;
          md += '\n```\n\n';
        }
        
        if (rule.dependencies.length > 0) {
          md += `**${this.getText('dependencies')}:** ${rule.dependencies.join(', ')}\n\n`;
        }
      }
    }
    
    // ワークフロー
    if (businessLogic.workflows.length > 0) {
      md += `## ${this.getText('workflows')}\n\n`;
      
      for (const workflow of businessLogic.workflows) {
        md += `### ${workflow.name}\n\n`;
        md += `**${this.getText('description')}:** ${workflow.name} workflow process\n\n`;
        md += `**${this.getText('complexity')}:** ${workflow.complexity}\n\n`;
        
        md += `**${this.getText('steps')}:**\n\n`;
        for (const step of workflow.steps) {
          md += `1. ${step}\n`;
        }
        md += '\n';
        
        if (workflow.businessRules.length > 0) {
          md += `**${this.getText('related_business_rules')}:** ${workflow.businessRules.join(', ')}\n\n`;
        }
      }
    }
    
    // データアクセスパターン
    if (businessLogic.dataAccess.length > 0) {
      md += `## ${this.getText('data_access_patterns')}\n\n`;
      
      for (const pattern of businessLogic.dataAccess) {
        md += `### ${pattern.operation} on ${pattern.table}\n\n`;
        md += `**${this.getText('operation')}:** ${pattern.operation}\n\n`;
        md += `**${this.getText('table')}:** ${pattern.table}\n\n`;
        md += `**${this.getText('complexity')}:** ${pattern.complexity}\n\n`;
        
        if (pattern.query) {
          md += `**${this.getText('query')}:**\n\n`;
          md += '```sql\n';
          md += pattern.query;
          md += '\n```\n\n';
        }
      }
    }
    
    return md;
  }

  private generateTestCasesMarkdown(testCases: GeneratedTestCase[], title: string): string {
    let md = `# ${title}\n\n`;
    
    md += `## ${this.getText('overview')}\n\n`;
    md += `${this.getText('test_cases_overview_text', testCases.length.toString())}\n\n`;
    
    // カテゴリ別にグループ化
    const testsByCategory = this.groupTestsByCategory(testCases);
    
    for (const [category, tests] of Object.entries(testsByCategory)) {
      md += `## ${this.getCategoryDisplayName(category)}\n\n`;
      
      for (const test of tests) {
        md += `### ${test.name}\n\n`;
        md += `**${this.getText('description')}:** ${test.description}\n\n`;
        md += `**${this.getText('category')}:** ${test.category}\n\n`;
        md += `**${this.getText('language')}:** ${test.language}\n\n`;
        md += `**${this.getText('framework')}:** ${test.framework}\n\n`;
        
        if (test.businessRule) {
          md += `**${this.getText('business_rule')}:** ${test.businessRule}\n\n`;
        }
        
        md += `**${this.getText('expected_behavior')}:** ${test.expectedBehavior}\n\n`;
        
        if (this.options.includeCodeSamples) {
          md += `**${this.getText('test_code')}:**\n\n`;
          md += `\`\`\`${test.language}\n`;
          md += test.code;
          md += '\n```\n\n';
        }
        
        if (test.testData.length > 0) {
          md += `**${this.getText('test_data')}:**\n\n`;
          md += '```json\n';
          md += JSON.stringify(test.testData, null, 2);
          md += '\n```\n\n';
        }
      }
    }
    
    return md;
  }

  private generateProjectOverviewMarkdown(data: any, title: string): string {
    let md = `# ${title}\n\n`;
    
    md += `## ${this.getText('summary')}\n\n`;
    md += `${this.getText('project_summary_text')}\n\n`;
    
    // 統計情報
    md += `### ${this.getText('statistics')}\n\n`;
    md += `- **${this.getText('user_stories')}:** ${data.userStories.userStories.length}\n`;
    md += `- **${this.getText('business_rules')}:** ${data.businessLogic.rules.length}\n`;
    md += `- **${this.getText('test_cases')}:** ${data.testCases.length}\n`;
    md += `- **${this.getText('workflows')}:** ${data.businessLogic.workflows.length}\n`;
    md += `- **${this.getText('data_access_patterns')}:** ${data.businessLogic.dataAccess.length}\n\n`;
    
    // ビジネスコンテキスト
    md += `### ${this.getText('business_context')}\n\n`;
    md += `**${this.getText('domain')}:** ${data.userStories.businessContext.domain}\n\n`;
    md += `**${this.getText('purpose')}:** ${data.userStories.businessContext.purpose}\n\n`;
    
    // キーエンティティ
    if (data.userStories.businessContext.keyEntities.length > 0) {
      md += `### ${this.getText('key_entities')}\n\n`;
      for (const entity of data.userStories.businessContext.keyEntities) {
        md += `- ${entity}\n`;
      }
      md += '\n';
    }
    
    // 複雑度分析
    md += `### ${this.getText('complexity_analysis')}\n\n`;
    md += `**${this.getText('overall_complexity')}:** ${data.businessLogic.complexity.overall}\n\n`;
    
    const complexityDistribution = this.analyzeComplexityDistribution(data.businessLogic.rules);
    md += `**${this.getText('complexity_distribution')}:**\n\n`;
    md += `- ${this.getText('low')}: ${complexityDistribution.low}\n`;
    md += `- ${this.getText('medium')}: ${complexityDistribution.medium}\n`;
    md += `- ${this.getText('high')}: ${complexityDistribution.high}\n\n`;
    
    // リスク評価
    const highComplexityRules = data.businessLogic.rules.filter((r: any) => r.complexity === 'high');
    if (highComplexityRules.length > 0) {
      md += `### ${this.getText('risk_assessment')}\n\n`;
      md += `${this.getText('high_complexity_rules_warning')}\n\n`;
      for (const rule of highComplexityRules) {
        md += `- ${rule.description} (${rule.location.file}:${rule.location.line})\n`;
      }
      md += '\n';
    }
    
    return md;
  }

  private generateTestStrategyMarkdown(testStrategy: any, testCases: GeneratedTestCase[], title: string): string {
    let md = `# ${title}\n\n`;
    
    md += `## ${this.getText('approach')}\n\n`;
    md += `${testStrategy.approach}\n\n`;
    
    md += `## ${this.getText('coverage')}\n\n`;
    md += `${testStrategy.coverage}\n\n`;
    
    // テストピラミッド
    md += `### ${this.getText('test_pyramid')}\n\n`;
    const testDistribution = this.analyzeTestDistribution(testCases);
    md += `- **${this.getText('unit_tests')}:** ${testDistribution.unit}\n`;
    md += `- **${this.getText('integration_tests')}:** ${testDistribution.integration}\n`;
    md += `- **${this.getText('business_rule_tests')}:** ${testDistribution.business_rule}\n`;
    md += `- **${this.getText('workflow_tests')}:** ${testDistribution.workflow}\n\n`;
    
    // シナリオ
    md += `## ${this.getText('test_scenarios')}\n\n`;
    for (const scenario of testStrategy.scenarios) {
      md += `- ${scenario}\n`;
    }
    md += '\n';
    
    // リスクエリア
    if (testStrategy.riskAreas && testStrategy.riskAreas.length > 0) {
      md += `## ${this.getText('risk_areas')}\n\n`;
      for (const risk of testStrategy.riskAreas) {
        md += `- ${risk}\n`;
      }
      md += '\n';
    }
    
    return md;
  }

  // HTML生成メソッド（基本実装）
  private generateUserStoryHTML(userStories: UserStoryExtractionResult, title: string): string {
    return this.convertMarkdownToHTML(this.generateUserStoryMarkdown(userStories, title));
  }

  private generateBusinessRulesHTML(businessLogic: BusinessLogicExtractResult, title: string): string {
    return this.convertMarkdownToHTML(this.generateBusinessRulesMarkdown(businessLogic, title));
  }

  private generateTestCasesHTML(testCases: GeneratedTestCase[], title: string): string {
    return this.convertMarkdownToHTML(this.generateTestCasesMarkdown(testCases, title));
  }

  private generateProjectOverviewHTML(data: any, title: string): string {
    return this.convertMarkdownToHTML(this.generateProjectOverviewMarkdown(data, title));
  }

  private generateTestStrategyHTML(testStrategy: any, testCases: GeneratedTestCase[], title: string): string {
    return this.convertMarkdownToHTML(this.generateTestStrategyMarkdown(testStrategy, testCases, title));
  }

  // Confluence生成メソッド（基本実装）
  private generateUserStoryConfluence(userStories: UserStoryExtractionResult, title: string): string {
    return this.convertMarkdownToConfluence(this.generateUserStoryMarkdown(userStories, title));
  }

  private generateBusinessRulesConfluence(businessLogic: BusinessLogicExtractResult, title: string): string {
    return this.convertMarkdownToConfluence(this.generateBusinessRulesMarkdown(businessLogic, title));
  }

  private generateTestCasesConfluence(testCases: GeneratedTestCase[], title: string): string {
    return this.convertMarkdownToConfluence(this.generateTestCasesMarkdown(testCases, title));
  }

  private generateProjectOverviewConfluence(data: any, title: string): string {
    return this.convertMarkdownToConfluence(this.generateProjectOverviewMarkdown(data, title));
  }

  private generateTestStrategyConfluence(testStrategy: any, testCases: GeneratedTestCase[], title: string): string {
    return this.convertMarkdownToConfluence(this.generateTestStrategyMarkdown(testStrategy, testCases, title));
  }

  // ユーティリティメソッド群

  private async writeDocument(filename: string, title: string, content: string): Promise<GeneratedDocument> {
    const extension = this.getFileExtension();
    const filePath = path.join(this.options.outputDir, `${filename}.${extension}`);
    
    await fs.writeFile(filePath, content, 'utf8');
    
    const stats = await fs.stat(filePath);
    
    return {
      filePath,
      title,
      content,
      format: this.options.format,
      size: stats.size
    };
  }

  private getFileExtension(): string {
    switch (this.options.format) {
      case 'markdown': return 'md';
      case 'html': return 'html';
      case 'json': return 'json';
      case 'confluence': return 'confluence';
      default: return 'txt';
    }
  }

  private getText(key: string, ...args: string[]): string {
    const texts = this.options.language === 'ja' ? this.getJapaneseTexts() : this.getEnglishTexts();
    let text = texts[key] || key;
    
    // 引数の置換
    args.forEach((arg, index) => {
      text = text.replace(`{${index}}`, arg);
    });
    
    return text;
  }

  private getJapaneseTexts(): Record<string, string> {
    return {
      user_story_title: '{0}のユーザーストーリー仕様書',
      business_rules_title: '業務ルール仕様書',
      test_cases_title: 'テストケース仕様書',
      project_overview_title: '{0}プロジェクト概要',
      test_strategy_title: 'テスト戦略書',
      business_context: 'ビジネスコンテキスト',
      domain: 'ドメイン',
      purpose: '目的',
      key_entities: '主要エンティティ',
      user_stories: 'ユーザーストーリー',
      description: '説明',
      business_value: 'ビジネス価値',
      complexity: '複雑度',
      acceptance_criteria: '受け入れ条件',
      related_functions: '関連機能',
      test_scenarios: 'テストシナリオ',
      priority: '優先度',
      overview: '概要',
      business_rules_overview_text: 'このドキュメントは、システムの業務ルールを定義します。',
      overall_complexity: '全体複雑度',
      type: 'タイプ',
      location: '場所',
      code_sample: 'コードサンプル',
      dependencies: '依存関係',
      workflows: 'ワークフロー',
      steps: 'ステップ',
      related_business_rules: '関連業務ルール',
      data_access_patterns: 'データアクセスパターン',
      operation: '操作',
      table: 'テーブル',
      query: 'クエリ',
      test_cases_overview_text: 'このドキュメントには{0}個のテストケースが含まれています。',
      category: 'カテゴリ',
      language: '言語',
      framework: 'フレームワーク',
      business_rule: '業務ルール',
      expected_behavior: '期待動作',
      test_code: 'テストコード',
      test_data: 'テストデータ',
      summary: 'サマリー',
      project_summary_text: 'このドキュメントは、プロジェクトの全体像を示します。',
      statistics: '統計情報',
      complexity_analysis: '複雑度分析',
      complexity_distribution: '複雑度分布',
      low: '低',
      medium: '中',
      high: '高',
      risk_assessment: 'リスク評価',
      high_complexity_rules_warning: '以下の高複雑度ルールには特に注意が必要です：',
      approach: 'アプローチ',
      coverage: 'カバレッジ',
      test_pyramid: 'テストピラミッド',
      unit_tests: 'ユニットテスト',
      integration_tests: '統合テスト',
      business_rule_tests: '業務ルールテスト',
      workflow_tests: 'ワークフローテスト',
      risk_areas: 'リスクエリア'
    };
  }

  private getEnglishTexts(): Record<string, string> {
    return {
      user_story_title: '{0} User Stories Specification',
      business_rules_title: 'Business Rules Specification',
      test_cases_title: 'Test Cases Specification',
      project_overview_title: '{0} Project Overview',
      test_strategy_title: 'Test Strategy Document',
      business_context: 'Business Context',
      domain: 'Domain',
      purpose: 'Purpose',
      key_entities: 'Key Entities',
      user_stories: 'User Stories',
      description: 'Description',
      business_value: 'Business Value',
      complexity: 'Complexity',
      acceptance_criteria: 'Acceptance Criteria',
      related_functions: 'Related Functions',
      test_scenarios: 'Test Scenarios',
      priority: 'Priority',
      overview: 'Overview',
      business_rules_overview_text: 'This document defines the business rules of the system.',
      overall_complexity: 'Overall Complexity',
      type: 'Type',
      location: 'Location',
      code_sample: 'Code Sample',
      dependencies: 'Dependencies',
      workflows: 'Workflows',
      steps: 'Steps',
      related_business_rules: 'Related Business Rules',
      data_access_patterns: 'Data Access Patterns',
      operation: 'Operation',
      table: 'Table',
      query: 'Query',
      test_cases_overview_text: 'This document contains {0} test cases.',
      category: 'Category',
      language: 'Language',
      framework: 'Framework',
      business_rule: 'Business Rule',
      expected_behavior: 'Expected Behavior',
      test_code: 'Test Code',
      test_data: 'Test Data',
      summary: 'Summary',
      project_summary_text: 'This document provides an overview of the project.',
      statistics: 'Statistics',
      complexity_analysis: 'Complexity Analysis',
      complexity_distribution: 'Complexity Distribution',
      low: 'Low',
      medium: 'Medium',
      high: 'High',
      risk_assessment: 'Risk Assessment',
      high_complexity_rules_warning: 'The following high-complexity rules require special attention:',
      approach: 'Approach',
      coverage: 'Coverage',
      test_pyramid: 'Test Pyramid',
      unit_tests: 'Unit Tests',
      integration_tests: 'Integration Tests',
      business_rule_tests: 'Business Rule Tests',
      workflow_tests: 'Workflow Tests',
      risk_areas: 'Risk Areas'
    };
  }

  private groupRulesByType(rules: any[]): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    
    for (const rule of rules) {
      if (!grouped[rule.type]) {
        grouped[rule.type] = [];
      }
      grouped[rule.type].push(rule);
    }
    
    return grouped;
  }

  private getTypeDisplayName(type: string): string {
    const displayNames = this.options.language === 'ja' ? {
      validation: 'バリデーションルール',
      calculation: '計算ルール',
      constraint: '制約ルール',
      workflow: 'ワークフロールール',
      transformation: '変換ルール'
    } : {
      validation: 'Validation Rules',
      calculation: 'Calculation Rules',
      constraint: 'Constraint Rules',
      workflow: 'Workflow Rules',
      transformation: 'Transformation Rules'
    };
    
    return displayNames[type as keyof typeof displayNames] || type;
  }

  private groupTestsByCategory(testCases: GeneratedTestCase[]): Record<string, GeneratedTestCase[]> {
    const grouped: Record<string, GeneratedTestCase[]> = {};
    
    for (const test of testCases) {
      if (!grouped[test.category]) {
        grouped[test.category] = [];
      }
      grouped[test.category].push(test);
    }
    
    return grouped;
  }

  private getCategoryDisplayName(category: string): string {
    const displayNames = this.options.language === 'ja' ? {
      unit: 'ユニットテスト',
      integration: '統合テスト',
      business_rule: '業務ルールテスト',
      workflow: 'ワークフローテスト'
    } : {
      unit: 'Unit Tests',
      integration: 'Integration Tests',
      business_rule: 'Business Rule Tests',
      workflow: 'Workflow Tests'
    };
    
    return displayNames[category as keyof typeof displayNames] || category;
  }

  private analyzeComplexityDistribution(rules: any[]): { low: number; medium: number; high: number } {
    const distribution = { low: 0, medium: 0, high: 0 };
    
    for (const rule of rules) {
      distribution[rule.complexity as keyof typeof distribution]++;
    }
    
    return distribution;
  }

  private analyzeTestDistribution(testCases: GeneratedTestCase[]): Record<string, number> {
    const distribution: Record<string, number> = {
      unit: 0,
      integration: 0,
      business_rule: 0,
      workflow: 0
    };
    
    for (const test of testCases) {
      distribution[test.category]++;
    }
    
    return distribution;
  }

  private convertMarkdownToHTML(markdown: string): string {
    // 簡易的なMarkdown→HTML変換
    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Documentation</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 40px; }
        h1, h2, h3 { color: #333; }
        code { background: #f4f4f4; padding: 2px 4px; }
        pre { background: #f4f4f4; padding: 10px; overflow-x: auto; }
    </style>
</head>
<body>
${markdown
  .replace(/^# (.+)$/gm, '<h1>$1</h1>')
  .replace(/^## (.+)$/gm, '<h2>$1</h2>')
  .replace(/^### (.+)$/gm, '<h3>$1</h3>')
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/\*(.+?)\*/g, '<em>$1</em>')
  .replace(/^- (.+)$/gm, '<li>$1</li>')
  .replace(/\n\n/g, '</p><p>')
  .replace(/^(.+)$/gm, '<p>$1</p>')}
</body>
</html>`;
  }

  private convertMarkdownToConfluence(markdown: string): string {
    // 簡易的なMarkdown→Confluence記法変換
    return markdown
      .replace(/^# (.+)$/gm, 'h1. $1')
      .replace(/^## (.+)$/gm, 'h2. $1')
      .replace(/^### (.+)$/gm, 'h3. $1')
      .replace(/\*\*(.+?)\*\*/g, '*$1*')
      .replace(/\*(.+?)\*/g, '_$1_')
      .replace(/```(\w+)?\n([\s\S]*?)```/g, '{code:$1}\n$2\n{code}')
      .replace(/`(.+?)`/g, '{{$1}}');
  }
}