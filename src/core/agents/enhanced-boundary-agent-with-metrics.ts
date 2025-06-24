import { LoggerFactory, StructuredLogger } from '../utils/structured-logger';
import { MetricsCollector } from '../utils/metrics-collector';
import { PerformanceTracker } from '../utils/performance-tracker';

/**
 * 使用例とベストプラクティス
 */
export class MetricsIntegrationExample {
  /**
   * 既存エージェントにメトリクスを統合する方法の例
   */
  static async integrateMetricsToExistingAgent(): Promise<void> {
    const projectRoot = '/path/to/project';
    
    // 1. パフォーマンストラッキングの初期化
    LoggerFactory.initialize(projectRoot);
    const logger = LoggerFactory.create('MyAgent');
    const performanceTracker = LoggerFactory.getPerformanceTracker();
    const metricsCollector = new MetricsCollector(performanceTracker, logger);

    // 2. エージェント実行の開始
    const runId = metricsCollector.startAgent('MyAgent', projectRoot);

    try {
      // 3. 処理の実行（メトリクス収集付き）
      await metricsCollector.trackFileProcessing(
        'example.go',
        'llm',
        async () => {
          // 実際の処理
          logger.info('ファイルを処理中...');
          await new Promise(resolve => setTimeout(resolve, 1000));
          return { success: true };
        }
      );

      // 4. カスタムメトリクスの記録
      metricsCollector.recordQualityMetrics(85, 7.5, 12, 5);

      // 5. 成功完了
      metricsCollector.completeAgent('completed');
      logger.success('処理が完了しました');

    } catch (error) {
      // 6. エラー処理
      logger.errorWithStack('処理中にエラーが発生', error instanceof Error ? error : new Error(String(error)));
      metricsCollector.completeAgent('failed', error instanceof Error ? error.message : String(error));
    } finally {
      // 7. リソースのクリーンアップ
      LoggerFactory.cleanup();
    }
  }
}