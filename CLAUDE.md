# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VibeFlow is an autonomous refactoring pipeline that transforms monolithic backend codebases into cleanly separated modular monoliths. It combines Mastra workflow engine with Claude Code-powered language models to automate the entire refactoring process from boundary discovery to code review.

**Current Status**: Early alpha with stub CLI implementations

## Architecture

### Multi-Agent Pipeline

```
BoundaryAgent → ArchitectAgent → RefactorAgent → TestSynthAgent
                                      ↓
                               MigrationRunner → ReviewAgent
```

### Key Agents

- **BoundaryAgent**: Extracts context boundaries from code → `domain-map.json`
- **ArchitectAgent**: Creates modular design proposals → `plan.md`
- **RefactorAgent**: Generates language-specific patches → `.refactor/`
- **TestSynthAgent**: Relocates tests and scaffolds missing cases → `__generated__/`
- **MigrationRunner**: Executes patches with rollback on failure → `result.json`
- **ReviewAgent**: Provides AI-assisted code review and auto-merge decisions

### Supported Languages

- TypeScript
- Go
- Python

## Development Commands

### Current CLI Commands

```bash
# Generate refactor plan (runs BoundaryAgent + ArchitectAgent)
vf plan [path]

# Execute refactor according to plan (runs RefactorAgent + MigrationRunner)
vf refactor [path]
vf refactor -a [path]  # Apply patches automatically
```

### Project Setup

Currently missing package.json and build configuration. When implementing:

1. Initialize TypeScript project with Commander.js and Chalk dependencies
2. Set up Mastra workflow engine integration
3. Configure Claude Code/Ollama LLM integration

## Code Architecture

### Directory Structure

```
src/
├── cli.ts          # CLI entry point using Commander.js
├── core/           # Core agent implementations (to be implemented)
│   ├── agents/     # Individual agent logic
│   ├── workflow/   # Mastra workflow definitions
│   └── utils/      # Shared utilities
└── tools/          # Language-specific refactoring tools
    ├── typescript/ # TypeScript AST manipulation
    ├── go/         # Go refactoring logic
    └── python/     # Python refactoring logic
```

### Key Artifacts

- `domain-map.json` - Extracted boundary information
- `boundary.yaml` - Manual boundary overrides
- `plan.md` - Architecture design proposal
- `.refactor/` - Generated patches directory
- `metrics.json` - Code quality metrics
- `result.json` - Build/test results
- `coverage-diff.json` - Test coverage changes

### Design Principles

1. **Idempotent Operations**: Each step can be re-run safely
2. **Git-based Safety**: All changes through git with rollback capability
3. **Validation First**: Circular dependency and boundary leak detection
4. **Language Agnostic**: Separate refactoring logic per language
5. **Incremental Progress**: Each agent produces verifiable artifacts

## Implementation Guidelines

### Agent Development

- Each agent should be a pure function with separated I/O
- Use TypeScript with strong typing for all implementations
- Integrate with Mastra workflow engine for orchestration
- LLM calls should use Claude Code API or Ollama as configured

### Error Handling

- All agents must support rollback operations
- Validate artifacts before proceeding to next stage
- Log detailed progress for debugging
- Fail fast with clear error messages

### Testing Approach

- Unit tests for individual agent logic
- Integration tests for full pipeline
- Use test projects in `workspace/` for end-to-end testing
- Validate generated patches before application

## Common Tasks

### Adding a New Agent

1. Create agent module in `src/core/agents/`
2. Define input/output artifact schemas
3. Implement validation logic
4. Add to Mastra workflow pipeline
5. Update CLI commands if needed

### Supporting a New Language

1. Add language directory in `src/tools/`
2. Implement AST parsing and manipulation
3. Create language-specific refactoring rules
4. Add test cases in `workspace/`
5. Update RefactorAgent to use new tools

### Debugging Pipeline Issues

1. Check artifact files for each completed stage
2. Use dry-run mode to preview changes
3. Examine git diff for applied patches
4. Review `metrics.json` for quality indicators
5. Check `result.json` for build/test failures

## Development Notes

- **Task File Naming**: When creating task files in `docs/task`, use `date "+%s"` to prefix the filename with a timestamp
- **Knowledge Sharing**: When getting some knowledge, document to `docs` and share it with other members
