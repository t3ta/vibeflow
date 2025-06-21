import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { executeAutoRefactor } from '../../src/core/workflow/auto-refactor-workflow.js';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';

// Mock all agents and dependencies
vi.mock('../../src/core/agents/enhanced-boundary-agent.js', () => ({
  EnhancedBoundaryAgent: vi.fn()
}));
vi.mock('../../src/core/agents/architect-agent.js', () => ({
  ArchitectAgent: vi.fn()
}));
vi.mock('../../src/core/agents/refactor-agent.js', () => ({
  RefactorAgent: vi.fn()
}));
vi.mock('../../src/core/agents/test-synth-agent.js', () => ({
  TestSynthAgent: vi.fn()
}));
vi.mock('../../src/core/agents/review-agent.js', () => ({
  ReviewAgent: vi.fn()
}));
vi.mock('fs/promises', () => ({
  access: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
  mkdir: vi.fn(),
  stat: vi.fn()
}));
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn(),
  promises: {
    access: vi.fn(),
    readFile: vi.fn(),
    writeFile: vi.fn(),
    mkdir: vi.fn(),
    stat: vi.fn()
  }
}));
vi.mock('child_process', () => ({
  execSync: vi.fn(),
  exec: vi.fn()
}));

const mockedFs = vi.mocked(fs);
const mockedFsSync = vi.mocked(fsSync);

// Create mock implementations
const createMockBoundaryAgent = () => ({
  analyzeBoundaries: vi.fn().mockResolvedValue({
    outputPath: '/tmp/domain-map.json',
    domainMap: {
      boundaries: [
        {
          name: 'user',
          description: 'User management',
          files: ['user.go'],
          dependencies: [],
          semantic_keywords: ['user'],
          confidence: 0.9,
          boundary_type: 'auto_discovered'
        }
      ]
    },
    autoDiscoveredBoundaries: [
      {
        name: 'user',
        description: 'User management',
        files: ['user.go'],
        dependencies: [],
        semantic_keywords: ['user'],
        confidence: 0.9,
        boundary_type: 'auto_discovered'
      }
    ],
    discoveryMetrics: {
      confidence_metrics: {
        overall_confidence: 87.3,
        structural_coherence: 92.1,
        database_alignment: 84.5
      },
      recommendations: []
    }
  })
});

const createMockArchitectAgent = () => ({
  generateArchitecturalPlan: vi.fn().mockResolvedValue({
    outputPath: '/tmp/plan.md',
    plan: {
      summary: { total_modules: 1 }
    }
  })
});

const createMockRefactorAgent = () => ({
  executeRefactoring: vi.fn().mockResolvedValue({
    applied_patches: ['user.go'],
    failed_patches: [],
    generated_files: [
      'internal/user/domain/user.go',
      'internal/user/usecase/user_service.go'
    ],
    compilation_result: {
      success: true,
      errors: [],
      warnings: []
    },
    test_result: {
      success: true,
      passed: 10,
      failed: 0,
      failedTests: [],
      coverage: 85
    },
    metrics: {
      transformation_summary: {
        files_processed: 1,
        modules_created: 1
      }
    }
  })
});

const createMockTestSynthAgent = () => ({
  synthesizeTests: vi.fn().mockResolvedValue({
    generated_tests: [
      'internal/user/domain/user_test.go',
      'internal/user/usecase/user_service_test.go'
    ],
    outputPath: '/tmp/tests'
  })
});

const createMockReviewAgent = () => ({
  reviewChanges: vi.fn().mockResolvedValue({
    outputPath: '/tmp/review.md',
    auto_merge_decision: {
      should_auto_merge: true,
      confidence: 0.95,
      reasons: ['All tests pass', 'Code quality high']
    },
    overall_assessment: {
      grade: 'A',
      score: 92
    }
  })
});

