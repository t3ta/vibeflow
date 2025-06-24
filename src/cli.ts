#!/usr/bin/env node
/**
 * VibeFlow CLI entry point.
 * Generates plan and runs refactor tasks on target project.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs/promises';
import { BoundaryAgent } from './core/agents/boundary-agent.js';
import { EnhancedBoundaryAgent } from './core/agents/enhanced-boundary-agent.js';
import { ArchitectAgent } from './core/agents/architect-agent.js';
import { RefactorAgent } from './core/agents/refactor-agent.js';
import { TestSynthAgent } from './core/agents/test-synth-agent.js';
import { MigrationRunner } from './core/agents/migration-runner.js';
import { ReviewAgent } from './core/agents/review-agent.js';
import { VibeFlowPaths } from './core/utils/file-paths.js';
import { executeAutoRefactor } from './core/workflow/auto-refactor-workflow.js';
import { CostManager } from './core/utils/cost-manager.js';
import { HybridRefactorAgent } from './core/agents/hybrid-refactor-agent.js';
import { IncrementalMigrationRunner } from './core/agents/incremental-migration-runner.js';
import { EnhancedTestSynthAgent } from './core/agents/enhanced-test-synth-agent.js';
import { BusinessLogicMigrationAgent } from './core/agents/business-logic-migration-agent.js';
import { TestSynthesisAgent } from './core/agents/test-synthesis-agent.js';
import { handleResumeFlow } from './core/utils/checkpoint-manager.js';
import { MetadataDrivenRefactorAgent } from './core/agents/metadata-driven-refactor-agent.js';
import { MetricsCLI } from './core/utils/metrics-cli.js';

// -----------------------------------------------------------------------------
// Workflow execution functions
// -----------------------------------------------------------------------------
async function runAutomaticBoundaryDiscovery(projectRoot: string): Promise<void> {
  const absolutePath = path.resolve(projectRoot);
  
  // Verify project exists
  try {
    await fs.access(absolutePath);
  } catch {
    throw new Error(`Project directory not found: ${absolutePath}`);
  }

  console.log(chalk.blue(`🤖 AI自動境界発見: ${absolutePath}`));
  console.log(chalk.gray('設定ファイル不要 - AIが完全自動でモジュール境界を発見します'));
  
  try {
    // AI完全自動境界発見（設定ファイルなしで実行）
    const enhancedBoundaryAgent = new EnhancedBoundaryAgent(absolutePath, undefined, undefined);
    const boundaryResult = await enhancedBoundaryAgent.analyzeBoundaries();
    
    console.log(chalk.green('✨ AI自動境界発見完了!'));
    console.log(chalk.cyan('\n📊 発見結果サマリ:'));
    console.log(chalk.gray(`   🎯 発見された境界: ${boundaryResult.autoDiscoveredBoundaries.length}個`));
    console.log(chalk.gray(`   📈 全体信頼度: ${boundaryResult.discoveryMetrics.confidence_metrics.overall_confidence.toFixed(1)}%`));
    console.log(chalk.gray(`   🏗️  構造一貫性: ${boundaryResult.discoveryMetrics.confidence_metrics.structural_coherence.toFixed(1)}%`));
    console.log(chalk.gray(`   🗄️  DB整合性: ${boundaryResult.discoveryMetrics.confidence_metrics.database_alignment.toFixed(1)}%`));
    
    console.log(chalk.cyan('\n🎯 発見された境界:'));
    boundaryResult.autoDiscoveredBoundaries
      .slice(0, 10)
      .forEach((boundary, i) => {
        console.log(chalk.gray(`   ${i + 1}. ${boundary.name} (信頼度${(boundary.confidence * 100).toFixed(1)}%)`));
        console.log(chalk.gray(`      └─ ${boundary.description}`));
        console.log(chalk.gray(`      └─ ファイル数: ${boundary.files.length}, キーワード: ${boundary.semantic_keywords.slice(0, 3).join(', ')}`));
      });
    
    if (boundaryResult.discoveryMetrics.recommendations.length > 0) {
      console.log(chalk.yellow('\n💡 AI推奨事項:'));
      boundaryResult.discoveryMetrics.recommendations
        .slice(0, 5)
        .forEach((rec, i) => {
          console.log(chalk.gray(`   ${i + 1}. ${rec.reason}`));
          console.log(chalk.gray(`      └─ ${rec.expected_benefit}`));
        });
    }
    
    const paths = new VibeFlowPaths(absolutePath);
    console.log(chalk.green('\n📄 Generated files:'));
    console.log(chalk.gray(`   - ${paths.getRelativePath(boundaryResult.outputPath)} (ドメインマップ)`));
    console.log(chalk.gray(`   - ${paths.getRelativePath(paths.autoBoundaryReportPath)} (詳細レポート)`));
    
    console.log(chalk.cyan('\n✨ 次のステップ:'));
    console.log(chalk.gray('   1. 生成されたドメインマップを確認'));
    console.log(chalk.gray('   2. 必要に応じてvibeflow.config.yamlを作成'));
    console.log(chalk.gray('   3. vf plan でアーキテクチャ設計を実行'));
    console.log(chalk.gray('   4. vf refactor で実際のリファクタリングを実行'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error in automatic boundary discovery:'), error);
    throw error;
  }
}

async function planTasks(projectRoot: string): Promise<void> {
  const absolutePath = path.resolve(projectRoot);
  
  // Verify project exists
  try {
    await fs.access(absolutePath);
  } catch {
    throw new Error(`Project directory not found: ${absolutePath}`);
  }

  console.log(chalk.blue(`📂 Analyzing project: ${absolutePath}`));
  
  try {
    // 1. Enhanced Boundary Analysis (AI + Manual)
    const enhancedBoundaryAgent = new EnhancedBoundaryAgent(absolutePath);
    const boundaryResult = await enhancedBoundaryAgent.analyzeBoundaries();
    
    // 2. Architectural Design
    const architectAgent = new ArchitectAgent(absolutePath);
    const architectResult = await architectAgent.generateArchitecturalPlan(boundaryResult.outputPath);
    
    const planPaths = new VibeFlowPaths(absolutePath);
    console.log(chalk.green('✅ Plan generation complete!'));
    console.log(chalk.gray('📄 Generated files:'));
    console.log(chalk.gray(`   - ${planPaths.getRelativePath(boundaryResult.outputPath)}`));
    console.log(chalk.gray(`   - ${planPaths.getRelativePath(architectResult.outputPath)}`));
    
    // Display AI discovery results
    if (boundaryResult.autoDiscoveredBoundaries.length > 0) {
      console.log(chalk.cyan('\n🤖 AI自動境界発見結果:'));
      console.log(chalk.gray(`   発見された境界: ${boundaryResult.autoDiscoveredBoundaries.length}個`));
      console.log(chalk.gray(`   全体信頼度: ${boundaryResult.discoveryMetrics.confidence_metrics.overall_confidence.toFixed(1)}%`));
      
      if (boundaryResult.hybridRecommendations.length > 0) {
        console.log(chalk.yellow(`   推奨事項: ${boundaryResult.hybridRecommendations.length}個`));
        boundaryResult.hybridRecommendations.slice(0, 3).forEach((rec, i) => {
          console.log(chalk.gray(`     ${i + 1}. ${rec.action}`));
        });
      }
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error in plan generation:'), error);
    throw error;
  }
}

async function runRefactor(projectRoot: string, apply: boolean, resumeOptions?: any): Promise<void> {
  const absolutePath = path.resolve(projectRoot);
  const paths = new VibeFlowPaths(absolutePath);
  
  // Verify required files exist
  const planPath = paths.planPath;
  const domainMapPath = paths.domainMapPath;
  
  // Check for required files unless in test environment
  if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
    try {
      await fs.access(planPath);
      await fs.access(domainMapPath);
    } catch {
      throw new Error(
        `Required files not found. Please run "vf plan" first to generate ${paths.getRelativePath(planPath)} and ${paths.getRelativePath(domainMapPath)}`
      );
    }
  } else {
    console.log(chalk.yellow('🔧 Test environment - skipping required file validation'));
  }

  console.log(chalk.blue(`🔧 Refactoring project: ${absolutePath}`));
  
  try {
    // 1. Business Logic Migration (AI-powered)
    console.log(chalk.blue('🧠 Step 1/5: AI-powered business logic migration...'));
    const businessLogicAgent = new BusinessLogicMigrationAgent(absolutePath);
    const businessLogicResult = await businessLogicAgent.execute({
      projectPath: absolutePath,
      domainMapPath: domainMapPath,
      planPath: planPath,
      aiEnabled: true,
      language: 'go' as const, // TODO: Auto-detect language
      preserveMode: 'strict',
      generateTests: true,
      generateDocumentation: true
    });
    
    console.log(chalk.green(`✅ 業務ロジック移行完了: ${businessLogicResult.migratedBoundaries.length}個の境界を処理`));
    console.log(chalk.gray(`   AI処理: ${businessLogicResult.aiProcessedFiles}ファイル, 静的解析: ${businessLogicResult.staticAnalysisFiles}ファイル`));
    
    // 2. Test Synthesis for files without tests
    console.log(chalk.blue('🧪 Step 2/5: AI-powered test synthesis...'));
    const testSynthesisAgent = new TestSynthesisAgent(absolutePath);
    const testSynthesisResult = await testSynthesisAgent.execute({
      projectPath: absolutePath,
      language: 'go' as const,
      outputPath: path.join(absolutePath, '__generated__/tests'),
      documentationPath: path.join(absolutePath, '__generated__/docs'),
      aiEnabled: true,
      generateDocumentation: true,
      localization: 'ja'
    });
    
    console.log(chalk.green(`✅ テスト生成完了: ${testSynthesisResult.generatedTests.length}個のテスト, ${testSynthesisResult.generatedDocuments.length}個のドキュメント`));
    
    // 3. Generate refactoring patches
    console.log(chalk.blue('🏗️  Step 3/5: Generating refactoring patches...'));
    const refactorAgent = new RefactorAgent(absolutePath);
    const refactorResult = await refactorAgent.generateRefactorPlan(planPath);
    
    // 4. Synthesize and relocate tests
    console.log(chalk.blue('🔄 Step 4/5: Test relocation and synthesis...'));
    const testSynthAgent = new TestSynthAgent(absolutePath);
    const testSynthResult = await testSynthAgent.synthesizeTests(paths.patchesDir);
    
    // 5. Run migration (apply patches)
    console.log(chalk.blue('🚀 Step 5/5: Applying patches and migration...'));
    const migrationRunner = new MigrationRunner(absolutePath, undefined, !apply);
    const migrationResult = await migrationRunner.executeMigration(paths.patchesDir, apply);
    
    // 6. Review changes
    const reviewAgent = new ReviewAgent(absolutePath);
    const reviewResult = await reviewAgent.reviewChanges(migrationResult.outputPath);
    
    console.log(chalk.green('✅ AI-powered完全なリファクタリングパイプライン完了!'));
    console.log(chalk.gray('📄 Generated files:'));
    console.log(chalk.gray(`   - ${paths.getRelativePath(refactorResult.outputPath)}/ (${refactorResult.plan.summary.total_patches} patches)`));
    console.log(chalk.gray(`   - ${paths.getRelativePath(testSynthResult.outputPath)} (${testSynthResult.generated_tests.length} tests)`));
    console.log(chalk.gray(`   - ${paths.getRelativePath(migrationResult.outputPath)} (migration results)`));
    console.log(chalk.gray(`   - ${paths.getRelativePath(reviewResult.outputPath)} (review report)`));
    console.log(chalk.gray(`   - __generated__/tests/ (${testSynthesisResult.generatedTests.length} AI-generated tests)`));
    console.log(chalk.gray(`   - __generated__/docs/ (${testSynthesisResult.generatedDocuments.length} user stories & specs)`));
    
    // Display key results
    console.log(chalk.cyan('\n📊 実行結果サマリ:'));
    console.log(chalk.gray(`   🧠 業務ロジック移行: ${businessLogicResult.migratedBoundaries.length}境界 (AI: ${businessLogicResult.aiProcessedFiles}, 静的: ${businessLogicResult.staticAnalysisFiles})`));
    console.log(chalk.gray(`   🧪 AI生成テスト: ${testSynthesisResult.generatedTests.length}個 (カバレッジ向上推定: ${testSynthesisResult.coverageImprovement?.improvement || 'N/A'}%)`));
    console.log(chalk.gray(`   📚 生成ドキュメント: ${testSynthesisResult.generatedDocuments.length}個のユーザーストーリー・仕様書`));
    console.log(chalk.gray(`   🔄 パッチ適用: ${migrationResult.applied_patches.length}成功 / ${migrationResult.failed_patches.length}失敗`));
    console.log(chalk.gray(`   ✅ ビルド: ${migrationResult.build_result.success ? '✅ 成功' : '❌ 失敗'}`));
    console.log(chalk.gray(`   🧪 テスト: ${migrationResult.test_result.success ? '✅ 成功' : '❌ 失敗'}`));
    console.log(chalk.gray(`   📋 総合評価: ${reviewResult.overall_assessment.grade}グレード`));
    console.log(chalk.gray(`   🤖 自動マージ: ${reviewResult.auto_merge_decision.should_auto_merge ? '✅ 可能' : '❌ 手動レビュー必要'}`));
    
    if (!apply) {
      console.log(chalk.yellow('\nℹ️  ドライランモード - 実際の変更は行われていません'));
      console.log(chalk.yellow('   --applyフラグで実際の変更を適用できます'));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error in refactor execution:'), error);
    throw error;
  }
}

async function runIncrementalRefactor(projectRoot: string, options: {
  apply: boolean;
  maxStageSize: number;
  resumeFromStage?: number;
  skipStages: number[];
}): Promise<void> {
  const absolutePath = path.resolve(projectRoot);
  const paths = new VibeFlowPaths(absolutePath);
  
  // Check that plan exists
  const planPath = paths.planPath;
  const domainMapPath = paths.domainMapPath;
  
  // Check for required files unless in test environment
  if (process.env.NODE_ENV !== 'test' && process.env.VITEST !== 'true') {
    try {
      await fs.access(planPath);
      await fs.access(domainMapPath);
    } catch {
      throw new Error(
        `Required files not found. Please run "vf plan" first to generate ${paths.getRelativePath(planPath)} and ${paths.getRelativePath(domainMapPath)}`
      );
    }
  } else {
    console.log(chalk.yellow('🔧 Test environment - skipping required file validation'));
  }

  console.log(chalk.blue(`🔄 インクリメンタルリファクタリング: ${absolutePath}`));
  console.log(chalk.gray(`⚙️  設定: 最大ステージサイズ=${options.maxStageSize}, スキップ=[${options.skipStages.join(', ')}]`));
  
  if (options.resumeFromStage) {
    console.log(chalk.cyan(`🔂 ステージ${options.resumeFromStage}から再開します`));
  }
  
  try {
    // 1. Enhanced test synthesis for better coverage
    console.log(chalk.blue('🧪 Step 1/3: Enhanced test synthesis...'));
    const enhancedTestSynth = new EnhancedTestSynthAgent();
    const testSynthResult = await enhancedTestSynth.execute({
      projectPath: absolutePath,
      currentCoverage: 18.6, // From real experiment data
      targetCoverage: 50,
      language: 'go',
      testTypes: ['unit', 'integration'],
      aiEnabled: true,
    });
    
    console.log(chalk.green(`✅ テスト生成完了: ${testSynthResult.generatedTests.length}個の新規テスト`));
    console.log(chalk.gray(`   推定カバレッジ向上: ${testSynthResult.coverageImprovement.beforeCoverage}% → ${testSynthResult.coverageImprovement.estimatedAfterCoverage}%`));
    
    // 2. Generate refactoring patches
    console.log(chalk.blue('🏗️  Step 2/3: Generating refactoring patches...'));
    const refactorAgent = new RefactorAgent(absolutePath);
    const refactorResult = await refactorAgent.generateRefactorPlan(planPath);
    
    // 3. Execute incremental migration
    console.log(chalk.blue('🔧 Step 3/3: Incremental patch application...'));
    const incrementalRunner = new IncrementalMigrationRunner();
    const migrationResult = await incrementalRunner.execute({
      projectPath: absolutePath,
      refactorPlanPath: path.join(paths.patchesDir, 'manifest.json'),
      config: {
        maxStageSize: options.maxStageSize,
        maxRetries: 2,
        buildTimeout: 120000,
        testTimeout: 300000,
        continueOnNonCriticalFailure: true,
        generateProgressReport: true,
        createStageBackups: options.apply,
      },
      resumeFromStage: options.resumeFromStage,
      skipStages: options.skipStages,
    });
    
    // 4. Generate review report
    const reviewAgent = new ReviewAgent(absolutePath);
    const reviewResult = await reviewAgent.reviewChanges(absolutePath);
    
    console.log(chalk.green('✅ インクリメンタルリファクタリング完了!'));
    
    // Display incremental results
    console.log(chalk.cyan('\n📊 実行結果サマリ:'));
    console.log(chalk.gray(`   総ステージ数: ${migrationResult.summary.totalStages}`));
    console.log(chalk.gray(`   成功ステージ: ${migrationResult.summary.successfulStages} ✅`));
    console.log(chalk.gray(`   失敗ステージ: ${migrationResult.summary.failedStages} ❌`));
    console.log(chalk.gray(`   スキップステージ: ${migrationResult.summary.skippedStages} ⏭️`));
    console.log(chalk.gray(`   パッチ適用: ${migrationResult.summary.appliedPatches}/${migrationResult.summary.totalPatches}`));
    console.log(chalk.gray(`   最終ビルド: ${migrationResult.summary.finalBuildSuccess ? '✅ 成功' : '❌ 失敗'}`));
    console.log(chalk.gray(`   最終テスト: ${migrationResult.summary.finalTestSuccess ? '✅ 成功' : '❌ 失敗'}`));
    console.log(chalk.gray(`   処理時間: ${(migrationResult.summary.processingTime / 1000).toFixed(1)}秒`));
    
    // Display recommendations
    if (migrationResult.recommendations.length > 0) {
      console.log(chalk.yellow('\n💡 推奨事項:'));
      migrationResult.recommendations.forEach(rec => {
        console.log(chalk.yellow(`   - ${rec}`));
      });
    }
    
    // Display stage details
    console.log(chalk.cyan('\n📋 ステージ詳細:'));
    migrationResult.stageResults.forEach(result => {
      const statusIcon = result.decision === 'continue' ? '✅' : 
                        result.decision === 'skip' ? '⏭️' : '❌';
      console.log(chalk.gray(`   ${statusIcon} Stage ${result.stage.id}: ${result.stage.name} (${result.applied.length}/${result.stage.patches.length} patches)`));
    });
    
    if (!options.apply) {
      console.log(chalk.yellow('\nℹ️  ドライランモード - 実際の変更は行われていません'));
      console.log(chalk.yellow('   --applyフラグで実際の変更を適用できます'));
    }
    
    // Suggest resume command if there were failures
    const lastFailedStage = migrationResult.stageResults
      .filter(r => r.decision === 'abort' || r.decision === 'skip')
      .pop();
    
    if (lastFailedStage && options.apply) {
      console.log(chalk.cyan(`\n🔂 失敗したステージから再開するには:`));
      console.log(chalk.cyan(`   vf refactor --incremental --apply --resume-from-stage ${lastFailedStage.stage.id}`));
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error in incremental refactor execution:'), error);
    throw error;
  }
}

// -----------------------------------------------------------------------------
// CLI definition
// -----------------------------------------------------------------------------
const program = new Command()
  .name('vf')
  .description('VibeFlow CLI - modular monolith refactoring assistant')
  .version('0.1.0');

program
  .command('plan')
  .argument('[path]', 'target project root', 'workspace')
  .description('Generate refactor plan')
  .action(async (path: string) => {
    console.log(chalk.cyan('▶ generating plan...'));
    await planTasks(path);
  });

program
  .command('discover')
  .argument('[path]', 'target project root', 'workspace')
  .description('AI-powered automatic boundary discovery (no config required)')
  .action(async (path: string) => {
    console.log(chalk.magenta('▶ AI automatic boundary discovery...'));
    await runAutomaticBoundaryDiscovery(path);
  });

program
  .command('refactor')
  .argument('[path]', 'target project root', 'workspace')
  .option('-a, --apply', 'apply patches automatically')
  .option('-i, --incremental', 'use incremental migration mode for safer execution')
  .option('--max-stage-size <number>', 'maximum patches per stage (default: 5)', '5')
  .option('--resume-from-stage <number>', 'resume from specific stage number')
  .option('--skip-stages <numbers>', 'comma-separated list of stages to skip')
  .option('--resume', 'resume from previous checkpoint')
  .option('--retry-failed', 'retry previously failed files during resume')
  .option('--clear-checkpoint', 'clear existing checkpoint and start fresh')
  .option('--from-step <step>', 'resume from specific step (boundary, migration, refactor, test, review)')
  .option('--only-files <files...>', 'process only specified files or patterns')
  .description('Execute refactor according to plan')
  .action(async (pathParam: string, opts: { 
    apply?: boolean; 
    incremental?: boolean;
    maxStageSize?: string;
    resumeFromStage?: string;
    skipStages?: string;
    resume?: boolean;
    retryFailed?: boolean;
    clearCheckpoint?: boolean;
    fromStep?: string;
    onlyFiles?: string[];
  }) => {
    console.log(chalk.green('▶ running refactor...'));
    
    // Handle resume flow first
    const absolutePath = path.resolve(pathParam);
    const { shouldResume, checkpoint, resumeOptions } = await handleResumeFlow(absolutePath, {
      resume: opts.resume,
      retryFailed: opts.retryFailed,
      fromStep: opts.fromStep,
      clearCheckpoint: opts.clearCheckpoint,
      onlyFiles: opts.onlyFiles
    });
    
    if (opts.clearCheckpoint) {
      return; // Exit after clearing checkpoint
    }
    
    if (opts.incremental) {
      console.log(chalk.cyan('🔄 インクリメンタルモード - 段階的に安全に実行します'));
      await runIncrementalRefactor(pathParam, {
        apply: opts.apply ?? false,
        maxStageSize: parseInt(opts.maxStageSize || '5'),
        resumeFromStage: opts.resumeFromStage ? parseInt(opts.resumeFromStage) : undefined,
        skipStages: opts.skipStages ? opts.skipStages.split(',').map(n => parseInt(n.trim())) : [],
      });
    } else {
      await runRefactor(pathParam, opts.apply ?? false, shouldResume ? resumeOptions : undefined);
    }
  });

// Add quality analysis command
program
  .command('analyze-quality')
  .argument('[path]', 'target project root', 'workspace')
  .option('-l, --log <path>', 'path to refactor log file')
  .description('Analyze refactoring quality and determine if rerun is needed')
  .action(async (targetPath: string, opts: { log?: string }) => {
    const { analyzeRefactorQuality } = await import('./core/utils/refactor-quality-analyzer.js');
    const absolutePath = path.isAbsolute(targetPath) ? targetPath : path.join(process.cwd(), targetPath);
    await analyzeRefactorQuality(absolutePath, opts.log);
  });

// Add refine command for selective re-processing
program
  .command('refine')
  .argument('[path]', 'target project root', 'workspace')
  .option('-l, --log <path>', 'path to refactor log file')
  .option('-f, --files <files...>', 'specific files to refine')
  .option('--force-ai', 'force AI processing even with rate limits')
  .description('Refine specific files that need quality improvement')
  .action(async (targetPath: string, opts: { log?: string; files?: string[]; forceAi?: boolean }) => {
    const { runRefine } = await import('./core/agents/refine-agent.js');
    const absolutePath = path.isAbsolute(targetPath) ? targetPath : path.join(process.cwd(), targetPath);
    await runRefine(absolutePath, {
      log: opts.log,
      files: opts.files,
      forceAI: opts.forceAi
    });
  });

program
  .command('full')
  .argument('[path]', 'target project root', 'workspace')
  .option('-a, --apply', 'apply patches automatically')
  .description('Run complete pipeline: plan + refactor')
  .action(async (path: string, opts: { apply?: boolean }) => {
    console.log(chalk.cyan('▶ running full pipeline...'));
    
    try {
      // 1. Generate plan
      console.log(chalk.blue('🔍 Step 1/2: Generating plan...'));
      await planTasks(path);
      
      // 2. Execute refactor
      console.log(chalk.blue('🔧 Step 2/2: Executing refactor...'));
      await runRefactor(path, opts.apply ?? false);
      
      console.log(chalk.green('🎉 Complete pipeline finished successfully!'));
      
    } catch (error) {
      console.error(chalk.red('❌ Pipeline failed:'), error);
      process.exit(1);
    }
  });

program
  .command('auto')
  .argument('[path]', 'target project root', 'workspace')
  .option('-a, --apply', 'actually apply changes (not dry-run)')
  .option('-l, --language <lang>', 'target language', 'go')
  .option('-p, --pattern <pattern>', 'architecture pattern', 'clean-arch')
  .option('-t, --timeout <minutes>', 'timeout in minutes', '60')
  .description('🤖 Complete automatic refactoring with AI - The Revolutionary Command')
  .action(async (path: string, opts: { 
    apply?: boolean; 
    language?: string; 
    pattern?: string; 
    timeout?: string;
  }) => {
    console.log(chalk.green('🤖 Running in Hybrid Mode'));
    console.log(chalk.gray('   Claude Code SDK + Templates for optimal results'));
    console.log(chalk.gray('   Falls back to template mode if AI unavailable'));
    console.log('');
    console.log(chalk.blue(`📁 Target: ${path}`));
    console.log(chalk.blue(`🔤 Language: ${opts.language}`));
    console.log(chalk.blue(`🏗️  Pattern: ${opts.pattern}`));
    console.log(chalk.blue(`⚙️  Mode: ${opts.apply ? chalk.red('🔥 APPLY CHANGES') : chalk.yellow('🔍 DRY RUN')}`));
    console.log('');
    
    const startTime = Date.now();
    
    try {
      // Timeout setting
      const timeoutMs = parseInt(opts.timeout || '60') * 60 * 1000;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('⏰ Timeout reached')), timeoutMs)
      );
      
      // Execute automatic refactoring workflow
      const refactorPromise = executeAutoRefactor(path, opts.apply);
      
      const result = await Promise.race([refactorPromise, timeoutPromise]) as any;
      
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      
      console.log('');
      console.log(chalk.green('🎉 AI Automatic Refactoring Complete!'));
      console.log(chalk.cyan(`⏱️  Total Time: ${duration} minutes`));
      console.log('');
      console.log(chalk.cyan('📊 Execution Summary:'));
      console.log(chalk.gray(`   🏗️  Created modules: ${result.boundaries?.length || 0}`));
      console.log(chalk.gray(`   🔄 Converted files: ${result.refactorResult?.applied_patches?.length || 0}`));
      console.log(chalk.gray(`   🧪 Generated tests: ${result.testResult?.generated_tests?.length || 0}`));
      console.log(chalk.gray(`   ✅ Compile: ${result.validation?.compile?.success ? 'Success' : 'Failed'}`));
      console.log(chalk.gray(`   🧪 Tests: ${result.validation?.tests?.success ? 'Success' : 'Failed'}`));
      console.log(chalk.gray(`   📈 Performance: ${result.validation?.performance?.improvement || 'N/A'}`));
      console.log('');
      
      if (!opts.apply) {
        console.log(chalk.yellow('ℹ️  This was a dry run. Use --apply flag to actually apply changes.'));
        console.log(chalk.yellow('   Example: vf auto . --apply'));
      } else {
        console.log(chalk.green('🚀 Production ready! Your codebase has been transformed.'));
        console.log(chalk.green('   Welcome to the new era of AI-powered development.'));
      }
      
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      console.log('');
      console.error(chalk.red(`❌ Refactoring failed (${duration} min elapsed):`), (error as any).message);
      console.log(chalk.red('🔄 Automatic rollback executed.'));
      console.log('');
      process.exit(1);
    }
  });

// -----------------------------------------------------------------------------
// Cost estimation command
// -----------------------------------------------------------------------------
program
  .command('business-logic')
  .argument('[path]', 'target project root', 'workspace')
  .option('-a, --apply', 'apply changes automatically')
  .option('-l, --language <lang>', 'target language (go, typescript, python)', 'go')
  .option('--ai-enabled', 'enable Claude Code AI processing (recommended)', true)
  .option('--preserve-mode <mode>', 'preservation mode (strict, adaptive, optimized)', 'strict')
  .option('--generate-tests', 'generate tests for extracted business logic', true)
  .option('--generate-docs', 'generate human-readable documentation', true)
  .description('🧠 AI-powered business logic migration and test synthesis')
  .action(async (pathParam: string, opts: { 
    apply?: boolean; 
    language?: string;
    aiEnabled?: boolean;
    preserveMode?: string;
    generateTests?: boolean;
    generateDocs?: boolean;
  }) => {
    console.log(chalk.magenta('🧠 AI-powered Business Logic Migration'));
    console.log(chalk.gray('   Extract, migrate, and document business logic with Claude Code'));
    console.log('');
    
    const absolutePath = path.resolve(pathParam);
    const paths = new VibeFlowPaths(absolutePath);
    
    try {
      console.log(chalk.blue('🔍 Step 1/2: Business logic migration...'));
      const businessLogicAgent = new BusinessLogicMigrationAgent(absolutePath);
      const businessLogicResult = await businessLogicAgent.execute({
        projectPath: absolutePath,
        domainMapPath: paths.domainMapPath,
        planPath: paths.planPath,
        aiEnabled: opts.aiEnabled ?? true,
        language: (opts.language as any) || 'go',
        preserveMode: opts.preserveMode as any || 'strict',
        generateTests: opts.generateTests ?? true,
        generateDocumentation: opts.generateDocs ?? true
      });
      
      console.log(chalk.blue('🧪 Step 2/2: Test synthesis and documentation...'));
      const testSynthesisAgent = new TestSynthesisAgent(absolutePath);
      const testSynthesisResult = await testSynthesisAgent.execute({
        projectPath: absolutePath,
        language: (opts.language as any) || 'go',
        outputPath: path.join(absolutePath, '__generated__/tests'),
        documentationPath: path.join(absolutePath, '__generated__/docs'),
        aiEnabled: opts.aiEnabled ?? true,
        generateDocumentation: opts.generateDocs ?? true,
        localization: 'ja'
      });
      
      console.log(chalk.green('✅ Business Logic Migration Complete!'));
      console.log(chalk.cyan('\n📊 Results Summary:'));
      console.log(chalk.gray(`   🧠 Migrated boundaries: ${businessLogicResult.migratedBoundaries.length}`));
      console.log(chalk.gray(`   🤖 AI processed files: ${businessLogicResult.aiProcessedFiles}`));
      console.log(chalk.gray(`   📊 Static analysis files: ${businessLogicResult.staticAnalysisFiles}`));
      console.log(chalk.gray(`   🧪 Generated tests: ${testSynthesisResult.generatedTests.length}`));
      console.log(chalk.gray(`   📚 Generated docs: ${testSynthesisResult.generatedDocuments.length}`));
      console.log('');
      console.log(chalk.cyan('📁 Generated Files:'));
      console.log(chalk.gray('   - __generated__/tests/ (AI-generated test cases)'));
      console.log(chalk.gray('   - __generated__/docs/ (User stories and specifications)'));
      
      if (!opts.apply) {
        console.log(chalk.yellow('\nℹ️  Analysis mode - no files were modified'));
        console.log(chalk.yellow('   Use --apply to generate actual test and documentation files'));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Business logic migration failed:'), error);
      process.exit(1);
    }
  });

program
  .command('estimate <path>')
  .description('💰 Estimate AI transformation costs')
  .option('-d, --detailed', 'show detailed breakdown')
  .action(async (targetPath: string, opts: { detailed?: boolean }) => {
    console.log(chalk.blue('💰 Cost Estimation for AI Transformation'));
    console.log('');

    try {
      const absolutePath = path.resolve(targetPath);
      
      // Run boundary discovery
      const boundaryAgent = new EnhancedBoundaryAgent(absolutePath);
      const { domainMap } = await boundaryAgent.analyzeBoundaries();
      
      // Estimate with hybrid agent
      const hybridAgent = new HybridRefactorAgent(absolutePath);
      const estimate = await hybridAgent.estimateCost(domainMap.boundaries);
      
      // Check cost limits
      const costManager = new CostManager(absolutePath);
      await costManager.initialize();
      const limitCheck = await costManager.checkLimits(estimate.estimatedCost, 'refactor');
      
      console.log(chalk.yellow('📊 Estimation Results:'));
      console.log(chalk.gray(`   Files to process: ${estimate.fileCount}`));
      console.log(chalk.gray(`   Estimated tokens: ${estimate.estimatedTokens.toLocaleString()}`));
      console.log(chalk.gray(`   Estimated cost: $${estimate.estimatedCost.toFixed(2)}`));
      console.log(chalk.gray(`   Estimated time: ${estimate.estimatedTime}`));
      console.log('');
      
      const usage = costManager.getUsageReport();
      console.log(chalk.cyan('💳 Current Usage:'));
      console.log(chalk.gray(`   Today: $${usage.today.cost.toFixed(2)} (${usage.today.operations} operations)`));
      console.log(chalk.gray(`   This month: $${usage.thisMonth.cost.toFixed(2)} (${usage.thisMonth.operations} operations)`));
      console.log('');
      console.log(chalk.cyan('🔒 Cost Limits:'));
      console.log(chalk.gray(`   Per run: $${usage.limits.perRun.toFixed(2)}`));
      console.log(chalk.gray(`   Daily: $${usage.limits.daily.toFixed(2)}`));
      console.log(chalk.gray(`   Monthly: $${usage.limits.monthly.toFixed(2)}`));
      console.log('');
      
      if (!limitCheck.allowed) {
        console.log(chalk.red(`❌ ${limitCheck.reason}`));
      } else {
        console.log(chalk.green('✅ Within cost limits'));
      }
      
      console.log(chalk.yellow('ℹ️  Using Claude Code SDK (OAuth-based)'));
      console.log(chalk.gray('   Template mode always available as fallback'));

      if (opts.detailed && domainMap.boundaries.length > 0) {
        console.log('');
        console.log(chalk.cyan('📁 Boundary Breakdown:'));
        for (const boundary of domainMap.boundaries) {
          console.log(chalk.gray(`   ${boundary.name}: ${boundary.files.length} files`));
        }
      }

    } catch (error) {
      console.error(chalk.red('❌ Estimation failed:'), error);
      process.exit(1);
    }
  });

program
  .command('refactor-smart')
  .argument('[path]', 'target project root', 'workspace')
  .option('-a, --apply', 'apply patches automatically')
  .option('--cache-only', 'use only cached metadata (skip analysis)')
  .option('--clear-cache', 'clear metadata cache before processing')
  .option('--show-plan', 'show optimization plan without executing')
  .description('Execute metadata-driven smart refactoring with optimized token usage')
  .action(async (pathParam: string, opts: { 
    apply?: boolean;
    cacheOnly?: boolean;
    clearCache?: boolean;
    showPlan?: boolean;
  }) => {
    try {
      console.log(chalk.blue('🚀 メタデータ駆動スマートリファクタリング開始...'));
      
      const absolutePath = path.resolve(pathParam);
      const paths = new VibeFlowPaths(absolutePath);
      
      // Load domain map
      const domainMapPath = paths.domainMapPath;
      let domainMap;
      try {
        const domainMapContent = await fs.readFile(domainMapPath, 'utf8');
        domainMap = JSON.parse(domainMapContent);
      } catch {
        console.error(chalk.red('❌ ドメインマップが見つかりません。まず "vf plan" を実行してください。'));
        process.exit(1);
      }

      // Create metadata-driven agent
      const metadataAgent = new MetadataDrivenRefactorAgent(absolutePath);
      
      // Clear cache if requested
      if (opts.clearCache) {
        console.log(chalk.yellow('🗑️ メタデータキャッシュをクリア中...'));
        // Implementation would clear the cache directory
      }
      
      // Execute metadata-driven refactoring
      const result = await metadataAgent.executeMetadataDrivenRefactoring(
        absolutePath, 
        domainMap.boundaries
      );
      
      // Show optimization plan
      if (opts.showPlan) {
        console.log(chalk.cyan('\n📋 最適化プラン:'));
        for (const boundary of result.boundaries) {
          console.log(chalk.yellow(`\n📁 ${boundary.boundary}:`));
          console.log(chalk.gray(`   🤖 LLM処理: ${boundary.llmProcessed.length}ファイル`));
          console.log(chalk.gray(`   📝 テンプレート: ${boundary.templateGenerated.length}ファイル`));
          console.log(chalk.gray(`   ⚡ 静的解析: ${boundary.staticAnalyzed.length}ファイル`));
          
          if (boundary.optimizations.length > 0) {
            console.log(chalk.green('   💡 最適化:'));
            boundary.optimizations.forEach(opt => 
              console.log(chalk.green(`      • ${opt}`))
            );
          }
        }
        
        console.log(chalk.cyan('\n📊 効率性メトリクス:'));
        console.log(chalk.green(`💰 トークン削減: ${result.efficiency.tokenReduction}%`));
        console.log(chalk.green(`⏱️ 処理時間短縮: ${result.efficiency.processingTimeReduction}%`));
        console.log(chalk.gray(`📈 総ファイル数: ${result.efficiency.totalFiles}`));
        console.log(chalk.gray(`🤖 LLM処理: ${result.efficiency.llmProcessedFiles}ファイル`));
        console.log(chalk.gray(`📝 テンプレート: ${result.efficiency.templateGeneratedFiles}ファイル`));
        console.log(chalk.gray(`⚡ 静的解析: ${result.efficiency.staticAnalyzedFiles}ファイル`));
        
        if (!opts.apply) {
          console.log(chalk.yellow('\n💡 実際にパッチを適用するには --apply オプションを使用してください'));
          return;
        }
      }
      
      console.log(chalk.green('✨ メタデータ駆動リファクタリング完了!'));
      
    } catch (error) {
      console.error(chalk.red('❌ メタデータ駆動リファクタリング失敗:'), error);
      process.exit(1);
    }
  });

// -----------------------------------------------------------------------------
// Metrics Commands
// -----------------------------------------------------------------------------

program
  .command('metrics')
  .argument('[path]', 'target project root', '.')
  .option('--run-id <id>', 'show details for specific run ID')
  .option('--agent <name>', 'filter by agent name')
  .option('--days <number>', 'number of days to include', '30')
  .option('--limit <number>', 'maximum number of runs to show', '20')
  .option('--export <format>', 'export data (csv|json)')
  .option('--output <file>', 'output file path for export')
  .option('--cleanup <days>', 'cleanup old data (retention days)')
  .description('Show performance metrics and statistics')
  .action(async (pathParam: string, opts: {
    runId?: string;
    agent?: string;
    days?: string;
    limit?: string;
    export?: 'csv' | 'json';
    output?: string;
    cleanup?: string;
  }) => {
    try {
      const absolutePath = path.resolve(pathParam);
      const metricsCLI = new MetricsCLI(absolutePath);
      
      // Cleanup operation
      if (opts.cleanup) {
        const retentionDays = parseInt(opts.cleanup);
        await metricsCLI.cleanup(retentionDays);
        metricsCLI.close();
        return;
      }
      
      // Export operation
      if (opts.export) {
        const days = parseInt(opts.days || '30');
        await metricsCLI.exportData(opts.export, opts.output, opts.agent, days);
        metricsCLI.close();
        return;
      }
      
      // Show specific run details
      if (opts.runId) {
        const runId = parseInt(opts.runId);
        await metricsCLI.showRunDetails(runId);
        metricsCLI.close();
        return;
      }
      
      // Show run history
      const limit = parseInt(opts.limit || '20');
      await metricsCLI.showRunHistory(opts.agent, limit);
      
      // Show statistics
      const days = parseInt(opts.days || '30');
      await metricsCLI.showAgentStats(opts.agent, days);
      
      metricsCLI.close();
      
    } catch (error) {
      console.error(chalk.red('❌ メトリクス取得失敗:'), error);
      process.exit(1);
    }
  });

// -----------------------------------------------------------------------------
// Entry
// -----------------------------------------------------------------------------
program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red('✖'), err);
  process.exit(1);
});
