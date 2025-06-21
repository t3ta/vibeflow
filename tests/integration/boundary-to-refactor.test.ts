import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { EnhancedBoundaryAgent } from '../../src/core/agents/enhanced-boundary-agent.js';
import { HybridRefactorAgent } from '../../src/core/agents/hybrid-refactor-agent.js';
import { createTempDir, cleanupTempDir, createMockGoProject } from '../setup.js';

// Mock fs operations for agent initialization
vi.mock('fs');
const mockedFsSync = vi.mocked(fsSync);

describe('Integration: Boundary Discovery → Refactoring', () => {
  let tempDir: string;
  let boundaryAgent: EnhancedBoundaryAgent;
  let refactorAgent: HybridRefactorAgent;

  beforeEach(async () => {
    tempDir = await createTempDir('boundary-refactor-integration');
    await createMockGoProject(tempDir);
    
    // Setup fs mocks for agent initialization
    mockedFsSync.existsSync.mockReturnValue(true);
    mockedFsSync.mkdirSync.mockReturnValue(undefined);
    mockedFsSync.readFileSync.mockReturnValue('');
    mockedFsSync.writeFileSync.mockReturnValue(undefined);
    
    boundaryAgent = new EnhancedBoundaryAgent(tempDir);
    refactorAgent = new HybridRefactorAgent(tempDir);
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should discover boundaries and successfully refactor them', async () => {
    // Step 1: Discover boundaries
    const boundaryResult = await boundaryAgent.analyzeBoundaries();
    
    expect(boundaryResult).toBeDefined();
    expect(boundaryResult.autoDiscoveredBoundaries.length).toBeGreaterThan(0);
    
    // Should discover user and product boundaries from mock project
    const boundaryNames = boundaryResult.autoDiscoveredBoundaries.map(b => b.name);
    expect(boundaryNames).toContain('user');
    expect(boundaryNames).toContain('product');

    // Step 2: Use discovered boundaries for refactoring
    const refactorResult = await refactorAgent.executeRefactoring(
      boundaryResult.domainMap.boundaries,
      false // dry-run
    );

    expect(refactorResult).toBeDefined();
    expect(refactorResult.generated_files.length).toBeGreaterThan(0);
    
    // Should generate clean architecture structure
    const generatedPaths = refactorResult.generated_files;
    expect(generatedPaths.some(p => p.includes('/domain/'))).toBe(true);
    expect(generatedPaths.some(p => p.includes('/usecase/'))).toBe(true);
    expect(generatedPaths.some(p => p.includes('/infrastructure/'))).toBe(true);
    expect(generatedPaths.some(p => p.includes('/handler/'))).toBe(true);

    // Verify boundary consistency
    const userBoundary = boundaryResult.domainMap.boundaries.find(b => b.name === 'user');
    expect(userBoundary).toBeDefined();
    
    const userFiles = generatedPaths.filter(p => p.includes('/user/'));
    expect(userFiles.length).toBeGreaterThan(0);
  });

  it('should handle empty projects gracefully', async () => {
    // Create empty project
    const emptyDir = await createTempDir('empty-project');
    
    const emptyBoundaryAgent = new EnhancedBoundaryAgent(emptyDir);
    const emptyRefactorAgent = new HybridRefactorAgent(emptyDir);

    try {
      // Discovery should complete but find no boundaries
      const boundaryResult = await emptyBoundaryAgent.analyzeBoundaries();
      expect(boundaryResult.autoDiscoveredBoundaries).toHaveLength(0);

      // Refactoring should handle empty boundary list
      const refactorResult = await emptyRefactorAgent.executeRefactoring([], false);
      expect(refactorResult.generated_files).toHaveLength(0);
      expect(refactorResult.applied_patches).toHaveLength(0);
    } finally {
      await cleanupTempDir(emptyDir);
    }
  });

  it('should maintain boundary metadata through pipeline', async () => {
    const boundaryResult = await boundaryAgent.analyzeBoundaries();
    
    // Get a discovered boundary
    const userBoundary = boundaryResult.autoDiscoveredBoundaries.find(b => b.name === 'user');
    expect(userBoundary).toBeDefined();
    
    // Verify metadata preservation
    expect(userBoundary?.semantic_keywords).toContain('user');
    expect(userBoundary?.confidence).toBeGreaterThan(0);
    expect(userBoundary?.files.length).toBeGreaterThan(0);

    // Refactor and verify metadata is used
    const refactorResult = await refactorAgent.executeRefactoring(
      [userBoundary!],
      false
    );

    // Generated files should reflect boundary structure
    const userDomainFile = refactorResult.generated_files.find(
      f => f.includes('/user/domain/')
    );
    expect(userDomainFile).toBeDefined();
  });

  it('should validate generated code structure', async () => {
    const boundaryResult = await boundaryAgent.analyzeBoundaries();
    const refactorResult = await refactorAgent.executeRefactoring(
      boundaryResult.domainMap.boundaries,
      false
    );

    // Each boundary should have all clean architecture layers
    for (const boundary of boundaryResult.domainMap.boundaries) {
      const boundaryFiles = refactorResult.generated_files.filter(
        f => f.includes(`/${boundary.name}/`)
      );

      // Should have domain, usecase, infrastructure, and handler layers
      expect(boundaryFiles.some(f => f.includes('/domain/'))).toBe(true);
      expect(boundaryFiles.some(f => f.includes('/usecase/'))).toBe(true);
      expect(boundaryFiles.some(f => f.includes('/infrastructure/'))).toBe(true);
      expect(boundaryFiles.some(f => f.includes('/handler/'))).toBe(true);
    }
  });

  it('should handle boundary confidence scores appropriately', async () => {
    const boundaryResult = await boundaryAgent.analyzeBoundaries();
    
    // Filter high-confidence boundaries
    const highConfidenceBoundaries = boundaryResult.autoDiscoveredBoundaries.filter(
      b => b.confidence > 0.8
    );

    if (highConfidenceBoundaries.length > 0) {
      const refactorResult = await refactorAgent.executeRefactoring(
        highConfidenceBoundaries,
        false
      );

      // High-confidence boundaries should generate more files
      expect(refactorResult.generated_files.length).toBeGreaterThan(0);
      expect(refactorResult.compilation_result.success).toBe(true);
    }
  });

  it('should handle file dependencies correctly', async () => {
    const boundaryResult = await boundaryAgent.analyzeBoundaries();
    
    // Look for boundaries with dependencies
    const boundariesWithDeps = boundaryResult.domainMap.boundaries.filter(
      b => b.dependencies && b.dependencies.length > 0
    );

    if (boundariesWithDeps.length > 0) {
      const refactorResult = await refactorAgent.executeRefactoring(
        boundariesWithDeps,
        false
      );

      // Should handle dependencies without circular references
      expect(refactorResult.compilation_result.success).toBe(true);
      expect(refactorResult.failed_patches).toHaveLength(0);
    }
  });

  it('should preserve semantic meaning across transformation', async () => {
    const boundaryResult = await boundaryAgent.analyzeBoundaries();
    
    // Find user boundary (should exist in mock project)
    const userBoundary = boundaryResult.domainMap.boundaries.find(b => b.name === 'user');
    
    if (userBoundary) {
      expect(userBoundary.semantic_keywords).toContain('user');
      
      const refactorResult = await refactorAgent.executeRefactoring([userBoundary], false);
      
      // Generated user domain should contain User struct/class
      const userDomainFile = refactorResult.generated_files.find(
        f => f.includes('/user/domain/') && f.endsWith('.go')
      );
      expect(userDomainFile).toBeDefined();
    }
  });

  it('should generate appropriate test files', async () => {
    const boundaryResult = await boundaryAgent.analyzeBoundaries();
    const refactorResult = await refactorAgent.executeRefactoring(
      boundaryResult.domainMap.boundaries,
      false
    );

    // Should generate test files for each layer
    const testFiles = refactorResult.generated_files.filter(f => f.includes('_test.go'));
    expect(testFiles.length).toBeGreaterThan(0);

    // Each boundary should have tests
    for (const boundary of boundaryResult.domainMap.boundaries) {
      const boundaryTests = testFiles.filter(f => f.includes(`/${boundary.name}/`));
      expect(boundaryTests.length).toBeGreaterThan(0);
    }
  });

  it('should handle compilation validation', async () => {
    const boundaryResult = await boundaryAgent.analyzeBoundaries();
    const refactorResult = await refactorAgent.executeRefactoring(
      boundaryResult.domainMap.boundaries,
      false
    );

    // Compilation result should be present
    expect(refactorResult.compilation_result).toBeDefined();
    expect(refactorResult.compilation_result.success).toBeDefined();
    
    // Should have minimal errors for template-generated code
    expect(refactorResult.compilation_result.errors.length).toBeLessThanOrEqual(2);
  });

  it('should provide meaningful metrics', async () => {
    const boundaryResult = await boundaryAgent.analyzeBoundaries();
    const refactorResult = await refactorAgent.executeRefactoring(
      boundaryResult.domainMap.boundaries,
      false
    );

    // Should provide transformation metrics
    expect(refactorResult.metrics).toBeDefined();
    expect(refactorResult.metrics.transformation_summary).toBeDefined();
    expect(refactorResult.metrics.transformation_summary.files_processed).toBeGreaterThan(0);
    
    // Boundary metrics should correlate with refactor metrics
    const boundaryCount = boundaryResult.domainMap.boundaries.length;
    const generatedModules = refactorResult.metrics.transformation_summary.modules_created || 0;
    expect(generatedModules).toBe(boundaryCount);
  });
});