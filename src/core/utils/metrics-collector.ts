import { PerformanceTracker, ProcessingMethod } from './performance-tracker';
import { StructuredLogger } from './structured-logger';
import { performance } from 'perf_hooks';

/**
 * MetricsCollector - エージェント用の標準メトリクス収集システム
 * 各エージェントが共通して使用できるメトリクス収集機能を提供
 */
export class MetricsCollector {
  private performanceTracker: PerformanceTracker;
  private logger: StructuredLogger;
  private timers: Map<string, number> = new Map();
  private counters: Map<string, number> = new Map();

  constructor(performanceTracker: PerformanceTracker, logger: StructuredLogger) {
    this.performanceTracker = performanceTracker;
    this.logger = logger;
  }

  /**
   * エージェント実行の開始
   */
  startAgent(agentName: string, projectPath: string, configuration?: any): number {
    this.logger.agentStart(agentName, projectPath, configuration);
    
    const runId = this.performanceTracker.startAgentRun(agentName, projectPath, configuration);
    
    // 初期メトリクス
    this.recordSystemMetrics();
    this.resetCounters();
    
    return runId;
  }

  /**
   * エージェント実行の完了
   */
  completeAgent(status: 'completed' | 'failed' | 'cancelled', errorSummary?: string): void {
    // 最終メトリクス
    this.recordSystemMetrics();
    this.recordCounterMetrics();
    
    this.performanceTracker.completeAgentRun(status, errorSummary);
    
    const agentName = this.getCurrentAgentName();
    if (agentName) {
      const duration = this.getTimer('agent_execution') || 0;
      this.logger.agentComplete(agentName, duration, this.getSummaryStats());
    }
  }

  /**
   * ファイル処理の追跡
   */
  trackFileProcessing<T>(
    filePath: string,
    method: ProcessingMethod,
    processor: () => Promise<T>,
    metadata?: any
  ): Promise<T> {
    return this.performanceTracker.measureExecutionTimeAsync(
      `file_processing_${method}`,
      async () => {
        const processingId = this.performanceTracker.startFileProcessing(filePath, method, metadata);
        const startTime = performance.now();
        
        this.logger.fileStart(filePath, method, metadata);
        
        try {
          const result = await processor();
          
          const duration = performance.now() - startTime;
          const success = true;
          
          this.performanceTracker.completeFileProcessing(
            processingId,
            success,
            metadata?.tokensUsed || 0,
            metadata?.cost || 0,
            metadata?.confidenceScore,
            metadata?.complexityScore
          );
          
          this.logger.fileComplete(filePath, method, duration, success, metadata);
          this.incrementCounter(`files_${method}_success`);
          
          return result;
          
        } catch (error) {
          const duration = performance.now() - startTime;
          const success = false;
          
          this.performanceTracker.completeFileProcessing(
            processingId,
            success,
            0,
            0,
            undefined,
            undefined,
            error instanceof Error ? error.message : String(error)
          );
          
          this.logger.fileComplete(filePath, method, duration, success, { error: error instanceof Error ? error.message : String(error) });
          this.incrementCounter(`files_${method}_failed`);
          
          throw error;
        }
      }
    );
  }

  /**
   * LLM API呼び出しの追跡
   */
  async trackLLMCall<T>(
    operation: string,
    estimatedTokens: number,
    apiCall: () => Promise<T & { tokensUsed?: number; cost?: number }>
  ): Promise<T> {
    const startTime = performance.now();
    
    try {
      const result = await apiCall();
      const duration = performance.now() - startTime;
      
      const actualTokens = result.tokensUsed || estimatedTokens;
      const cost = result.cost || this.estimateCost(actualTokens);
      
      this.logger.cost(operation, actualTokens, cost);
      
      // メトリクス記録
      this.performanceTracker.recordMetric('llm_call_duration', duration, 'ms', 'performance');
      this.performanceTracker.recordMetric('llm_tokens_used', actualTokens, 'tokens', 'cost');
      this.performanceTracker.recordMetric('llm_cost', cost, 'usd', 'cost');
      
      this.incrementCounter('llm_calls_success');
      this.addToCounter('total_tokens', actualTokens);
      this.addToCounter('total_cost', cost);
      
      // パフォーマンス警告
      if (duration > 30000) { // 30秒以上
        this.logger.performanceWarning(operation, duration, 30000);
      }
      
      return result;
      
    } catch (error) {
      const duration = performance.now() - startTime;
      
      this.logger.errorWithStack(`LLM呼び出し失敗: ${operation}`, error instanceof Error ? error : new Error(String(error)));
      
      this.performanceTracker.recordMetric('llm_call_duration', duration, 'ms', 'performance');
      this.incrementCounter('llm_calls_failed');
      
      throw error;
    }
  }

