#!/usr/bin/env node

import { LoggerFactory } from './dist/core/utils/structured-logger.js';
import { MetricsCollector } from './dist/core/utils/metrics-collector.js';
import { EnhancedBoundaryAgent } from './dist/core/agents/enhanced-boundary-agent.js';

async function testBoundaryAgentWithMetrics() {
  console.log('🧪 メトリクス統合BoundaryAgentのテスト開始...');
  
  try {
    // 1. メトリクスシステム初期化
    const projectRoot = process.cwd() + '/workspace/umitron-www-navy';
    LoggerFactory.initialize(projectRoot);
    
    const logger = LoggerFactory.create('BoundaryAgent');
    const performanceTracker = LoggerFactory.getPerformanceTracker();
    const metricsCollector = new MetricsCollector(performanceTracker, logger);
    
    // 2. エージェント実行開始の記録
    logger.info('BoundaryAgent実行を開始...');
    const runId = metricsCollector.startAgent('BoundaryAgent', projectRoot, {
      mode: 'full_auto',
      sampling: true,
      maxFiles: 50
    });
    
    console.log(`📊 実行ID: ${runId}`);
    
    // 3. Boundary Agentの実行（メトリクス付き）
    metricsCollector.startTimer('boundary_discovery');
    
    // ファイル解析のシミュレーション
    await metricsCollector.trackFileProcessing(
      'backend/models/fish_school.go',
      'llm',
      async () => {
        logger.info('魚群モデルを分析中...');
        await new Promise(resolve => setTimeout(resolve, 800));
        return {
          boundaries: ['fish_management', 'school_operations'],
          confidence: 85.5
        };
      },
      { tokensUsed: 1200, confidenceScore: 85.5, complexityScore: 7.2 }
    );
    
    await metricsCollector.trackFileProcessing(
      'backend/services/daily_input.go',
      'llm',
      async () => {
        logger.info('日次入力サービスを分析中...');
        await new Promise(resolve => setTimeout(resolve, 600));
        return {
          boundaries: ['daily_operations', 'input_management'],
          confidence: 78.0
        };
      },
      { tokensUsed: 950, confidenceScore: 78.0, complexityScore: 6.8 }
    );
    
    await metricsCollector.trackFileProcessing(
      'backend/repositories/fish_preserve.go',
      'static',
      async () => {
        logger.info('魚群保管リポジトリを静的解析中...');
        await new Promise(resolve => setTimeout(resolve, 200));
        return {
          boundaries: ['fish_management', 'storage_operations'],
          confidence: 65.0
        };
      },
      { tokensUsed: 0, confidenceScore: 65.0, complexityScore: 4.5 }
    );
    
    // 4. LLM呼び出しのシミュレーション
    await metricsCollector.trackLLMCall(
      'semantic_clustering',
      1500,
      async () => {
        logger.info('セマンティッククラスタリング実行中...');
        await new Promise(resolve => setTimeout(resolve, 1200));
        return {
          clusters: ['fish_management', 'daily_operations', 'input_management'],
          tokensUsed: 1450,
          cost: 0.0087
        };
      }
    );
    
    await metricsCollector.trackLLMCall(
      'dependency_analysis',
      800,
      async () => {
        logger.info('依存関係分析実行中...');
        await new Promise(resolve => setTimeout(resolve, 900));
        return {
          dependencies: 45,
          circular: 2,
          tokensUsed: 750,
          cost: 0.0045
        };
      }
    );
    
    // 5. 境界発見メトリクスの記録
    metricsCollector.recordBoundaryMetrics(
      21, // 発見された境界数
      2,  // 循環依存数
      78.5, // 結合度スコア
      22.0  // 疎結合度スコア
    );
    
    // 6. 品質メトリクスの記録
    metricsCollector.recordQualityMetrics(
      76.2, // 信頼度スコア
      6.8,  // 複雑度スコア
      18,   // 抽出されたビジネスルール数
      45    // パターンマッチ数
    );
    
    // 7. 効率性メトリクスの記録
    metricsCollector.recordEfficiencyMetrics(
      35.0, // トークン削減率（サンプリングにより）
      60.0, // 時間短縮率
      0.0   // キャッシュヒット率（初回実行のため）
    );
    
    const discoveryTime = metricsCollector.stopTimer('boundary_discovery');
    
    // 8. システムメトリクス記録
    metricsCollector.recordSystemMetrics();
    
    // 9. 成功完了
    metricsCollector.completeAgent('completed');
    logger.success(`境界発見完了! 実行時間: ${Math.round(discoveryTime)}ms`);
    
    console.log('✅ BoundaryAgent with メトリクス記録完了');
    console.log(`⏱️ 実行時間: ${Math.round(discoveryTime / 1000)}秒`);
    console.log(`📊 実行ID: ${runId}`);
    
    // 10. リソースクリーンアップ
    LoggerFactory.cleanup();
    
    return runId;
    
  } catch (error) {
    console.error('❌ テスト中にエラーが発生:', error);
    LoggerFactory.cleanup();
    throw error;
  }
}

testBoundaryAgentWithMetrics()
  .then(runId => {
    console.log(`🎉 テスト成功! 実行ID: ${runId}`);
    console.log('📊 メトリクス確認: node dist/cli.js metrics');
    console.log(`📋 詳細確認: node dist/cli.js metrics --run-id ${runId}`);
  })
  .catch(error => {
    console.error('💥 テスト失敗:', error.message);
    process.exit(1);
  });