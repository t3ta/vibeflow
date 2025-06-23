import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

export interface CheckpointData {
  version: string;
  timestamp: string;
  projectPath: string;
  currentStep: string;
  stepProgress: {
    totalFiles: number;
    processedFiles: string[];
    failedFiles: string[];
    currentFileIndex: number;
  };
  stepResults: {
    [stepName: string]: any;
  };
  configuration: {
    applyChanges: boolean;
    aiEnabled: boolean;
    language: string;
    preserveMode: string;
  };
}

export interface ResumeOptions {
  skipCompleted?: boolean;
  retryFailed?: boolean;
  fromStep?: string;
  onlyFiles?: string[];
}

export class CheckpointManager {
  private projectPath: string;
  private checkpointPath: string;

  constructor(projectPath: string) {
    this.projectPath = projectPath;
    this.checkpointPath = path.join(projectPath, '.vibeflow', 'checkpoint.json');
  }

  async saveCheckpoint(data: CheckpointData): Promise<void> {
    try {
      // Ensure .vibeflow directory exists
      const vibeflowDir = path.dirname(this.checkpointPath);
      await fs.mkdir(vibeflowDir, { recursive: true });

      // Save checkpoint data
      await fs.writeFile(this.checkpointPath, JSON.stringify(data, null, 2));
      
      console.log(chalk.gray(`💾 チェックポイント保存: ${data.currentStep} (${data.stepProgress.processedFiles.length}/${data.stepProgress.totalFiles})`));
    } catch (error) {
      console.warn(chalk.yellow(`⚠️  チェックポイント保存失敗: ${error}`));
    }
  }