  /**
   * 品質メトリクスの記録
   */
  recordQualityMetrics(
    confidenceScore: number,
    complexityScore: number,
    businessRulesCount: number,
    patternMatchCount: number
  ): void {
    this.performanceTracker.recordMetric('confidence_score', confidenceScore, 'percentage', 'quality');
    this.performanceTracker.recordMetric('complexity_score', complexityScore, 'score', 'quality');
    this.performanceTracker.recordMetric('business_rules_extracted', businessRulesCount, 'count', 'quality');
    this.performanceTracker.recordMetric('patterns_matched', patternMatchCount, 'count', 'quality');
    
    this.logger.metric('quality_confidence', confidenceScore, 'percentage', 'quality');
    this.logger.metric('code_complexity', complexityScore, 'score', 'quality');
  }

  /**
   * 効率性メトリクスの記録
   */
  recordEfficiencyMetrics(
    tokenReduction: number,
    timeReduction: number,
    cacheHitRate: number
  ): void {
    this.performanceTracker.recordMetric('token_reduction', tokenReduction, 'percentage', 'efficiency');
    this.performanceTracker.recordMetric('time_reduction', timeReduction, 'percentage', 'efficiency');
    this.performanceTracker.recordMetric('cache_hit_rate', cacheHitRate, 'percentage', 'efficiency');
    
    this.logger.metric('token_savings', tokenReduction, 'percentage', 'efficiency');
    this.logger.metric('time_savings', timeReduction, 'percentage', 'efficiency');
  }

  /**
   * タイマーの開始
   */
  startTimer(name: string): void {
    this.timers.set(name, performance.now());
  }

  /**
   * タイマーの停止と記録
   */
  stopTimer(name: string): number {
    const startTime = this.timers.get(name);
    if (!startTime) {
      this.logger.warn(`Timer '${name}' not found`);
      return 0;
    }
    
    const duration = performance.now() - startTime;
    this.timers.delete(name);
    
    this.performanceTracker.recordMetric(`timer_${name}`, duration, 'ms', 'performance');
    this.logger.metric(`execution_time_${name}`, duration, 'ms', 'performance');
    
    return duration;
  }

  /**
   * タイマーの取得（停止しない）
   */
  getTimer(name: string): number | null {
    const startTime = this.timers.get(name);
    return startTime ? performance.now() - startTime : null;
  }

  /**
   * カウンターのインクリメント
   */
  incrementCounter(name: string, amount: number = 1): void {
    const current = this.counters.get(name) || 0;
    this.counters.set(name, current + amount);
  }

  /**
   * カウンターへの加算
   */
  addToCounter(name: string, value: number): void {
    this.incrementCounter(name, value);
  }

  /**
   * カウンターの取得
   */
  getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  /**
   * システムメトリクスの記録
   */
  recordSystemMetrics(): void {
    this.performanceTracker.recordMemoryUsage();
    
    const memUsage = process.memoryUsage();
    const memoryThreshold = 512; // 512MB
    
    if (memUsage.heapUsed / 1024 / 1024 > memoryThreshold) {
      this.logger.memoryWarning(memUsage.heapUsed / 1024 / 1024, memoryThreshold);
    }
    
    // CPU使用率（簡易）
    const cpuUsage = process.cpuUsage();
    this.performanceTracker.recordMetric('cpu_user', cpuUsage.user / 1000, 'ms', 'performance');
    this.performanceTracker.recordMetric('cpu_system', cpuUsage.system / 1000, 'ms', 'performance');
  }

