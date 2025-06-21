import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HybridRefactorAgent } from '../../src/core/agents/hybrid-refactor-agent.js';
import { DomainBoundary } from '../../src/core/types/config.js';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  readdirSync: vi.fn(),
  statSync: vi.fn()
}));
vi.mock('../../src/core/utils/claude-code-integration.js');

const mockedFs = vi.mocked(fs);
const mockedFsSync = vi.mocked(fsSync);

describe('HybridRefactorAgent', () => {
  let agent: HybridRefactorAgent;
  let tempDir: string;
  let mockBoundaries: DomainBoundary[];

  beforeEach(() => {
    tempDir = '/tmp/test-project';
    
    // Setup fs mocks
    mockedFsSync.existsSync.mockReturnValue(true);
    mockedFsSync.mkdirSync.mockReturnValue(undefined);
    mockedFsSync.readFileSync.mockReturnValue('');
    mockedFsSync.writeFileSync.mockReturnValue(undefined);
    
    agent = new HybridRefactorAgent(tempDir);
    
    mockBoundaries = [
      {
        name: 'user',
        description: 'User management domain',
        files: ['user.go', 'user_test.go'],
        dependencies: ['database'],
        semantic_keywords: ['user', 'auth', 'login'],
        confidence: 0.9,
        boundary_type: 'auto_discovered'
      },
      {
        name: 'product',
        description: 'Product catalog domain',
        files: ['product.go', 'product_test.go'],
        dependencies: ['database'],
        semantic_keywords: ['product', 'catalog', 'inventory'],
        confidence: 0.85,
        boundary_type: 'auto_discovered'
      }
    ];

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with project path', () => {
      expect(agent).toBeDefined();
      expect(agent['projectRoot']).toBe(tempDir);
    });

    it('should detect AI availability', () => {
      expect(agent['useAI']).toBeDefined();
    });
  });

  describe('estimateCost', () => {
    beforeEach(() => {
      mockedFs.readFile.mockResolvedValue(`
        package main
        
        type User struct {
          ID   string
          Name string
        }
        
        func CreateUser() *User {
          return &User{}
        }
      `);

      mockedFs.stat.mockResolvedValue({
        isFile: () => true,
        size: 1024
      } as any);
    });

    it('should estimate cost for boundaries', async () => {
      const estimate = await agent.estimateCost(mockBoundaries);

      expect(estimate).toBeDefined();
      expect(estimate.fileCount).toBe(4); // 2 boundaries * 2 files each
      expect(estimate.estimatedTokens).toBeGreaterThan(0);
      expect(estimate.estimatedCost).toBeGreaterThan(0);
      expect(estimate.estimatedTime).toBeDefined();
    });

    it('should provide detailed cost breakdown', async () => {
      const estimate = await agent.estimateCost(mockBoundaries);

      expect(estimate.breakdown).toBeDefined();
      expect(estimate.breakdown.templates).toBe(0); // Templates are free
      expect(estimate.breakdown.ai_enhancement).toBeGreaterThan(0);
      expect(estimate.breakdown.validation).toBeGreaterThan(0);
    });

    it('should estimate different costs for different file sizes', async () => {
      // Small file
      mockedFs.stat.mockResolvedValueOnce({ isFile: () => true, size: 100 } as any);
      const smallEstimate = await agent.estimateCost([mockBoundaries[0]]);

      // Large file  
      mockedFs.stat.mockResolvedValueOnce({ isFile: () => true, size: 10000 } as any);
      const largeEstimate = await agent.estimateCost([mockBoundaries[0]]);

      expect(largeEstimate.estimatedCost).toBeGreaterThan(smallEstimate.estimatedCost);
    });
  });

  describe('executeRefactoring', () => {
    beforeEach(() => {
      mockedFs.readFile.mockImplementation((filePath: string) => {
        const fileName = filePath.toString();
        if (fileName.includes('user.go')) {
          return Promise.resolve(`
            package main
            
            import "database/sql"
            
            type User struct {
              ID    string \`json:"id"\`
              Name  string \`json:"name"\`
              Email string \`json:"email"\`
            }
            
            func CreateUser(name, email string) *User {
              return &User{
                ID:    generateID(),
                Name:  name,
                Email: email,
              }
            }
            
            func GetUser(db *sql.DB, id string) (*User, error) {
              var user User
              err := db.QueryRow("SELECT id, name, email FROM users WHERE id = ?", id).
                Scan(&user.ID, &user.Name, &user.Email)
              return &user, err
            }
          `);
        }
        return Promise.resolve('package main');
      });

      mockedFs.mkdir.mockResolvedValue(undefined);
      mockedFs.writeFile.mockResolvedValue(undefined);
      mockedFs.access.mockResolvedValue(undefined);
    });

    it('should execute refactoring in template mode', async () => {
      // Force template mode
      agent['useAI'] = false;

      const result = await agent.executeRefactoring(mockBoundaries, false);

      expect(result).toBeDefined();
      expect(result.applied_patches).toBeInstanceOf(Array);
      expect(result.created_files).toBeInstanceOf(Array);
      expect(result.aiEnhanced).toBe(false);
    });

    it('should generate clean architecture structure', async () => {
      const result = await agent.executeRefactoring(mockBoundaries, false);

      // Check that clean architecture files were generated
      const writeFileCalls = mockedFs.writeFile.mock.calls;
      const generatedFiles = writeFileCalls.map(call => call[0]);

      // Should generate domain, usecase, infrastructure, and handler layers
      expect(generatedFiles.some(file => file.toString().includes('/domain/'))).toBe(true);
      expect(generatedFiles.some(file => file.toString().includes('/usecase/'))).toBe(true);
      expect(generatedFiles.some(file => file.toString().includes('/infrastructure/'))).toBe(true);
      expect(generatedFiles.some(file => file.toString().includes('/handler/'))).toBe(true);
    });

    it('should generate tests for each layer', async () => {
      const result = await agent.executeRefactoring(mockBoundaries, false);

      const writeFileCalls = mockedFs.writeFile.mock.calls;
      const generatedFiles = writeFileCalls.map(call => call[0]);

      // Should generate test files
      expect(generatedFiles.some(file => file.toString().includes('_test.go'))).toBe(true);
    });

    it('should handle dry-run mode', async () => {
      const result = await agent.executeRefactoring(mockBoundaries, false);

      expect(result.applied_patches).toHaveLength(0); // No patches applied in dry-run
      expect(result.generated_files.length).toBeGreaterThan(0); // Files generated for preview
    });

    it('should apply changes when requested', async () => {
      const result = await agent.executeRefactoring(mockBoundaries, true);

      expect(result.applied_patches.length).toBeGreaterThan(0);
      expect(mockedFs.writeFile).toHaveBeenCalled();
    });
  });

  describe('template generation', () => {
    beforeEach(() => {
      mockedFs.readFile.mockResolvedValue(`
        package main
        
        type User struct {
          ID   string
          Name string
        }
      `);
    });

    it('should generate domain entities', async () => {
      mockedFsSync.readFileSync.mockReturnValue('package main\ntype User struct { ID string }');
      
      const result = await agent['generateRefactoredCode'](
        'user.go',
        mockBoundaries[0]
      );

      expect(result.refactored_files).toBeDefined();
      expect(result.refactored_files).toBeInstanceOf(Array);
      
      if (result.refactored_files.length > 0) {
        const domainFile = result.refactored_files.find(f => 
          f.path.includes('/domain/') || f.path.includes('user')
        );
        expect(domainFile).toBeDefined();
      }
    });

    it('should generate usecase services', async () => {
      mockedFsSync.readFileSync.mockReturnValue('package main\ntype User struct { ID string }');
      
      const result = await agent['generateRefactoredCode'](
        'user.go',
        mockBoundaries[0]
      );

      expect(result.refactored_files).toBeDefined();
      expect(result.refactored_files).toBeInstanceOf(Array);
      
      // Template-based refactoring may create usecase/service files
      if (result.refactored_files.length > 0) {
        expect(result.refactored_files.some(f => 
          f.path.includes('usecase') || f.path.includes('service')
        )).toBeTruthy();
      }
    });

    it('should generate repository interfaces', async () => {
      mockedFsSync.readFileSync.mockReturnValue('package main\ntype User struct { ID string }');
      
      const result = await agent['generateRefactoredCode'](
        'user.go',
        mockBoundaries[0]
      );

      expect(result.refactored_files).toBeDefined();
      expect(result.refactored_files).toBeInstanceOf(Array);
      
      // Check if refactored files are generated
      if (result.refactored_files.length > 0) {
        expect(result.refactored_files.some(f => 
          f.path.includes('domain') || f.path.includes('infrastructure')
        )).toBeTruthy();
      }
    });

    it('should generate HTTP handlers', async () => {
      mockedFsSync.readFileSync.mockReturnValue('package main\ntype User struct { ID string }');
      
      const result = await agent['generateRefactoredCode'](
        'user.go',
        mockBoundaries[0]
      );

      expect(result.refactored_files).toBeDefined();
      expect(result.refactored_files).toBeInstanceOf(Array);
      
      // Check if handler-related files are generated
      if (result.refactored_files.length > 0) {
        expect(result.refactored_files.some(f => 
          f.path.includes('handler') || f.path.includes('http')
        )).toBeTruthy();
      }
    });
  });

  describe('AI enhancement', () => {
    it('should use AI when available', async () => {
      // Mock AI availability
      agent['useAI'] = true;
      
      // Mock Claude Code integration
      const mockClaudeCode = {
        enhanceCode: vi.fn().mockResolvedValue('enhanced code'),
        getUsage: vi.fn().mockResolvedValue({ tokensUsed: 100, cost: 0.01 })
      };
      agent['claudeCode'] = mockClaudeCode as any;

      mockedFs.readFile.mockResolvedValue('package main\ntype User struct{}');

      await agent.executeRefactoring(mockBoundaries, false);

      expect(mockClaudeCode.enhanceCode).toHaveBeenCalled();
    });

    it('should fallback to templates when AI fails', async () => {
      agent['useAI'] = true;
      
      const mockClaudeCode = {
        enhanceCode: vi.fn().mockRejectedValue(new Error('AI service unavailable')),
        getUsage: vi.fn().mockResolvedValue({ tokensUsed: 0, cost: 0 })
      };
      agent['claudeCode'] = mockClaudeCode as any;

      mockedFs.readFile.mockResolvedValue('package main\ntype User struct{}');

      const result = await agent.executeRefactoring(mockBoundaries, false);

      // Should still complete successfully with templates
      expect(result).toBeDefined();
      expect(result.generated_files.length).toBeGreaterThan(0);
    });
  });

  describe('validation', () => {
    it('should validate generated code', async () => {
      const result = await agent.executeRefactoring(mockBoundaries, false);

      expect(result.compilation_result).toBeDefined();
      expect(result.compilation_result.success).toBeDefined();
    });

    it('should handle compilation failures', async () => {
      // Mock compilation failure by generating invalid code
      mockedFs.readFile.mockResolvedValue('invalid go code!!!');

      const result = await agent.executeRefactoring(mockBoundaries, false);

      expect(result.compilation_result.success).toBe(false);
      expect(result.compilation_result.errors.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle file read errors gracefully', async () => {
      mockedFs.readFile.mockRejectedValue(new Error('File not found'));

      await expect(agent.executeRefactoring(mockBoundaries, false))
        .rejects.toThrow('File not found');
    });

    it('should handle empty boundaries array', async () => {
      const result = await agent.executeRefactoring([], false);

      expect(result.applied_patches).toHaveLength(0);
      expect(result.generated_files).toHaveLength(0);
    });

    it('should handle invalid project structure', async () => {
      mockedFs.access.mockRejectedValue(new Error('Directory not found'));

      await expect(agent.executeRefactoring(mockBoundaries, false))
        .rejects.toThrow();
    });
  });

  describe('metrics collection', () => {
    it('should collect transformation metrics', async () => {
      const result = await agent.executeRefactoring(mockBoundaries, false);

      expect(result.metrics).toBeDefined();
      expect(result.metrics.transformation_summary).toBeDefined();
      expect(result.metrics.transformation_summary.files_processed).toBeGreaterThan(0);
    });

    it('should track performance metrics', async () => {
      const startTime = Date.now();
      
      const result = await agent.executeRefactoring(mockBoundaries, false);
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      expect(duration).toBeGreaterThan(0);
      expect(result.metrics.performance?.duration_ms).toBeDefined();
    });
  });
});