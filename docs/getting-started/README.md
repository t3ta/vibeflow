# Getting Started with VibeFlow

VibeFlow transforms monolithic codebases into clean, modular architectures using AI-powered boundary discovery and intelligent code transformation.

## 🚀 Quick Installation

```bash
# Clone repository (until npm package is available)
git clone https://github.com/your-org/vibeflow.git
cd vibeflow

# Install dependencies
npm install

# Build the project
npm run build

# Link for global access
npm link
```

## 🎯 Your First Transformation

### Option 1: Zero-Config AI Transformation (Recommended)

Perfect for exploring what VibeFlow can do with your codebase:

```bash
# Navigate to your project
cd /path/to/your/monolithic-project

# Run complete AI transformation (dry-run)
vf auto . 

# Apply changes if you're happy with the preview
vf auto . --apply
```

**What happens:**
1. 🔍 AI discovers module boundaries automatically
2. 🏗️ Generates clean architecture design
3. ✨ Transforms code using templates + AI enhancement
4. 🧪 Creates comprehensive test suites
5. ✅ Validates compilation and tests
6. 📊 Provides quality assessment

### Option 2: Step-by-Step Workflow

For more control over the transformation process:

```bash
# Step 1: Discover boundaries
vf discover .
# Creates: domain-map.json with discovered modules

# Step 2: Generate architecture plan
vf plan .
# Creates: plan.md with detailed refactoring strategy

# Step 3: Execute transformation  
vf refactor . --apply
# Applies the transformation based on the plan
```

## 🎭 Understanding Operation Modes

### 🤖 Hybrid Mode (Default)
- **Best of both worlds**: AI intelligence + template reliability
- **Cost-optimized**: Uses AI for complex logic, templates for structure
- **OAuth-based**: No API keys needed (uses Claude Code SDK)
- **Fallback safety**: Continues with templates if AI unavailable

```bash
vf auto . --apply
# Automatically uses hybrid mode
```

### 📋 Template-Only Mode
- **Zero cost**: Completely free operation
- **High quality**: Production-ready Clean Architecture patterns
- **Immediate**: No API dependencies
- **Reliable**: 100% consistent output

```bash
# Force template-only mode
VIBEFLOW_AI_ENABLED=false vf auto . --apply
```

### 🧠 AI-Enhanced Mode
- **Maximum intelligence**: Full Claude Code SDK utilization
- **Context-aware**: Understands business logic and preserves intent
- **Adaptive**: Learns from your codebase patterns
- **Premium results**: Highest quality transformations

```bash
# Enable full AI mode (higher cost)
vf auto . --apply --ai-enhanced
```

## 📊 Understanding Output

### Boundary Discovery Results
```bash
$ vf discover ./my-service

🤖 AI自動境界発見: /path/to/my-service
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

### Transformation Results
```bash
$ vf auto ./my-service --apply

🎉 AI Automatic Refactoring Complete!
⏱️ Total Time: 3.4 minutes

📊 Execution Summary:
   🏗️ Created modules: 4
   🔄 Converted files: 15
   🧪 Generated tests: 23
   ✅ Compile: Success
   🧪 Tests: Success  
   📈 Performance: 20% faster response time expected
```

### Generated File Structure
```
my-service/
├── internal/
│   ├── user/
│   │   ├── domain/
│   │   │   ├── user.go
│   │   │   └── user_test.go
│   │   ├── usecase/
│   │   │   ├── user_service.go
│   │   │   └── user_service_test.go
│   │   ├── infrastructure/
│   │   │   ├── user_repository.go
│   │   │   └── user_repository_test.go
│   │   └── handler/
│   │       ├── user_handler.go
│   │       └── user_handler_test.go
│   └── product/
│       ├── domain/
│       ├── usecase/
│       ├── infrastructure/
│       └── handler/
└── .vibeflow/
    ├── domain-map.json
    ├── plan.md
    └── metrics.json
```

## 💰 Cost Management

### Before You Start
Always estimate costs for AI transformations:

```bash
# Get cost estimation
vf estimate ./my-project

💰 Cost Estimation for AI Transformation
📊 Estimation Results:
   Files to process: 25
   Estimated tokens: 45,000
   Estimated cost: $0.68
   Estimated time: 4-6 minutes

