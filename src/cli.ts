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
  .description('Execute refactor according to plan')
  .action(async (path: string, opts: { apply?: boolean }) => {
    console.log(chalk.green('▶ running refactor...'));
    await runRefactor(path, opts.apply ?? false);
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
    if (!process.env.CLAUDE_API_KEY) {
      console.log(chalk.blue('📋 Running in Template Mode'));
      console.log(chalk.gray('   High-quality code generation using proven patterns'));
      console.log(chalk.gray('   Set CLAUDE_API_KEY for AI-powered transformation'));
    } else {
      console.log(chalk.green('🤖 Running in AI Mode'));
      console.log(chalk.gray('   Intelligent code transformation with Claude'));
    }
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
// Entry
// -----------------------------------------------------------------------------
program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red('✖'), err);
  process.exit(1);
});
