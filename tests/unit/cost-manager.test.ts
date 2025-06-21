import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CostManager } from '../../src/core/utils/cost-manager.js';
import * as fs from 'fs/promises';
import * as path from 'path';

// Mock file system operations
vi.mock('fs/promises');
const mockedFs = vi.mocked(fs);

describe('CostManager', () => {
  let costManager: CostManager;
  let tempDir: string;

  beforeEach(() => {
    tempDir = '/tmp/test-project';
    costManager = new CostManager(tempDir);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with project path', () => {
      expect(costManager).toBeDefined();
      // Note: constructor doesn't expose projectRoot directly
    });
  });

  describe('initialize', () => {
    it('should create config directory if not exists', async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile.mockRejectedValue(new Error('File not found'));
      mockedFs.writeFile.mockResolvedValue(undefined);

      await costManager.initialize();

      expect(mockedFs.mkdir).toHaveBeenCalledWith(
        path.join(tempDir, '.vibeflow'),
        { recursive: true }
      );
    });

    it('should create default config if not exists', async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile.mockRejectedValue(new Error('File not found'));
      mockedFs.writeFile.mockResolvedValue(undefined);

      await costManager.initialize();

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        path.join(tempDir, '.vibeflow', 'cost-limits.json'),
        expect.any(String)
      );
    });

    it('should load existing config if available', async () => {
      const existingLimits = {
        daily: 50.0,
        monthly: 500.0,
        perRun: 10.0
      };

      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify(existingLimits)) // cost-limits.json
        .mockRejectedValueOnce(new Error('Usage file not found')); // usage-history.json

      await costManager.initialize();

      // Verify limits were loaded by checking usage report
      const report = costManager.getUsageReport();
      expect(report.limits.daily).toBe(50.0);
      expect(report.limits.monthly).toBe(500.0);
      expect(report.limits.perRun).toBe(10.0);
    });
  });

  describe('checkLimits', () => {
    beforeEach(async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify({ daily: 50.0, monthly: 200.0, perRun: 5.0 }))
        .mockResolvedValueOnce(JSON.stringify([])); // Empty usage history

      await costManager.initialize();
    });

    it('should allow operation within per-run limit', async () => {
      const result = await costManager.checkLimits(3.0, 'refactor');

      expect(result.allowed).toBe(true);
      expect(result.currentDaily).toBe(0);
      expect(result.currentMonthly).toBe(0);
    });

    it('should reject operation exceeding per-run limit', async () => {
      const result = await costManager.checkLimits(6.0, 'refactor');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('per-run limit');
    });

    it('should reject operation exceeding daily limit', async () => {
      // Simulate existing daily usage
      const existingUsage = [
        {
          timestamp: new Date().toISOString(),
          tokens: 10000,
          cost: 45.0,
          operation: 'previous_refactor'
        }
      ];

      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify({ daily: 50.0, monthly: 200.0, perRun: 10.0 }))
        .mockResolvedValueOnce(JSON.stringify(existingUsage));

      await costManager.initialize();

      const result = await costManager.checkLimits(8.0, 'refactor');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('daily limit');
    });

    it('should reject operation exceeding monthly limit', async () => {
      // Simulate existing monthly usage
      const existingUsage = [
        {
          timestamp: new Date().toISOString(),
          tokens: 50000,
          cost: 195.0,
          operation: 'previous_refactor'
        }
      ];

      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify({ daily: 250.0, monthly: 200.0, perRun: 10.0 }))
        .mockResolvedValueOnce(JSON.stringify(existingUsage));

      await costManager.initialize();

      const result = await costManager.checkLimits(8.0, 'refactor');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('monthly limit');
    });
  });

  describe('recordUsage', () => {
    beforeEach(async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify({ daily: 50.0, monthly: 200.0, perRun: 5.0 }))
        .mockResolvedValueOnce(JSON.stringify([]));
      mockedFs.writeFile.mockResolvedValue(undefined);

      await costManager.initialize();
    });

    it('should record operation usage', async () => {
      await costManager.recordUsage(5000, 3.50, 'refactor');

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        path.join(tempDir, '.vibeflow', 'usage-history.json'),
        expect.stringContaining('3.5')
      );
    });

    it('should update usage report after recording', async () => {
      await costManager.recordUsage(5000, 2.50, 'refactor');

      const report = costManager.getUsageReport();
      expect(report.today.cost).toBe(2.50);
      expect(report.today.operations).toBe(1);
      expect(report.today.tokens).toBe(5000);
    });
  });

  describe('getUsageReport', () => {
    it('should return empty usage for new instance', () => {
      const report = costManager.getUsageReport();

      expect(report.today.cost).toBe(0);
      expect(report.today.operations).toBe(0);
      expect(report.thisMonth.cost).toBe(0);
      expect(report.thisMonth.operations).toBe(0);
    });

    it('should return current limits', async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify({ daily: 75.0, monthly: 300.0, perRun: 8.0 }))
        .mockResolvedValueOnce(JSON.stringify([]));

      await costManager.initialize();

      const report = costManager.getUsageReport();
      expect(report.limits.daily).toBe(75.0);
      expect(report.limits.monthly).toBe(300.0);
      expect(report.limits.perRun).toBe(8.0);
    });
  });

  describe('updateLimits', () => {
    beforeEach(async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify({ daily: 50.0, monthly: 200.0, perRun: 5.0 }))
        .mockResolvedValueOnce(JSON.stringify([]));
      mockedFs.writeFile.mockResolvedValue(undefined);

      await costManager.initialize();
    });

    it('should update cost limits', async () => {
      await costManager.updateLimits({
        daily: 100.0,
        perRun: 15.0
      });

      expect(mockedFs.writeFile).toHaveBeenCalledWith(
        path.join(tempDir, '.vibeflow', 'cost-limits.json'),
        expect.stringContaining('100')
      );

      const report = costManager.getUsageReport();
      expect(report.limits.daily).toBe(100.0);
      expect(report.limits.perRun).toBe(15.0);
      expect(report.limits.monthly).toBe(200.0); // Should preserve existing
    });
  });

  describe('error handling', () => {
    it('should handle file system errors gracefully', async () => {
      mockedFs.mkdir.mockRejectedValue(new Error('Permission denied'));

      await expect(costManager.initialize())
        .rejects.toThrow('Permission denied');
    });

    it('should handle corrupted config files', async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile
        .mockResolvedValueOnce('invalid json') // corrupted config
        .mockResolvedValueOnce(JSON.stringify([])); // valid usage
      mockedFs.writeFile.mockResolvedValue(undefined);

      await costManager.initialize();

      // Should still initialize with defaults when config is corrupted
      const report = costManager.getUsageReport();
      expect(report.limits.daily).toBeGreaterThan(0);
    });

    it('should handle missing usage file gracefully', async () => {
      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify({ daily: 50.0, monthly: 200.0, perRun: 5.0 }))
        .mockRejectedValueOnce(new Error('Usage file not found'));

      await costManager.initialize();

      const report = costManager.getUsageReport();
      expect(report.today.cost).toBe(0);
      expect(report.thisMonth.cost).toBe(0);
    });
  });

  describe('usage history management', () => {
    it('should filter out old usage records', async () => {
      // Create usage records older than 90 days
      const oldUsage = [
        {
          timestamp: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(), // 100 days ago
          tokens: 1000,
          cost: 5.0,
          operation: 'old_refactor'
        }
      ];

      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.readFile
        .mockResolvedValueOnce(JSON.stringify({ daily: 50.0, monthly: 200.0, perRun: 5.0 }))
        .mockResolvedValueOnce(JSON.stringify(oldUsage));
      mockedFs.writeFile.mockResolvedValue(undefined);

      await costManager.initialize();
      await costManager.recordUsage(1000, 2.0, 'new_refactor');

      // Old records should be filtered out when saving
      const saveCall = mockedFs.writeFile.mock.calls.find(call => 
        call[0].toString().includes('usage-history.json')
      );
      const savedUsage = JSON.parse(saveCall?.[1] as string);
      
      expect(savedUsage).toHaveLength(1); // Only new record should remain
      expect(savedUsage[0].operation).toBe('new_refactor');
    });
  });
});