import { BaseAgent } from './base-agent.js';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { RefactorPlan, RefactorPatch } from './refactor-agent.js';
import { BuildFixerAgent, BuildError } from './build-fixer-agent.js';
import { MigrationRunner, BuildResult, TestResult } from './migration-runner.js';

const RefactoringStageSchema = z.object({
  id: z.number(),
  name: z.string(),
  patches: z.array(z.any()), // RefactorPatch schema
  dependencies: z.array(z.number()),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
  rollbackStrategy: z.enum(['abort', 'skip', 'retry']),
});

const StageExecutionResultSchema = z.object({
  stage: RefactoringStageSchema,
  applied: z.array(z.any()),
  failed: z.array(z.any()),
  buildResult: z.any(), // BuildResult schema
  testResult: z.any(), // TestResult schema
  fixResult: z.any().optional(),
  decision: z.enum(['continue', 'retry', 'skip', 'abort']),
  processingTime: z.number(),
});

const IncrementalMigrationInputSchema = z.object({
  projectPath: z.string(),
  refactorPlanPath: z.string(),
  config: z.object({
    maxStageSize: z.number().min(1).default(5),
    maxRetries: z.number().min(0).default(2),
    buildTimeout: z.number().min(1000).default(120000),
    testTimeout: z.number().min(1000).default(300000),
    continueOnNonCriticalFailure: z.boolean().default(true),
    generateProgressReport: z.boolean().default(true),
    createStageBackups: z.boolean().default(true),
  }),
  resumeFromStage: z.number().optional(),
  skipStages: z.array(z.number()).default([]),
});

const IncrementalMigrationOutputSchema = z.object({
  stages: z.array(RefactoringStageSchema),
  stageResults: z.array(StageExecutionResultSchema),
  summary: z.object({
    totalStages: z.number(),
    successfulStages: z.number(),
    failedStages: z.number(),
    skippedStages: z.number(),
    totalPatches: z.number(),
    appliedPatches: z.number(),
    finalBuildSuccess: z.boolean(),
    finalTestSuccess: z.boolean(),
    processingTime: z.number(),
  }),
  recommendations: z.array(z.string()),
});

export type RefactoringStage = z.infer<typeof RefactoringStageSchema>;
export type StageExecutionResult = z.infer<typeof StageExecutionResultSchema>;
export type IncrementalMigrationInput = z.infer<typeof IncrementalMigrationInputSchema>;
export type IncrementalMigrationOutput = z.infer<typeof IncrementalMigrationOutputSchema>;

export class IncrementalMigrationRunner extends BaseAgent<IncrementalMigrationInput, IncrementalMigrationOutput> {
  private buildFixer: BuildFixerAgent;
  private migrationRunner?: MigrationRunner;

  constructor() {
    super(
      'IncrementalMigrationRunner',
      'Executes refactoring in incremental stages with risk mitigation',
      IncrementalMigrationInputSchema as any,
      IncrementalMigrationOutputSchema as any
    );
    
    this.buildFixer = new BuildFixerAgent();
  }

  async execute(input: IncrementalMigrationInput): Promise<IncrementalMigrationOutput> {
    const startTime = Date.now();
    
    this.logger.info('Starting incremental migration', {
      projectPath: input.projectPath,
      maxStageSize: input.config.maxStageSize,
      resumeFromStage: input.resumeFromStage,
    });

    try {
      // Phase 1: Load and analyze refactor plan
      const refactorPlan = this.loadRefactorPlan(input.refactorPlanPath);
      this.logger.info('Loaded refactor plan', { totalPatches: refactorPlan.patches.length });

      // Phase 2: Create stages from patches
      const stages = await this.createStages(refactorPlan, input.config);
      this.logger.info('Created execution stages', { totalStages: stages.length });

      // Phase 3: Execute stages incrementally
      const stageResults = await this.executeStages(input, stages);

      // Phase 4: Generate summary and recommendations
      const summary = this.generateSummary(stages, stageResults, Date.now() - startTime);
      const recommendations = this.generateRecommendations(stageResults);

      return {
        stages,
        stageResults,
        summary,
        recommendations,
      };
    } catch (error) {
      this.logger.error('Incremental migration failed', { error });
      throw error;
    }
  }

