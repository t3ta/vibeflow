import { PerformanceTracker, AgentRunSummary, PerformanceStats } from './performance-tracker';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

/**
 * MetricsCLI - メトリクス表示・管理用のCLIユーティリティ
 */
export class MetricsCLI {
  private performanceTracker: PerformanceTracker;

  constructor(projectRoot: string) {
    this.performanceTracker = new PerformanceTracker(projectRoot);
  }

  /**
   * 実行履歴の表示
   */
  async showRunHistory(agentName?: string, limit: number = 20): Promise<void> {
    console.log(chalk.blue('📊 VibeFlow 実行履歴\n'));
    
    const runs = this.performanceTracker.getRunHistory(agentName, limit);
    
    if (runs.length === 0) {
      console.log(chalk.gray('実行履歴がありません。'));
      return;
    }

    // テーブルヘッダー
    console.log(chalk.cyan(
      'ID'.padEnd(4) + 
      'エージェント'.padEnd(20) + 
      '開始時刻'.padEnd(20) + 
      'ステータス'.padEnd(12) + 
      'ファイル'.padEnd(8) + 
      'トークン'.padEnd(12) + 
      'コスト'
    ));
    console.log(chalk.gray('-'.repeat(90)));

    for (const run of runs) {
      const startTime = new Date(run.start_time).toLocaleString('ja-JP').slice(5, 16);
      const status = this.formatStatus(run.status);
      const files = `${run.processed_files || 0}/${run.total_files || 0}`;
      const tokens = run.total_tokens ? run.total_tokens.toLocaleString() : '0';
      const cost = run.total_cost ? `$${run.total_cost.toFixed(4)}` : '$0.00';
      
      console.log(
        String(run.id).padEnd(4) +
        run.agent_name.padEnd(20) +
        startTime.padEnd(20) +
        status.padEnd(20) + // ANSIエスケープシーケンスを考慮して長めに
        files.padEnd(8) +
        tokens.padEnd(12) +
        cost
      );
    }
    
    console.log('');
  }

  /**
   * 特定実行の詳細表示
   */
  async showRunDetails(runId: number): Promise<void> {
    const details = this.performanceTracker.getRunDetails(runId);
    
    if (!details) {
      console.log(chalk.red(`❌ 実行ID ${runId} が見つかりません。`));
      return;
    }

    console.log(chalk.blue(`📋 実行詳細 (ID: ${runId})\n`));
    
    // 基本情報
    const run = details.run;
    console.log(chalk.yellow('基本情報:'));
    console.log(`  エージェント: ${run.agent_name}`);
    console.log(`  プロジェクト: ${run.project_path}`);
    console.log(`  開始時刻: ${new Date(run.start_time).toLocaleString('ja-JP')}`);
    console.log(`  終了時刻: ${run.end_time ? new Date(run.end_time).toLocaleString('ja-JP') : '実行中'}`);
    console.log(`  ステータス: ${this.formatStatus(run.status)}`);
    console.log(`  処理時間: ${this.formatDuration(run.start_time, run.end_time)}`);
    console.log('');

    // 統計情報
    console.log(chalk.yellow('統計情報:'));
    console.log(`  総ファイル数: ${run.total_files || 0}`);
    console.log(`  処理成功: ${run.processed_files || 0}`);
    console.log(`  処理失敗: ${run.failed_files || 0}`);
    console.log(`  成功率: ${this.calculateSuccessRate(run.processed_files, run.total_files)}%`);
    console.log(`  総トークン: ${(run.total_tokens || 0).toLocaleString()}`);
    console.log(`  総コスト: $${(run.total_cost || 0).toFixed(4)}`);
    console.log('');

    // ファイル処理詳細（上位10件）
    if (details.files.length > 0) {
      console.log(chalk.yellow('ファイル処理詳細（上位10件）:'));
      const topFiles = details.files
        .sort((a, b) => (b.tokens_used || 0) - (a.tokens_used || 0))
        .slice(0, 10);
      
      for (const file of topFiles) {
        const fileName = path.basename(file.file_path);
        const method = file.processing_method;
        const success = file.success ? '✅' : '❌';
        const tokens = file.tokens_used || 0;
        const duration = this.formatDuration(file.start_time, file.end_time);
        
        console.log(`  ${success} ${fileName} [${method}] - ${tokens} tokens, ${duration}`);
      }
      console.log('');
    }

    // エラー情報
    const errors = details.logs.filter(log => log.level === 'error');
    if (errors.length > 0) {
      console.log(chalk.yellow('エラー情報:'));
      for (const error of errors.slice(0, 5)) {
        console.log(chalk.red(`  ❌ ${error.message}`));
        if (error.file_path) {
          console.log(chalk.gray(`     ファイル: ${path.basename(error.file_path)}`));
        }
      }
      if (errors.length > 5) {
        console.log(chalk.gray(`  ... 他 ${errors.length - 5} 件のエラー`));
      }
      console.log('');
    }

    // パフォーマンスメトリクス（重要なもの）
    const importantMetrics = details.metrics.filter(m => 
      ['execution_time', 'memory_rss', 'token_reduction', 'confidence_score'].some(name => 
        m.metric_name.includes(name)
      )
    );
    
    if (importantMetrics.length > 0) {
      console.log(chalk.yellow('主要メトリクス:'));
      for (const metric of importantMetrics) {
        const value = this.formatMetricValue(metric.metric_value, metric.metric_unit);
        console.log(`  📊 ${metric.metric_name}: ${value}`);
      }
      console.log('');
    }
  }

