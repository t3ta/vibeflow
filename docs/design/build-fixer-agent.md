# BuildFixerAgent Design Document

## Overview

BuildFixerAgent is responsible for automatically fixing build errors that occur after refactoring. It analyzes build failures, identifies dependency issues, and applies corrective actions to ensure the codebase compiles successfully.

## Core Responsibilities

1. **Build Error Analysis**
   - Parse build output to identify error types
   - Categorize errors (import errors, type mismatches, missing dependencies)
   - Prioritize fixes based on error severity

2. **Dependency Resolution**
   - Update go.mod files for new module structure
   - Fix import paths after module reorganization
   - Resolve circular dependencies

3. **Incremental Fixing**
   - Apply fixes incrementally with validation
   - Roll back unsuccessful fixes
   - Generate alternative solutions when primary fixes fail

## Input/Output Schema

### Input
```typescript
interface BuildFixerInput {
  projectPath: string;
  buildErrors: BuildError[];
  refactoringManifest: RefactoringManifest;
  language: 'go' | 'typescript' | 'python';
}

interface BuildError {
  file: string;
  line: number;
  column: number;
  type: 'import' | 'type' | 'syntax' | 'dependency';
  message: string;
  context?: string;
}
```

### Output
```typescript
interface BuildFixerOutput {
  fixes: BuildFix[];
  summary: {
    totalErrors: number;
    fixedErrors: number;
    remainingErrors: number;
    appliedFixes: string[];
  };
  buildResult: {
    success: boolean;
    output: string;
    duration: number;
  };
}

interface BuildFix {
  type: 'import' | 'dependency' | 'type' | 'config';
  file: string;
  description: string;
  patch: string;
  confidence: number;
}
```

## Implementation Strategy

### Phase 1: Error Detection and Parsing
1. Execute build command and capture output
2. Parse error messages using language-specific patterns
3. Group related errors for batch fixing

### Phase 2: Fix Generation
1. **Import Path Fixes**
   - Map old import paths to new module structure
   - Update all import statements across the codebase
   - Handle relative imports and circular dependencies

2. **Go Module Updates**
   - Generate appropriate go.mod files for new modules
   - Update require directives for inter-module dependencies
   - Run `go mod tidy` to clean up dependencies

3. **Type and Interface Fixes**
   - Identify moved types and update references
   - Fix method receiver types after struct relocation
   - Update interface implementations

### Phase 3: Validation and Rollback
1. Apply fixes in dependency order
2. Run build after each fix batch
3. Roll back unsuccessful fixes
4. Generate diagnostic report for unfixable errors

## Integration Points

1. **With MigrationRunner**
   - Triggered automatically after patch application
   - Receives refactoring manifest for context

2. **With ReviewAgent**
   - Provides fix summary for review
   - Highlights manual intervention requirements

3. **With TestSynthAgent**
   - Coordinates test updates with build fixes
   - Ensures tests compile after fixes

## Error Handling

- Graceful degradation for complex errors
- Clear reporting of unfixable issues
- Suggestion generation for manual fixes

## Success Metrics

- Build success rate after fixing
- Average time to fix per error type
- Reduction in manual intervention required