  private loadRefactorPlan(planPath: string): RefactorPlan {
    if (!fs.existsSync(planPath)) {
      throw new Error(`Refactor plan not found: ${planPath}`);
    }
    
    const content = fs.readFileSync(planPath, 'utf8');
    return JSON.parse(content);
  }

  private async createStages(
    refactorPlan: RefactorPlan,
    config: any
  ): Promise<RefactoringStage[]> {
    this.logger.info('Creating refactoring stages');

    // Analyze patch dependencies and risks
    const patchAnalysis = await this.analyzePatchDependencies(refactorPlan.patches);
    
    // Create stages based on dependency analysis and risk assessment
    const stages: RefactoringStage[] = [];
    
    // Stage 1: Foundation (Critical)
    const foundationPatches = this.filterPatchesByType(refactorPlan.patches, ['create_directory', 'create_module']);
    if (foundationPatches.length > 0) {
      stages.push({
        id: 1,
        name: 'Foundation Setup',
        patches: foundationPatches,
        dependencies: [],
        priority: 'critical',
        rollbackStrategy: 'abort',
      });
    }

    // Stage 2: Entity Creation (High Priority)
    const entityPatches = this.filterPatchesByPattern(refactorPlan.patches, /entity|domain/i);
    if (entityPatches.length > 0) {
      stages.push({
        id: 2,
        name: 'Domain Entity Creation',
        patches: entityPatches,
        dependencies: foundationPatches.length > 0 ? [1] : [],
        priority: 'high',
        rollbackStrategy: 'retry',
      });
    }

    // Stage 3: Repository Layer (High Priority)
    const repoPatches = this.filterPatchesByPattern(refactorPlan.patches, /repository|repo/i);
    if (repoPatches.length > 0) {
      stages.push({
        id: 3,
        name: 'Repository Layer',
        patches: repoPatches,
        dependencies: [1, 2].filter(id => stages.some(s => s.id === id)),
        priority: 'high',
        rollbackStrategy: 'retry',
      });
    }

    // Stage 4: Service Layer (Medium Priority)
    const servicePatches = this.filterPatchesByPattern(refactorPlan.patches, /service|usecase/i);
    if (servicePatches.length > 0) {
      stages.push({
        id: 4,
        name: 'Service Layer',
        patches: servicePatches,
        dependencies: [2, 3].filter(id => stages.some(s => s.id === id)),
        priority: 'medium',
        rollbackStrategy: 'skip',
      });
    }

    // Stage 5: Handler Layer (Medium Priority)
    const handlerPatches = this.filterPatchesByPattern(refactorPlan.patches, /handler|controller/i);
    if (handlerPatches.length > 0) {
      stages.push({
        id: 5,
        name: 'Handler Layer',
        patches: handlerPatches,
        dependencies: [3, 4].filter(id => stages.some(s => s.id === id)),
        priority: 'medium',
        rollbackStrategy: 'skip',
      });
    }

    // Remaining patches in smaller batches
    const remainingPatches = this.getRemainingPatches(refactorPlan.patches, stages);
    const remainingStages = this.createBatchStages(remainingPatches, config.maxStageSize, stages.length);
    stages.push(...remainingStages);

    return stages;
  }

