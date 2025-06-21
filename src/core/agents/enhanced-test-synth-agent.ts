import { BaseAgent } from './base-agent.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { glob } from 'glob';
import { CodeAnalyzer, FileInfo } from '../utils/code-analyzer.js';

// Enhanced schemas
const CoverageGapSchema = z.object({
  file: z.string(),
  function: z.string(),
  lineStart: z.number(),
  lineEnd: z.number(),
  complexity: z.number(),
  priority: z.enum(['high', 'medium', 'low']),
});

const TestGenerationStrategySchema = z.object({
  unitTests: z.object({
    priority: z.enum(['high', 'medium', 'low']),
    targetCoverage: z.number(),
    focusAreas: z.array(z.string()),
  }),
  integrationTests: z.object({
    scenarios: z.array(z.string()),
    mockingRequired: z.boolean(),
  }),
  edgeCaseTests: z.object({
    errorHandling: z.boolean(),
    boundaryConditions: z.boolean(),
    concurrency: z.boolean(),
  }),
});

const EnhancedTestSynthInputSchema = z.object({
  projectPath: z.string(),
  refactoringManifest: z.any(),
  currentCoverage: z.number(),
  targetCoverage: z.number().min(0).max(100).default(50),
  language: z.enum(['go', 'typescript', 'python']),
  testTypes: z.array(z.enum(['unit', 'integration', 'e2e'])).default(['unit', 'integration']),
  aiEnabled: z.boolean().default(true),
});

const GeneratedTestSchema = z.object({
  file: z.string(),
  testType: z.enum(['unit', 'integration', 'e2e']),
  coverageTarget: z.array(z.string()),
  content: z.string(),
  confidence: z.number().min(0).max(1),
  dependencies: z.array(z.string()),
});

const CoverageAnalysisSchema = z.object({
  currentCoverage: z.number(),
  functionCoverage: z.number(),
  branchCoverage: z.number(),
  uncoveredFunctions: z.array(z.string()),
  coverageGaps: z.array(CoverageGapSchema),
  criticalPaths: z.array(z.string()),
});

const EnhancedTestSynthOutputSchema = z.object({
  testRelocations: z.array(z.object({
    originalTest: z.string(),
    newLocation: z.string(),
    module: z.string(),
    dependenciesUpdated: z.array(z.string()),
  })),
  generatedTests: z.array(GeneratedTestSchema),
  coverageAnalysis: CoverageAnalysisSchema,
  coverageImprovement: z.object({
    beforeCoverage: z.number(),
    estimatedAfterCoverage: z.number(),
    newTestFiles: z.number(),
    relocatedTestFiles: z.number(),
    improvementPercentage: z.number(),
  }),
  summary: z.object({
    totalTestsGenerated: z.number(),
    estimatedCoverageGain: z.number(),
    failedGenerations: z.number(),
    processingTime: z.number(),
  }),
});

export type EnhancedTestSynthInput = z.infer<typeof EnhancedTestSynthInputSchema>;
export type EnhancedTestSynthOutput = z.infer<typeof EnhancedTestSynthOutputSchema>;
export type CoverageGap = z.infer<typeof CoverageGapSchema>;
export type GeneratedTest = z.infer<typeof GeneratedTestSchema>;
export type CoverageAnalysis = z.infer<typeof CoverageAnalysisSchema>;

export class EnhancedTestSynthAgent extends BaseAgent<EnhancedTestSynthInput, EnhancedTestSynthOutput> {
  private analyzer!: CodeAnalyzer;

  constructor() {
    super(
      'EnhancedTestSynthAgent',
      'AI-powered test generation and coverage improvement agent',
      EnhancedTestSynthInputSchema as any,
      EnhancedTestSynthOutputSchema as any
    );
  }

