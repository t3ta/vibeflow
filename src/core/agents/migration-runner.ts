import * as fs from 'fs';
import * as path from 'path';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import { RefactorPlan, CodePatch } from './refactor-agent.js';
import { VibeFlowConfig } from '../types/config.js';
import { ConfigLoader } from '../utils/config-loader.js';
import { VibeFlowPaths } from '../utils/file-paths.js';

const execAsync = promisify(exec);

export interface MigrationResult {
  applied_patches: AppliedPatch[];
  failed_patches: FailedPatch[];
  build_result: BuildResult;
  test_result: TestResult;
  rollback_info: RollbackInfo;
  outputPath: string;
}

export interface AppliedPatch {
  patch_id: number;
  file: string;
  action: string;
  success: boolean;
  git_commit?: string;
}

export interface FailedPatch {
  patch_id: number;
  file: string;
  action: string;
  error: string;
  rollback_required: boolean;
}

export interface BuildResult {
  success: boolean;
  errors: string[];
  warnings: string[];
  duration_ms: number;
}

export interface TestResult {
  success: boolean;
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  coverage_percentage?: number;
  duration_ms: number;
}

export interface RollbackInfo {
  backup_commit: string;
  rollback_available: boolean;
  rollback_steps: string[];
}

export class MigrationRunner {
  private config: VibeFlowConfig;
  private projectRoot: string;
  private dryRun: boolean;
  private paths: VibeFlowPaths;

  constructor(projectRoot: string, configPath?: string, dryRun: boolean = false) {
    this.config = ConfigLoader.loadVibeFlowConfig(configPath);
    this.projectRoot = projectRoot;
    this.dryRun = dryRun;
    this.paths = new VibeFlowPaths(projectRoot);
  }

  async executeMigration(refactorPlanPath: string, autoApply: boolean = false): Promise<MigrationResult> {
    console.log('🚀 マイグレーション実行を開始...');
    
    if (this.dryRun) {
      console.log('🔍 ドライランモード - 実際の変更は行いません');
    }

    // 1. 前提条件チェック
    await this.validatePreconditions();
    
    // 2. バックアップ作成
    const backupCommit = await this.createBackup();
    
    // 3. リファクタリング計画読み込み
    const refactorPlan = this.loadRefactorPlan(refactorPlanPath);
    
    // 4. パッチ適用
    const { appliedPatches, failedPatches } = await this.applyPatches(refactorPlan, autoApply);
    
    // 5. ビルド検証
    const buildResult = await this.runBuild();
    
    // 6. テスト実行
    const testResult = await this.runTests();
    
    // 7. 失敗時のロールバック処理
    if (!buildResult.success || !testResult.success) {
      if (!this.dryRun && autoApply) {
        console.log('❌ ビルドまたはテストが失敗 - ロールバックを実行...');
        await this.rollback(backupCommit);
      }
    }
    
    // 8. 結果サマリ
    const result: MigrationResult = {
      applied_patches: appliedPatches,
      failed_patches: failedPatches,
      build_result: buildResult,
      test_result: testResult,
      rollback_info: {
        backup_commit: backupCommit,
        rollback_available: !this.dryRun,
        rollback_steps: this.generateRollbackSteps(backupCommit),
      },
      outputPath: this.paths.migrationResultPath,
    };
    
    // 9. 結果保存
    await this.saveResults(result);
    
    console.log(`✅ マイグレーション完了: ${appliedPatches.length}個の成功、${failedPatches.length}個の失敗`);
    
    return result;
  }

