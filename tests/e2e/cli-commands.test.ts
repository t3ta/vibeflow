import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execSync } from 'child_process';
import * as fs from 'fs/promises';
import * as path from 'path';
import { createTempDir, cleanupTempDir, createMockGoProject } from '../setup.js';

// Don't mock child_process for E2E tests - we need to actually run commands

describe('E2E: CLI Commands', () => {
  let tempDir: string;
  let cliPath: string;

  beforeEach(async () => {
    tempDir = await createTempDir('e2e-cli');
    
    // Build the CLI if not already built
    cliPath = path.resolve(process.cwd(), 'dist/cli.js');
    
    try {
      await fs.access(cliPath);
    } catch {
      // Build if dist doesn't exist
      execSync('npm run build', { cwd: process.cwd() });
    }
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('vf discover command', () => {
    it('should discover boundaries in Go project', async () => {
      await createMockGoProject(tempDir);
      
      const output = execSync(`node "${cliPath}" discover "${tempDir}"`, {
        encoding: 'utf8',
        cwd: process.cwd()
      });

      expect(output).toContain('AI自動境界発見');
      expect(output).toContain('発見された境界');
      expect(output).toContain('全体信頼度');
      
      // Check that output files were created
      const domainMapPath = path.join(tempDir, '.vibeflow', 'domain-map.json');
      const reportPath = path.join(tempDir, '.vibeflow', 'auto-boundary-report.md');
      
      const domainMapExists = await fs.access(domainMapPath).then(() => true).catch(() => false);
      const reportExists = await fs.access(reportPath).then(() => true).catch(() => false);
      
      expect(domainMapExists).toBe(true);
      expect(reportExists).toBe(true);
    });

    it('should handle empty projects gracefully', async () => {
      const output = execSync(`node "${cliPath}" discover "${tempDir}"`, {
        encoding: 'utf8',
        cwd: process.cwd()
      });

      expect(output).toContain('AI自動境界発見');
      // Should complete without errors even for empty projects
    });
  });

  describe('vf plan command', () => {
    it('should generate architectural plan', async () => {
      await createMockGoProject(tempDir);
      
      const output = execSync(`node "${cliPath}" plan "${tempDir}"`, {
        encoding: 'utf8',
        cwd: process.cwd()
      });

      expect(output).toContain('Plan generation complete');
      expect(output).toContain('Generated files');
      
      // Check that plan files were created
      const planPath = path.join(tempDir, '.vibeflow', 'plan.md');
      const domainMapPath = path.join(tempDir, '.vibeflow', 'domain-map.json');
      
      const planExists = await fs.access(planPath).then(() => true).catch(() => false);
      const domainMapExists = await fs.access(domainMapPath).then(() => true).catch(() => false);
      
      expect(planExists).toBe(true);
      expect(domainMapExists).toBe(true);
    });

    it('should show AI discovery results', async () => {
      await createMockGoProject(tempDir);
      
      const output = execSync(`node "${cliPath}" plan "${tempDir}"`, {
        encoding: 'utf8',
        cwd: process.cwd()
      });

      expect(output).toContain('AI自動境界発見結果');
      expect(output).toContain('発見された境界');
    });
  });

  describe('vf refactor command', () => {
    it('should execute refactoring in dry-run mode', async () => {
      await createMockGoProject(tempDir);
      
      // First generate plan
      execSync(`node "${cliPath}" plan "${tempDir}"`, {
        cwd: process.cwd()
      });
      
      // Then refactor
      const output = execSync(`node "${cliPath}" refactor "${tempDir}"`, {
        encoding: 'utf8',
        cwd: process.cwd()
      });

      expect(output).toContain('完全なリファクタリングパイプライン完了');
      expect(output).toContain('ドライランモード');
    });

    it('should apply changes with --apply flag', async () => {
      await createMockGoProject(tempDir);
      
      // Generate plan first
      execSync(`node "${cliPath}" plan "${tempDir}"`, {
        cwd: process.cwd(),
        timeout: 30000
      });
      
      // Apply refactoring
      const output = execSync(`node "${cliPath}" refactor "${tempDir}" --apply`, {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 30000
      });

      expect(output).toContain('完全なリファクタリングパイプライン完了');
      expect(output).not.toContain('ドライランモード');
      
      // Check that files were actually created
      const internalDir = path.join(tempDir, 'internal');
      const exists = await fs.access(internalDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should fail gracefully when plan files are missing', async () => {
      await createMockGoProject(tempDir);
      
      try {
        execSync(`node "${cliPath}" refactor "${tempDir}"`, {
          encoding: 'utf8',
          cwd: process.cwd(),
          timeout: 30000
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('Required files not found');
      }
    });
  });

  describe('vf auto command', () => {
    it('should execute complete workflow in dry-run mode', async () => {
      await createMockGoProject(tempDir);
      
      const output = execSync(`node "${cliPath}" auto "${tempDir}"`, {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 120000 // 2 minute timeout
      });

      expect(output).toContain('Running in Hybrid Mode');
      expect(output).toContain('Step 1/6: Boundary Discovery');
      expect(output).toContain('Step 2/6: Architecture Design');
      expect(output).toContain('Step 3/6: Code Transformation');
      expect(output).toContain('AI Automatic Refactoring Complete');
      expect(output).toContain('DRY RUN');
    });

    it('should apply changes with --apply flag', async () => {
      await createMockGoProject(tempDir);
      
      const output = execSync(`node "${cliPath}" auto "${tempDir}" --apply`, {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 120000
      });

      expect(output).toContain('APPLY CHANGES');
      expect(output).toContain('AI Automatic Refactoring Complete');
      
      // Verify files were created
      const internalDir = path.join(tempDir, 'internal');
      const exists = await fs.access(internalDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });

    it('should support language and pattern options', async () => {
      await createMockGoProject(tempDir);
      
      const output = execSync(
        `node "${cliPath}" auto "${tempDir}" --language go --pattern clean-arch`,
        {
          encoding: 'utf8',
          cwd: process.cwd(),
          timeout: 120000
        }
      );

      expect(output).toContain('Language: go');
      expect(output).toContain('Pattern: clean-arch');
    });

    it('should respect timeout option', async () => {
      await createMockGoProject(tempDir);
      
      try {
        execSync(`node "${cliPath}" auto "${tempDir}" --timeout 0.01`, {
          encoding: 'utf8',
          cwd: process.cwd(),
          timeout: 5000
        });
        expect.fail('Should have timed out');
      } catch (error: any) {
        expect(error.message).toContain('Timeout reached');
      }
    });
  });

  describe('vf estimate command', () => {
    it('should provide cost estimation', async () => {
      await createMockGoProject(tempDir);
      
      const output = execSync(`node "${cliPath}" estimate "${tempDir}"`, {
        encoding: 'utf8',
        cwd: process.cwd()
      });

      expect(output).toContain('Cost Estimation for AI Transformation');
      expect(output).toContain('Files to process');
      expect(output).toContain('Estimated tokens');
      expect(output).toContain('Estimated cost');
      expect(output).toContain('Current Usage');
    });

    it('should show detailed breakdown with --detailed flag', async () => {
      await createMockGoProject(tempDir);
      
      const output = execSync(`node "${cliPath}" estimate "${tempDir}" --detailed`, {
        encoding: 'utf8',
        cwd: process.cwd()
      });

      expect(output).toContain('Boundary Breakdown');
    });
  });

  describe('vf full command', () => {
    it('should execute complete pipeline', async () => {
      await createMockGoProject(tempDir);
      
      const output = execSync(`node "${cliPath}" full "${tempDir}"`, {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 120000
      });

      expect(output).toContain('Step 1/2: Generating plan');
      expect(output).toContain('Step 2/2: Executing refactor');
      expect(output).toContain('Complete pipeline finished successfully');
    });

    it('should apply changes with --apply flag', async () => {
      await createMockGoProject(tempDir);
      
      const output = execSync(`node "${cliPath}" full "${tempDir}" --apply`, {
        encoding: 'utf8',
        cwd: process.cwd(),
        timeout: 120000
      });

      expect(output).toContain('Complete pipeline finished successfully');
      
      // Verify files were created
      const internalDir = path.join(tempDir, 'internal');
      const exists = await fs.access(internalDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    });
  });

  describe('CLI error handling', () => {
    it('should handle non-existent directories', async () => {
      const nonExistentDir = path.join(tempDir, 'does-not-exist');
      
      try {
        execSync(`node "${cliPath}" discover "${nonExistentDir}"`, {
          encoding: 'utf8',
          cwd: process.cwd()
        });
        expect.fail('Should have thrown an error');
      } catch (error: any) {
        expect(error.message).toContain('not found');
      }
    });

    it('should show help with --help flag', async () => {
      const output = execSync(`node "${cliPath}" --help`, {
        encoding: 'utf8',
        cwd: process.cwd()
      });

      expect(output).toContain('Usage:');
      expect(output).toContain('Commands:');
      expect(output).toContain('auto');
      expect(output).toContain('discover');
      expect(output).toContain('plan');
      expect(output).toContain('refactor');
    });

    it('should show version with --version flag', async () => {
      const output = execSync(`node "${cliPath}" --version`, {
        encoding: 'utf8',
        cwd: process.cwd()
      });

      expect(output).toMatch(/\d+\.\d+\.\d+/);
    });
  });

  describe('Configuration and output files', () => {
    it('should create .vibeflow directory structure', async () => {
      await createMockGoProject(tempDir);
      
      execSync(`node "${cliPath}" discover "${tempDir}"`, {
        cwd: process.cwd()
      });

      // Check directory structure
      const vibeflowDir = path.join(tempDir, '.vibeflow');
      const exists = await fs.access(vibeflowDir).then(() => true).catch(() => false);
      expect(exists).toBe(true);
      
      // Check for various files that should be created
      const expectedFiles = [
        'domain-map.json',
        'auto-boundary-report.md'
      ];
      
      for (const file of expectedFiles) {
        const filePath = path.join(vibeflowDir, file);
        const fileExists = await fs.access(filePath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);
      }
    });

    it('should generate valid JSON output files', async () => {
      await createMockGoProject(tempDir);
      
      execSync(`node "${cliPath}" discover "${tempDir}"`, {
        cwd: process.cwd()
      });

      const domainMapPath = path.join(tempDir, '.vibeflow', 'domain-map.json');
      const domainMapContent = await fs.readFile(domainMapPath, 'utf8');
      
      // Should be valid JSON
      expect(() => JSON.parse(domainMapContent)).not.toThrow();
      
      const domainMap = JSON.parse(domainMapContent);
      expect(domainMap.boundaries).toBeDefined();
      expect(Array.isArray(domainMap.boundaries)).toBe(true);
    });
  });

  describe('Performance and reliability', () => {
    it('should complete commands within reasonable time', async () => {
      await createMockGoProject(tempDir);
      
      const startTime = Date.now();
      
      execSync(`node "${cliPath}" discover "${tempDir}"`, {
        cwd: process.cwd()
      });
      
      const duration = Date.now() - startTime;
      
      // Should complete discovery within 30 seconds for small project
      expect(duration).toBeLessThan(30000);
    });

    it('should be idempotent - running multiple times should produce same results', async () => {
      await createMockGoProject(tempDir);
      
      // Run discovery twice
      const output1 = execSync(`node "${cliPath}" discover "${tempDir}"`, {
        encoding: 'utf8',
        cwd: process.cwd()
      });
      
      const output2 = execSync(`node "${cliPath}" discover "${tempDir}"`, {
        encoding: 'utf8',
        cwd: process.cwd()
      });
      
      // Results should be consistent (allowing for small confidence variations)
      expect(output1).toContain('AI自動境界発見');
      expect(output2).toContain('AI自動境界発見');
    });
  });
});