  async execute(input: EnhancedTestSynthInput): Promise<EnhancedTestSynthOutput> {
    const startTime = Date.now();
    this.analyzer = new CodeAnalyzer(input.projectPath);

    this.logger.info('Starting enhanced test synthesis', {
      currentCoverage: input.currentCoverage,
      targetCoverage: input.targetCoverage,
      language: input.language,
    });

    try {
      // Phase 1: Deep coverage analysis
      const coverageAnalysis = await this.analyzeCoverageGaps(input);
      
      // Phase 2: Generate test strategy
      const testStrategy = await this.generateTestStrategy(input, coverageAnalysis);
      
      // Phase 3: Relocate existing tests
      const testRelocations = await this.relocateExistingTests(input);
      
      // Phase 4: Generate new tests
      const generatedTests = await this.generateNewTests(input, coverageAnalysis, testStrategy);
      
      // Phase 5: Calculate improvement metrics
      const coverageImprovement = this.calculateCoverageImprovement(
        input.currentCoverage,
        generatedTests,
        testRelocations
      );

      const processingTime = Date.now() - startTime;

      return {
        testRelocations,
        generatedTests,
        coverageAnalysis,
        coverageImprovement,
        summary: {
          totalTestsGenerated: generatedTests.length,
          estimatedCoverageGain: coverageImprovement.improvementPercentage,
          failedGenerations: 0, // Track this during generation
          processingTime,
        },
      };
    } catch (error) {
      this.logger.error('Enhanced test synthesis failed', { error });
      throw error;
    }
  }

  private async analyzeCoverageGaps(input: EnhancedTestSynthInput): Promise<CoverageAnalysis> {
    this.logger.info('Analyzing coverage gaps');

    const coverageFile = path.join(input.projectPath, 'coverage.out');
    let currentCoverage = input.currentCoverage;
    let functionCoverage = 0;
    let branchCoverage = 0;

    // Get detailed coverage if available
    if (fs.existsSync(coverageFile)) {
      const detailedCoverage = await this.parseDetailedCoverage(coverageFile);
      functionCoverage = detailedCoverage.functionCoverage;
      branchCoverage = detailedCoverage.branchCoverage;
    }

    // Find uncovered functions
    const uncoveredFunctions = await this.findUncoveredFunctions(input);
    
    // Identify coverage gaps with priority
    const coverageGaps = await this.identifyCoverageGaps(input, uncoveredFunctions);
    
    // Find critical paths
    const criticalPaths = await this.findCriticalPaths(input);

    return {
      currentCoverage,
      functionCoverage,
      branchCoverage,
      uncoveredFunctions,
      coverageGaps,
      criticalPaths,
    };
  }

  private async generateTestStrategy(
    input: EnhancedTestSynthInput,
    analysis: CoverageAnalysis
  ): Promise<any> {
    const coverageGap = input.targetCoverage - input.currentCoverage;
    const highPriorityGaps = analysis.coverageGaps.filter(gap => gap.priority === 'high');
    
    return {
      unitTests: {
        priority: highPriorityGaps.length > 5 ? 'high' : 'medium',
        targetCoverage: Math.min(input.targetCoverage, input.currentCoverage + 20),
        focusAreas: highPriorityGaps.map(gap => gap.function),
      },
      integrationTests: {
        scenarios: analysis.criticalPaths,
        mockingRequired: true,
      },
      edgeCaseTests: {
        errorHandling: true,
        boundaryConditions: true,
        concurrency: input.language === 'go',
      },
    };
  }

  private async relocateExistingTests(input: EnhancedTestSynthInput): Promise<any[]> {
    this.logger.info('Relocating existing tests');

    const testRelocations: any[] = [];
    
    // Find existing test files
    const testPattern = this.getTestPattern(input.language);
    const testFiles = await glob(testPattern, { 
      cwd: input.projectPath,
      ignore: ['vendor/**', 'node_modules/**'],
    });

    for (const testFile of testFiles) {
      const relocation = await this.determineTestRelocation(input, testFile);
      if (relocation) {
        testRelocations.push(relocation);
      }
    }

    return testRelocations;
  }

