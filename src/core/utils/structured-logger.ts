import chalk from 'chalk';
import { PerformanceTracker, LogLevel } from './performance-tracker';

/**
 * StructuredLogger - console.logの置き換え用構造化ログシステム
 * PerformanceTrackerと連携してSQLiteに記録しつつ、コンソール出力も制御
 */
export class StructuredLogger {
  private performanceTracker: PerformanceTracker;
  private logLevel: LogLevel;
  private context: string;

  constructor(
    performanceTracker: PerformanceTracker, 
    context: string = 'unknown',
    logLevel: LogLevel = 'info'
  ) {
    this.performanceTracker = performanceTracker;
    this.context = context;
    this.logLevel = logLevel;
  }

  /**
   * デバッグレベルのログ
   */
  debug(message: string, details?: any, filePath?: string): void {
    this.log('debug', message, details, filePath);
  }

  /**
   * 情報レベルのログ
   */
  info(message: string, details?: any, filePath?: string): void {
    this.log('info', message, details, filePath);
  }

  /**
   * 警告レベルのログ
   */
  warn(message: string, details?: any, filePath?: string): void {
    this.log('warn', message, details, filePath);
  }

  /**
   * エラーレベルのログ
   */
  error(message: string, details?: any, filePath?: string): void {
    this.log('error', message, details, filePath);
  }

  /**
   * 成功メッセージ（info扱い）
   */
  success(message: string, details?: any, filePath?: string): void {
    this.logToConsole('info', `✅ ${message}`, details);
    this.performanceTracker.log('info', message, details, filePath);
  }

  /**
   * 進捗メッセージ
   */
  progress(message: string, current: number, total: number, details?: any): void {
    const percentage = Math.round((current / total) * 100);
    const progressBar = this.createProgressBar(percentage);
    const fullMessage = `${progressBar} ${message} (${current}/${total})`;
    
    this.logToConsole('info', fullMessage, details);
    this.performanceTracker.log('info', fullMessage, { current, total, percentage, ...details });
  }

  /**
   * エージェント開始ログ
   */
  agentStart(agentName: string, projectPath: string, details?: any): void {
    const message = `🚀 ${agentName} 開始: ${projectPath}`;
    this.logToConsole('info', chalk.blue(message), details);
    this.performanceTracker.log('info', message, details);
  }

  /**
   * エージェント完了ログ
   */
  agentComplete(agentName: string, duration: number, stats?: any): void {
    const message = `✨ ${agentName} 完了 (${this.formatDuration(duration)})`;
    this.logToConsole('info', chalk.green(message), stats);
    this.performanceTracker.log('info', message, { duration, ...stats });
  }

  /**
   * ファイル処理開始ログ
   */
  fileStart(filePath: string, method: string, details?: any): void {
    const message = `📄 処理開始: ${this.shortenPath(filePath)} [${method}]`;
    this.logToConsole('debug', message, details);
    this.performanceTracker.log('debug', message, { method, ...details }, filePath);
  }

  /**
   * ファイル処理完了ログ
   */
  fileComplete(filePath: string, method: string, duration: number, success: boolean, details?: any): void {
    const status = success ? '✅' : '❌';
    const message = `${status} 処理完了: ${this.shortenPath(filePath)} [${method}] (${this.formatDuration(duration)})`;
    
    const level = success ? 'info' : 'warn';
    this.logToConsole(level, message, details);
    this.performanceTracker.log(level, message, { method, duration, success, ...details }, filePath);
  }

  /**
   * メトリクス記録と表示
   */
  metric(name: string, value: number, unit: string = '', category: string = 'performance'): void {
    this.performanceTracker.recordMetric(name, value, unit, category);
    
    if (this.shouldShowMetric(name)) {
      const formattedValue = this.formatMetricValue(value, unit);
      this.logToConsole('debug', `📊 ${name}: ${formattedValue}`);
    }
  }

  /**
   * コスト情報のログ
   */
  cost(operation: string, tokens: number, cost: number, details?: any): void {
    const message = `💰 ${operation}: ${tokens.toLocaleString()} tokens, $${cost.toFixed(4)}`;
    this.logToConsole('info', chalk.yellow(message), details);
    this.performanceTracker.log('info', message, { tokens, cost, ...details });
    
    // メトリクスとしても記録
    this.performanceTracker.recordMetric('tokens_used', tokens, 'tokens', 'cost');
    this.performanceTracker.recordMetric('cost_incurred', cost, 'usd', 'cost');
  }

