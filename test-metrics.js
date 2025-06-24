#!/usr/bin/env node

import { LoggerFactory } from './dist/core/utils/structured-logger.js';
import { MetricsCollector } from './dist/core/utils/metrics-collector.js';

async function testMetricsSystem() {
  console.log('🧪 パフォーマンス管理システムのテスト開始...');
  
  try {
    // 1. 初期化
    const projectRoot = process.cwd();
    LoggerFactory.initialize(projectRoot);
    
    const logger = LoggerFactory.create('TestAgent');
    const performanceTracker = LoggerFactory.getPerformanceTracker();
    const metricsCollector = new MetricsCollector(performanceTracker, logger);
    
    // 2. エージェント実行開始
    logger.info('エージェント実行を開始...');
    const runId = metricsCollector.startAgent('TestAgent', projectRoot, {
      testMode: true,
      version: '1.0.0'
    });
    
    console.log(`📊 実行ID: ${runId}`);
    
    // 3. ファイル処理のシミュレーション
    await metricsCollector.trackFileProcessing(
      'test-file-1.go',
      'llm',
      async () => {
        logger.info('LLMでファイル処理中...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        return { success: true, extractedLogic: 5 };
      },
      { tokensUsed: 1500, confidenceScore: 85.5 }
    );
    
    await metricsCollector.trackFileProcessing(
      'test-file-2.go',
      'static',
      async () => {
        logger.info('静的解析でファイル処理中...');
        await new Promise(resolve => setTimeout(resolve, 200));
        return { success: true, extractedLogic: 2 };
      },
      { tokensUsed: 0, confidenceScore: 65.0 }
    );
    
    // 4. LLM呼び出しのシミュレーション
    await metricsCollector.trackLLMCall(
      'boundary_extraction',
      800,
      async () => {
        await new Promise(resolve => setTimeout(resolve, 500));
        return { 
          boundaries: ['user', 'order', 'payment'],
          tokensUsed: 750,
          cost: 0.0023
        };
      }
    );
    
    // 5. カスタムメトリクス記録
    metricsCollector.recordQualityMetrics(82.5, 7.2, 12, 8);
    metricsCollector.recordEfficiencyMetrics(75.0, 45.0, 80.0);
    metricsCollector.recordBoundaryMetrics(3, 0, 85.0, 15.0);
    
    // 6. システムメトリクス記録
    metricsCollector.recordSystemMetrics();
    
    // 7. 成功完了
    metricsCollector.completeAgent('completed');
    logger.success('テスト完了!');
    
    console.log('✅ メトリクス記録完了');
    
    // 8. リソースクリーンアップ
    LoggerFactory.cleanup();
    
    return runId;
    
  } catch (error) {
    console.error('❌ テスト中にエラーが発生:', error);
    LoggerFactory.cleanup();
    throw error;
  }
}

testMetricsSystem()
  .then(runId => {
    console.log(`🎉 テスト成功! 実行ID: ${runId}`);
    console.log('📊 メトリクス確認: node dist/cli.js metrics');
  })
  .catch(error => {
    console.error('💥 テスト失敗:', error.message);
    process.exit(1);
  });