  /**
   * エージェント別統計の表示
   */
  async showAgentStats(agentName?: string, days: number = 30): Promise<void> {
    console.log(chalk.blue(`📈 パフォーマンス統計 (過去${days}日間)\n`));
    
    const stats = this.performanceTracker.getPerformanceStats(agentName, days);
    
    console.log(chalk.yellow('実行統計:'));
    console.log(`  総実行回数: ${stats.totalRuns}`);
    console.log(`  成功率: ${stats.successRate.toFixed(1)}%`);
    console.log(`  平均処理時間: ${stats.averageDurationMinutes.toFixed(1)}分`);
    console.log('');
    
    console.log(chalk.yellow('リソース使用量:'));
    console.log(`  平均トークン: ${stats.averageTokens.toLocaleString()}`);
    console.log(`  平均コスト: $${stats.averageCost.toFixed(4)}`);
    console.log(`  平均ファイル数: ${stats.averageFiles.toFixed(0)}`);
    console.log('');

    // エージェント別の詳細統計
    if (!agentName) {
      await this.showAgentComparison(days);
    }
  }

  /**
   * エージェント比較
   */
  private async showAgentComparison(days: number): Promise<void> {
    console.log(chalk.yellow('エージェント別比較:'));
    
    const agents = ['BoundaryAgent', 'ArchitectAgent', 'RefactorAgent', 'MetadataDrivenRefactorAgent'];
    
    console.log(chalk.cyan(
      'エージェント'.padEnd(25) + 
      '実行回数'.padEnd(10) + 
      '成功率'.padEnd(10) + 
      '平均時間'.padEnd(12) + 
      '平均コスト'
    ));
    console.log(chalk.gray('-'.repeat(70)));
    
    for (const agent of agents) {
      const stats = this.performanceTracker.getPerformanceStats(agent, days);
      
      if (stats.totalRuns > 0) {
        console.log(
          agent.padEnd(25) +
          String(stats.totalRuns).padEnd(10) +
          `${stats.successRate.toFixed(1)}%`.padEnd(10) +
          `${stats.averageDurationMinutes.toFixed(1)}m`.padEnd(12) +
          `$${stats.averageCost.toFixed(4)}`
        );
      }
    }
    console.log('');
  }

  /**
   * データのエクスポート
   */
  async exportData(format: 'csv' | 'json', outputPath?: string, agentName?: string, days: number = 30): Promise<void> {
    const runs = this.performanceTracker.getRunHistory(agentName, 1000);
    const filteredRuns = runs.filter(run => {
      const runDate = new Date(run.start_time);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      return runDate >= cutoff;
    });

    const filename = outputPath || `vibeflow-metrics-${new Date().toISOString().split('T')[0]}.${format}`;
    
    if (format === 'csv') {
      await this.exportToCSV(filteredRuns, filename);
    } else {
      await this.exportToJSON(filteredRuns, filename);
    }
    
    console.log(chalk.green(`✅ データをエクスポートしました: ${filename}`));
  }

