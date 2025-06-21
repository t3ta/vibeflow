import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BuildFixerAgent } from '../../src/core/agents/build-fixer-agent.js';
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

vi.mock('glob', () => ({
  glob: vi.fn()
}));

const mockedFs = vi.mocked(fs);
const mockedExecSync = vi.mocked(execSync);

describe('BuildFixerAgent', () => {
  let agent: BuildFixerAgent;
  let tempDir: string;

  beforeEach(() => {
    tempDir = '/tmp/test-project';
    agent = new BuildFixerAgent();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with correct name and description', () => {
      expect(agent.getName()).toBe('BuildFixerAgent');
      expect(agent.getDescription()).toBe('Automatically fixes build errors after refactoring');
    });
  });

  describe('execute', () => {
    it('should fix Go import errors', async () => {
      const input = {
        projectPath: tempDir,
        buildErrors: [{
          file: 'main.go',
          line: 1,
          column: 1,
          type: 'import' as const,
          message: 'cannot find module "old/package"',
          context: 'import "old/package"'
        }],
        refactoringManifest: {
          movedPackages: {
            'old/package': 'new/package'
          }
        },
        language: 'go' as const
      };

      // Mock for generateGoImportFix to find new import path
      agent['findNewImportPath'] = vi.fn().mockReturnValue('new/package');
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('package main\nimport "old/package"\n');
      mockedExecSync.mockReturnValue('Build successful');

      const result = await agent.run(input);

      expect(result.fixes).toHaveLength(1);
      expect(result.fixes[0].type).toBe('import');
      expect(result.fixes[0].description).toContain('Update import path');
      expect(result.summary.fixedErrors).toBe(1);
      expect(result.buildResult.success).toBe(true);
    });

    it('should handle Go dependency errors', async () => {
      const input = {
        projectPath: tempDir,
        buildErrors: [{
          file: 'go.mod',
          line: 1,
          column: 1,
          type: 'dependency' as const,
          message: 'missing module',
          context: ''
        }],
        refactoringManifest: {
          newModules: [{
            name: 'internal/user',
            path: 'internal/user'
          }]
        },
        language: 'go' as const
      };

      // Mock file existence checks for go.mod creation
      mockedFs.existsSync.mockImplementation((filePath) => {
        // Root go.mod exists, but new module go.mod doesn't
        if (typeof filePath === 'string' && filePath.includes('internal/user/go.mod')) {
          return false;
        }
        if (typeof filePath === 'string' && filePath.endsWith('go.mod')) {
          return true;
        }
        return false;
      });

      mockedFs.readFileSync.mockReturnValue('module myproject\n\ngo 1.21\n');
      mockedExecSync.mockReturnValue('go: downloading modules...');

      const result = await agent.run(input);

      expect(result.fixes.some(f => f.type === 'config')).toBe(true);
      expect(result.fixes.some(f => f.description.includes('go.mod'))).toBe(true);
    });

    it('should fix TypeScript import errors', async () => {
      const input = {
        projectPath: tempDir,
        buildErrors: [{
          file: 'index.ts',
          line: 1,
          column: 1,
          type: 'import' as const,
          message: "Cannot find module './old-path'",
          context: "import { User } from './old-path'"
        }],
        refactoringManifest: {
          movedFiles: {
            './old-path': './new-path'
          }
        },
        language: 'typescript' as const
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue("import { User } from './old-path'");
      mockedExecSync.mockReturnValue('Build successful');

      const result = await agent.run(input);

      expect(result.fixes).toHaveLength(1);
      expect(result.fixes[0].type).toBe('import');
      expect(result.summary.fixedErrors).toBe(1);
    });

    it('should handle Python import errors', async () => {
      const input = {
        projectPath: tempDir,
        buildErrors: [{
          file: 'main.py',
          line: 1,
          column: 1,
          type: 'import' as const,
          message: "No module named 'old_module'",
          context: "import old_module"
        }],
        refactoringManifest: {
          movedModules: {
            'old_module': 'new_module'
          }
        },
        language: 'python' as const
      };

      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('import old_module');
      mockedExecSync.mockReturnValue('');

      const result = await agent.run(input);

      expect(result.fixes).toHaveLength(1);
      expect(result.fixes[0].type).toBe('import');
    });

    it('should handle build failures after fixes', async () => {
      const input = {
        projectPath: tempDir,
        buildErrors: [{
          file: 'main.go',
          line: 1,
          column: 1,
          type: 'syntax' as const,
          message: 'syntax error',
          context: ''
        }],
        refactoringManifest: {},
        language: 'go' as const
      };

      mockedExecSync.mockImplementation(() => {
        const error = new Error('Build failed: error: syntax error in main.go:5:10');
        (error as any).stderr = 'error: syntax error in main.go:5:10';
        throw error;
      });

      const result = await agent.run(input);

      expect(result.buildResult.success).toBe(false);
      expect(result.summary.remainingErrors).toBeGreaterThanOrEqual(0);
    });

    it('should apply advanced Go fixes when initial build fails', async () => {
      const input = {
        projectPath: tempDir,
        buildErrors: [{
          file: 'main.go',
          line: 1,
          column: 1,
          type: 'import' as const,
          message: 'cannot find module',
          context: ''
        }],
        refactoringManifest: {},
        language: 'go' as const
      };

      let callCount = 0;
      mockedExecSync.mockImplementation((cmd) => {
        callCount++;
        if (cmd.includes('go build') && callCount === 1) {
          throw new Error('Build failed');
        }
        if (cmd.includes('go mod tidy')) {
          return 'go: tidying modules';
        }
        if (cmd.includes('go build') && callCount > 1) {
          return 'Build successful';
        }
        return '';
      });

      const result = await agent.run(input);

      expect(mockedExecSync).toHaveBeenCalledWith(
        expect.stringContaining('go mod tidy'),
        expect.any(Object)
      );
    });

    it('should handle empty build errors', async () => {
      const input = {
        projectPath: tempDir,
        buildErrors: [],
        refactoringManifest: {},
        language: 'go' as const
      };

      mockedExecSync.mockReturnValue('Build successful');

      const result = await agent.run(input);

      expect(result.fixes).toHaveLength(0);
      expect(result.summary.totalErrors).toBe(0);
      expect(result.buildResult.success).toBe(true);
    });

    it('should generate confidence scores for fixes', async () => {
      const input = {
        projectPath: tempDir,
        buildErrors: [{
          file: 'main.go',
          line: 1,
          column: 1,
          type: 'import' as const,
          message: 'cannot find module "old/package"',
          context: ''
        }],
        refactoringManifest: {
          movedPackages: {
            'old/package': 'new/package'
          }
        },
        language: 'go' as const
      };

      // Mock findNewImportPath to return the mapped package
      agent['findNewImportPath'] = vi.fn().mockReturnValue('new/package');
      
      mockedFs.existsSync.mockReturnValue(true);
      mockedFs.readFileSync.mockReturnValue('import "old/package"');
      mockedExecSync.mockReturnValue('');

      const result = await agent.run(input);

      expect(result.fixes.length).toBeGreaterThan(0);
      expect(result.fixes[0].confidence).toBeGreaterThan(0);
      expect(result.fixes[0].confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('error categorization', () => {
    it('should correctly categorize errors by type', () => {
      const errors = [
        { file: 'a.go', line: 1, column: 1, type: 'import' as const, message: 'import error' },
        { file: 'b.go', line: 1, column: 1, type: 'import' as const, message: 'import error' },
        { file: 'c.go', line: 1, column: 1, type: 'type' as const, message: 'type error' }
      ];

      const categorized = agent['categorizeErrors'](errors);

      expect(categorized.get('import')).toHaveLength(2);
      expect(categorized.get('type')).toHaveLength(1);
    });
  });

  describe('patch generation', () => {
    it('should generate correct patches', () => {
      const original = 'import "old/package"';
      const updated = 'import "new/package"';

      const patch = agent['generatePatch'](original, updated);

      expect(patch).toBe(updated);
    });
  });
});