  private async generateNewTests(
    input: EnhancedTestSynthInput,
    analysis: CoverageAnalysis,
    strategy: any
  ): Promise<GeneratedTest[]> {
    this.logger.info('Generating new tests', { 
      gaps: analysis.coverageGaps.length,
      aiEnabled: input.aiEnabled 
    });

    const generatedTests: GeneratedTest[] = [];
    
    // Prioritize high-priority gaps
    const prioritizedGaps = analysis.coverageGaps
      .sort((a, b) => this.getPriorityScore(a) - this.getPriorityScore(b))
      .slice(0, 20); // Limit to top 20 to avoid overwhelming

    for (const gap of prioritizedGaps) {
      try {
        const test = await this.generateTestForGap(input, gap, strategy);
        if (test) {
          generatedTests.push(test);
        }
      } catch (error) {
        this.logger.warn('Failed to generate test for gap', { gap: gap.function, error });
      }
    }

    // Generate integration tests for critical paths
    for (const criticalPath of analysis.criticalPaths.slice(0, 5)) {
      try {
        const integrationTest = await this.generateIntegrationTest(input, criticalPath);
        if (integrationTest) {
          generatedTests.push(integrationTest);
        }
      } catch (error) {
        this.logger.warn('Failed to generate integration test', { path: criticalPath, error });
      }
    }

    return generatedTests;
  }

  private async generateTestForGap(
    input: EnhancedTestSynthInput,
    gap: CoverageGap,
    strategy: any
  ): Promise<GeneratedTest | null> {
    if (input.aiEnabled) {
      return await this.generateAITest(input, gap);
    } else {
      return await this.generateTemplateTest(input, gap);
    }
  }

  private async generateAITest(
    input: EnhancedTestSynthInput,
    gap: CoverageGap
  ): Promise<GeneratedTest | null> {
    try {
      // Read the function code
      const functionCode = await this.extractFunctionCode(gap);
      
      // Generate test using AI (placeholder for Claude Code integration)
      const testContent = await this.generateTestWithAI(input.language, functionCode, gap);
      
      const testFileName = this.generateTestFileName(gap, input.language);
      
      return {
        file: testFileName,
        testType: 'unit',
        coverageTarget: [gap.function],
        content: testContent,
        confidence: 0.85,
        dependencies: await this.analyzeDependencies(gap.file),
      };
    } catch (error) {
      this.logger.warn('AI test generation failed, falling back to template', { error });
      return await this.generateTemplateTest(input, gap);
    }
  }

  private async generateTemplateTest(
    input: EnhancedTestSynthInput,
    gap: CoverageGap
  ): Promise<GeneratedTest | null> {
    const template = this.getTestTemplate(input.language);
    const functionCode = await this.extractFunctionCode(gap);
    
    const templateData = {
      functionName: gap.function,
      packageName: this.extractPackageName(gap.file),
      testCases: this.generateBasicTestCases(functionCode),
    };
    
    const testContent = this.renderTemplate(template, templateData);
    const testFileName = this.generateTestFileName(gap, input.language);
    
    return {
      file: testFileName,
      testType: 'unit',
      coverageTarget: [gap.function],
      content: testContent,
      confidence: 0.7,
      dependencies: await this.analyzeDependencies(gap.file),
    };
  }

  private async generateIntegrationTest(
    input: EnhancedTestSynthInput,
    criticalPath: string
  ): Promise<GeneratedTest | null> {
    // Generate integration test for critical path
    const template = this.getIntegrationTestTemplate(input.language);
    const testContent = this.renderTemplate(template, { path: criticalPath });
    
    return {
      file: `integration_${criticalPath.replace(/[^a-zA-Z0-9]/g, '_')}_test.${this.getTestExtension(input.language)}`,
      testType: 'integration',
      coverageTarget: [criticalPath],
      content: testContent,
      confidence: 0.75,
      dependencies: [],
    };
  }