  private async validatePreconditions(): Promise<void> {
    // Git repository check (skip in dry run mode)
    if (!this.dryRun && !fs.existsSync(path.join(this.projectRoot, '.git'))) {
      throw new Error('Git repository required for safe migration');
    }

    // Working directory clean check (skip in dry run mode)
    if (!this.dryRun) {
      try {
        const status = execSync('git status --porcelain', { 
          cwd: this.projectRoot,
          encoding: 'utf8' 
        });
        if (status.trim() !== '') {
          throw new Error('Working directory must be clean before migration. Please commit or stash changes.');
        }
      } catch (error) {
        throw new Error(`Git status check failed: ${error}`);
      }
    }

    // Check if required tools are available
    const requiredTools = ['go', 'git'];
    for (const tool of requiredTools) {
      try {
        execSync(`which ${tool}`, { stdio: 'ignore' });
      } catch {
        throw new Error(`Required tool not found: ${tool}`);
      }
    }
  }

  private async createBackup(): Promise<string> {
    if (this.dryRun) {
      return 'dry-run-backup';
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const branchName = `vibeflow-backup-${timestamp}`;
    
    try {
      execSync(`git checkout -b ${branchName}`, { cwd: this.projectRoot });
      execSync('git checkout -', { cwd: this.projectRoot }); // Switch back to original branch
      
      const commitHash = execSync('git rev-parse HEAD', { 
        cwd: this.projectRoot,
        encoding: 'utf8' 
      }).trim();
      
      console.log(`📦 バックアップ作成: ${branchName} (${commitHash.substring(0, 8)})`);
      return commitHash;
    } catch (error) {
      throw new Error(`Failed to create backup: ${error}`);
    }
  }

  private loadRefactorPlan(planPath: string): RefactorPlan {
    const manifestPath = path.join(this.paths.patchesDir, 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Refactor manifest not found: ${manifestPath}`);
    }
    
    const content = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(content);
    
    return {
      patches: manifest.patches,
      summary: manifest.summary,
    };
  }

  private async applyPatches(
    refactorPlan: RefactorPlan,
    autoApply: boolean
  ): Promise<{ appliedPatches: AppliedPatch[]; failedPatches: FailedPatch[] }> {
    const appliedPatches: AppliedPatch[] = [];
    const failedPatches: FailedPatch[] = [];

    console.log(`📝 ${refactorPlan.patches.length}個のパッチを適用中...`);

    for (const [index, patch] of refactorPlan.patches.entries()) {
      const patchId = index + 1;
      
      try {
        if (!autoApply && !this.dryRun) {
          const shouldApply = await this.promptForPatchApplication(patch, patchId);
          if (!shouldApply) {
            console.log(`⏭️  パッチ${patchId}をスキップ`);
            continue;
          }
        }

        await this.applyPatch(patch);
        
        const gitCommit = this.dryRun ? undefined : await this.commitPatch(patch, patchId);
        
        appliedPatches.push({
          patch_id: patchId,
          file: patch.file,
          action: patch.action,
          success: true,
          git_commit: gitCommit,
        });

        console.log(`✅ パッチ${patchId}適用完了: ${patch.file}`);

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        
        failedPatches.push({
          patch_id: patchId,
          file: patch.file,
          action: patch.action,
          error: errorMessage,
          rollback_required: true,
        });

        console.log(`❌ パッチ${patchId}適用失敗: ${errorMessage}`);
        
        if (!autoApply) {
          const shouldContinue = await this.promptForContinuation(patch, errorMessage);
          if (!shouldContinue) {
            break;
          }
        }
      }
    }

    return { appliedPatches, failedPatches };
  }

  private async applyPatch(patch: CodePatch): Promise<void> {
    if (this.dryRun) {
      console.log(`[DRY RUN] Would apply patch: ${patch.action} ${patch.file}`);
      return;
    }

    const filePath = path.resolve(this.projectRoot, patch.file);
    
    switch (patch.action) {
      case 'create':
        await this.createFile(filePath, patch.new_content);
        break;
      case 'modify':
        await this.modifyFile(filePath, patch);
        break;
      case 'delete':
        await this.deleteFile(filePath);
        break;
      case 'move':
        await this.moveFile(patch);
        break;
      default:
        throw new Error(`Unknown patch action: ${patch.action}`);
    }
  }

  private async createFile(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content);
  }

  private async modifyFile(filePath: string, patch: CodePatch): Promise<void> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File to modify does not exist: ${filePath}`);
    }
    
    // For simplicity, we'll replace the entire file content
    // In a more sophisticated implementation, we'd apply specific changes
    fs.writeFileSync(filePath, patch.new_content);
  }

