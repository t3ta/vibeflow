import chalk from 'chalk';

export interface RateLimitConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  rateLimitCooldownMs: number;
}

export interface RateLimitState {
  consecutiveFailures: number;
  lastFailureTime: number;
  isInCooldown: boolean;
  totalRetries: number;
}

export class RateLimitManager {
  private config: RateLimitConfig;
  private state: RateLimitState;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      maxRetries: 5,
      baseDelayMs: 5000, // 5秒
      maxDelayMs: 300000, // 5分
      backoffMultiplier: 2,
      rateLimitCooldownMs: 900000, // 15分
      ...config
    };

    this.state = {
      consecutiveFailures: 0,
      lastFailureTime: 0,
      isInCooldown: false,
      totalRetries: 0
    };
  }

  async executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName: string = 'operation'
  ): Promise<T> {
    for (let attempt = 1; attempt <= this.config.maxRetries; attempt++) {
      try {
        // Rate Limit cooldown check
        if (this.state.isInCooldown) {
          const timeRemaining = this.getRemainingCooldownTime();
          if (timeRemaining > 0) {
            console.log(chalk.yellow(`⏸️  Rate Limit cooldown: ${Math.ceil(timeRemaining / 60000)}分待機中...`));
            await this.sleep(Math.min(timeRemaining, 60000)); // 最大1分ずつ待機
            continue;
          } else {
            this.exitCooldown();
          }
        }

        const result = await operation();
        this.onSuccess();
        return result;

      } catch (error) {
        const isRateLimit = this.isRateLimitError(error);
        
        if (isRateLimit) {
          this.onRateLimitError();
          console.log(chalk.red(`⚠️  Rate Limit detected: ${operationName} (試行 ${attempt}/${this.config.maxRetries})`));
          
          if (attempt === this.config.maxRetries) {
            console.log(chalk.red(`❌ Rate Limit: 最大リトライ回数に達しました`));
            throw error;
          }

          const delay = this.calculateDelay(attempt);
          console.log(chalk.yellow(`⏳ ${Math.ceil(delay / 1000)}秒後にリトライします...`));
          await this.sleep(delay);
          continue;
        }

        // Rate Limit以外のエラーは即座に投げる
        throw error;
      }
    }

    throw new Error(`Operation failed after ${this.config.maxRetries} attempts`);
  }

  private isRateLimitError(error: any): boolean {
    const message = error?.message?.toLowerCase() || '';
    const statusCode = error?.status || error?.statusCode;

    return (
      statusCode === 429 ||
      message.includes('rate limit') ||
      message.includes('too many requests') ||
      message.includes('quota') ||
      message.includes('throttle')
    );
  }

  private onSuccess(): void {
    this.state.consecutiveFailures = 0;
    this.state.isInCooldown = false;
  }

  private onRateLimitError(): void {
    this.state.consecutiveFailures++;
    this.state.lastFailureTime = Date.now();
    this.state.totalRetries++;

    // 連続失敗が多い場合はcooldownに入る
    if (this.state.consecutiveFailures >= 3) {
      this.enterCooldown();
    }
  }

  private enterCooldown(): void {
    this.state.isInCooldown = true;
    console.log(chalk.red(`🛑 Rate Limit cooldown開始: ${Math.ceil(this.config.rateLimitCooldownMs / 60000)}分間待機`));
  }

  private exitCooldown(): void {
    this.state.isInCooldown = false;
    this.state.consecutiveFailures = 0;
    console.log(chalk.green(`✅ Rate Limit cooldown終了: 処理再開`));
  }

  private getRemainingCooldownTime(): number {
    if (!this.state.isInCooldown) return 0;
    
    const elapsed = Date.now() - this.state.lastFailureTime;
    return Math.max(0, this.config.rateLimitCooldownMs - elapsed);
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay = this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt - 1);
    const jitter = Math.random() * 1000; // 0-1秒のランダム要素
    return Math.min(exponentialDelay + jitter, this.config.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getState(): RateLimitState {
    return { ...this.state };
  }

  getConfig(): RateLimitConfig {
    return { ...this.config };
  }

  reset(): void {
    this.state = {
      consecutiveFailures: 0,
      lastFailureTime: 0,
      isInCooldown: false,
      totalRetries: 0
    };
  }

  // 統計情報を表示
  printStats(): void {
    console.log(chalk.blue('\n📊 Rate Limit統計:'));
    console.log(`   • 総リトライ回数: ${this.state.totalRetries}`);
    console.log(`   • 連続失敗回数: ${this.state.consecutiveFailures}`);
    console.log(`   • Cooldown状態: ${this.state.isInCooldown ? 'Yes' : 'No'}`);
    
    if (this.state.isInCooldown) {
      const remaining = this.getRemainingCooldownTime();
      console.log(`   • 残り待機時間: ${Math.ceil(remaining / 60000)}分`);
    }
  }
}

// バッチ処理用のユーティリティ
export class BatchProcessor<T> {
  private rateLimitManager: RateLimitManager;
  
  constructor(rateLimitConfig?: Partial<RateLimitConfig>) {
    this.rateLimitManager = new RateLimitManager(rateLimitConfig);
  }

  async processBatch(
    items: T[],
    processor: (item: T, index: number) => Promise<any>,
    batchSize: number = 1,
    progressCallback?: (processed: number, total: number) => void
  ): Promise<any[]> {
    const results: any[] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      for (let j = 0; j < batch.length; j++) {
        const item = batch[j];
        const globalIndex = i + j;
        
        try {
          const result = await this.rateLimitManager.executeWithRetry(
            () => processor(item, globalIndex),
            `Processing item ${globalIndex + 1}/${items.length}`
          );
          
          results.push(result);
          
          if (progressCallback) {
            progressCallback(globalIndex + 1, items.length);
          }
          
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          console.error(chalk.red(`❌ Failed to process item ${globalIndex + 1}: ${errorMessage}`));
          results.push({ error: errorMessage, item });
        }
      }
      
      // バッチ間の小休止
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    this.rateLimitManager.printStats();
    return results;
  }
}

// CLI integration helper
export async function createRateLimitAwareExecution<T>(
  operation: () => Promise<T>,
  options: {
    name?: string;
    maxRetries?: number;
    cooldownMinutes?: number;
    showProgress?: boolean;
  } = {}
): Promise<T> {
  const manager = new RateLimitManager({
    maxRetries: options.maxRetries || 5,
    rateLimitCooldownMs: (options.cooldownMinutes || 15) * 60 * 1000
  });

  if (options.showProgress) {
    const interval = setInterval(() => {
      manager.printStats();
    }, 30000); // 30秒ごとに統計表示

    try {
      const result = await manager.executeWithRetry(operation, options.name);
      clearInterval(interval);
      return result;
    } catch (error) {
      clearInterval(interval);
      throw error;
    }
  } else {
    return manager.executeWithRetry(operation, options.name);
  }
}