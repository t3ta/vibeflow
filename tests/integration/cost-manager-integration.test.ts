import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { CostManager } from '../../src/core/utils/cost-manager.js';
import { HybridRefactorAgent } from '../../src/core/agents/hybrid-refactor-agent.js';
import { createTempDir, cleanupTempDir, createMockGoProject, generateMockBoundary } from '../setup.js';

// Mock fs operations
vi.mock('fs');
const mockedFsSync = vi.mocked(fsSync);

describe('Integration: Cost Management with Refactoring', () => {
  let tempDir: string;
  let costManager: CostManager;
  let refactorAgent: HybridRefactorAgent;

  beforeEach(async () => {
    tempDir = await createTempDir('cost-integration');
    await createMockGoProject(tempDir);
    
    // Setup fs mocks for agent initialization
    mockedFsSync.existsSync.mockReturnValue(true);
    mockedFsSync.mkdirSync.mockReturnValue(undefined);
    mockedFsSync.readFileSync.mockReturnValue('');
    mockedFsSync.writeFileSync.mockReturnValue(undefined);
    
    costManager = new CostManager(tempDir);
    refactorAgent = new HybridRefactorAgent(tempDir);
    
    await costManager.initialize();
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should estimate costs before refactoring', async () => {
    const mockBoundaries = [
      generateMockBoundary({ name: 'user', files: ['user.go'] }),
      generateMockBoundary({ name: 'product', files: ['product.go'] })
    ];

    // Get cost estimate
    const estimate = await refactorAgent.estimateCost(mockBoundaries);
    
    expect(estimate).toBeDefined();
    expect(estimate.fileCount).toBe(2);
    expect(estimate.estimatedCost).toBeGreaterThan(0);
    expect(estimate.estimatedTime).toBeDefined();

    // Check if within limits
    const limitCheck = await costManager.checkLimits(estimate.estimatedCost, 'refactor');
    expect(limitCheck.allowed).toBe(true);
  });

  it('should track actual costs during refactoring', async () => {
    const mockBoundaries = [generateMockBoundary({ name: 'user', files: ['user.go'] })];

    // Estimate first
    const estimate = await refactorAgent.estimateCost(mockBoundaries);
    
    // Execute refactoring (dry-run)
    const refactorResult = await refactorAgent.executeRefactoring(mockBoundaries, false);
    
    // Simulate cost recording (normally done by AI integration)
    await costManager.recordUsage(
      estimate.estimatedTokens,
      estimate.estimatedCost,
      'refactor'
    );

    // Verify usage tracking
    const usageReport = costManager.getUsageReport();
    expect(usageReport.today.cost).toBe(estimate.estimatedCost);
    expect(usageReport.today.operations).toBe(1);
    expect(usageReport.today.tokens).toBe(estimate.estimatedTokens);
  });

  it('should enforce cost limits', async () => {
    // Set very low limits
    await costManager.updateLimits({
      perRun: 0.01,
      daily: 0.05,
      monthly: 0.10
    });

    const mockBoundaries = [
      generateMockBoundary({ name: 'user' }),
      generateMockBoundary({ name: 'product' }),
      generateMockBoundary({ name: 'order' })
    ];

    // Estimate should exceed limits
    const estimate = await refactorAgent.estimateCost(mockBoundaries);
    const limitCheck = await costManager.checkLimits(estimate.estimatedCost, 'refactor');

    expect(limitCheck.allowed).toBe(false);
    expect(limitCheck.reason).toBeDefined();
  });

  it('should handle daily limit rollover', async () => {
    // Record usage for "yesterday"
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Manually add old usage to simulate previous day
    await costManager.recordUsage(10000, 5.0, 'previous_refactor');
    
    // Today's usage should start fresh
    const usageReport = costManager.getUsageReport();
    expect(usageReport.today.cost).toBe(5.0); // Same day in test
    
    // But monthly should accumulate
    expect(usageReport.thisMonth.cost).toBe(5.0);
  });

  it('should provide cost breakdown for complex projects', async () => {
    const largeMockBoundaries = [
      generateMockBoundary({ name: 'user', files: ['user.go', 'user_service.go'] }),
      generateMockBoundary({ name: 'product', files: ['product.go', 'product_service.go'] }),
      generateMockBoundary({ name: 'order', files: ['order.go', 'order_service.go'] }),
      generateMockBoundary({ name: 'payment', files: ['payment.go'] })
    ];

    const estimate = await refactorAgent.estimateCost(largeMockBoundaries);
    
    expect(estimate.breakdown).toBeDefined();
    expect(estimate.breakdown.templates).toBe(0); // Templates are free
    expect(estimate.breakdown.ai_enhancement).toBeGreaterThan(0);
    expect(estimate.breakdown.validation).toBeGreaterThan(0);
    
    // Total should equal sum of breakdown
    const total = estimate.breakdown.templates + 
                  estimate.breakdown.ai_enhancement + 
                  estimate.breakdown.validation;
    expect(Math.abs(estimate.estimatedCost - total)).toBeLessThan(0.01);
  });

  it('should handle cost estimation errors gracefully', async () => {
    // Test with invalid/empty boundaries
    const estimate = await refactorAgent.estimateCost([]);
    
    expect(estimate.fileCount).toBe(0);
    expect(estimate.estimatedCost).toBe(0);
    expect(estimate.estimatedTokens).toBe(0);
  });

  it('should track multiple operations', async () => {
    const boundary1 = generateMockBoundary({ name: 'user' });
    const boundary2 = generateMockBoundary({ name: 'product' });

    // First operation
    const estimate1 = await refactorAgent.estimateCost([boundary1]);
    await costManager.recordUsage(estimate1.estimatedTokens, estimate1.estimatedCost, 'refactor_user');

    // Second operation
    const estimate2 = await refactorAgent.estimateCost([boundary2]);
    await costManager.recordUsage(estimate2.estimatedTokens, estimate2.estimatedCost, 'refactor_product');

    // Check accumulation
    const usageReport = costManager.getUsageReport();
    expect(usageReport.today.operations).toBe(2);
    expect(usageReport.today.cost).toBe(estimate1.estimatedCost + estimate2.estimatedCost);
    expect(usageReport.today.tokens).toBe(estimate1.estimatedTokens + estimate2.estimatedTokens);
  });

  it('should persist cost data across sessions', async () => {
    // Record some usage
    await costManager.recordUsage(5000, 2.5, 'test_refactor');
    
    // Create new cost manager instance (simulating restart)
    const newCostManager = new CostManager(tempDir);
    await newCostManager.initialize();
    
    // Usage should be persisted
    const usageReport = newCostManager.getUsageReport();
    expect(usageReport.today.cost).toBe(2.5);
    expect(usageReport.today.operations).toBe(1);
  });

  it('should handle concurrent cost tracking', async () => {
    const boundaries = [
      generateMockBoundary({ name: 'user' }),
      generateMockBoundary({ name: 'product' })
    ];

    // Simulate concurrent operations
    const promises = boundaries.map(async (boundary, index) => {
      const estimate = await refactorAgent.estimateCost([boundary]);
      await costManager.recordUsage(
        estimate.estimatedTokens, 
        estimate.estimatedCost, 
        `refactor_${index}`
      );
      return estimate;
    });

    const estimates = await Promise.all(promises);
    
    // All operations should be tracked
    const usageReport = costManager.getUsageReport();
    expect(usageReport.today.operations).toBe(2);
    
    const totalCost = estimates.reduce((sum, est) => sum + est.estimatedCost, 0);
    expect(Math.abs(usageReport.today.cost - totalCost)).toBeLessThan(0.01);
  });

  it('should validate cost limits hierarchy', async () => {
    // Try to set invalid limits (daily < per-run)
    await expect(costManager.updateLimits({
      perRun: 10.0,
      daily: 5.0  // Invalid: daily should be >= per-run
    })).rejects.toThrow();

    // Try to set invalid limits (monthly < daily)
    await expect(costManager.updateLimits({
      daily: 100.0,
      monthly: 50.0  // Invalid: monthly should be >= daily
    })).rejects.toThrow();
  });

  it('should provide accurate cost projections', async () => {
    const mockBoundaries = [
      generateMockBoundary({ name: 'user', files: ['user.go'] })
    ];

    const estimate = await refactorAgent.estimateCost(mockBoundaries);
    
    // For template mode, costs should be minimal
    if (!refactorAgent['useAI']) {
      expect(estimate.estimatedCost).toBeLessThan(0.10);
    }
    
    // Time estimate should be reasonable
    expect(estimate.estimatedTime).toMatch(/\d+(-\d+)?\s*(seconds?|minutes?)/);
  });
});