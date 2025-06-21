# Incremental Refactoring Mode Design Document

## Overview

段階的リファクタリングモードは、大規模なリファクタリングを小さなステップに分割し、各段階でビルド・テストを実行することで、リスクを最小化し成功率を向上させるための機能です。

## Problem Statement

現在の実証実験では、39個のパッチを一度に適用した結果、最終的にビルドエラーが発生しました。これは以下の問題を示しています：

1. **依存関係の複雑性**: 多数のパッチが相互依存している
2. **エラーの特定困難**: どのパッチが問題を引き起こしたか特定が困難
3. **ロールバックの粒度**: 全体をロールバックするか、そのまま進むかの二択

## Solution: Incremental Application

### Core Concept

```
Patches = [P1, P2, P3, ..., P39]
Stages = [Stage1: [P1-P5], Stage2: [P6-P12], Stage3: [P13-P20], ...]

For each Stage:
  1. Apply patches in stage
  2. Run BuildFixerAgent
  3. Run tests
  4. If success: continue to next stage
  5. If failure: analyze and decide (retry/skip/rollback)
```

## Implementation Strategy

### Stage Definition
```typescript
interface RefactoringStage {
  id: number;
  name: string;
  patches: RefactorPatch[];
  dependencies: number[]; // Stage IDs this stage depends on
  priority: 'critical' | 'high' | 'medium' | 'low';
  rollbackStrategy: 'abort' | 'skip' | 'retry';
}
```

### Stage Planning Algorithm
1. **Dependency Analysis**: Analyze patch dependencies
2. **Risk Assessment**: Evaluate each patch's risk level
3. **Batching Strategy**: Group related patches into stages
4. **Critical Path**: Ensure critical functionality is prioritized

### Execution Flow
```typescript
interface StageExecutionResult {
  stage: RefactoringStage;
  applied: RefactorPatch[];
  failed: RefactorPatch[];
  buildResult: BuildResult;
  testResult: TestResult;
  decision: 'continue' | 'retry' | 'skip' | 'abort';
}
```

## Stage Categories

### 1. Foundation Stage (Critical)
- Module structure creation
- Basic directory setup
- Core interface definitions

### 2. Entity Migration Stage (High)
- Domain entity extraction
- Value object creation
- Core type definitions

### 3. Repository Stage (High)
- Repository interface definition
- Data access layer separation
- Database interaction isolation

### 4. Service Layer Stage (Medium)
- Business logic extraction
- Service interface definition
- Dependency injection setup

### 5. Handler Stage (Medium)
- HTTP handler separation
- Request/response handling
- Route organization

### 6. Integration Stage (Low)
- Cross-module integration
- Interface implementations
- Final wiring

## Error Handling Strategies

### Per-Stage Strategies

1. **Critical Stages**: Abort on failure
   - Foundation must succeed for everything else to work
   - No point continuing if basic structure fails

2. **High Priority Stages**: Retry with fixes
   - Apply BuildFixerAgent
   - Attempt alternative approaches
   - Skip individual problematic patches if needed

3. **Medium/Low Priority Stages**: Skip on persistent failure
   - Continue to next stage
   - Mark for manual review
   - Generate detailed failure report

### Rollback Granularity
```typescript
interface RollbackOptions {
  scope: 'patch' | 'stage' | 'full';
  preserveProgress: boolean;
  createBranch: boolean;
}
```

## Integration Points

### With MigrationRunner
- Replace monolithic patch application
- Add stage-by-stage execution
- Enhanced progress reporting

### With BuildFixerAgent
- Triggered after each stage
- Stage-specific error context
- Focused fix generation

### With EnhancedTestSynthAgent
- Progressive test generation
- Stage-specific test validation
- Incremental coverage improvement

## Configuration

```typescript
interface IncrementalConfig {
  maxStageSize: number;
  maxRetries: number;
  buildTimeout: number;
  testTimeout: number;
  continueOnNonCriticalFailure: boolean;
  generateProgressReport: boolean;
  createStageBackups: boolean;
}
```

## Success Metrics

1. **Success Rate Improvement**
   - Target: 80%+ successful completion
   - Reduced manual intervention

2. **Error Isolation**
   - Identify problematic patches quickly
   - Focused error resolution

3. **Progress Preservation**
   - Maintain partial progress on failure
   - Avoid complete rollback scenarios

## Implementation Plan

### Phase 1: Stage Planning
- Dependency analysis algorithms
- Risk assessment methods
- Batching strategies

### Phase 2: Execution Engine
- Stage execution loop
- Error handling logic
- Progress tracking

### Phase 3: Integration
- MigrationRunner integration
- Agent coordination
- Configuration management

### Phase 4: Reporting
- Detailed progress reports
- Failure analysis
- Recommendations for manual fixes

## Example Usage

```bash
# Execute with incremental mode
vf refactor --incremental --max-stage-size 5

# Resume from failed stage
vf refactor --resume-from-stage 3

# Skip problematic stage and continue
vf refactor --skip-stage 2 --continue
```

## Benefits

1. **Risk Mitigation**: Smaller failure blast radius
2. **Progress Preservation**: Don't lose all work on single failure
3. **Better Debugging**: Isolated error identification
4. **Adaptive Strategy**: Different handling per stage criticality
5. **User Control**: Granular control over execution