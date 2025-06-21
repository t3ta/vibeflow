import * as fs from 'fs/promises';
import * as path from 'path';

export interface CostLimit {
  daily: number;
  monthly: number;
  perRun: number;
}

export interface UsageRecord {
  timestamp: string;
  tokens: number;
  cost: number;
  operation: string;
}

/**
 * Cost management for AI operations
 * Tracks usage, enforces limits, and provides reporting
 */
export class CostManager {
  private readonly configPath: string;
  private readonly usagePath: string;
  private limits: CostLimit;
  private currentUsage: UsageRecord[] = [];

  constructor(projectRoot: string) {
    const vibeflowDir = path.join(projectRoot, '.vibeflow');
    this.configPath = path.join(vibeflowDir, 'cost-limits.json');
    this.usagePath = path.join(vibeflowDir, 'usage-history.json');
    
    // Default limits
    this.limits = {
      daily: parseFloat(process.env.VIBEFLOW_DAILY_LIMIT || '10.00'),
      monthly: parseFloat(process.env.VIBEFLOW_MONTHLY_LIMIT || '100.00'),
      perRun: parseFloat(process.env.VIBEFLOW_RUN_LIMIT || '5.00')
    };
  }

  /**
   * Initialize cost manager and load history
   */
  async initialize(): Promise<void> {
    // Ensure directories exist
    const dir = path.dirname(this.configPath);
    await fs.mkdir(dir, { recursive: true });

    // Load limits if exists
    try {
      const limitsData = await fs.readFile(this.configPath, 'utf8');
      this.limits = { ...this.limits, ...JSON.parse(limitsData) };
    } catch {
      // Save default limits
      await this.saveLimits();
    }

    // Load usage history
    try {
      const usageData = await fs.readFile(this.usagePath, 'utf8');
      this.currentUsage = JSON.parse(usageData);
    } catch {
      this.currentUsage = [];
    }
  }

  /**
   * Check if operation is within cost limits
   */
  async checkLimits(estimatedCost: number, operation: string): Promise<{
    allowed: boolean;
    reason?: string;
    currentDaily: number;
    currentMonthly: number;
  }> {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Calculate current usage
    const dailyUsage = this.currentUsage
      .filter(u => new Date(u.timestamp) >= todayStart)
      .reduce((sum, u) => sum + u.cost, 0);

    const monthlyUsage = this.currentUsage
      .filter(u => new Date(u.timestamp) >= monthStart)
      .reduce((sum, u) => sum + u.cost, 0);

    // Check limits
    if (estimatedCost > this.limits.perRun) {
      return {
        allowed: false,
        reason: `Estimated cost ($${estimatedCost.toFixed(2)}) exceeds per-run limit ($${this.limits.perRun.toFixed(2)})`,
        currentDaily: dailyUsage,
        currentMonthly: monthlyUsage
      };
    }

    if (dailyUsage + estimatedCost > this.limits.daily) {
      return {
        allowed: false,
        reason: `Would exceed daily limit. Current: $${dailyUsage.toFixed(2)}, Limit: $${this.limits.daily.toFixed(2)}`,
        currentDaily: dailyUsage,
        currentMonthly: monthlyUsage
      };
    }

    if (monthlyUsage + estimatedCost > this.limits.monthly) {
      return {
        allowed: false,
        reason: `Would exceed monthly limit. Current: $${monthlyUsage.toFixed(2)}, Limit: $${this.limits.monthly.toFixed(2)}`,
        currentDaily: dailyUsage,
        currentMonthly: monthlyUsage
      };
    }

    return {
      allowed: true,
      currentDaily: dailyUsage,
      currentMonthly: monthlyUsage
    };
  }

  /**
   * Record actual usage
   */
  async recordUsage(tokens: number, cost: number, operation: string): Promise<void> {
    const record: UsageRecord = {
      timestamp: new Date().toISOString(),
      tokens,
      cost,
      operation
    };

    this.currentUsage.push(record);
    
    // Keep only last 90 days
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);
    this.currentUsage = this.currentUsage.filter(
      u => new Date(u.timestamp) > cutoffDate
    );

    await this.saveUsage();
  }

  /**
   * Get usage report
   */
  getUsageReport(): {
    today: { tokens: number; cost: number; operations: number };
    thisMonth: { tokens: number; cost: number; operations: number };
    limits: CostLimit;
  } {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const todayUsage = this.currentUsage.filter(
      u => new Date(u.timestamp) >= todayStart
    );
    const monthUsage = this.currentUsage.filter(
      u => new Date(u.timestamp) >= monthStart
    );

    return {
      today: {
        tokens: todayUsage.reduce((sum, u) => sum + u.tokens, 0),
        cost: todayUsage.reduce((sum, u) => sum + u.cost, 0),
        operations: todayUsage.length
      },
      thisMonth: {
        tokens: monthUsage.reduce((sum, u) => sum + u.tokens, 0),
        cost: monthUsage.reduce((sum, u) => sum + u.cost, 0),
        operations: monthUsage.length
      },
      limits: this.limits
    };
  }

  /**
   * Update cost limits
   */
  async updateLimits(newLimits: Partial<CostLimit>): Promise<void> {
    this.limits = { ...this.limits, ...newLimits };
    await this.saveLimits();
  }

  private async saveLimits(): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(this.limits, null, 2));
  }

  private async saveUsage(): Promise<void> {
    await fs.writeFile(this.usagePath, JSON.stringify(this.currentUsage, null, 2));
  }
}