  /**
   * エラー詳細ログ（スタックトレース含む）
   */
  errorWithStack(message: string, error: Error, filePath?: string): void {
    const details = {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
    
    this.logToConsole('error', `❌ ${message}`, details);
    this.performanceTracker.log('error', message, details, filePath);
  }

  /**
   * パフォーマンス警告
   */
  performanceWarning(operation: string, duration: number, threshold: number, details?: any): void {
    const message = `⚠️ 性能警告: ${operation} が ${this.formatDuration(duration)} (閾値: ${this.formatDuration(threshold)})`;
    this.logToConsole('warn', chalk.yellow(message), details);
    this.performanceTracker.log('warn', message, { operation, duration, threshold, ...details });
  }

  /**
   * メモリ使用量警告
   */
  memoryWarning(current: number, threshold: number): void {
    const message = `⚠️ メモリ警告: ${current.toFixed(1)}MB (閾値: ${threshold}MB)`;
    this.logToConsole('warn', chalk.yellow(message));
    this.performanceTracker.log('warn', message, { current, threshold });
  }

  /**
   * 基本ログメソッド
   */
  private log(level: LogLevel, message: string, details?: any, filePath?: string): void {
    if (this.shouldLog(level)) {
      this.logToConsole(level, message, details);
    }
    
    this.performanceTracker.log(level, message, details, filePath);
  }

  /**
   * コンソール出力
   */
  private logToConsole(level: LogLevel, message: string, details?: any): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    const contextStr = `[${this.context}]`;
    
    let coloredMessage: string;
    
    switch (level) {
      case 'debug':
        coloredMessage = chalk.gray(`${timestamp} ${contextStr} ${message}`);
        break;
      case 'info':
        coloredMessage = chalk.white(`${timestamp} ${contextStr} ${message}`);
        break;
      case 'warn':
        coloredMessage = chalk.yellow(`${timestamp} ${contextStr} ⚠️  ${message}`);
        break;
      case 'error':
        coloredMessage = chalk.red(`${timestamp} ${contextStr} ❌ ${message}`);
        break;
    }

    console.log(coloredMessage);
    
    if (details && (level === 'error' || level === 'warn' || this.logLevel === 'debug')) {
      console.log(chalk.gray('  詳細:', JSON.stringify(details, null, 2)));
    }
  }

  /**
   * ログレベルチェック
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentIndex = levels.indexOf(this.logLevel);
    const messageIndex = levels.indexOf(level);
    return messageIndex >= currentIndex;
  }

  /**
   * メトリクス表示判定
   */
  private shouldShowMetric(name: string): boolean {
    // 重要なメトリクスのみ表示
    const importantMetrics = [
      'execution_time',
      'tokens_used',
      'cost_incurred',
      'memory_rss',
      'files_processed'
    ];
    
    return importantMetrics.some(metric => name.includes(metric));
  }

  /**
   * 進捗バーの作成
   */
  private createProgressBar(percentage: number): string {
    const width = 20;
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return chalk.cyan(`[${bar}] ${percentage}%`);
  }

  /**
   * パスの短縮表示
   */
  private shortenPath(filePath: string): string {
    const parts = filePath.split('/');
    if (parts.length <= 3) return filePath;
    
    return `.../${parts.slice(-2).join('/')}`;
  }

  /**
   * 期間のフォーマット
   */
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${Math.round(ms)}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  }

  /**
   * メトリクス値のフォーマット
   */
  private formatMetricValue(value: number, unit: string): string {
    switch (unit) {
      case 'ms':
        return this.formatDuration(value);
      case 'mb':
        return `${value.toFixed(1)}MB`;
      case 'tokens':
        return `${value.toLocaleString()} tokens`;
      case 'usd':
        return `$${value.toFixed(4)}`;
      case 'percentage':
        return `${value.toFixed(1)}%`;
      default:
        return `${value.toLocaleString()}${unit}`;
    }
  }

  /**
   * 新しいコンテキストのロガーを作成
   */
  createChild(context: string): StructuredLogger {
    return new StructuredLogger(
      this.performanceTracker, 
      `${this.context}:${context}`, 
      this.logLevel
    );
  }

  /**
   * ログレベルの変更
   */
  setLogLevel(level: LogLevel): void {
    this.logLevel = level;
  }
}

/**
 * グローバルロガーのファクトリー
 */
export class LoggerFactory {
  private static performanceTracker: PerformanceTracker | null = null;
  
  static initialize(projectRoot: string): void {
    this.performanceTracker = new PerformanceTracker(projectRoot);
  }
  
  static create(context: string, logLevel: LogLevel = 'info'): StructuredLogger {
    if (!this.performanceTracker) {
      throw new Error('LoggerFactory not initialized. Call LoggerFactory.initialize() first.');
    }
    
    return new StructuredLogger(this.performanceTracker, context, logLevel);
  }
  
  static getPerformanceTracker(): PerformanceTracker {
    if (!this.performanceTracker) {
      throw new Error('LoggerFactory not initialized.');
    }
    
    return this.performanceTracker;
  }
  
  static cleanup(): void {
    if (this.performanceTracker) {
      this.performanceTracker.close();
      this.performanceTracker = null;
    }
  }
}