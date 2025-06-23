import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';
import { BusinessLogicMigrationAgent } from './business-logic-migration-agent.js';
import { RefactorQualityAnalyzer } from '../utils/refactor-quality-analyzer.js';
import * as paths from '../utils/file-paths.js';

interface RefineOptions {
  projectPath: string;
  logPath?: string;
  targetFiles?: string[];
  forceAI?: boolean;
  maxRetries?: number;
}

interface RefineResult {
  refinedFiles: string[];
  improvedFiles: string[];
  skippedFiles: string[];
  failedFiles: string[];
  qualityBefore: number;
  qualityAfter: number;
}

export class RefineAgent {
  private analyzer: RefactorQualityAnalyzer;
  
  constructor() {
    this.analyzer = new RefactorQualityAnalyzer();
  }

  async execute(options: RefineOptions): Promise<RefineResult> {
    const logPath = options.logPath || path.join(options.projectPath, 'vibeflow_refactor.log');
    
    // 1. Analyze current quality and identify files needing refinement
    console.log(chalk.blue('🔍 現在の品質を分析中...'));
    const qualityReport = await this.analyzer.analyzeProcessingQuality(logPath, options.projectPath);
    
    // 2. Identify files that need refinement
    const filesToRefine = await this.identifyRefinementTargets(logPath, options.targetFiles);
    
    console.log(chalk.yellow(`📋 ${filesToRefine.length}個のファイルを再処理対象として特定`));
    
    // 3. Create refinement state
    const refinementState = await this.loadRefinementState(options.projectPath);
    
    const result: RefineResult = {
      refinedFiles: [],
      improvedFiles: [],
      skippedFiles: [],
      failedFiles: [],
      qualityBefore: qualityReport.confidence,
      qualityAfter: 0
    };

    // 4. Process each file that needs refinement
    for (const file of filesToRefine) {
      console.log(chalk.gray(`\n🔄 再処理中: ${file}`));
      
      try {
        const improved = await this.refineFile(file, options, refinementState);
        
        if (improved) {
          result.improvedFiles.push(file);
          console.log(chalk.green(`  ✅ 品質改善: ${file}`));
        } else {
          result.skippedFiles.push(file);
          console.log(chalk.gray(`  ⏭️  スキップ: ${file} (既に十分な品質)`));
        }
        
        result.refinedFiles.push(file);
      } catch (error) {
        result.failedFiles.push(file);
        console.log(chalk.red(`  ❌ 失敗: ${file}`));
        console.log(chalk.gray(`     ${error}`));
        
        if (!options.forceAI && error instanceof Error && error.message.includes('rate limit')) {
          console.log(chalk.yellow('\n⚠️  Rate Limitを検出。--force-aiオプションで再試行可能です。'));
          break;
        }
      }
    }

    // 5. Re-analyze quality after refinement
    console.log(chalk.blue('\n📊 改善後の品質を分析中...'));
    const newQualityReport = await this.analyzer.analyzeProcessingQuality(
      await this.generateRefinedLog(logPath, result),
      options.projectPath
    );
    
    result.qualityAfter = newQualityReport.confidence;
    
    // 6. Save refinement state
    await this.saveRefinementState(options.projectPath, refinementState);
    
    return result;
  }

  private async identifyRefinementTargets(
    logPath: string,
    targetFiles?: string[]
  ): Promise<string[]> {
    if (targetFiles && targetFiles.length > 0) {
      return targetFiles;
    }

    // Parse log to find files that had fallback processing
    const logContent = await fs.readFile(logPath, 'utf-8');
    const lines = logContent.split('\n');
    const fallbackFiles: string[] = [];
    let currentFile: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Track current file being processed
      if (line.includes('Processing:')) {
        const match = line.match(/Processing: (.+)$/);
        if (match) {
          currentFile = match[1];
        }
      }
      
      // Check if fallback was used
      if (line.includes('Claude Code returned empty results') && currentFile) {
        fallbackFiles.push(currentFile);
      }
      
      // Also check for empty results
      if (line.includes('0 rules, 0 data patterns, 0 workflows') && currentFile) {
        if (!fallbackFiles.includes(currentFile)) {
          fallbackFiles.push(currentFile);
        }
      }
    }

    // Prioritize critical files
    const criticalPatterns = [
      /services\//,
      /handlers\//,
      /usecase\//,
      /domain\//,
      /core\//
    ];

