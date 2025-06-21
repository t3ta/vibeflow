# VibeFlow Testing Guide

Comprehensive testing strategy for VibeFlow's AI-powered code transformation pipeline.

## 🧪 Testing Philosophy

VibeFlow employs a **three-tier testing strategy** to ensure reliability across all transformation scenarios:

1. **Unit Tests**: Individual agent and utility testing
2. **Integration Tests**: Agent interaction and workflow validation  
3. **End-to-End Tests**: Complete CLI and workflow testing

## 🚀 Quick Start

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests
npm run test:e2e        # End-to-end tests

# Run with coverage
npm run test:coverage

# Watch mode for development
npm run test:watch
```

## 📊 Test Coverage Goals

| Component | Target Coverage | Current Status |
|-----------|----------------|---------------|
| Core Agents | 90%+ | ✅ Implemented |
| Utilities | 85%+ | ✅ Implemented |
| Workflows | 80%+ | ✅ Implemented |
| CLI Commands | 75%+ | ✅ Implemented |
| Integration | 70%+ | ✅ Implemented |

## 🔬 Unit Tests

### Core Agents Testing

#### BoundaryAgent (`tests/unit/enhanced-boundary-agent.test.ts`)
- **Boundary Discovery**: ML algorithm validation
- **Confidence Scoring**: Accuracy of boundary detection
- **Language Detection**: Go, TypeScript, Python support
- **Error Handling**: Graceful failure modes

```typescript
describe('EnhancedBoundaryAgent', () => {
  it('should discover domain-specific boundaries', async () => {
    const result = await agent.analyzeBoundaries();
    
    expect(result.autoDiscoveredBoundaries).toContain('user');
    expect(result.autoDiscoveredBoundaries).toContain('product');
  });
});
```

#### RefactorAgent (`tests/unit/hybrid-refactor-agent.test.ts`)
- **Template Generation**: Clean Architecture patterns
- **AI Integration**: Claude Code SDK enhancement
- **Hybrid Fallback**: AI failure graceful degradation
- **Code Validation**: Compilation and syntax checking

```typescript
describe('HybridRefactorAgent', () => {
  it('should generate clean architecture structure', async () => {
    const result = await agent.executeRefactoring(boundaries, false);
    
    expect(result.generated_files.some(f => f.includes('/domain/'))).toBe(true);
    expect(result.generated_files.some(f => f.includes('/usecase/'))).toBe(true);
  });
});
```

#### CostManager (`tests/unit/cost-manager.test.ts`)
- **Limit Enforcement**: Per-run, daily, monthly limits
- **Usage Tracking**: Token and cost accumulation
- **Persistence**: Configuration and history storage
- **Concurrent Access**: Thread-safe operations

```typescript
describe('CostManager', () => {
  it('should enforce cost limits', async () => {
    const result = await costManager.checkLimits(100.0, 'refactor');
    
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('limit');
  });
});
```

### Testing Utilities

#### Mock Creation
```typescript
// Create realistic test projects
const tempDir = await createTempDir('test-project');
await createMockGoProject(tempDir);

// Generate mock boundaries
const boundary = generateMockBoundary({
  name: 'user',
  files: ['user.go'],
  confidence: 0.9
});
```

#### File System Mocking
```typescript
// Mock fs operations for isolated testing
vi.mock('fs/promises');
const mockedFs = vi.mocked(fs);

