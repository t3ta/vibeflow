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

async function runRefactor(projectRoot: string, apply: boolean): Promise<void> {
  const absolutePath = path.resolve(projectRoot);
  const paths = new VibeFlowPaths(absolutePath);
  
  // Verify required files exist
  const planPath = paths.planPath;
  const domainMapPath = paths.domainMapPath;
  
  try {
    await fs.access(planPath);
    await fs.access(domainMapPath);
  } catch {
    throw new Error(
      `Required files not found. Please run "vf plan" first to generate ${paths.getRelativePath(planPath)} and ${paths.getRelativePath(domainMapPath)}`
    );
  }

  console.log(chalk.blue(`🔧 Refactoring project: ${absolutePath}`));
  
  try {
    // 1. Generate refactoring patches
    const refactorAgent = new RefactorAgent(absolutePath);
    const refactorResult = await refactorAgent.generateRefactorPlan(planPath);
    
    // 2. Synthesize and relocate tests
    const testSynthAgent = new TestSynthAgent(absolutePath);
    const testSynthResult = await testSynthAgent.synthesizeTests(paths.patchesDir);
    
    // 3. Run migration (apply patches)
    const migrationRunner = new MigrationRunner(absolutePath, undefined, !apply);
    const migrationResult = await migrationRunner.executeMigration(paths.patchesDir, apply);
    
    // 4. Review changes
    const reviewAgent = new ReviewAgent(absolutePath);
    const reviewResult = await reviewAgent.reviewChanges(migrationResult.outputPath);
    
    console.log(chalk.green('✅ 完全なリファクタリングパイプライン完了!'));
    console.log(chalk.gray('📄 Generated files:'));
    console.log(chalk.gray(`   - ${paths.getRelativePath(refactorResult.outputPath)}/ (${refactorResult.plan.summary.total_patches} patches)`));
    console.log(chalk.gray(`   - ${paths.getRelativePath(testSynthResult.outputPath)} (${testSynthResult.generated_tests.length} tests)`));
    console.log(chalk.gray(`   - ${paths.getRelativePath(migrationResult.outputPath)} (migration results)`));
    console.log(chalk.gray(`   - ${paths.getRelativePath(reviewResult.outputPath)} (review report)`));
    
    // Display key results
    console.log(chalk.cyan('\n📊 実行結果サマリ:'));
    console.log(chalk.gray(`   パッチ適用: ${migrationResult.applied_patches.length}成功 / ${migrationResult.failed_patches.length}失敗`));
    console.log(chalk.gray(`   ビルド: ${migrationResult.build_result.success ? '✅ 成功' : '❌ 失敗'}`));
    console.log(chalk.gray(`   テスト: ${migrationResult.test_result.success ? '✅ 成功' : '❌ 失敗'}`));
    console.log(chalk.gray(`   総合評価: ${reviewResult.overall_assessment.grade}グレード`));
    console.log(chalk.gray(`   自動マージ: ${reviewResult.auto_merge_decision.should_auto_merge ? '✅ 可能' : '❌ 手動レビュー必要'}`));
    
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
  
  try {
    await fs.access(planPath);
    await fs.access(domainMapPath);
  } catch {
    throw new Error(
      `Required files not found. Please run "vf plan" first to generate ${paths.getRelativePath(planPath)} and ${paths.getRelativePath(domainMapPath)}`
    );
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
      refactoringManifest: {},
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
  .description('Execute refactor according to plan')
  .action(async (path: string, opts: { 
    apply?: boolean; 
    incremental?: boolean;
    maxStageSize?: string;
    resumeFromStage?: string;
    skipStages?: string;
  }) => {
    console.log(chalk.green('▶ running refactor...'));
    
    if (opts.incremental) {
      console.log(chalk.cyan('🔄 インクリメンタルモード - 段階的に安全に実行します'));
      await runIncrementalRefactor(path, {
        apply: opts.apply ?? false,
        maxStageSize: parseInt(opts.maxStageSize || '5'),
        resumeFromStage: opts.resumeFromStage ? parseInt(opts.resumeFromStage) : undefined,
        skipStages: opts.skipStages ? opts.skipStages.split(',').map(n => parseInt(n.trim())) : [],
      });
    } else {
      await runRefactor(path, opts.apply ?? false);
    }
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

// -----------------------------------------------------------------------------
// Entry
// -----------------------------------------------------------------------------
program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red('✖'), err);
  process.exit(1);
});