  private async deleteFile(filePath: string): Promise<void> {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  private async moveFile(patch: CodePatch): Promise<void> {
    // This would require source and destination paths
    // For now, we'll implement it as create + delete
    throw new Error('Move operation not yet implemented');
  }

  private async commitPatch(patch: CodePatch, patchId: number): Promise<string> {
    try {
      execSync(`git add "${patch.file}"`, { cwd: this.projectRoot });
      
      const commitMessage = `vibeflow: ${patch.description} (patch ${patchId})

Generated by VibeFlow autonomous refactoring pipeline.
Action: ${patch.action}
File: ${patch.file}

🤖 Generated with VibeFlow
`;

      execSync(`git commit -m "${commitMessage}"`, { cwd: this.projectRoot });
      
      const commitHash = execSync('git rev-parse HEAD', { 
        cwd: this.projectRoot,
        encoding: 'utf8' 
      }).trim();
      
      return commitHash;
    } catch (error) {
      throw new Error(`Failed to commit patch: ${error}`);
    }
  }

  private async runBuild(): Promise<BuildResult> {
    console.log('🔨 ビルドを実行中...');
    
    if (this.dryRun) {
      return {
        success: true,
        errors: [],
        warnings: [],
        duration_ms: 0,
      };
    }

    const startTime = Date.now();
    
    try {
      const { stdout, stderr } = await execAsync('go build ./...', {
        cwd: this.projectRoot,
        timeout: 120000, // 2 minutes timeout
      });
      
      const duration = Date.now() - startTime;
      const warnings = this.parseGoWarnings(stderr);
      
      console.log(`✅ ビルド成功 (${duration}ms)`);
      
      return {
        success: true,
        errors: [],
        warnings,
        duration_ms: duration,
      };
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const errors = this.parseGoErrors(error.stderr || error.message);
      
      console.log(`❌ ビルド失敗 (${duration}ms)`);
      
      return {
        success: false,
        errors,
        warnings: [],
        duration_ms: duration,
      };
    }
  }

  private async runTests(): Promise<TestResult> {
    console.log('🧪 テストを実行中...');
    
    if (this.dryRun) {
      return {
        success: true,
        total_tests: 0,
        passed_tests: 0,
        failed_tests: 0,
        duration_ms: 0,
      };
    }

    const startTime = Date.now();
    
    try {
      const { stdout, stderr } = await execAsync('go test -v -coverprofile=coverage.out ./...', {
        cwd: this.projectRoot,
        timeout: 300000, // 5 minutes timeout
      });
      
      const duration = Date.now() - startTime;
      const testStats = this.parseGoTestOutput(stdout);
      const coverage = await this.parseCoverageOutput();
      
      console.log(`✅ テスト成功 (${duration}ms) - ${testStats.passed}/${testStats.total} passed`);
      
      return {
        success: testStats.failed === 0,
        total_tests: testStats.total,
        passed_tests: testStats.passed,
        failed_tests: testStats.failed,
        coverage_percentage: coverage,
        duration_ms: duration,
      };
      
    } catch (error: any) {
      const duration = Date.now() - startTime;
      const testStats = this.parseGoTestOutput(error.stdout || '');
      
      console.log(`❌ テスト失敗 (${duration}ms) - ${testStats.failed} tests failed`);
      
      return {
        success: false,
        total_tests: testStats.total,
        passed_tests: testStats.passed,
        failed_tests: testStats.failed,
        duration_ms: duration,
      };
    }
  }

  private async rollback(backupCommit: string): Promise<void> {
    if (this.dryRun) {
      console.log('[DRY RUN] Would rollback to commit:', backupCommit);
      return;
    }

    try {
      execSync(`git reset --hard ${backupCommit}`, { cwd: this.projectRoot });
      console.log('🔄 ロールバック完了');
    } catch (error) {
      throw new Error(`Rollback failed: ${error}`);
    }
  }

  private generateRollbackSteps(backupCommit: string): string[] {
    return [
      `git reset --hard ${backupCommit}`,
      'git clean -fd',
      'go mod tidy',
      'go build ./...',
    ];
  }

  private parseGoWarnings(stderr: string): string[] {
    const warnings: string[] = [];
    const lines = stderr.split('\n');
    
    for (const line of lines) {
      if (line.includes('warning:') || line.includes('Warning:')) {
        warnings.push(line.trim());
      }
    }
    
    return warnings;
  }

  private parseGoErrors(stderr: string): string[] {
    const errors: string[] = [];
    const lines = stderr.split('\n');
    
    for (const line of lines) {
      if (line.includes('error:') || line.includes('Error:') || line.includes('.go:')) {
        errors.push(line.trim());
      }
    }
    
    return errors;
  }

  private parseGoTestOutput(stdout: string): { total: number; passed: number; failed: number } {
    let total = 0;
    let passed = 0;
    let failed = 0;
    
    const lines = stdout.split('\n');
    for (const line of lines) {
      if (line.includes('RUN   Test')) {
        total++;
      } else if (line.includes('--- PASS:')) {
        passed++;
      } else if (line.includes('--- FAIL:')) {
        failed++;
      }
    }
    
    return { total, passed, failed };
  }

  private async parseCoverageOutput(): Promise<number | undefined> {
    const coverageFile = path.join(this.projectRoot, 'coverage.out');
    if (!fs.existsSync(coverageFile)) {
      return undefined;
    }

    try {
      const { stdout } = await execAsync('go tool cover -func=coverage.out', {
        cwd: this.projectRoot,
      });
      
      const totalLine = stdout.split('\n').find(line => line.includes('total:'));
      if (totalLine) {
        const match = totalLine.match(/(\d+\.\d+)%/);
        if (match) {
          return parseFloat(match[1]);
        }
      }
    } catch {
      // Coverage parsing failed, not critical
    }
    
    return undefined;
  }

  private async promptForPatchApplication(patch: CodePatch, patchId: number): Promise<boolean> {
    // In a real implementation, this would use a proper CLI prompt library
    console.log(`\n📋 パッチ ${patchId}:`);
    console.log(`   Action: ${patch.action}`);
    console.log(`   File: ${patch.file}`);
    console.log(`   Description: ${patch.description}`);
    
    // For now, return true (auto-approve) since we don't have interactive prompting
    return true;
  }

  private async promptForContinuation(patch: CodePatch, error: string): Promise<boolean> {
    console.log(`\n❌ パッチ適用に失敗しました:`);
    console.log(`   File: ${patch.file}`);
    console.log(`   Error: ${error}`);
    console.log(`   Continue with remaining patches? (auto-continuing for now)`);
    
    // For now, return true to continue
    return true;
  }

  private async saveResults(result: MigrationResult): Promise<void> {
    const resultPath = result.outputPath;
    fs.writeFileSync(resultPath, JSON.stringify(result, null, 2));
    
    // Also save a summary
    const summaryPath = path.join(this.paths.outputRootPath, 'results', 'migration-summary.json');
    const summary = {
      timestamp: new Date().toISOString(),
      success: result.failed_patches.length === 0 && result.build_result.success && result.test_result.success,
      patches_applied: result.applied_patches.length,
      patches_failed: result.failed_patches.length,
      build_success: result.build_result.success,
      test_success: result.test_result.success,
      coverage_percentage: result.test_result.coverage_percentage,
    };
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    
    console.log(`✅ マイグレーション結果を保存: ${this.paths.getRelativePath(resultPath)}, ${this.paths.getRelativePath(summaryPath)}`);
  }
}