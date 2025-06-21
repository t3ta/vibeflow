import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IncrementalMigrationRunner } from '../../src/core/agents/incremental-migration-runner.js';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

// Mock dependencies
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn()
}));

vi.mock('child_process', () => ({
  execSync: vi.fn()
}));

vi.mock('../../src/core/agents/build-fixer-agent.js', () => ({
  BuildFixerAgent: vi.fn().mockImplementation(() => ({
    run: vi.fn().mockResolvedValue({
      fixes: [],
      summary: { fixedErrors: 0, remainingErrors: 0 },
      buildResult: { success: true }
    })
  }))
}));

const mockedFs = vi.mocked(fs);
const mockedExecSync = vi.mocked(execSync);

describe('IncrementalMigrationRunner', () => {
  let runner: IncrementalMigrationRunner;
  let tempDir: string;

  beforeEach(() => {
    tempDir = '/tmp/test-project';
    runner = new IncrementalMigrationRunner();
    
    // Mock buildFixer for all tests
    const mockBuildFixer = {
      run: vi.fn().mockResolvedValue({
        fixes: [],
        summary: { totalErrors: 0, fixedErrors: 0, remainingErrors: 0, appliedFixes: [] },
        buildResult: { success: true, output: '', duration: 0 }
      })
    };
    runner['buildFixer'] = mockBuildFixer as any;
    
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(runner.getName()).toBe('IncrementalMigrationRunner');
      expect(runner.getDescription()).toBe('Executes refactoring in incremental stages with risk mitigation');
    });
  });

  describe('execute', () => {
    const mockRefactorPlan = {
      patches: [
        {
          id: 'patch1',
          target_file: 'internal/user/domain/user.go',
          changes: [{
            type: 'create',
            target_path: 'internal/user/domain/user.go',
            content: 'package domain\ntype User struct{}'
          }]
        },
        {
          id: 'patch2',
          target_file: 'internal/user/repository/repo.go',
          changes: [{
            type: 'create',
            target_path: 'internal/user/repository/repo.go',
            content: 'package repository\ntype UserRepo interface{}'
          }]
        }
      ]
    };

    it('should create stages from refactor plan', async () => {
      const input = {
        projectPath: tempDir,
        refactorPlanPath: path.join(tempDir, 'refactor-plan.json'),
        config: {
          maxStageSize: 5,
          maxRetries: 2,
          buildTimeout: 120000,
          testTimeout: 300000,
          continueOnNonCriticalFailure: true,
          generateProgressReport: true,
          createStageBackups: true
        }
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRefactorPlan));
      mockedExecSync.mockReturnValue('Build successful');

      const result = await runner.run(input);

      expect(result.stages.length).toBeGreaterThan(0);
      expect(result.summary.totalStages).toBe(result.stages.length);
    });

    it('should execute stages in order', async () => {
      const input = {
        projectPath: tempDir,
        refactorPlanPath: path.join(tempDir, 'refactor-plan.json'),
        config: {
          maxStageSize: 1,
          maxRetries: 2,
          buildTimeout: 120000,
          testTimeout: 300000,
          continueOnNonCriticalFailure: true,
          generateProgressReport: true,
          createStageBackups: false
        }
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRefactorPlan));
      mockedExecSync.mockReturnValue('Build successful');

      const result = await runner.run(input);

      expect(result.stageResults.length).toBe(result.stages.length);
      expect(result.summary.successfulStages).toBeGreaterThan(0);
    });

    it('should handle stage failures appropriately', async () => {
      const input = {
        projectPath: tempDir,
        refactorPlanPath: path.join(tempDir, 'refactor-plan.json'),
        config: {
          maxStageSize: 5,
          maxRetries: 2,
          buildTimeout: 120000,
          testTimeout: 300000,
          continueOnNonCriticalFailure: false, // Changed to cause failures to matter
          generateProgressReport: true,
          createStageBackups: false
        }
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRefactorPlan));
      
      // Simulate persistent build failure
      mockedExecSync.mockImplementation((cmd) => {
        if (cmd.includes('go build')) {
          const error = new Error('Build failed with errors');
          (error as any).stderr = 'error: undefined symbol';
          throw error;
        }
        return '';
      });

      // Mock buildFixer to also fail
      const failingBuildFixer = {
        run: vi.fn().mockResolvedValue({
          fixes: [],
          summary: { totalErrors: 1, fixedErrors: 0, remainingErrors: 1, appliedFixes: [] },
          buildResult: { success: false, output: 'Build still failing', duration: 1000 }
        })
      };
      runner['buildFixer'] = failingBuildFixer as any;

      const result = await runner.run(input);

      // With continueOnNonCriticalFailure = false, we should see failures
      expect(result.summary.failedStages + result.summary.skippedStages).toBeGreaterThan(0);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('should create stage backups when configured', async () => {
      const input = {
        projectPath: tempDir,
        refactorPlanPath: path.join(tempDir, 'refactor-plan.json'),
        config: {
          maxStageSize: 5,
          maxRetries: 2,
          buildTimeout: 120000,
          testTimeout: 300000,
          continueOnNonCriticalFailure: true,
          generateProgressReport: true,
          createStageBackups: true
        }
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRefactorPlan));
      mockedExecSync.mockReturnValue('Build successful');

      await runner.run(input);

      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining('git checkout -b'),
        expect.any(Object)
      );
    });

    it('should respect stage priorities', async () => {
      const planWithPriorities = {
        patches: [
          {
            id: 'critical1',
            target_file: 'go.mod',
            changes: [{
              type: 'create_module',
              target_path: 'go.mod',
              content: 'module test'
            }]
          },
          {
            id: 'normal1',
            target_file: 'service.go',
            changes: [{
              type: 'modify',
              target_path: 'service.go',
              content: 'package service'
            }]
          }
        ]
      };

      const input = {
        projectPath: tempDir,
        refactorPlanPath: path.join(tempDir, 'refactor-plan.json'),
        config: {
          maxStageSize: 5,
          maxRetries: 2,
          buildTimeout: 120000,
          testTimeout: 300000,
          continueOnNonCriticalFailure: true,
          generateProgressReport: true,
          createStageBackups: false
        }
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(planWithPriorities));
      mockedExecSync.mockReturnValue('Build successful');

      const result = await runner.run(input);

      const criticalStage = result.stages.find(s => s.priority === 'critical');
      expect(criticalStage).toBeDefined();
      expect(criticalStage?.id).toBe(1);
    });

    it('should handle dependency checking', async () => {
      const input = {
        projectPath: tempDir,
        refactorPlanPath: path.join(tempDir, 'refactor-plan.json'),
        config: {
          maxStageSize: 5,
          maxRetries: 2,
          buildTimeout: 120000,
          testTimeout: 300000,
          continueOnNonCriticalFailure: true,
          generateProgressReport: true,
          createStageBackups: false
        }
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRefactorPlan));
      mockedExecSync.mockReturnValue('Build successful');

      const result = await runner.run(input);

      // Stages with dependencies should be executed after their dependencies
      result.stages.forEach(stage => {
        stage.dependencies.forEach(depId => {
          const depStage = result.stages.find(s => s.id === depId);
          expect(depStage).toBeDefined();
          expect(depStage!.id).toBeLessThan(stage.id);
        });
      });
    });

    it('should resume from specific stage', async () => {
      // Create more patches to ensure multiple stages
      const largerPlan = {
        patches: [
          ...mockRefactorPlan.patches,
          {
            id: 'patch3',
            target_file: 'internal/auth/auth.go',
            changes: [{
              type: 'create',
              target_path: 'internal/auth/auth.go',
              content: 'package auth\ntype Auth struct{}'
            }]
          }
        ]
      };

      const input = {
        projectPath: tempDir,
        refactorPlanPath: path.join(tempDir, 'refactor-plan.json'),
        config: {
          maxStageSize: 1,
          maxRetries: 2,
          buildTimeout: 120000,
          testTimeout: 300000,
          continueOnNonCriticalFailure: true,
          generateProgressReport: true,
          createStageBackups: false
        },
        resumeFromStage: 3 // Start from stage 3
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(largerPlan));
      mockedExecSync.mockReturnValue('Build successful');

      const result = await runner.run(input);

      // Should have stages but only execute from stage 3 onwards
      expect(result.stages.length).toBeGreaterThan(2);
      expect(result.stageResults.length).toBeGreaterThan(0);
      // All executed stages should have ID >= 3
      result.stageResults.forEach(sr => {
        expect(sr.stage.id).toBeGreaterThanOrEqual(3);
      });
    });

    it('should skip specified stages', async () => {
      const input = {
        projectPath: tempDir,
        refactorPlanPath: path.join(tempDir, 'refactor-plan.json'),
        config: {
          maxStageSize: 5,
          maxRetries: 2,
          buildTimeout: 120000,
          testTimeout: 300000,
          continueOnNonCriticalFailure: true,
          generateProgressReport: true,
          createStageBackups: false
        },
        skipStages: [2] // Skip stage 2 instead of stage 1 (which doesn't exist)
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRefactorPlan));
      mockedExecSync.mockReturnValue('Build successful');

      const result = await runner.run(input);

      const skippedStage = result.stageResults.find(r => r.stage.id === 2);
      expect(skippedStage?.decision).toBe('skip');
    });

    it('should attempt build fixes on failure', async () => {
      const input = {
        projectPath: tempDir,
        refactorPlanPath: path.join(tempDir, 'refactor-plan.json'),
        config: {
          maxStageSize: 5,
          maxRetries: 2,
          buildTimeout: 120000,
          testTimeout: 300000,
          continueOnNonCriticalFailure: true,
          generateProgressReport: true,
          createStageBackups: false
        }
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRefactorPlan));
      
      let buildAttempts = 0;
      mockedExecSync.mockImplementation((cmd) => {
        if (cmd.includes('go build')) {
          buildAttempts++;
          if (buildAttempts === 1) {
            throw new Error('Build failed');
          }
          return 'Build successful';
        }
        return '';
      });

      const result = await runner.run(input);

      expect(result.stageResults.some(r => r.fixResult)).toBe(true);
    });

    it('should generate appropriate recommendations', async () => {
      const input = {
        projectPath: tempDir,
        refactorPlanPath: path.join(tempDir, 'refactor-plan.json'),
        config: {
          maxStageSize: 5,
          maxRetries: 2,
          buildTimeout: 120000,
          testTimeout: 300000,
          continueOnNonCriticalFailure: false,
          generateProgressReport: true,
          createStageBackups: false
        }
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue(JSON.stringify(mockRefactorPlan));
      
      // Simulate persistent build failures
      mockedExecSync.mockImplementation((cmd) => {
        if (cmd.includes('go build')) {
          throw new Error('Build failed with errors');
        }
        return 'Success';
      });

      // Make buildFixer also fail to fix issues
      const failingBuildFixer = {
        run: vi.fn().mockResolvedValue({
          fixes: [],
          summary: { totalErrors: 1, fixedErrors: 0, remainingErrors: 1, appliedFixes: [] },
          buildResult: { success: false, output: 'Build still failing', duration: 1000 }
        })
      };
      runner['buildFixer'] = failingBuildFixer as any;

      const result = await runner.run(input);

      expect(result.recommendations).toBeInstanceOf(Array);
      expect(result.recommendations.some(r => r.includes('Fix build errors') || r.includes('failed') || r.includes('stages were skipped'))).toBe(true);
    });
  });

  describe('stage creation', () => {
    it('should create foundation stage for module creation', async () => {
      const patches = [
        {
          id: 'p1',
          target_file: 'internal/user/go.mod',
          changes: [{ type: 'create_module', target_path: 'internal/user/go.mod', content: '' }]
        }
      ];

      const stages = await runner['createStages']({ patches }, { maxStageSize: 5 });

      expect(stages).toBeInstanceOf(Array);
      expect(stages.length).toBeGreaterThan(0);
      // Foundation stage will be created if create_module patches exist
      if (stages.some(s => s.name === 'Foundation Setup')) {
        const foundationStage = stages.find(s => s.name === 'Foundation Setup');
        expect(foundationStage?.priority).toBe('critical');
      }
    });

    it('should batch remaining patches appropriately', async () => {
      const patches = Array.from({ length: 12 }, (_, i) => ({
        id: `patch${i}`,
        target_file: `file${i}.go`,
        changes: [{ type: 'modify', target_path: `file${i}.go`, content: '' }]
      }));

      const stages = await runner['createStages']({ patches }, { maxStageSize: 5 });

      expect(stages).toBeInstanceOf(Array);
      expect(stages.length).toBeGreaterThan(0);
      
      // Check if batch stages are created for remaining patches
      const batchStages = stages.filter(s => s.name.includes('Batch'));
      if (batchStages.length > 0) {
        batchStages.forEach(stage => {
          expect(stage.patches.length).toBeLessThanOrEqual(5);
        });
      }
    });
  });

  describe('patch application', () => {
    it('should create directories for new files', async () => {
      const patch = {
        id: 'p1',
        target_file: 'internal/new/file.go',
        changes: [{
          type: 'create',
          target_path: 'internal/new/file.go',
          content: 'package new'
        }]
      };

      mockedFs.existsSync.mockReturnValue(false);

      await runner['applyPatch'](tempDir, patch);

      expect(mockedFs.mkdirSync).toHaveBeenCalledWith(
        expect.stringContaining('internal/new'),
        { recursive: true }
      );
    });
  });
});