  private async executeStages(
    input: IncrementalMigrationInput,
    stages: RefactoringStage[]
  ): Promise<StageExecutionResult[]> {
    const results: StageExecutionResult[] = [];
    
    const startFromStage = input.resumeFromStage || 1;
    const skipStages = new Set(input.skipStages);

    for (const stage of stages) {
      if (stage.id < startFromStage) {
        this.logger.info(`Skipping stage ${stage.id} (resuming from ${startFromStage})`);
        continue;
      }

      if (skipStages.has(stage.id)) {
        this.logger.info(`Skipping stage ${stage.id} (user requested)`);
        results.push(this.createSkippedResult(stage));
        continue;
      }

      // Check dependencies
      const missingDeps = this.checkStageDependencies(stage, results);
      if (missingDeps.length > 0) {
        this.logger.warn(`Stage ${stage.id} dependencies not met`, { missingDeps });
        results.push(this.createFailedResult(stage, 'Dependencies not met'));
        
        if (stage.priority === 'critical') {
          this.logger.error('Critical stage failed, aborting');
          break;
        }
        continue;
      }

      const result = await this.executeStage(input, stage);
      results.push(result);

      // Decide whether to continue based on stage result
      if (result.decision === 'abort') {
        this.logger.error(`Stage ${stage.id} aborted, stopping execution`);
        break;
      }

      if (result.decision === 'retry' && stage.rollbackStrategy === 'retry') {
        this.logger.info(`Retrying stage ${stage.id}`);
        // Implement retry logic here
      }
    }

    return results;
  }

  private async executeStage(
    input: IncrementalMigrationInput,
    stage: RefactoringStage
  ): Promise<StageExecutionResult> {
    const stageStartTime = Date.now();
    
    this.logger.info(`Executing stage ${stage.id}: ${stage.name}`, {
      patchCount: stage.patches.length,
      priority: stage.priority,
    });

    try {
      // Create stage backup if configured
      let backupCommit: string | undefined;
      if (input.config.createStageBackups) {
        backupCommit = await this.createStageBackup(input.projectPath, stage.id);
      }

      // Apply patches in this stage
      const { applied, failed } = await this.applyStagePatches(input.projectPath, stage.patches);

      // Run build
      const buildResult = await this.runBuild(input.projectPath, input.config.buildTimeout);
      
      let fixResult;
      
      // If build failed, attempt fixes
      if (!buildResult.success) {
        this.logger.info('Build failed, attempting fixes');
        fixResult = await this.attemptBuildFix(input.projectPath, buildResult, stage);
        
        // Re-run build after fixes
        if (fixResult && fixResult.buildResult.success) {
          buildResult.success = true;
          buildResult.errors = [];
        }
      }

      // Run tests if build succeeded
      let testResult: TestResult | undefined;
      if (buildResult.success) {
        testResult = await this.runTests(input.projectPath, input.config.testTimeout);
      }

      // Make decision based on results
      const decision = this.makeStageDecision(stage, buildResult, testResult, input.config);

      return {
        stage,
        applied,
        failed,
        buildResult,
        testResult,
        fixResult,
        decision,
        processingTime: Date.now() - stageStartTime,
      };
    } catch (error) {
      this.logger.error(`Stage ${stage.id} execution failed`, { error });
      
      return {
        stage,
        applied: [],
        failed: stage.patches,
        buildResult: { success: false, errors: [String(error)], warnings: [], duration_ms: 0 },
        testResult: undefined,
        decision: stage.priority === 'critical' ? 'abort' : 'skip',
        processingTime: Date.now() - stageStartTime,
      };
    }
  }

  private makeStageDecision(
    stage: RefactoringStage,
    buildResult: BuildResult,
    testResult?: TestResult,
    config?: any
  ): 'continue' | 'retry' | 'skip' | 'abort' {
    // Critical stages must succeed
    if (stage.priority === 'critical') {
      if (!buildResult.success) {
        return 'abort';
      }
      return 'continue';
    }

    // High priority stages - retry if configured
    if (stage.priority === 'high') {
      if (!buildResult.success) {
        return stage.rollbackStrategy === 'retry' ? 'retry' : 'skip';
      }
      return 'continue';
    }

    // Medium/Low priority stages - skip on failure if configured
    if (!buildResult.success && config?.continueOnNonCriticalFailure) {
      return 'skip';
    }

    return buildResult.success ? 'continue' : 'skip';
  }

  private async applyStagePatches(
    projectPath: string,
    patches: RefactorPatch[]
  ): Promise<{ applied: RefactorPatch[]; failed: RefactorPatch[] }> {
    const applied: RefactorPatch[] = [];
    const failed: RefactorPatch[] = [];

    for (const patch of patches) {
      try {
        await this.applyPatch(projectPath, patch);
        applied.push(patch);
        this.logger.info(`Applied patch: ${patch.id}`);
      } catch (error) {
        this.logger.warn(`Failed to apply patch: ${patch.id}`, { error });
        failed.push(patch);
      }
    }

    return { applied, failed };
  }