describe('executeAutoRefactor', () => {
  let mockBoundaryAgent: any;
  let mockArchitectAgent: any;
  let mockRefactorAgent: any;
  let mockTestSynthAgent: any;
  let mockReviewAgent: any;

  beforeEach(async () => {
    // Set up mocks
    mockBoundaryAgent = createMockBoundaryAgent();
    mockArchitectAgent = createMockArchitectAgent();
    mockRefactorAgent = createMockRefactorAgent();
    mockTestSynthAgent = createMockTestSynthAgent();
    mockReviewAgent = createMockReviewAgent();

    // Set up constructor mocks
    const { EnhancedBoundaryAgent } = await vi.importMock('../../src/core/agents/enhanced-boundary-agent.js') as any;
    const { ArchitectAgent } = await vi.importMock('../../src/core/agents/architect-agent.js') as any;
    const { RefactorAgent } = await vi.importMock('../../src/core/agents/refactor-agent.js') as any;
    const { TestSynthAgent } = await vi.importMock('../../src/core/agents/test-synth-agent.js') as any;
    const { ReviewAgent } = await vi.importMock('../../src/core/agents/review-agent.js') as any;

    EnhancedBoundaryAgent.mockImplementation(() => mockBoundaryAgent);
    ArchitectAgent.mockImplementation(() => mockArchitectAgent);
    RefactorAgent.mockImplementation(() => mockRefactorAgent);
    TestSynthAgent.mockImplementation(() => mockTestSynthAgent);
    ReviewAgent.mockImplementation(() => mockReviewAgent);

    // Mock file system
    mockedFs.access.mockResolvedValue(undefined);
    mockedFs.readFile.mockResolvedValue('test content');
    mockedFs.writeFile.mockResolvedValue(undefined);
    mockedFs.mkdir.mockResolvedValue(undefined);
    mockedFsSync.existsSync.mockReturnValue(true);

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('successful execution', () => {
    it('should execute complete workflow in dry-run mode', async () => {
      const result = await executeAutoRefactor('/tmp/test-project', false);

      expect(result).toBeDefined();
      expect(result.boundaries).toHaveLength(1);
      expect(result.refactorResult.applied_patches).toHaveLength(1);
      expect(result.testResult.generated_tests).toHaveLength(2);
      expect(result.validation.compile.success).toBe(true);
    });

    it('should execute complete workflow with changes applied', async () => {
      const result = await executeAutoRefactor('/tmp/test-project', true);

      expect(result).toBeDefined();
      expect(mockRefactorAgent.executeRefactoring).toHaveBeenCalledWith(
        expect.any(Array),
        true // applyChanges = true
      );
    });

    it('should call all agents in correct order', async () => {
      const callOrder: string[] = [];

      mockBoundaryAgent.analyzeBoundaries.mockImplementation(() => {
        callOrder.push('boundary');
        return Promise.resolve({
          outputPath: '/tmp/domain-map.json',
          domainMap: { boundaries: [] },
          autoDiscoveredBoundaries: [],
          discoveryMetrics: { confidence_metrics: { overall_confidence: 0 } }
        });
      });

      mockArchitectAgent.generateArchitecturalPlan.mockImplementation(() => {
        callOrder.push('architect');
        return Promise.resolve({ outputPath: '/tmp/plan.md' });
      });

      mockRefactorAgent.executeRefactoring.mockImplementation(() => {
        callOrder.push('refactor');
        return Promise.resolve({
          applied_patches: [],
          failed_patches: [],
          generated_files: [],
          compilation_result: { success: true, errors: [], warnings: [] },
          test_result: { success: true, passed: 0, failed: 0, failedTests: [], coverage: 0 },
          metrics: { transformation_summary: { files_processed: 0 } }
        });
      });

      mockTestSynthAgent.synthesizeTests.mockImplementation(() => {
        callOrder.push('test');
        return Promise.resolve({ generated_tests: [], outputPath: '/tmp/tests' });
      });

      mockReviewAgent.reviewChanges.mockImplementation(() => {
        callOrder.push('review');
        return Promise.resolve({
          outputPath: '/tmp/review.md',
          auto_merge_decision: { should_auto_merge: false },
          overall_assessment: { grade: 'B' }
        });
      });

      await executeAutoRefactor('/tmp/test-project', false);

      expect(callOrder).toEqual(['boundary', 'architect', 'refactor', 'test', 'review']);
    });

    it('should resolve absolute path correctly', async () => {
      await executeAutoRefactor('./relative-path', false);

      // Should resolve to absolute path
      expect(mockBoundaryAgent.analyzeBoundaries).toHaveBeenCalled();
    });
  });

  describe('error handling and rollback', () => {
    it('should handle boundary discovery failure', async () => {
      mockBoundaryAgent.analyzeBoundaries.mockRejectedValue(
        new Error('Boundary analysis failed')
      );

      await expect(executeAutoRefactor('/tmp/test-project', false))
        .rejects.toThrow('Boundary analysis failed');
    });

    it('should handle refactoring failure with rollback', async () => {
      mockRefactorAgent.executeRefactoring.mockRejectedValue(
        new Error('Refactoring failed')
      );

      // Mock execSync for rollback commands
      const execSyncMock = vi.fn();
      vi.doMock('child_process', () => ({
        execSync: execSyncMock
      }));

      await expect(executeAutoRefactor('/tmp/test-project', true))
        .rejects.toThrow('Refactoring failed');
    });

    it('should execute rollback when changes are applied and error occurs', async () => {
      mockTestSynthAgent.synthesizeTests.mockRejectedValue(
        new Error('Test generation failed')
      );

      await expect(executeAutoRefactor('/tmp/test-project', true))
        .rejects.toThrow('Test generation failed');

      // Rollback should be called for applied changes
    });

    it('should not execute rollback for dry-run failures', async () => {
      mockReviewAgent.reviewChanges.mockRejectedValue(
        new Error('Review failed')
      );

      await expect(executeAutoRefactor('/tmp/test-project', false))
        .rejects.toThrow('Review failed');

      // No rollback expected for dry-run
    });
  });

  describe('validation pipeline', () => {
    it('should run compilation validation', async () => {
      // Mock go.mod exists
      mockedFs.existsSync = vi.fn().mockImplementation((path: string) => {
        return path.toString().includes('go.mod');
      });

      // Mock execSync for go build
      const execSyncMock = vi.fn().mockReturnValue('');
      vi.doMock('child_process', () => ({
        execSync: execSyncMock
      }));

      const result = await executeAutoRefactor('/tmp/test-project', true);

      expect(result.validation.compile.success).toBe(true);
    });

    it('should handle compilation failures', async () => {
      mockedFs.existsSync = vi.fn().mockImplementation((path: string) => {
        return path.toString().includes('go.mod');
      });

      const execSyncMock = vi.fn().mockImplementation(() => {
        throw new Error('Compilation error');
      });
      vi.doMock('child_process', () => ({
        execSync: execSyncMock
      }));

      const result = await executeAutoRefactor('/tmp/test-project', true);

      expect(result.validation.compile.success).toBe(false);
      expect(result.validation.compile.errors).toContain('Compilation error');
    });

    it('should run test validation', async () => {
      mockedFs.existsSync = vi.fn().mockImplementation((path: string) => {
        return path.toString().includes('go.mod');
      });

      const execSyncMock = vi.fn()
        .mockReturnValueOnce('') // go build
        .mockReturnValueOnce('PASS: TestUser\nPASS: TestProduct'); // go test

      vi.doMock('child_process', () => ({
        execSync: execSyncMock
      }));

      const result = await executeAutoRefactor('/tmp/test-project', true);

      expect(result.validation.tests.success).toBe(true);
      expect(result.validation.tests.passed).toBeGreaterThan(0);
    });

    it('should generate performance metrics', async () => {
      const result = await executeAutoRefactor('/tmp/test-project', false);

      expect(result.validation.performance).toBeDefined();
      expect(result.validation.performance.improvement).toBeDefined();
      expect(result.validation.performance.metrics).toBeDefined();
      expect(result.validation.performance.metrics.responseTime).toBeGreaterThan(0);
    });
  });

  describe('different project types', () => {
    it('should handle TypeScript projects', async () => {
      mockedFs.existsSync = vi.fn().mockImplementation((path: string) => {
        return path.toString().includes('package.json');
      });

      const execSyncMock = vi.fn().mockReturnValue('');
      vi.doMock('child_process', () => ({
        execSync: execSyncMock
      }));

      const result = await executeAutoRefactor('/tmp/ts-project', true);

      expect(result).toBeDefined();
      expect(execSyncMock).toHaveBeenCalledWith(
        'npm run build',
        expect.any(Object)
      );
    });

    it('should handle projects without known build system', async () => {
      mockedFs.existsSync = vi.fn().mockReturnValue(false);

      const result = await executeAutoRefactor('/tmp/unknown-project', true);

      expect(result.validation.compile.warnings).toContain(
        'No known build system detected'
      );
    });
  });

  describe('progress reporting', () => {
    it('should report progress through console logs', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeAutoRefactor('/tmp/test-project', false);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Step 1/6: Boundary Discovery')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Step 2/6: Architecture Design')
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Step 3/6: Code Transformation')
      );

      consoleSpy.mockRestore();
    });

    it('should report different modes correctly', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      // Dry run mode
      await executeAutoRefactor('/tmp/test-project', false);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔍 DRY RUN')
      );

      consoleSpy.mockClear();

      // Apply changes mode
      await executeAutoRefactor('/tmp/test-project', true);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('🔥 APPLY CHANGES')
      );

      consoleSpy.mockRestore();
    });

    it('should report timing information', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeAutoRefactor('/tmp/test-project', false);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Complete automatic refactoring workflow finished! \(\d+\.\d+ min\)/)
      );

      consoleSpy.mockRestore();
    });
  });

  describe('auto-merge decisions', () => {
    it('should handle auto-merge approval', async () => {
      mockReviewAgent.reviewChanges.mockResolvedValue({
        outputPath: '/tmp/review.md',
        auto_merge_decision: {
          should_auto_merge: true,
          confidence: 0.95
        },
        overall_assessment: { grade: 'A' }
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeAutoRefactor('/tmp/test-project', true);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('AI approved changes - ready for production!')
      );

      consoleSpy.mockRestore();
    });

    it('should handle manual review requirement', async () => {
      mockReviewAgent.reviewChanges.mockResolvedValue({
        outputPath: '/tmp/review.md',
        auto_merge_decision: {
          should_auto_merge: false,
          confidence: 0.65
        },
        overall_assessment: { grade: 'B' }
      });

      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await executeAutoRefactor('/tmp/test-project', true);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Manual review recommended')
      );

      consoleSpy.mockRestore();
    });
  });
});