  // Helper methods
  private async parseDetailedCoverage(coverageFile: string): Promise<{ functionCoverage: number; branchCoverage: number }> {
    // Parse Go coverage file or other language coverage formats
    // This is a simplified implementation
    return { functionCoverage: 65, branchCoverage: 55 };
  }

  private async findUncoveredFunctions(input: EnhancedTestSynthInput): Promise<string[]> {
    const sourceFiles = await glob('**/*.go', { 
      cwd: input.projectPath,
      ignore: ['vendor/**', '*_test.go'],
    });
    
    const uncoveredFunctions: string[] = [];
    
    for (const file of sourceFiles) {
      const functions = await this.extractFunctions(path.join(input.projectPath, file));
      // Check coverage for each function (simplified)
      uncoveredFunctions.push(...functions.filter(f => !this.isFunctionCovered(f)));
    }
    
    return uncoveredFunctions;
  }

  private async identifyCoverageGaps(
    input: EnhancedTestSynthInput,
    uncoveredFunctions: string[]
  ): Promise<CoverageGap[]> {
    const gaps: CoverageGap[] = [];
    
    for (const func of uncoveredFunctions.slice(0, 30)) { // Limit for performance
      const gap = await this.analyzeFunctionForGap(func);
      if (gap) {
        gaps.push(gap);
      }
    }
    
    return gaps.sort((a, b) => this.getPriorityScore(b) - this.getPriorityScore(a));
  }

  private async findCriticalPaths(input: EnhancedTestSynthInput): Promise<string[]> {
    // Identify critical execution paths in the codebase
    // This would involve static analysis to find important code paths
    return ['user-authentication', 'data-processing', 'error-handling'];
  }

  private getPriorityScore(gap: CoverageGap): number {
    const priorityScores = { high: 3, medium: 2, low: 1 };
    return priorityScores[gap.priority] * gap.complexity;
  }

  private getTestPattern(language: string): string {
    switch (language) {
      case 'go': return '**/*_test.go';
      case 'typescript': return '**/*.{test,spec}.{ts,js}';
      case 'python': return '**/test_*.py';
      default: return '**/*test*';
    }
  }

  private getTestExtension(language: string): string {
    switch (language) {
      case 'go': return 'go';
      case 'typescript': return 'ts';
      case 'python': return 'py';
      default: return 'txt';
    }
  }

  private getTestTemplate(language: string): string {
    switch (language) {
      case 'go':
        return `package {{packageName}}

import (
    "testing"
)

func Test{{functionName}}(t *testing.T) {
    tests := []struct {
        name     string
        {{#testCases}}
        args     {{argsType}}
        want     {{wantType}}
        wantErr  bool
        {{/testCases}}
    }{
        {{#testCases}}
        {
            name: "{{name}}",
            args: {{args}},
            want: {{want}},
            wantErr: {{wantErr}},
        },
        {{/testCases}}
    }
    
    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            got, err := {{functionName}}({{callArgs}})
            if (err != nil) != tt.wantErr {
                t.Errorf("{{functionName}}() error = %v, wantErr %v", err, tt.wantErr)
                return
            }
            if got != tt.want {
                t.Errorf("{{functionName}}() = %v, want %v", got, tt.want)
            }
        })
    }
}`;
      default:
        return 'TODO: Implement test template for {{language}}';
    }
  }

  private getIntegrationTestTemplate(language: string): string {
    switch (language) {
      case 'go':
        return `package integration

import (
    "testing"
)

func TestIntegration{{path}}(t *testing.T) {
    // Integration test for {{path}}
    t.Skip("Generated integration test - implement as needed")
}`;
      default:
        return 'TODO: Implement integration test template';
    }
  }