  async loadCheckpoint(): Promise<CheckpointData | null> {
    try {
      const content = await fs.readFile(this.checkpointPath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  async hasCheckpoint(): Promise<boolean> {
    try {
      await fs.access(this.checkpointPath);
      return true;
    } catch {
      return false;
    }
  }

  async clearCheckpoint(): Promise<void> {
    try {
      await fs.unlink(this.checkpointPath);
      console.log(chalk.gray('🗑️  チェックポイントクリア'));
    } catch {
      // Ignore if file doesn't exist
    }
  }

  async analyzeResumability(): Promise<{
    canResume: boolean;
    lastStep: string;
    progress: string;
    timeElapsed: string;
    recommendations: string[];
  }> {
    const checkpoint = await this.loadCheckpoint();
    
    if (!checkpoint) {
      return {
        canResume: false,
        lastStep: 'none',
        progress: '0%',
        timeElapsed: '0s',
        recommendations: ['新規実行を開始してください']
      };
    }

    const timeElapsed = Date.now() - new Date(checkpoint.timestamp).getTime();
    const progressPercent = ((checkpoint.stepProgress.processedFiles.length / checkpoint.stepProgress.totalFiles) * 100).toFixed(1);
    
    const recommendations: string[] = [];
    
    if (checkpoint.stepProgress.failedFiles.length > 0) {
      recommendations.push(`${checkpoint.stepProgress.failedFiles.length}個の失敗ファイルを再試行可能`);
    }
    
    if (progressPercent === '100.0') {
      recommendations.push('次のステップから再開可能');
    } else {
      recommendations.push('未処理ファイルから再開可能');
    }

    return {
      canResume: true,
      lastStep: checkpoint.currentStep,
      progress: `${progressPercent}%`,
      timeElapsed: this.formatElapsedTime(timeElapsed),
      recommendations
    };
  }

  createCheckpointData(
    currentStep: string,
    totalFiles: number,
    processedFiles: string[],
    failedFiles: string[],
    currentFileIndex: number,
    stepResults: Record<string, any>,
    configuration: CheckpointData['configuration']
  ): CheckpointData {
    return {
      version: '1.0.0',
      timestamp: new Date().toISOString(),
      projectPath: this.projectPath,
      currentStep,
      stepProgress: {
        totalFiles,
        processedFiles,
        failedFiles,
        currentFileIndex
      },
      stepResults,
      configuration
    };
  }

  shouldProcessFile(filePath: string, checkpoint: CheckpointData | null, options: ResumeOptions): boolean {
    if (!checkpoint) return true;

    const isCompleted = checkpoint.stepProgress.processedFiles.includes(filePath);
    const isFailed = checkpoint.stepProgress.failedFiles.includes(filePath);

    // Skip completed files unless explicitly retrying
    if (isCompleted && !options.retryFailed) {
      return false;
    }

    // Retry failed files if requested
    if (isFailed && options.retryFailed) {
      return true;
    }

    // Process only specific files if specified
    if (options.onlyFiles && options.onlyFiles.length > 0) {
      return options.onlyFiles.some(pattern => filePath.includes(pattern));
    }

    // Process new files
    return !isCompleted;
  }

  private formatElapsedTime(milliseconds: number): string {
    const seconds = Math.floor(milliseconds / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);

    if (hours > 0) {
      return `${hours}時間${minutes % 60}分`;
    } else if (minutes > 0) {
      return `${minutes}分${seconds % 60}秒`;
    } else {
      return `${seconds}秒`;
    }
  }

  async generateResumeReport(checkpoint: CheckpointData): Promise<string> {
    const output: string[] = [];
    
    output.push(chalk.bold('🔄 レジューム可能な処理が見つかりました\n'));
    
    // Basic info
    output.push(`最終実行: ${chalk.cyan(new Date(checkpoint.timestamp).toLocaleString())}`);
    output.push(`プロジェクト: ${chalk.gray(checkpoint.projectPath)}`);
    output.push(`中断ステップ: ${chalk.yellow(checkpoint.currentStep)}\n`);
    
    // Progress info
    const progressPercent = ((checkpoint.stepProgress.processedFiles.length / checkpoint.stepProgress.totalFiles) * 100).toFixed(1);
    output.push(`進捗: ${chalk.green(`${checkpoint.stepProgress.processedFiles.length}/${checkpoint.stepProgress.totalFiles}`)} (${progressPercent}%)`);
    
    if (checkpoint.stepProgress.failedFiles.length > 0) {
      output.push(`失敗: ${chalk.red(`${checkpoint.stepProgress.failedFiles.length}ファイル`)}`);
    }
    
    // Configuration
    output.push(`\n設定:`);
    output.push(`  • AI処理: ${checkpoint.configuration.aiEnabled ? chalk.green('有効') : chalk.gray('無効')}`);
    output.push(`  • 自動適用: ${checkpoint.configuration.applyChanges ? chalk.green('有効') : chalk.gray('無効')}`);
    output.push(`  • 言語: ${checkpoint.configuration.language}`);
    
    // Resume options
    output.push(`\n${chalk.bold('📋 再開オプション:')}`);
    output.push(`  vf refactor . --resume                    # 続きから再開`);
    output.push(`  vf refactor . --resume --retry-failed     # 失敗ファイルも再試行`);
    output.push(`  vf refactor . --resume --from-step next   # 次ステップから開始`);
    output.push(`  vf refactor . --clear-checkpoint          # チェックポイントクリア`);
    
    return output.join('\n');
  }
}

// CLI integration helper
export async function handleResumeFlow(
  projectPath: string,
  options: {
    resume?: boolean;
    retryFailed?: boolean;
    fromStep?: string;
    clearCheckpoint?: boolean;
    onlyFiles?: string[];
  }
): Promise<{ shouldResume: boolean; checkpoint: CheckpointData | null; resumeOptions: ResumeOptions }> {
  const checkpointManager = new CheckpointManager(projectPath);
  
  // Clear checkpoint if requested
  if (options.clearCheckpoint) {
    await checkpointManager.clearCheckpoint();
    console.log(chalk.green('✅ チェックポイントをクリアしました'));
    return { shouldResume: false, checkpoint: null, resumeOptions: {} };
  }
  
  const checkpoint = await checkpointManager.loadCheckpoint();
  
  // No checkpoint exists
  if (!checkpoint) {
    if (options.resume) {
      console.log(chalk.yellow('⚠️  レジューム可能なチェックポイントが見つかりません'));
    }
    return { shouldResume: false, checkpoint: null, resumeOptions: {} };
  }
  
  // Show resume report
  if (options.resume) {
    const report = await checkpointManager.generateResumeReport(checkpoint);
    console.log(report);
    
    const resumeOptions: ResumeOptions = {
      skipCompleted: true,
      retryFailed: options.retryFailed || false,
      fromStep: options.fromStep,
      onlyFiles: options.onlyFiles
    };
    
    return { shouldResume: true, checkpoint, resumeOptions };
  }
  
  // Checkpoint exists but resume not requested - ask user
  const analysis = await checkpointManager.analyzeResumability();
  if (analysis.canResume) {
    console.log(chalk.yellow(`⚠️  前回の処理が中断されています (${analysis.progress} 完了)`));
    console.log(chalk.gray(`   --resume オプションで続きから再開できます`));
  }
  
  return { shouldResume: false, checkpoint, resumeOptions: {} };
}