  /**
   * CSV形式でエクスポート
   */
  private async exportToCSV(runs: AgentRunSummary[], filename: string): Promise<void> {
    const headers = [
      'ID', 'Agent', 'Project', 'StartTime', 'EndTime', 'Status',
      'TotalFiles', 'ProcessedFiles', 'FailedFiles', 'TotalTokens', 'TotalCost'
    ];
    
    const rows = runs.map(run => [
      run.id,
      run.agent_name,
      path.basename(run.project_path),
      run.start_time,
      run.end_time || '',
      run.status,
      run.total_files,
      run.processed_files,
      run.failed_files,
      run.total_tokens,
      run.total_cost
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
    
    await fs.writeFile(filename, csvContent);
  }

  /**
   * JSON形式でエクスポート
   */
  private async exportToJSON(runs: AgentRunSummary[], filename: string): Promise<void> {
    const data = {
      exported_at: new Date().toISOString(),
      runs: runs,
      summary: {
        total_runs: runs.length,
        success_rate: runs.filter(r => r.status === 'completed').length / runs.length * 100,
        total_tokens: runs.reduce((sum, r) => sum + (r.total_tokens || 0), 0),
        total_cost: runs.reduce((sum, r) => sum + (r.total_cost || 0), 0)
      }
    };
    
    await fs.writeFile(filename, JSON.stringify(data, null, 2));
  }

  /**
   * データベースのクリーンアップ
   */
  async cleanup(retentionDays: number = 90): Promise<void> {
    console.log(chalk.yellow(`🗑️ ${retentionDays}日以前のデータをクリーンアップ中...`));
    
    this.performanceTracker.cleanup(retentionDays);
    
    console.log(chalk.green('✅ クリーンアップ完了'));
  }

  /**
   * ヘルパーメソッド: ステータスのフォーマット
   */
  private formatStatus(status: string): string {
    switch (status) {
      case 'completed':
        return chalk.green('✅ 完了');
      case 'failed':
        return chalk.red('❌ 失敗');
      case 'running':
        return chalk.blue('🔄 実行中');
      case 'cancelled':
        return chalk.yellow('⏹️ キャンセル');
      default:
        return chalk.gray(status);
    }
  }

  /**
   * ヘルパーメソッド: 期間のフォーマット
   */
  private formatDuration(startTime: string, endTime?: string): string {
    if (!endTime) return '実行中';
    
    const start = new Date(startTime);
    const end = new Date(endTime);
    const diffMs = end.getTime() - start.getTime();
    
    if (diffMs < 60000) return `${Math.round(diffMs / 1000)}秒`;
    if (diffMs < 3600000) return `${Math.round(diffMs / 60000)}分`;
    return `${Math.round(diffMs / 3600000)}時間`;
  }

  /**
   * ヘルパーメソッド: 成功率の計算
   */
  private calculateSuccessRate(processed: number, total: number): number {
    if (!total || total === 0) return 0;
    return Math.round((processed / total) * 100);
  }

  /**
   * ヘルパーメソッド: メトリクス値のフォーマット
   */
  private formatMetricValue(value: number, unit?: string): string {
    switch (unit) {
      case 'ms':
        if (value < 1000) return `${Math.round(value)}ms`;
        if (value < 60000) return `${(value / 1000).toFixed(1)}s`;
        return `${(value / 60000).toFixed(1)}m`;
      case 'mb':
        return `${value.toFixed(1)}MB`;
      case 'tokens':
        return `${value.toLocaleString()} tokens`;
      case 'usd':
        return `$${value.toFixed(4)}`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return `${value.toLocaleString()}${unit || ''}`;
    }
  }

  /**
   * リソースのクリーンアップ
   */
  close(): void {
    this.performanceTracker.close();
  }
}