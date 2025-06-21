# AI Mode Guide

AI Mode leverages the Claude Code SDK to provide intelligent, context-aware code transformation.

## Prerequisites

1. **API Key**
   ```bash
   export CLAUDE_API_KEY=sk-ant-api03-...
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

## Operation Modes

### 1. Pure AI Mode
Use Claude Code SDK for complete transformation:
```bash
export USE_FULL_CLAUDE_CODE=true
vf auto ./my-project --apply
```

### 2. Hybrid Mode (Default)
Combines templates with AI enhancement:
```bash
vf auto ./my-project --apply
```

### 3. Cost Estimation
Check costs before running:
```bash
vf estimate ./my-project
```

## Features

### Business Logic Preservation
AI Mode automatically:
- Analyzes existing code patterns
- Identifies core business logic
- Preserves critical algorithms
- Maintains API contracts

### Intelligent Enhancement
Beyond templates, AI adds:
- Context-specific error handling
- Performance optimizations
- Better variable naming
- Comprehensive documentation

### Code Analysis
```bash
# Analyze code before transformation
vf analyze ./src/services/user.go

Output:
📊 Code Analysis:
   Business Logic: 5 rules found
   - User validation logic
   - Permission checking
   - Email uniqueness
   Patterns: Repository, Service
   Dependencies: database/sql, redis
   Suggestions: 3 improvements
```

## Cost Management

### Setting Limits
```bash
# Daily limit
export VIBEFLOW_DAILY_LIMIT=10.00

# Per-run limit  
export VIBEFLOW_RUN_LIMIT=5.00

# Monthly limit
export VIBEFLOW_MONTHLY_LIMIT=100.00
```

### Usage Tracking
```bash
vf usage

💳 Current Usage:
   Today: $2.45 (12 operations)
   This month: $45.20 (234 operations)
   
🔒 Limits:
   Daily: $10.00
   Monthly: $100.00
```

## Best Practices

### 1. Start with Estimates
Always estimate costs first:
```bash
vf estimate ./my-project --detailed
```

### 2. Use Hybrid Mode
For most projects, hybrid mode offers the best balance:
- Lower costs than pure AI
- Higher quality than pure templates
- Faster than pure AI

### 3. Review AI Changes
AI suggestions should be reviewed:
```bash
# Dry run first
vf auto ./my-project

# Review changes
git diff

# Apply if satisfied
vf auto ./my-project --apply
```

### 4. Incremental Adoption
Start with one module:
```bash
vf auto ./src/services/user --apply
```

## Troubleshooting

### API Key Issues
```bash
# Verify API key
echo $CLAUDE_API_KEY

# Test connection
vf test-ai
```

### Rate Limits
If you hit rate limits:
1. Wait 1 minute
2. Use smaller batches
3. Enable retry logic

### High Costs
To reduce costs:
1. Use hybrid mode (default)
2. Process fewer files at once
3. Increase template coverage

## Advanced Usage

### Custom Instructions
Create `.vibeflow/instructions.md`:
```markdown
# Custom AI Instructions

1. Use our company's error handling pattern
2. Include telemetry in all services
3. Follow our naming conventions
```

### Pattern Learning
Coming soon: Train on your patterns
```bash
vf learn ./examples --pattern custom-arch
```

## Comparison: Template vs AI vs Hybrid

| Aspect | Template | AI | Hybrid |
|--------|----------|----|---------| 
| Setup | None | API Key | API Key |
| Cost | Free | $0.10-0.20/file | $0.05/file |
| Speed | 2-3s | 10-15s | 5-8s |
| Customization | Low | High | Medium |
| Business Logic | Manual | Preserved | Preserved |
| Error Handling | Basic | Advanced | Advanced |
| Best For | Prototypes | Complex refactoring | Production |

## Next Steps

1. Set up your API key
2. Run cost estimation
3. Try hybrid mode on a small module
4. Review and iterate