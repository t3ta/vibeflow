# Go Project Root Detection Fix

## Problem

VibeFlow was failing to build Go projects where the `go.mod` file is located in a subdirectory instead of the project root. This is common in monorepo structures where:

```
project-root/
├── frontend/          (React/Node.js app)
├── backend/           (Go application)
│   ├── go.mod        ← Go module here
│   ├── main.go
│   └── ...
└── docs/
```

## Solution

Created a new utility module `go-project-utils.ts` that:

1. **Automatically detects Go projects** in common subdirectories:
   - `backend`, `server`, `api`, `cmd`, `app`, `service`, `services`, `go`, `golang`
   - Falls back to project root if needed

2. **Provides helper functions**:
   - `detectGoProject()` - Finds go.mod and returns project info
   - `getGoWorkingDirectory()` - Gets the correct working directory for Go commands
   - `withGoWorkingDirectory()` - Executes callback with correct working directory
   - `findAllGoModules()` - Finds all Go modules in project (for multi-module projects)

3. **Updated affected components**:
   - `MigrationRunner` - Updated build and test commands
   - `BuildFixerAgent` - Updated build commands and advanced Go fixes
   - `AutoRefactorWorkflow` - Updated compilation and test execution

## Test Results

Successfully tested with the umitron-www-navy project:

```
Go Project Detection Results:
============================
hasGoProject: true
goModulePath: /Users/tmita/workspace/vibeflow/workspace/umitron-www-navy/backend/go.mod
workingDirectory: /Users/tmita/workspace/vibeflow/workspace/umitron-www-navy/backend
moduleName: github.com/umitron/umitron-www-navy

✅ Successfully detected Go project!
Working directory: /Users/tmita/workspace/vibeflow/workspace/umitron-www-navy/backend
Relative path: ./backend
```

## Code Changes

### Files Modified
- `src/core/agents/migration-runner.ts`
- `src/core/agents/build-fixer-agent.ts`
- `src/core/workflow/auto-refactor-workflow.ts`

### Files Created
- `src/core/utils/go-project-utils.ts`

### Key Benefits
1. **Automatic detection** - No manual configuration required
2. **Robust search** - Checks common Go directory patterns
3. **Multi-module support** - Can handle projects with multiple Go modules
4. **Error handling** - Graceful fallback if no Go project found
5. **Clear logging** - Shows which directory is being used for builds

This fix resolves build failures in projects with Go modules in subdirectories like the umitron-www-navy structure.