💳 Current Usage:
   Today: $2.34 (8 operations)
   This month: $18.45 (67 operations)
```

### Setting Cost Limits
Create `.vibeflow/config.json`:

```json
{
  "cost_limits": {
    "per_run": 5.00,
    "daily": 25.00,
    "monthly": 100.00
  },
  "ai": {
    "enabled": true,
    "fallback_to_templates": true
  }
}
```

## 🛡️ Safety Features

### Automatic Backups
VibeFlow automatically backs up all files before making changes:

```bash
# Backup location
.vibeflow/backups/2024-01-15-14-30-00/
├── original_files/
│   ├── main.go
│   ├── user.go
│   └── product.go
└── metadata.json
```

### Rollback on Failure
If anything goes wrong, automatic rollback kicks in:

```bash
❌ Refactoring failed (2.1 min elapsed): compilation error
🔄 Automatic rollback executed.
✅ All files restored to original state
```

### Manual Rollback
You can also rollback manually:

```bash
# Rollback the last transformation
vf rollback

# Rollback to specific backup
vf rollback --backup 2024-01-15-14-30-00
```

## 🎯 Advanced Usage

### Custom Configuration
Create `vibeflow.config.yaml` for project-specific settings:

```yaml
# Architecture preferences
architecture:
  pattern: clean-architecture
  language: go
  layers:
    - domain      # Business entities
    - usecase     # Business logic
    - infrastructure  # External dependencies  
    - handler     # HTTP/gRPC handlers

# Boundary overrides
boundaries:
  - name: user
    description: User management domain
    files:
      - "internal/user/**/*.go"
      - "pkg/auth/**/*.go"
    
# AI configuration
ai:
  enabled: true
  max_cost_per_file: 0.10
  fallback_to_templates: true

# Quality targets
quality:
  test_coverage_minimum: 80
  max_cyclomatic_complexity: 10
  require_documentation: true
```

### Language-Specific Options

#### Go Projects
```bash
# Go-specific transformations
vf auto . --language go --pattern clean-arch
```

#### TypeScript Projects  
```bash
# TypeScript with specific patterns
vf auto . --language typescript --pattern hexagonal
```

#### Python Projects
```bash
# Python with Django patterns
vf auto . --language python --pattern django-clean
```

## 🧪 Testing Your Transformations

### Verify Results
After transformation, verify everything works:

```bash
# Run tests
go test ./...

# Check compilation
go build ./...

# Verify code quality
golangci-lint run
```

### Quality Metrics
VibeFlow provides detailed quality metrics in `.vibeflow/metrics.json`:

```json
{
  "transformation_summary": {
    "files_processed": 25,
    "modules_created": 4,
    "tests_generated": 23,
    "coverage_improvement": "+45%"
  },
  "code_quality": {
    "maintainability_index": 82,
    "cyclomatic_complexity": 6.3,
    "code_duplication": "2.1%"
  }
}
```

## 🆘 Troubleshooting

### Common Issues

#### "Required files not found"
```bash
❌ Required files not found. Please run "vf plan" first
```
**Solution**: Run the workflow in order: `discover` → `plan` → `refactor`

#### "Claude Code SDK not available"
```bash
⚠️ Claude Code SDK not available, using template mode
```
**Solution**: This is normal - VibeFlow falls back to high-quality templates

#### "Compilation failed after transformation"
```bash
❌ Compilation failed: undefined: UserRepository
```
**Solution**: Check `.vibeflow/logs/` for detailed error information

### Getting Help

1. **Check logs**: `.vibeflow/logs/vibeflow.log`
2. **Review backups**: `.vibeflow/backups/`
3. **Validate config**: `vf config validate`
4. **Community support**: [GitHub Issues](https://github.com/your-org/vibeflow/issues)

## 📝 What's Next?

After your first successful transformation:

1. **Explore Examples**: Check `docs/examples/` for more complex scenarios
2. **Custom Patterns**: Learn to create your own transformation patterns
3. **CI/CD Integration**: Automate transformations in your pipeline
4. **Team Adoption**: Share configurations across your team

---

**🎉 Congratulations! You're now ready to transform your codebase with VibeFlow.**

*Need help? Check our [FAQ](../faq.md) or [join our community](https://discord.gg/vibeflow)*