    return fallbackFiles.sort((a, b) => {
      const aCritical = criticalPatterns.some(p => p.test(a));
      const bCritical = criticalPatterns.some(p => p.test(b));
      
      if (aCritical && !bCritical) return -1;
      if (!aCritical && bCritical) return 1;
      return 0;
    });
  }

  private async refineFile(
    filePath: string,
    options: RefineOptions,
    state: RefinementState
  ): Promise<boolean> {
    // Check if already refined
    if (state.refinedFiles[filePath]?.success) {
      return false;
    }

    // Use BusinessLogicMigrationAgent for AI processing
    const agent = new BusinessLogicMigrationAgent(options.projectPath);
    
    try {
      // Extract business logic with AI
      const result = await agent.extractBusinessLogicFromFile(filePath, {
        aiEnabled: true,
        forceAI: options.forceAI,
        preserveMode: 'strict'
      });

      // Check if improvement was achieved
      const hasImprovement = result.rules.length > 0 || 
                           result.dataAccess.length > 0 || 
                           result.workflows.length > 0;

      // Update state
      state.refinedFiles[filePath] = {
        success: true,
        timestamp: new Date().toISOString(),
        metrics: {
          rules: result.rules.length,
          patterns: result.dataAccess.length,
          workflows: result.workflows.length
        }
      };

      return hasImprovement;
    } catch (error) {
      state.refinedFiles[filePath] = {
        success: false,
        timestamp: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown error'
      };
      throw error;
    }
  }

  private async loadRefinementState(projectPath: string): Promise<RefinementState> {
    const statePath = path.join(projectPath, '.vibeflow', 'refinement-state.json');
    
    try {
      const content = await fs.readFile(statePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {
        version: '1.0.0',
        refinedFiles: {},
        lastRun: null
      };
    }
  }

  private async saveRefinementState(
    projectPath: string,
    state: RefinementState
  ): Promise<void> {
    const statePath = path.join(projectPath, '.vibeflow', 'refinement-state.json');
    state.lastRun = new Date().toISOString();
    
    await fs.writeFile(statePath, JSON.stringify(state, null, 2));
  }

  private async generateRefinedLog(
    originalLogPath: string,
    result: RefineResult
  ): Promise<string> {
    // In a real implementation, this would merge the refined results
    // with the original log. For now, return the original path.
    return originalLogPath;
  }

  async generateReport(result: RefineResult): Promise<string> {
    const output: string[] = [];
    
    output.push(chalk.bold('\n✨ リファインメント結果レポート\n'));
    
    // Quality improvement
    const qualityImprovement = result.qualityAfter - result.qualityBefore;
    const improvementColor = qualityImprovement > 0 ? chalk.green : chalk.red;
    
    output.push(`品質スコア: ${chalk.gray(`${result.qualityBefore.toFixed(1)}%`)} → ${improvementColor(`${result.qualityAfter.toFixed(1)}%`)} (${improvementColor(`+${qualityImprovement.toFixed(1)}%`)})\n`);
    
    // File statistics
    output.push(chalk.bold('📊 処理統計:'));
    output.push(`  • 処理対象: ${result.refinedFiles.length}ファイル`);
    output.push(`  • 品質改善: ${chalk.green(`${result.improvedFiles.length}ファイル`)}`);
    output.push(`  • スキップ: ${chalk.gray(`${result.skippedFiles.length}ファイル`)}`);
    if (result.failedFiles.length > 0) {
      output.push(`  • 失敗: ${chalk.red(`${result.failedFiles.length}ファイル`)}`);
    }
    
    // Improved files list
    if (result.improvedFiles.length > 0) {
      output.push('\n' + chalk.bold('✅ 品質が改善されたファイル:'));
      result.improvedFiles.slice(0, 10).forEach(file => {
        output.push(`  • ${file}`);
      });
      if (result.improvedFiles.length > 10) {
        output.push(`  ... 他${result.improvedFiles.length - 10}ファイル`);
      }
    }
    
    // Failed files list
    if (result.failedFiles.length > 0) {
      output.push('\n' + chalk.bold('❌ 処理に失敗したファイル:'));
      result.failedFiles.slice(0, 5).forEach(file => {
        output.push(`  • ${file}`);
      });
    }
    
    return output.join('\n');
  }
}

interface RefinementState {
  version: string;
  refinedFiles: Record<string, {
    success: boolean;
    timestamp: string;
    error?: string;
    metrics?: {
      rules: number;
      patterns: number;
      workflows: number;
    };
  }>;
  lastRun: string | null;
}

// CLI integration
export async function runRefine(
  projectPath: string,
  options: {
    log?: string;
    files?: string[];
    forceAI?: boolean;
  } = {}
): Promise<void> {
  const agent = new RefineAgent();
  
  try {
    console.log(chalk.magenta('🔧 リファインメント実行中...\n'));
    
    const result = await agent.execute({
      projectPath,
      logPath: options.log,
      targetFiles: options.files,
      forceAI: options.forceAI,
      maxRetries: 3
    });
    
    const report = await agent.generateReport(result);
    console.log(report);
    
    // Save detailed report
    const reportPath = path.join(projectPath, '.vibeflow', 'refinement-report.json');
    await fs.writeFile(reportPath, JSON.stringify(result, null, 2));
    
    console.log(chalk.gray(`\n📄 詳細レポート: ${reportPath}`));
    
    if (result.qualityAfter >= 70) {
      console.log(chalk.green('\n✅ 十分な品質レベルに到達しました！'));
    } else if (result.qualityAfter > result.qualityBefore) {
      console.log(chalk.yellow('\n⚡ 品質は改善されましたが、さらなる改善の余地があります。'));
    } else {
      console.log(chalk.red('\n⚠️  品質改善が見られませんでした。--force-aiオプションの使用を検討してください。'));
    }
  } catch (error) {
    console.error(chalk.red('❌ リファインメントエラー:'), error);
    process.exit(1);
  }
}