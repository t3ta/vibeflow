import { promises as fs } from 'fs';
import path from 'path';
import chalk from 'chalk';

interface ProcessingStats {
  totalFiles: number;
  aiProcessedFiles: number;
  fallbackProcessedFiles: number;
  extractedRules: number;
  extractedPatterns: number;
  extractedWorkflows: number;
  emptyResults: number;
}

interface QualityReport {
  needsRerun: boolean;
  confidence: number;
  reasons: string[];
  recommendations: string[];
  criticalFiles: string[];
}

export class RefactorQualityAnalyzer {
  async analyzeProcessingQuality(
    logPath: string,
    projectPath: string
  ): Promise<QualityReport> {
    const logContent = await fs.readFile(logPath, 'utf-8');
    const stats = this.parseProcessingStats(logContent);
    
    return this.evaluateQuality(stats, projectPath);
  }

  private parseProcessingStats(logContent: string): ProcessingStats {
    const lines = logContent.split('\n');
    const stats: ProcessingStats = {
      totalFiles: 0,
      aiProcessedFiles: 0,
      fallbackProcessedFiles: 0,
      extractedRules: 0,
      extractedPatterns: 0,
      extractedWorkflows: 0,
      emptyResults: 0
    };

    lines.forEach(line => {
      if (line.includes('Processing:')) {
        stats.totalFiles++;
      }
      if (line.includes('Claude Code returned empty results')) {
        stats.fallbackProcessedFiles++;
      }
      if (line.includes('Using Claude Code for business logic extraction') && 
          !lines[lines.indexOf(line) + 2]?.includes('empty results')) {
        stats.aiProcessedFiles++;
      }
      
      // Extract rule/pattern/workflow counts
      const ruleMatch = line.match(/(\d+) rules/);
      const patternMatch = line.match(/(\d+) data patterns/);
      const workflowMatch = line.match(/(\d+) workflows/);
      
      if (ruleMatch) stats.extractedRules += parseInt(ruleMatch[1]);
      if (patternMatch) stats.extractedPatterns += parseInt(patternMatch[1]);
      if (workflowMatch) stats.extractedWorkflows += parseInt(workflowMatch[1]);
      
      if (line.includes('0 rules, 0 data patterns, 0 workflows')) {
        stats.emptyResults++;
      }
    });

    return stats;
  }

  private async evaluateQuality(
    stats: ProcessingStats,
    projectPath: string
  ): Promise<QualityReport> {
    const aiProcessingRate = stats.aiProcessedFiles / stats.totalFiles;
    const emptyResultRate = stats.emptyResults / stats.totalFiles;
    const avgExtractedItems = (stats.extractedRules + stats.extractedPatterns + stats.extractedWorkflows) / stats.totalFiles;

    // Identify critical files that should be AI-processed
    const criticalFiles = await this.identifyCriticalFiles(projectPath);
    
    const report: QualityReport = {
      needsRerun: false,
      confidence: 0,
      reasons: [],
      recommendations: [],
      criticalFiles: []
    };

    // Decision logic
    if (aiProcessingRate < 0.1) {
      report.needsRerun = true;
      report.reasons.push(`AI処理率が極めて低い: ${(aiProcessingRate * 100).toFixed(1)}%`);
    }

    if (emptyResultRate > 0.8) {
      report.needsRerun = true;
      report.reasons.push(`空の結果が多すぎる: ${(emptyResultRate * 100).toFixed(1)}%`);
    }

    if (avgExtractedItems < 0.5) {
      report.reasons.push(`抽出された業務ロジックが少ない: 平均${avgExtractedItems.toFixed(2)}項目/ファイル`);
    }

    // Calculate confidence
    report.confidence = Math.max(0, Math.min(100, 
      (aiProcessingRate * 50) + 
      ((1 - emptyResultRate) * 30) + 
      (Math.min(avgExtractedItems / 5, 1) * 20)
    ));

    // Generate recommendations
    if (report.needsRerun) {
      report.recommendations.push('Rate Limit解除後の完全な再実行を推奨');
      report.recommendations.push('重要な業務ロジックファイルに対するAI処理が必要');
    } else if (report.confidence < 70) {
      report.recommendations.push('部分的な再実行を検討');
      report.recommendations.push('criticalディレクトリのみの再処理で品質向上可能');
    } else {
      report.recommendations.push('現在の処理結果で十分な品質を確保');
      report.recommendations.push('必要に応じて個別ファイルの再処理を実施');
    }

    report.criticalFiles = criticalFiles.filter(file => 
      stats.fallbackProcessedFiles > 0 // Simplified check
    );

    return report;
  }

  private async identifyCriticalFiles(projectPath: string): Promise<string[]> {
    // Identify critical business logic files
    const criticalPatterns = [
      '**/services/**/*.go',
      '**/handlers/**/*.go',
      '**/usecase/**/*.go',
      '**/domain/**/*.go',
      '**/core/**/*.go'
    ];

    // In real implementation, use glob to find these files
    return [
      'services/fish_school.go',
      'handlers/daily_inputs.go',
      'usecase/fish_school_summary.go'
    ];
  }

  async generateReport(report: QualityReport): Promise<string> {
    const output: string[] = [];
    
    output.push(chalk.bold('\n🔍 リファクタリング品質分析レポート\n'));
    
    // Confidence score with color
    const confidenceColor = report.confidence >= 70 ? chalk.green : 
                           report.confidence >= 40 ? chalk.yellow : chalk.red;
    output.push(`信頼度スコア: ${confidenceColor(`${report.confidence.toFixed(1)}%`)}\n`);
    
    // Rerun recommendation
    if (report.needsRerun) {
      output.push(chalk.red.bold('⚠️  再実行を強く推奨\n'));
    } else {
      output.push(chalk.green('✅ 現在の処理結果は十分な品質\n'));
    }
    
    // Reasons
    if (report.reasons.length > 0) {
      output.push(chalk.bold('📊 分析結果:'));
      report.reasons.forEach(reason => {
        output.push(`  • ${reason}`);
      });
      output.push('');
    }
    
    // Recommendations
    output.push(chalk.bold('💡 推奨アクション:'));
    report.recommendations.forEach(rec => {
      output.push(`  • ${rec}`);
    });
    
    // Critical files
    if (report.criticalFiles.length > 0) {
      output.push('\n' + chalk.bold('🎯 優先的に再処理すべきファイル:'));
      report.criticalFiles.slice(0, 5).forEach(file => {
        output.push(`  • ${file}`);
      });
      if (report.criticalFiles.length > 5) {
        output.push(`  ... 他${report.criticalFiles.length - 5}ファイル`);
      }
    }
    
    return output.join('\n');
  }
}

// CLI integration
export async function analyzeRefactorQuality(
  projectPath: string,
  logPath?: string
): Promise<void> {
  const analyzer = new RefactorQualityAnalyzer();
  const actualLogPath = logPath || path.join(projectPath, 'vibeflow_refactor.log');
  
  try {
    console.log(chalk.blue('🤖 AI品質分析を実行中...\n'));
    
    const report = await analyzer.analyzeProcessingQuality(actualLogPath, projectPath);
    const reportText = await analyzer.generateReport(report);
    
    console.log(reportText);
    
    // Save report
    const reportPath = path.join(projectPath, '.vibeflow', 'quality-report.json');
    await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
    
    console.log(chalk.gray(`\n📄 詳細レポート: ${reportPath}`));
    
    // Exit with appropriate code
    process.exit(report.needsRerun ? 1 : 0);
  } catch (error) {
    console.error(chalk.red('❌ 品質分析エラー:'), error);
    process.exit(2);
  }
}