mockedFs.readFile.mockResolvedValue('mock file content');
mockedFs.writeFile.mockResolvedValue(undefined);
```

## 🔄 Integration Tests

### Agent Interaction Testing

#### Boundary → Refactor Pipeline (`tests/integration/boundary-to-refactor.test.ts`)
```typescript
describe('Integration: Boundary Discovery → Refactoring', () => {
  it('should discover boundaries and successfully refactor them', async () => {
    // Step 1: Discover boundaries
    const boundaryResult = await boundaryAgent.analyzeBoundaries();
    
    // Step 2: Use discovered boundaries for refactoring
    const refactorResult = await refactorAgent.executeRefactoring(
      boundaryResult.domainMap.boundaries,
      false
    );
    
    // Verify consistency and structure
    expect(refactorResult.generated_files.length).toBeGreaterThan(0);
  });
});
```

#### Cost Management Integration (`tests/integration/cost-manager-integration.test.ts`)
```typescript
describe('Integration: Cost Management with Refactoring', () => {
  it('should track actual costs during refactoring', async () => {
    const estimate = await refactorAgent.estimateCost(boundaries);
    await refactorAgent.executeRefactoring(boundaries, false);
    await costManager.recordUsage(estimate.estimatedTokens, estimate.estimatedCost, 'refactor');
    
    const usageReport = costManager.getUsageReport();
    expect(usageReport.today.cost).toBe(estimate.estimatedCost);
  });
});
```

### Data Flow Validation
- **Artifact Consistency**: Files pass correctly between agents
- **Metadata Preservation**: Boundary information maintained
- **Error Propagation**: Failures handled gracefully
- **Rollback Verification**: Changes reverted on failure

## 🎯 End-to-End Tests

### Complete Workflow Testing (`tests/e2e/full-workflow.test.ts`)

#### Go Project Transformation
```typescript
describe('E2E: Complete Auto-Refactor Workflow', () => {
  it('should execute complete Go project transformation', async () => {
    await createMockGoProject(tempDir);
    
    const result = await executeAutoRefactor(tempDir, false);
    
    // Verify all pipeline stages
    expect(result.boundaries.length).toBeGreaterThan(0);
    expect(result.refactorResult.generated_files.length).toBeGreaterThan(0);
    expect(result.testResult.generated_tests.length).toBeGreaterThan(0);
    expect(result.validation.compile.success).toBe(true);
  });
});
```

#### Large Project Performance
```typescript
it('should handle large projects efficiently', async () => {
  // Create project with multiple domains
  const domains = ['auth', 'billing', 'notification', 'analytics'];
  // ... create files for each domain
  
  const startTime = Date.now();
  const result = await executeAutoRefactor(tempDir, false);
  const duration = Date.now() - startTime;
  
  expect(duration).toBeLessThan(120000); // Under 2 minutes
  expect(result.boundaries.length).toBeGreaterThanOrEqual(domains.length);
});
```

### CLI Command Testing (`tests/e2e/cli-commands.test.ts`)

#### Command Validation
```typescript
describe('E2E: CLI Commands', () => {
  it('should execute complete workflow in dry-run mode', async () => {
    const output = execSync(`node "${cliPath}" auto "${tempDir}"`, {
      encoding: 'utf8',
      timeout: 60000
    });
    
    expect(output).toContain('Step 1/6: Boundary Discovery');
    expect(output).toContain('AI Automatic Refactoring Complete');
    expect(output).toContain('DRY RUN');
  });
});
```

#### Error Handling
```typescript
it('should handle non-existent directories', async () => {
  try {
    execSync(`node "${cliPath}" discover "/nonexistent"`);
    expect.fail('Should have thrown an error');
  } catch (error: any) {
    expect(error.message).toContain('not found');
  }
});
```

## 🛠 Test Configuration

### Vitest Configuration (`vitest.config.ts`)
```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      thresholds: {
        global: {
          lines: 80,
          functions: 80,
          branches: 70,
          statements: 80
        }
      }
    }
  }
});
```

### Test Setup (`tests/setup.ts`)
```typescript
// Global setup for all tests
beforeAll(async () => {
  // Suppress console output during tests
  global.console = { ...console, log: vi.fn(), warn: vi.fn() };
});

// Utility functions
export const createTempDir = async (prefix: string): Promise<string> => {
  // Creates isolated test environment
};
```

## 📝 Test Scenarios

### Boundary Discovery Scenarios
- **Empty Projects**: No source files
- **Single Domain**: One clear boundary
- **Multiple Domains**: Complex interconnected modules
- **Mixed Languages**: Go + TypeScript projects
- **Large Codebases**: 50+ files across domains

### Refactoring Scenarios
- **Template Mode**: No AI enhancement
- **Hybrid Mode**: AI + template combination  
- **AI Mode**: Full Claude Code SDK utilization
- **Error Recovery**: Compilation failures and rollback
- **Incremental Changes**: Partial application testing

### Cost Management Scenarios
- **Limit Enforcement**: Exceeding various thresholds
- **Usage Tracking**: Multi-day/month accumulation
- **Concurrent Operations**: Parallel cost tracking
- **Persistence**: Configuration survival across restarts
- **Estimation Accuracy**: Predicted vs actual costs

### CLI Testing Scenarios
- **All Commands**: discover, plan, refactor, auto, estimate, full
- **Flag Combinations**: --apply, --language, --pattern, --timeout
- **Error Conditions**: Missing files, invalid syntax
- **Output Validation**: JSON structure, file creation
- **Performance**: Command execution timing

## 🐛 Debugging Tests

### Verbose Output
```bash
# Run tests with detailed output
npm run test -- --reporter=verbose

# Run specific test file
npm run test tests/unit/enhanced-boundary-agent.test.ts

# Run tests matching pattern
npm run test -- --grep "boundary discovery"
```

### Test Isolation
```bash
# Run single test
npm run test -- --grep "should discover boundaries and successfully refactor them"

# Debug mode with full output
DEBUG=vibeflow:* npm run test
```

### Coverage Analysis
```bash
# Generate detailed coverage report
npm run test:coverage

# Open HTML coverage report
open coverage/index.html
```

## 🚀 Continuous Integration

### GitHub Actions
```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Install dependencies
        run: npm ci
        
      - name: Run unit tests
        run: npm run test:unit
        
      - name: Run integration tests
        run: npm run test:integration
        
      - name: Run E2E tests
        run: npm run test:e2e
        
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### Pre-commit Hooks
```json
{
  "pre-commit": [
    "npm run typecheck",
    "npm run lint",
    "npm run test:unit"
  ]
}
```

## 📊 Testing Metrics

### Success Criteria
- **Unit Test Coverage**: 90%+ for core agents
- **Integration Test Pass Rate**: 100%
- **E2E Test Execution Time**: < 5 minutes
- **CLI Command Coverage**: All commands tested
- **Error Scenario Coverage**: 80%+ edge cases

### Performance Benchmarks
- **Boundary Discovery**: < 30 seconds for 50 files
- **Refactoring**: < 2 minutes for 5 boundaries
- **Cost Estimation**: < 5 seconds for 100 files
- **CLI Response Time**: < 1 second for help/version

---

**🎯 Goal: Ensure VibeFlow delivers reliable, predictable code transformations across all supported languages and project types.**