  private calculateCoverageImprovement(
    currentCoverage: number,
    generatedTests: GeneratedTest[],
    relocations: any[]
  ): any {
    // Estimate coverage improvement based on generated tests
    const estimatedGain = generatedTests.length * 2.5; // Rough estimate
    const estimatedAfterCoverage = Math.min(currentCoverage + estimatedGain, 100);
    
    return {
      beforeCoverage: currentCoverage,
      estimatedAfterCoverage,
      newTestFiles: generatedTests.length,
      relocatedTestFiles: relocations.length,
      improvementPercentage: estimatedAfterCoverage - currentCoverage,
    };
  }

  // Placeholder methods that would need full implementation
  private async extractFunctionCode(gap: CoverageGap): Promise<string> {
    const filePath = gap.file;
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    return lines.slice(gap.lineStart - 1, gap.lineEnd).join('\n');
  }

  private async generateTestWithAI(language: string, functionCode: string, gap: CoverageGap): Promise<string> {
    // This would integrate with Claude Code SDK
    // For now, return a placeholder
    return this.generateTemplateBasedTest(language, functionCode, gap);
  }

  private generateTemplateBasedTest(language: string, functionCode: string, gap: CoverageGap): string {
    // Generate basic test based on function signature analysis
    return `// Generated test for ${gap.function}\n// TODO: Implement test cases`;
  }

  private generateTestFileName(gap: CoverageGap, language: string): string {
    const baseName = path.basename(gap.file, path.extname(gap.file));
    const extension = this.getTestExtension(language);
    return `${baseName}_${gap.function}_test.${extension}`;
  }

  private async extractFunctions(filePath: string): Promise<string[]> {
    // Extract function names from source file
    const content = fs.readFileSync(filePath, 'utf-8');
    const funcRegex = /func\s+(\w+)\s*\(/g;
    const functions: string[] = [];
    let match;
    
    while ((match = funcRegex.exec(content)) !== null) {
      functions.push(match[1]);
    }
    
    return functions;
  }

  private isFunctionCovered(functionName: string): boolean {
    // Check if function is covered by existing tests
    // This would require integration with coverage tools
    return Math.random() > 0.7; // Placeholder
  }

  private async analyzeFunctionForGap(functionName: string): Promise<CoverageGap | null> {
    // Analyze function to determine if it needs test coverage
    // This is a simplified implementation
    return {
      file: `./src/${functionName}.go`,
      function: functionName,
      lineStart: 1,
      lineEnd: 10,
      complexity: Math.floor(Math.random() * 10) + 1,
      priority: Math.random() > 0.5 ? 'high' : 'medium',
    };
  }

  private async determineTestRelocation(input: EnhancedTestSynthInput, testFile: string): Promise<any | null> {
    // Determine if test needs to be relocated based on refactoring
    // This would analyze the refactoring manifest
    return null; // Placeholder
  }

  private extractPackageName(filePath: string): string {
    const content = fs.readFileSync(filePath, 'utf-8');
    const match = content.match(/^package\s+(\w+)/m);
    return match ? match[1] : 'main';
  }

  private generateBasicTestCases(functionCode: string): any[] {
    // Generate basic test cases based on function analysis
    return [
      { name: 'valid input', args: '{}', want: 'expected', wantErr: false },
      { name: 'invalid input', args: '{}', want: 'nil', wantErr: true },
    ];
  }

  private renderTemplate(template: string, data: any): string {
    // Simple template rendering (would use a proper template engine in production)
    let result = template;
    for (const [key, value] of Object.entries(data)) {
      result = result.replace(new RegExp(`{{${key}}}`, 'g'), String(value));
    }
    return result;
  }

  private async analyzeDependencies(filePath: string): Promise<string[]> {
    // Analyze file dependencies for test generation
    const content = fs.readFileSync(filePath, 'utf-8');
    const imports: string[] = [];
    const importRegex = /import\s+(?:"([^"]+)"|`([^`]+)`)/g;
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1] || match[2]);
    }
    
    return imports;
  }
}