  private async applyPatch(projectPath: string, patch: RefactorPatch): Promise<void> {
    // This is a simplified implementation
    // Real implementation would handle different patch types
    this.logger.debug(`Applying patch ${patch.id} to ${patch.target_file}`);
    
    // Create directories if needed
    const targetDir = path.dirname(path.join(projectPath, patch.target_file));
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Apply patch content based on changes
    for (const change of patch.changes) {
      if (change.type === 'create') {
        fs.writeFileSync(path.join(projectPath, change.target_path), change.content || '');
      } else if (change.type === 'modify') {
        // Handle modification
        if (fs.existsSync(path.join(projectPath, change.target_path))) {
          const currentContent = fs.readFileSync(path.join(projectPath, change.target_path), 'utf-8');
          const modifiedContent = change.content || currentContent;
          fs.writeFileSync(path.join(projectPath, change.target_path), modifiedContent);
        }
      }
    }
  }

  private async runBuild(projectPath: string, timeout: number): Promise<BuildResult> {
    this.logger.info('Running build');
    
    const startTime = Date.now();
    
    try {
      const result = execSync('go build ./...', {
        cwd: projectPath,
        timeout,
        encoding: 'utf-8',
      });
      
      return {
        success: true,
        errors: [],
        warnings: [],
        duration_ms: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        errors: [error.message || 'Build failed'],
        warnings: [],
        duration_ms: Date.now() - startTime,
      };
    }
  }

  private async runTests(projectPath: string, timeout: number): Promise<TestResult> {
    this.logger.info('Running tests');
    
    const startTime = Date.now();
    
    try {
      const result = execSync('go test ./...', {
        cwd: projectPath,
        timeout,
        encoding: 'utf-8',
      });
      
      return {
        success: true,
        total_tests: 0, // Parse from output
        passed_tests: 0,
        failed_tests: 0,
        duration_ms: Date.now() - startTime,
      };
    } catch (error: any) {
      return {
        success: false,
        total_tests: 0,
        passed_tests: 0,
        failed_tests: 0,
        duration_ms: Date.now() - startTime,
      };
    }
  }

  private async attemptBuildFix(
    projectPath: string,
    buildResult: BuildResult,
    stage: RefactoringStage
  ): Promise<any> {
    const buildErrors = this.convertToBuildErrors(buildResult.errors, buildResult.errors.join('\n'));
    
    return await this.buildFixer.run({
      projectPath,
      buildErrors,
      refactoringManifest: { stage: stage.name },
      language: 'go',
    });
  }

  private convertToBuildErrors(errors: string[], stderr: string): BuildError[] {
    return errors.map((error, index) => ({
      file: 'unknown',
      line: 1,
      column: 1,
      type: 'syntax' as const,
      message: error,
      context: error,
    }));
  }

  private async createStageBackup(projectPath: string, stageId: number): Promise<string> {
    const branchName = `vibeflow-stage-${stageId}-backup`;
    
    try {
      execSync(`git checkout -b ${branchName}`, { cwd: projectPath });
      execSync('git checkout -', { cwd: projectPath }); // Switch back
      
      const commitHash = execSync('git rev-parse HEAD', { 
        cwd: projectPath,
        encoding: 'utf8' 
      }).trim();
      
      this.logger.info(`Created stage backup: ${branchName}`);
      return commitHash;
    } catch (error) {
      this.logger.warn('Failed to create stage backup', { error });
      return '';
    }
  }

  // Helper methods for stage creation
  private analyzePatchDependencies(patches: RefactorPatch[]): any {
    // Analyze patch dependencies
    return {};
  }

  private filterPatchesByType(patches: RefactorPatch[], types: string[]): RefactorPatch[] {
    return patches.filter(patch => 
      patch.changes.some(change => types.includes(change.type))
    );
  }

