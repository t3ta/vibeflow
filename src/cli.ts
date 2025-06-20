#!/usr/bin/env node
/**
 * VibeFlow CLI entry point.
 * Generates plan and runs refactor tasks on target project.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs/promises';
import { mastra } from './core/mastra';

// -----------------------------------------------------------------------------
// Workflow execution functions
// -----------------------------------------------------------------------------
async function planTasks(projectRoot: string): Promise<void> {
  const absolutePath = path.resolve(projectRoot);
  
  // Verify project exists
  try {
    await fs.access(absolutePath);
  } catch {
    throw new Error(`Project directory not found: ${absolutePath}`);
  }

  console.log(chalk.blue(`📂 Analyzing project: ${absolutePath}`));
  
  // TODO: Mastra APIの変更に対応した実装に更新
  console.log(chalk.yellow('⚠️  Workflow execution is temporarily disabled'));
  console.log(chalk.yellow('   Using stub implementation'));
  
  
  // スタブ実装
  console.log(chalk.gray('🔍 Analyzing codebase structure...'));
  console.log(chalk.gray('  (BoundaryAgent implementation pending)'));
  console.log(chalk.gray('🏗️  Designing modular architecture...'));
  console.log(chalk.gray('  (ArchitectAgent implementation pending)'));
  
  console.log(chalk.green('✅ Plan generation complete!'));
  console.log(chalk.gray('📄 Generated files:'));
  console.log(chalk.gray('   - domain-map.json (stub)'));
  console.log(chalk.gray('   - plan.md (stub)'));
}

async function runRefactor(projectRoot: string, apply: boolean): Promise<void> {
  const absolutePath = path.resolve(projectRoot);
  
  // Verify required files exist
  const planPath = path.join(absolutePath, 'plan.md');
  const domainMapPath = path.join(absolutePath, 'domain-map.json');
  
  try {
    await fs.access(planPath);
    await fs.access(domainMapPath);
  } catch {
    throw new Error(
      'Required files not found. Please run "vf plan" first to generate plan.md and domain-map.json'
    );
  }

  console.log(chalk.blue(`🔧 Refactoring project: ${absolutePath}`));
  
  // TODO: Mastra APIの変更に対応した実装に更新
  console.log(chalk.yellow('⚠️  Workflow execution is temporarily disabled'));
  console.log(chalk.yellow('   Using stub implementation'));
  
  // スタブ実装
  const mode = !apply ? 'Dry Run' : 'Auto Apply';
  console.log(chalk.gray('🔧 Generating refactoring patches...'));
  console.log(chalk.gray('  (RefactorAgent implementation pending)'));
  console.log(chalk.gray('🧪 Synthesizing and relocating tests...'));
  console.log(chalk.gray('  (TestSynthAgent implementation pending)'));
  console.log(chalk.gray('🚀 Running migration...'));
  console.log(chalk.gray(`  Mode: ${mode}`));
  console.log(chalk.gray('  (MigrationRunner implementation pending)'));
  console.log(chalk.gray('👀 Reviewing changes...'));
  console.log(chalk.gray('  (ReviewAgent implementation pending)'));
  
  console.log(chalk.green('✅ Refactoring complete!'));
  if (!apply) {
    console.log(chalk.yellow('ℹ️  Dry run mode - no changes were applied'));
    console.log(chalk.yellow('   Use --apply flag to apply changes'));
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
  .command('refactor')
  .argument('[path]', 'target project root', 'workspace')
  .option('-a, --apply', 'apply patches automatically')
  .description('Execute refactor according to plan')
  .action(async (path: string, opts: { apply?: boolean }) => {
    console.log(chalk.green('▶ running refactor...'));
    await runRefactor(path, opts.apply ?? false);
  });

// -----------------------------------------------------------------------------
// Entry
// -----------------------------------------------------------------------------
program.parseAsync(process.argv).catch((err) => {
  console.error(chalk.red('✖'), err);
  process.exit(1);
});
