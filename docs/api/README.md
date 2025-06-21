# VibeFlow API Reference

Complete API documentation for VibeFlow's command-line interface and programmatic APIs.

## 📋 Table of Contents

- [CLI Commands](#-cli-commands)
- [Configuration API](#-configuration-api)
- [Programmatic API](#-programmatic-api)
- [Cost Management API](#-cost-management-api)
- [Error Handling](#-error-handling)

## 🚀 CLI Commands

### `vf auto` - Complete Automatic Refactoring

The revolutionary command that transforms your entire codebase automatically.

```bash
vf auto [path] [options]
```

**Arguments:**
- `path` - Target project directory (default: current directory)

**Options:**
- `-a, --apply` - Apply changes (default: dry-run mode)
- `-l, --language <lang>` - Target language: `go`, `typescript`, `python` (default: auto-detect)
- `-p, --pattern <pattern>` - Architecture pattern: `clean-arch`, `hexagonal`, `ddd`, `layered` (default: `clean-arch`)
- `-t, --timeout <minutes>` - Timeout in minutes (default: 60)

**Examples:**
```bash
# Dry-run transformation
vf auto ./my-service

# Apply Go clean architecture transformation
vf auto ./go-service --apply --language go --pattern clean-arch

# TypeScript hexagonal architecture with 30min timeout
vf auto ./ts-api --apply --language typescript --pattern hexagonal --timeout 30
```

**Output:**
```
🤖 Running in Hybrid Mode
   Claude Code SDK + Templates for optimal results

📁 Target: ./my-service
🔤 Language: go
🏗️ Pattern: clean-arch
⚙️ Mode: 🔥 APPLY CHANGES

🤖 Step 1/6: Boundary Discovery
   ✅ Discovered 4 boundaries with 87.3% confidence

🏗️ Step 2/6: Architecture Design
   ✅ Architecture plan generated

✨ Step 3/6: Code Transformation
   ✅ All 15 files transformed successfully

🧪 Step 4/6: Test Generation
   ✅ Generated 23 test files

🔍 Step 5/6: Quality Validation
   ✅ All quality checks passed

🤖 Step 6/6: Code Review
   ✅ AI approved changes - ready for production!

🎉 AI Automatic Refactoring Complete!
⏱️ Total Time: 3.4 minutes
```

### `vf discover` - AI Boundary Discovery

Discover module boundaries automatically without any configuration.

```bash
vf discover [path]
```

**Arguments:**
- `path` - Target project directory (default: `workspace`)

**Examples:**
```bash
# Discover boundaries in current project
vf discover .

# Analyze specific service
vf discover ./user-service
```

**Output:**
```
🤖 AI自動境界発見: /path/to/project
📊 発見結果サマリ:
   🎯 発見された境界: 4個
   📈 全体信頼度: 87.3%
   🏗️ 構造一貫性: 92.1%
   🗄️ DB整合性: 84.5%

🎯 発見された境界:
   1. user (信頼度91.2%)
      └─ User management and authentication domain
      └─ ファイル数: 8, キーワード: user, auth, login
   2. product (信頼度88.7%)
      └─ Product catalog and inventory domain
      └─ ファイル数: 12, キーワード: product, inventory, catalog
```

### `vf plan` - Generate Architecture Plan

Create detailed refactoring plans based on discovered boundaries.

```bash
vf plan [path]
```

**Arguments:**
- `path` - Target project directory (default: `workspace`)

**Generated Files:**
- `domain-map.json` - Discovered boundary information
- `plan.md` - Detailed architectural design plan

### `vf refactor` - Execute Refactoring

Apply transformations according to the generated plan.

```bash
vf refactor [path] [options]
```

**Options:**
- `-a, --apply` - Apply patches automatically (default: dry-run)

**Examples:**
```bash
# Dry-run refactoring
vf refactor ./my-service

# Apply refactoring patches
vf refactor ./my-service --apply
```

### `vf estimate` - Cost Estimation

Estimate AI transformation costs before running.

```bash
vf estimate <path> [options]
```

**Options:**
- `-d, --detailed` - Show detailed breakdown by boundary

**Examples:**
```bash
# Basic cost estimation
vf estimate ./my-project

# Detailed breakdown
vf estimate ./my-project --detailed
```

**Output:**
```
💰 Cost Estimation for AI Transformation

📊 Estimation Results:
   Files to process: 25
   Estimated tokens: 45,000
   Estimated cost: $0.68
   Estimated time: 4-6 minutes

💳 Current Usage:
   Today: $2.34 (8 operations)
   This month: $18.45 (67 operations)

🔒 Cost Limits:
   Per run: $5.00
   Daily: $50.00
   Monthly: $200.00

✅ Within cost limits
```

### `vf full` - Complete Pipeline

Run the complete pipeline: plan + refactor in sequence.

```bash
vf full [path] [options]
```

**Options:**
- `-a, --apply` - Apply patches automatically

## ⚙️ Configuration API

### Configuration File: `vibeflow.config.yaml`

```yaml
# AI Configuration
ai:
  enabled: true                    # Enable AI features
  fallback_to_templates: true     # Fallback to templates on AI failure
  max_cost_per_run: 5.00         # Maximum cost per operation

# Architecture Configuration  
architecture:
  pattern: clean-architecture     # Architecture pattern
  language: go                    # Target language
  layers:                         # Custom layer definitions
    - domain
    - usecase
    - infrastructure
    - handler

# Boundary Overrides (optional)
boundaries:
  - name: user                    # Boundary name
    description: "User management domain"
    files:                        # File patterns
      - "internal/user/**/*.go"
      - "pkg/auth/**/*.go"
    dependencies:                 # Dependencies
      - database
      - messaging
    semantic_keywords:            # Domain keywords
      - user
      - auth
      - login

# Safety Configuration
safety:
  backup_enabled: true           # Automatic backups
  rollback_on_failure: true     # Auto-rollback on failure
  validate_before_apply: true   # Pre-flight validation

# Cost Management
cost_limits:
  per_run: 5.00                 # Maximum cost per run
  daily: 50.00                  # Daily spending limit
  monthly: 200.00               # Monthly spending limit

# Quality Targets
quality:
  test_coverage_minimum: 80     # Minimum test coverage %
  max_cyclomatic_complexity: 10 # Complexity threshold
  require_documentation: true   # Require code documentation
```

### Runtime Configuration: `.vibeflow/config.json`

```json
{
  "project_id": "my-service-v1",
  "last_run": "2024-01-15T14:30:00Z",
  "cost_limits": {
    "per_run": 5.00,
    "daily": 25.00, 
    "monthly": 100.00
  },
  "usage_tracking": {
    "total_operations": 67,
    "total_cost": 18.45,
    "last_reset": "2024-01-01T00:00:00Z"
  }
}
```

## 🔧 Programmatic API

### Core Classes

#### `AutoRefactorWorkflow`

Execute the complete refactoring pipeline programmatically.

```typescript
import { executeAutoRefactor } from './core/workflow/auto-refactor-workflow.js';

const result = await executeAutoRefactor(
  '/path/to/project',    // Project path
  true                   // Apply changes
);

console.log(`Transformed ${result.refactorResult.applied_patches.length} files`);
```

#### `EnhancedBoundaryAgent`

Discover module boundaries using AI and ML algorithms.

```typescript
import { EnhancedBoundaryAgent } from './core/agents/enhanced-boundary-agent.js';

const agent = new EnhancedBoundaryAgent('/path/to/project');
const boundaries = await agent.analyzeBoundaries();

console.log(`Discovered ${boundaries.autoDiscoveredBoundaries.length} boundaries`);
console.log(`Overall confidence: ${boundaries.discoveryMetrics.confidence_metrics.overall_confidence}%`);
```

#### `HybridRefactorAgent`

Execute intelligent code transformation with AI + template hybrid approach.

```typescript
import { HybridRefactorAgent } from './core/agents/hybrid-refactor-agent.js';

const agent = new HybridRefactorAgent('/path/to/project');

// Estimate costs first
const estimate = await agent.estimateCost(boundaries);
console.log(`Estimated cost: $${estimate.estimatedCost}`);

// Execute transformation
const result = await agent.executeRefactoring(boundaries, true);
console.log(`Applied ${result.applied_patches.length} patches`);
```

#### `CostManager`

Manage AI usage costs and enforce limits.

```typescript
import { CostManager } from './core/utils/cost-manager.js';

const costManager = new CostManager('/path/to/project');
await costManager.initialize();

// Check if operation is within limits
const canRun = await costManager.checkLimits(1.50, 'refactor');
if (!canRun.allowed) {
  console.log(`Cannot run: ${canRun.reason}`);
}

// Track usage
await costManager.trackUsage(1.50, 'refactor', {
  files_processed: 10,
  tokens_used: 5000
});

// Get usage report
const usage = costManager.getUsageReport();
console.log(`Today's usage: $${usage.today.cost}`);
```

### Type Definitions

#### `RefactorResult`

```typescript
interface RefactorResult {
  applied_patches: string[];        // Successfully applied patches
  failed_patches: string[];         // Failed patch applications
  generated_files: string[];        // Newly created files
  compilation_result: CompileResult; // Compilation validation
  test_result: TestResult;          // Test execution results
  metrics: QualityMetrics;          // Code quality metrics
}
```

#### `DomainBoundary`

```typescript
interface DomainBoundary {
  name: string;                     // Boundary name
  description: string;              // Human-readable description
  files: string[];                  // File paths in boundary
  dependencies: string[];           // Dependencies on other boundaries
  semantic_keywords: string[];      // Domain-specific terminology
  confidence: number;               // ML confidence score (0-1)
  boundary_type: string;            // Type classification
}
```

#### `CostEstimate`

```typescript
interface CostEstimate {
  fileCount: number;                // Number of files to process
  estimatedTokens: number;          // Estimated token usage
  estimatedCost: number;            // Estimated cost in USD
  estimatedTime: string;            // Estimated duration
  breakdown: {                      // Detailed cost breakdown
    templates: number;              // Template generation cost
    ai_enhancement: number;         // AI enhancement cost
    validation: number;             // Validation cost
  };
}
```

## 💰 Cost Management API

### Cost Limits Configuration

```typescript
interface CostLimits {
  perRun: number;      // Maximum cost per single operation
  daily: number;       // Daily spending limit
  monthly: number;     // Monthly spending limit
}
```

### Usage Tracking

```typescript
interface UsageReport {
  today: {
    cost: number;           // Today's total cost
    operations: number;     // Number of operations today
  };
  thisMonth: {
    cost: number;           // This month's total cost
    operations: number;     // Number of operations this month
  };
  limits: CostLimits;       // Current cost limits
}
```

### Cost Check Response

```typescript
interface CostCheckResult {
  allowed: boolean;         // Whether operation is allowed
  reason?: string;          // Reason if not allowed
  remainingBudget: {
    perRun: number;         // Remaining per-run budget
    daily: number;          // Remaining daily budget  
    monthly: number;        // Remaining monthly budget
  };
}
```

## ❌ Error Handling

### Error Types

```typescript
enum VibeFlowErrorCode {
  BOUNDARY_DISCOVERY_FAILED = 'BOUNDARY_DISCOVERY_FAILED',
  ARCHITECTURE_PLAN_FAILED = 'ARCHITECTURE_PLAN_FAILED', 
  REFACTOR_FAILED = 'REFACTOR_FAILED',
  TEST_GENERATION_FAILED = 'TEST_GENERATION_FAILED',
  COMPILATION_FAILED = 'COMPILATION_FAILED',
  COST_LIMIT_EXCEEDED = 'COST_LIMIT_EXCEEDED',
  AI_SERVICE_UNAVAILABLE = 'AI_SERVICE_UNAVAILABLE'
}
```

### Error Response Format

```typescript
interface VibeFlowError {
  code: VibeFlowErrorCode;     // Error classification
  message: string;             // Human-readable message
  severity: ErrorSeverity;     // WARNING | ERROR | FATAL
  context?: {                  // Additional context
    agent?: string;            // Which agent failed
    file?: string;             // Which file caused error
    operation?: string;        // Which operation failed
  };
  recovery?: {                 // Recovery suggestions
    action: string;            // Suggested action
    command?: string;          // Suggested command
  };
}
```

### Common Error Responses

#### Cost Limit Exceeded
```json
{
  "code": "COST_LIMIT_EXCEEDED",
  "message": "Daily cost limit of $50.00 exceeded",
  "severity": "ERROR",
  "context": {
    "current_usage": 52.30,
    "limit": 50.00
  },
  "recovery": {
    "action": "Wait until tomorrow or increase daily limit",
    "command": "vf config set cost_limits.daily 100.00"
  }
}
```

#### AI Service Unavailable
```json
{
  "code": "AI_SERVICE_UNAVAILABLE", 
  "message": "Claude Code SDK not available, falling back to template mode",
  "severity": "WARNING",
  "context": {
    "agent": "RefactorAgent"
  },
  "recovery": {
    "action": "Template mode will be used automatically"
  }
}
```

### Exit Codes

- `0` - Success
- `1` - General error
- `2` - Configuration error
- `3` - Cost limit exceeded
- `4` - Compilation failed
- `5` - AI service unavailable (when fallback disabled)

---

**For more examples and advanced usage, see the [examples directory](../examples/).**