  /**
   * カウンターメトリクスの記録
   */
  private recordCounterMetrics(): void {
    for (const [name, value] of this.counters.entries()) {
      this.performanceTracker.recordMetric(`counter_${name}`, value, 'count', 'performance');
    }
  }

  /**
   * カウンターのリセット
   */
  private resetCounters(): void {
    this.counters.clear();
    this.timers.clear();
    this.startTimer('agent_execution');
  }

  /**
   * コスト推定（簡易）
   */
  private estimateCost(tokens: number): number {
    // Claude-3.5-Sonnet pricing (approximate)
    const inputCostPer1k = 0.003;
    const outputCostPer1k = 0.015;
    
    // 入力:出力を3:1と仮定
    const inputTokens = tokens * 0.75;
    const outputTokens = tokens * 0.25;
    
    return (inputTokens / 1000 * inputCostPer1k) + (outputTokens / 1000 * outputCostPer1k);
  }

  /**
   * サマリー統計の取得
   */
  private getSummaryStats(): any {
    return {
      files_processed: this.getCounter('files_llm_success') + this.getCounter('files_template_success') + this.getCounter('files_static_success'),
      files_failed: this.getCounter('files_llm_failed') + this.getCounter('files_template_failed') + this.getCounter('files_static_failed'),
      llm_calls: this.getCounter('llm_calls_success'),
      llm_failures: this.getCounter('llm_calls_failed'),
      total_tokens: this.getCounter('total_tokens'),
      total_cost: this.getCounter('total_cost')
    };
  }

  /**
   * 現在のエージェント名を取得（簡易実装）
   */
  private getCurrentAgentName(): string | null {
    // 実際の実装では、PerformanceTrackerから現在のrun情報を取得
    return null; // TODO: 実装
  }

  /**
   * 境界発見特有のメトリクス
   */
  recordBoundaryMetrics(
    boundariesFound: number,
    circularDependencies: number,
    cohesionScore: number,
    couplingScore: number
  ): void {
    this.performanceTracker.recordMetric('boundaries_found', boundariesFound, 'count', 'quality');
    this.performanceTracker.recordMetric('circular_dependencies', circularDependencies, 'count', 'quality');
    this.performanceTracker.recordMetric('cohesion_score', cohesionScore, 'score', 'quality');
    this.performanceTracker.recordMetric('coupling_score', couplingScore, 'score', 'quality');
    
    this.logger.info(`🔍 境界発見: ${boundariesFound}個, 循環依存: ${circularDependencies}個`);
    this.logger.metric('boundaries_discovered', boundariesFound, 'count', 'quality');
  }

  /**
   * リファクタリング特有のメトリクス
   */
  recordRefactoringMetrics(
    patchesGenerated: number,
    patchesApplied: number,
    buildSuccess: boolean,
    testsPassed: number,
    testsFailed: number
  ): void {
    this.performanceTracker.recordMetric('patches_generated', patchesGenerated, 'count', 'quality');
    this.performanceTracker.recordMetric('patches_applied', patchesApplied, 'count', 'quality');
    this.performanceTracker.recordMetric('build_success', buildSuccess ? 1 : 0, 'boolean', 'quality');
    this.performanceTracker.recordMetric('tests_passed', testsPassed, 'count', 'quality');
    this.performanceTracker.recordMetric('tests_failed', testsFailed, 'count', 'quality');
    
    const successRate = patchesGenerated > 0 ? (patchesApplied / patchesGenerated) * 100 : 0;
    this.logger.info(`🔧 リファクタリング: ${patchesApplied}/${patchesGenerated}パッチ適用 (${successRate.toFixed(1)}%)`);
  }

  /**
   * メトリクスの一括エクスポート
   */
  exportMetrics(): any {
    return {
      timers: Object.fromEntries(this.timers),
      counters: Object.fromEntries(this.counters),
      summary: this.getSummaryStats()
    };
  }
}