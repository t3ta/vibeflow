import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { performance } from 'perf_hooks';

/**
 * PerformanceTracker - SQLiteベースのパフォーマンス記録システム
 * 大きなログファイルの問題を解決し、構造化されたメトリクス管理を提供
 */
export class PerformanceTracker {
  private db!: Database.Database;
  private dbPath: string;
  private currentRunId: number | null = null;

  constructor(projectRoot: string) {
    const vibeflowDir = path.join(projectRoot, '.vibeflow');
    this.dbPath = path.join(vibeflowDir, 'performance.db');
    this.initializeDatabaseSync();
  }

  /**
   * データベースの初期化とスキーマ作成（同期版）
   */
  private initializeDatabaseSync(): void {
    // .vibeflowディレクトリの作成
    const dirPath = path.dirname(this.dbPath);
    try {
      require('fs').mkdirSync(dirPath, { recursive: true });
    } catch (error) {
      // ディレクトリが既に存在する場合は無視
    }
    
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL'); // 高性能化
    this.db.pragma('synchronous = NORMAL');
    
    // テーブル作成
    this.createTables();
  }

  /**
   * SQLiteテーブルの作成
   */
  private createTables(): void {
    // エージェント実行履歴テーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agent_runs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent_name TEXT NOT NULL,
        project_path TEXT NOT NULL,
        start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        status TEXT NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed', 'cancelled'
        version TEXT NOT NULL DEFAULT '1.0.0',
        total_files INTEGER DEFAULT 0,
        processed_files INTEGER DEFAULT 0,
        failed_files INTEGER DEFAULT 0,
        total_tokens INTEGER DEFAULT 0,
        total_cost REAL DEFAULT 0.0,
        configuration TEXT, -- JSON
        error_summary TEXT
      );
    `);

    // ファイル処理詳細テーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS file_processing (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        processing_method TEXT NOT NULL, -- 'llm', 'template', 'static', 'cache'
        start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        tokens_used INTEGER DEFAULT 0,
        cost REAL DEFAULT 0.0,
        confidence_score REAL,
        complexity_score REAL,
        success BOOLEAN NOT NULL DEFAULT 0,
        error_message TEXT,
        metadata TEXT, -- JSON
        FOREIGN KEY (run_id) REFERENCES agent_runs (id)
      );
    `);

    // パフォーマンスメトリクステーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER NOT NULL,
        metric_name TEXT NOT NULL,
        metric_value REAL NOT NULL,
        metric_unit TEXT, -- 'ms', 'tokens', 'mb', 'percentage'
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        category TEXT, -- 'performance', 'quality', 'cost', 'efficiency'
        FOREIGN KEY (run_id) REFERENCES agent_runs (id)
      );
    `);

    // エラー・警告ログテーブル
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS log_entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        run_id INTEGER,
        level TEXT NOT NULL, -- 'debug', 'info', 'warn', 'error'
        message TEXT NOT NULL,
        details TEXT, -- JSON
        file_path TEXT,
        timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (run_id) REFERENCES agent_runs (id)
      );
    `);

    // インデックス作成
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_agent_runs_agent_name ON agent_runs(agent_name);
      CREATE INDEX IF NOT EXISTS idx_agent_runs_start_time ON agent_runs(start_time);
      CREATE INDEX IF NOT EXISTS idx_file_processing_run_id ON file_processing(run_id);
      CREATE INDEX IF NOT EXISTS idx_file_processing_method ON file_processing(processing_method);
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_run_id ON performance_metrics(run_id);
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_name ON performance_metrics(metric_name);
      CREATE INDEX IF NOT EXISTS idx_log_entries_run_id ON log_entries(run_id);
      CREATE INDEX IF NOT EXISTS idx_log_entries_level ON log_entries(level);
    `);
  }

  /**
   * 新しいエージェント実行の開始記録
   */
  startAgentRun(agentName: string, projectPath: string, configuration?: any): number {
    const stmt = this.db.prepare(`
      INSERT INTO agent_runs (agent_name, project_path, configuration, version)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      agentName,
      projectPath,
      configuration ? JSON.stringify(configuration) : null,
      process.env.VIBEFLOW_VERSION || '1.0.0'
    );
    
    this.currentRunId = result.lastInsertRowid as number;
    
    // 開始メトリクス記録
    this.recordMetric('execution_start', Date.now(), 'ms', 'performance');
    
    return this.currentRunId;
  }

  /**
   * エージェント実行の完了記録
   */
  completeAgentRun(status: 'completed' | 'failed' | 'cancelled', errorSummary?: string): void {
    if (!this.currentRunId) return;

    const stmt = this.db.prepare(`
      UPDATE agent_runs 
      SET end_time = CURRENT_TIMESTAMP, status = ?, error_summary = ?
      WHERE id = ?
    `);
    
    stmt.run(status, errorSummary || null, this.currentRunId);
    
    // 完了メトリクス記録
    this.recordMetric('execution_end', Date.now(), 'ms', 'performance');
    this.calculateRunSummary();
  }

  /**
   * ファイル処理の開始記録
   */
  startFileProcessing(filePath: string, method: ProcessingMethod, metadata?: any): number {
    if (!this.currentRunId) {
      throw new Error('No active run. Call startAgentRun first.');
    }

    const stmt = this.db.prepare(`
      INSERT INTO file_processing (run_id, file_path, processing_method, metadata)
      VALUES (?, ?, ?, ?)
    `);
    
    const result = stmt.run(
      this.currentRunId,
      filePath,
      method,
      metadata ? JSON.stringify(metadata) : null
    );
    
    return result.lastInsertRowid as number;
  }

  /**
   * ファイル処理の完了記録
   */
  completeFileProcessing(
    processingId: number,
    success: boolean,
    tokensUsed: number = 0,
    cost: number = 0,
    confidenceScore?: number,
    complexityScore?: number,
    errorMessage?: string
  ): void {
    const stmt = this.db.prepare(`
      UPDATE file_processing 
      SET end_time = CURRENT_TIMESTAMP, success = ?, tokens_used = ?, cost = ?, 
          confidence_score = ?, complexity_score = ?, error_message = ?
      WHERE id = ?
    `);
    
    stmt.run(
      success ? 1 : 0,
      tokensUsed,
      cost,
      confidenceScore || null,
      complexityScore || null,
      errorMessage || null,
      processingId
    );

    // ファイル単位のメトリクス記録
    if (tokensUsed > 0) {
      this.recordMetric('tokens_per_file', tokensUsed, 'tokens', 'cost');
    }
    if (cost > 0) {
      this.recordMetric('cost_per_file', cost, 'usd', 'cost');
    }
  }

  /**
   * パフォーマンスメトリクスの記録
   */
  recordMetric(
    name: string, 
    value: number, 
    unit: string = '', 
    category: string = 'performance'
  ): void {
    if (!this.currentRunId) return;

    const stmt = this.db.prepare(`
      INSERT INTO performance_metrics (run_id, metric_name, metric_value, metric_unit, category)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(this.currentRunId, name, value, unit, category);
  }

  /**
   * 構造化ログエントリの記録
   */
  log(
    level: LogLevel, 
    message: string, 
    details?: any, 
    filePath?: string
  ): void {
    const stmt = this.db.prepare(`
      INSERT INTO log_entries (run_id, level, message, details, file_path)
      VALUES (?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      this.currentRunId || null,
      level,
      message,
      details ? JSON.stringify(details) : null,
      filePath || null
    );

    // 重要なログは標準出力にも出力
    if (level === 'error' || level === 'warn') {
      console.log(`[${level.toUpperCase()}] ${message}`);
      if (details) {
        console.log('Details:', details);
      }
    }
  }

  /**
   * 実行サマリの計算と更新
   */
  private calculateRunSummary(): void {
    if (!this.currentRunId) return;

    const summary = this.db.prepare(`
      SELECT 
        COUNT(*) as total_files,
        SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as processed_files,
        SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed_files,
        SUM(tokens_used) as total_tokens,
        SUM(cost) as total_cost
      FROM file_processing 
      WHERE run_id = ?
    `).get(this.currentRunId) as any;

    const updateStmt = this.db.prepare(`
      UPDATE agent_runs 
      SET total_files = ?, processed_files = ?, failed_files = ?, 
          total_tokens = ?, total_cost = ?
      WHERE id = ?
    `);

    updateStmt.run(
      summary.total_files,
      summary.processed_files,
      summary.failed_files,
      summary.total_tokens,
      summary.total_cost,
      this.currentRunId
    );
  }

  /**
   * 実行履歴の取得
   */
  getRunHistory(agentName?: string, limit: number = 50): AgentRunSummary[] {
    let query = `
      SELECT id, agent_name, project_path, start_time, end_time, status, 
             total_files, processed_files, failed_files, total_tokens, total_cost
      FROM agent_runs
    `;
    
    const params: any[] = [];
    
    if (agentName) {
      query += ` WHERE agent_name = ?`;
      params.push(agentName);
    }
    
    query += ` ORDER BY start_time DESC LIMIT ?`;
    params.push(limit);

    return this.db.prepare(query).all(...params) as AgentRunSummary[];
  }

  /**
   * 詳細な実行情報の取得
   */
  getRunDetails(runId: number): RunDetails | null {
    const run = this.db.prepare(`
      SELECT * FROM agent_runs WHERE id = ?
    `).get(runId) as any;

    if (!run) return null;

    const files = this.db.prepare(`
      SELECT * FROM file_processing WHERE run_id = ? ORDER BY start_time
    `).all(runId) as any[];

    const metrics = this.db.prepare(`
      SELECT * FROM performance_metrics WHERE run_id = ? ORDER BY timestamp
    `).all(runId) as any[];

    const logs = this.db.prepare(`
      SELECT * FROM log_entries WHERE run_id = ? ORDER BY timestamp
    `).all(runId) as any[];

    return {
      run,
      files,
      metrics,
      logs
    };
  }

  /**
   * パフォーマンス統計の取得
   */
  getPerformanceStats(agentName?: string, days: number = 30): PerformanceStats {
    const dateFilter = `datetime('now', '-${days} days')`;
    
    let baseQuery = `
      FROM agent_runs 
      WHERE start_time >= ${dateFilter}
    `;
    
    const params: any[] = [];
    
    if (agentName) {
      baseQuery += ` AND agent_name = ?`;
      params.push(agentName);
    }

    const totalRuns = this.db.prepare(`SELECT COUNT(*) as count ${baseQuery}`).get(...params) as any;
    
    const successRate = this.db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed
      ${baseQuery}
    `).get(...params) as any;

    const avgMetrics = this.db.prepare(`
      SELECT 
        AVG(total_tokens) as avg_tokens,
        AVG(total_cost) as avg_cost,
        AVG(processed_files) as avg_files,
        AVG(CAST((julianday(end_time) - julianday(start_time)) * 24 * 60 AS INTEGER)) as avg_duration_minutes
      ${baseQuery} AND end_time IS NOT NULL
    `).get(...params) as any;

    return {
      totalRuns: totalRuns.count,
      successRate: successRate.total > 0 ? (successRate.completed / successRate.total) * 100 : 0,
      averageTokens: avgMetrics.avg_tokens || 0,
      averageCost: avgMetrics.avg_cost || 0,
      averageFiles: avgMetrics.avg_files || 0,
      averageDurationMinutes: avgMetrics.avg_duration_minutes || 0
    };
  }

  /**
   * メモリ使用量の記録
   */
  recordMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    this.recordMetric('memory_rss', memUsage.rss / 1024 / 1024, 'mb', 'performance');
    this.recordMetric('memory_heap_used', memUsage.heapUsed / 1024 / 1024, 'mb', 'performance');
  }

  /**
   * 実行時間の測定ヘルパー
   */
  measureExecutionTime<T>(operation: string, fn: () => T): T {
    const start = performance.now();
    const result = fn();
    const duration = performance.now() - start;
    
    this.recordMetric(`execution_time_${operation}`, duration, 'ms', 'performance');
    
    return result;
  }

  /**
   * 非同期実行時間の測定ヘルパー
   */
  async measureExecutionTimeAsync<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;
    
    this.recordMetric(`execution_time_${operation}`, duration, 'ms', 'performance');
    
    return result;
  }

  /**
   * データベースのクリーンアップ（古いデータの削除）
   */
  cleanup(retentionDays: number = 90): void {
    const cutoffDate = `datetime('now', '-${retentionDays} days')`;
    
    this.db.prepare(`DELETE FROM log_entries WHERE timestamp < ${cutoffDate}`).run();
    this.db.prepare(`DELETE FROM performance_metrics WHERE timestamp < ${cutoffDate}`).run();
    this.db.prepare(`DELETE FROM file_processing WHERE run_id IN (
      SELECT id FROM agent_runs WHERE start_time < ${cutoffDate}
    )`).run();
    this.db.prepare(`DELETE FROM agent_runs WHERE start_time < ${cutoffDate}`).run();
    
    // VACUUM for space reclamation
    this.db.pragma('optimize');
  }

  /**
   * データベース接続のクローズ
   */
  close(): void {
    if (this.db) {
      this.db.close();
    }
  }
}

// 型定義
export type ProcessingMethod = 'llm' | 'template' | 'static' | 'cache';
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface AgentRunSummary {
  id: number;
  agent_name: string;
  project_path: string;
  start_time: string;
  end_time: string | null;
  status: string;
  total_files: number;
  processed_files: number;
  failed_files: number;
  total_tokens: number;
  total_cost: number;
}

export interface RunDetails {
  run: any;
  files: any[];
  metrics: any[];
  logs: any[];
}

export interface PerformanceStats {
  totalRuns: number;
  successRate: number;
  averageTokens: number;
  averageCost: number;
  averageFiles: number;
  averageDurationMinutes: number;
}