  private filterPatchesByPattern(patches: RefactorPatch[], pattern: RegExp): RefactorPatch[] {
    return patches.filter(patch => 
      pattern.test(patch.target_file) || pattern.test(patch.id) ||
      patch.changes.some(change => pattern.test(change.target_path))
    );
  }

  private getRemainingPatches(patches: RefactorPatch[], stages: RefactoringStage[]): RefactorPatch[] {
    const usedPatches = new Set(stages.flatMap(s => s.patches.map(p => p.id)));
    return patches.filter(patch => !usedPatches.has(patch.id));
  }

  private createBatchStages(
    patches: RefactorPatch[],
    maxStageSize: number,
    startId: number
  ): RefactoringStage[] {
    const stages: RefactoringStage[] = [];
    
    for (let i = 0; i < patches.length; i += maxStageSize) {
      const batch = patches.slice(i, i + maxStageSize);
      stages.push({
        id: startId + Math.floor(i / maxStageSize) + 1,
        name: `Batch ${Math.floor(i / maxStageSize) + 1}`,
        patches: batch,
        dependencies: [],
        priority: 'low',
        rollbackStrategy: 'skip',
      });
    }
    
    return stages;
  }

  private checkStageDependencies(stage: RefactoringStage, results: StageExecutionResult[]): number[] {
    const completedStages = new Set(
      results
        .filter(r => r.decision === 'continue')
        .map(r => r.stage.id)
    );
    
    return stage.dependencies.filter(depId => !completedStages.has(depId));
  }

  private createSkippedResult(stage: RefactoringStage): StageExecutionResult {
    return {
      stage,
      applied: [],
      failed: [],
      buildResult: { success: true, errors: [], warnings: ['Stage skipped'], duration_ms: 0 },
      testResult: undefined,
      decision: 'skip',
      processingTime: 0,
    };
  }

  private createFailedResult(stage: RefactoringStage, reason: string): StageExecutionResult {
    return {
      stage,
      applied: [],
      failed: stage.patches,
      buildResult: { success: false, errors: [reason], warnings: [], duration_ms: 0 },
      testResult: undefined,
      decision: stage.priority === 'critical' ? 'abort' : 'skip',
      processingTime: 0,
    };
  }

  private generateSummary(
    stages: RefactoringStage[],
    results: StageExecutionResult[],
    processingTime: number
  ): any {
    const successfulStages = results.filter(r => r.decision === 'continue').length;
    const failedStages = results.filter(r => r.decision === 'abort').length;
    const skippedStages = results.filter(r => r.decision === 'skip').length;
    
    const totalPatches = stages.reduce((sum, stage) => sum + stage.patches.length, 0);
    const appliedPatches = results.reduce((sum, result) => sum + result.applied.length, 0);
    
    const lastResult = results[results.length - 1];
    const finalBuildSuccess = lastResult?.buildResult?.success || false;
    const finalTestSuccess = lastResult?.testResult?.success || false;

    return {
      totalStages: stages.length,
      successfulStages,
      failedStages,
      skippedStages,
      totalPatches,
      appliedPatches,
      finalBuildSuccess,
      finalTestSuccess,
      processingTime,
    };
  }

  private generateRecommendations(results: StageExecutionResult[]): string[] {
    const recommendations: string[] = [];
    
    const failedResults = results.filter(r => r.decision === 'abort' || (r.failed.length > 0));
    
    if (failedResults.length > 0) {
      recommendations.push('Review failed stages and consider manual intervention');
      
      for (const result of failedResults) {
        if (result.buildResult && !result.buildResult.success) {
          recommendations.push(`Stage ${result.stage.id}: Fix build errors - ${result.buildResult.errors.join(', ')}`);
        }
      }
    }

    const skippedResults = results.filter(r => r.decision === 'skip');
    if (skippedResults.length > 0) {
      recommendations.push(`${skippedResults.length} stages were skipped - consider manual completion`);
    }

    if (results.some(r => r.fixResult)) {
      recommendations.push('Build fixes were applied automatically - review changes');
    }

    return recommendations;
  }
}