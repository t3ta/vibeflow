# VibeFlow Complete Auto-Refactoring Implementation Guide

## Mission: Build the Industry's Best Fully Automated Refactoring Tool

Current VibeFlow is like "a perfect architect who can't actually build houses". One step away from revolutionary tool. Bridge this gap.

---

## Phase 1: AI Integration Revival (Priority 1 - 1 week)

### URGENT: Actually Use Claude Code SDK

Current: `ClaudeCodeClient` is implemented but nobody uses it  
Required: **Execute actual code transformation with Claude Code SDK**

#### Complete RefactorAgent Rewrite

```typescript
// src/core/agents/refactor-agent.ts - Soul Implementation
export class RefactorAgent {
  private claudeClient: ClaudeCodeClient;
  
  constructor(projectRoot: string) {
    this.claudeClient = new ClaudeCodeClient({
      cwd: projectRoot,
      maxTurns: 5,
      systemPrompt: 'You are the world\'s best refactoring engineer.'
    });
  }

  // Not template generation, actual code transformation
  async generateRefactoredCode(file: string, boundary: DomainBoundary): Promise<RefactoredFile> {
    const originalCode = fs.readFileSync(file, 'utf8');
    
    const prompt = `
Transform this ${this.detectLanguage(file)} code to clean architecture suitable for ${boundary.name} module:

## Current Situation
- File: ${file}
- Target: migrate to internal/${boundary.name}/
- Dependencies: ${boundary.dependencies.join(', ')}

## Required Transformations
1. Complete separation of domain logic and infrastructure layer
2. Properly extract interfaces (dependency inversion)
3. Change to testable structure
4. Completely eliminate circular dependencies
5. Eliminate primitive type dependencies with value objects

## Output Format
Return in JSON format:
{
  "refactored_files": [
    {
      "path": "internal/customer/domain/customer.go",
      "content": "package domain\\n\\n// Domain logic...",
      "description": "Customer domain entity"
    },
    {
      "path": "internal/customer/usecase/customer_service.go", 
      "content": "package usecase\\n\\n// Use case...",
      "description": "Customer service use case"
    }
  ],
  "interfaces": [
    {
      "name": "CustomerRepository",
      "path": "internal/customer/domain/repository.go",
      "content": "type CustomerRepository interface { ... }"
    }
  ],
  "tests": [
    {
      "path": "internal/customer/domain/customer_test.go",
      "content": "package domain\\n\\nfunc TestCustomer..."
    }
  ]
}

Original code:
\`\`\`${this.detectLanguage(file)}
${originalCode}
\`\`\`
    `;
    
    const result = await this.claudeClient.queryForResult(prompt);
    return this.claudeClient.extractJsonFromResult(result);
  }

  // Not plan generation, actual file operations
  async executeRefactoring(boundaries: DomainBoundary[], applyChanges: boolean): Promise<RefactorResult> {
    const results: RefactorResult = {
      applied_patches: [],
      failed_patches: [],
      created_files: [],
      modified_files: [],
      deleted_files: []
    };

    for (const boundary of boundaries) {
      console.log(`Refactoring ${boundary.name} module...`);
      
      // 1. Create module structure
      await this.createModuleStructure(boundary);
      
      // 2. Actually transform each file
      for (const file of boundary.files) {
        try {
          const refactoredFiles = await this.generateRefactoredCode(file, boundary);
          
          if (applyChanges) {
            await this.applyRefactoredFiles(refactoredFiles);
            results.applied_patches.push(file);
          } else {
            console.log(`  ${file} -> will split into ${refactoredFiles.refactored_files.length} files`);
          }
        } catch (error) {
          results.failed_patches.push({ file, error: error.message });
        }
      }
    }

    return results;
  }

  private async createModuleStructure(boundary: DomainBoundary): Promise<void> {
    const dirs = [
      `internal/${boundary.name}/domain`,
      `internal/${boundary.name}/usecase`, 
      `internal/${boundary.name}/infrastructure`,
      `internal/${boundary.name}/handler`,
      `internal/${boundary.name}/test`
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
  }

  private async applyRefactoredFiles(refactoredFiles: RefactoredFile): Promise<void> {
    // Actual file writing
    for (const file of refactoredFiles.refactored_files) {
      await fs.writeFile(file.path, file.content);
      console.log(`  Created ${file.path}`);
    }
    
    // Interface generation
    for (const iface of refactoredFiles.interfaces) {
      await fs.writeFile(iface.path, iface.content);
      console.log(`  Created ${iface.name} interface`);
    }
    
    // Test generation
    for (const test of refactoredFiles.tests) {
      await fs.writeFile(test.path, test.content);
      console.log(`  Created test ${test.path}`);
    }
  }
}
```

#### Type Definitions

```typescript
// src/core/types/refactor.ts
export interface RefactoredFile {
  refactored_files: {
    path: string;
    content: string;
    description: string;
  }[];
  interfaces: {
    name: string;
    path: string;
    content: string;
  }[];
  tests: {
    path: string;
    content: string;
  }[];
}

export interface RefactorResult {
  applied_patches: string[];
  failed_patches: { file: string; error: string }[];
  created_files: string[];
  modified_files: string[];
  deleted_files: string[];
}
```

---

## Phase 2: Mastra Workflow Revival (3 days)

### Complete Reimplementation for Latest API

```typescript
// src/core/workflow/auto-refactor-workflow.ts
import { createWorkflow, createStep } from '@mastra/core/workflows';

export const autoRefactorWorkflow = createWorkflow({
  name: 'auto-refactor',
  description: 'Complete automatic refactoring workflow',
  
  steps: [
    createStep({
      id: 'boundary-discovery',
      name: 'Boundary Discovery',
      execute: async (context: { projectPath: string }) => {
        console.log('AI boundary discovery running...');
        const agent = new EnhancedBoundaryAgent(context.projectPath);
        const result = await agent.analyzeBoundaries();
        return { boundaries: result.autoDiscoveredBoundaries };
      }
    }),

    createStep({
      id: 'architecture-planning', 
      name: 'Architecture Design',
      dependsOn: ['boundary-discovery'],
      execute: async (context) => {
        console.log('Architecture design in progress...');
        const agent = new ArchitectAgent(context.projectPath);
        const result = await agent.generateArchitecturalPlan(context.domainMapPath);
        return { plan: result.plan };
      }
    }),

    createStep({
      id: 'code-refactoring',
      name: 'Actual Code Refactoring', 
      dependsOn: ['architecture-planning'],
      execute: async (context) => {
        console.log('AI automatic code transformation running...');
        const agent = new RefactorAgent(context.projectPath);
        const result = await agent.executeRefactoring(context.boundaries, context.applyChanges);
        
        if (result.failed_patches.length > 0) {
          throw new Error(`Failed to transform ${result.failed_patches.length} files`);
        }
        
        return { refactorResult: result };
      }
    }),

    createStep({
      id: 'test-synthesis',
      name: 'Automatic Test Generation',
      dependsOn: ['code-refactoring'],
      execute: async (context) => {
        console.log('Automatic test generation...');
        const agent = new TestSynthAgent(context.projectPath);
        return await agent.generateComprehensiveTests(context.refactorResult);
      }
    }),

    createStep({
      id: 'validation',
      name: 'Quality Validation',
      dependsOn: ['test-synthesis'],
      execute: async (context) => {
        console.log('Quality validation running...');
        
        // Compile check
        const compileResult = await this.runCompilation(context.projectPath);
        if (!compileResult.success) {
          throw new Error(`Compile errors: ${compileResult.errors.join(', ')}`);
        }
        
        // Test execution
        const testResult = await this.runTestSuite(context.projectPath);
        if (!testResult.success) {
          throw new Error(`Test failures: ${testResult.failedTests.length} cases`);
        }
        
        // Performance test
        const perfResult = await this.runPerformanceTests(context.projectPath);
        
        return {
          compile: compileResult,
          tests: testResult, 
          performance: perfResult
        };
      }
    }),

    createStep({
      id: 'review-and-commit',
      name: 'Review and Commit',
      dependsOn: ['validation'],
      execute: async (context) => {
        console.log('AI automatic review running...');
        const agent = new ReviewAgent(context.projectPath);
        const review = await agent.reviewChanges(context.refactorResult);
        
        if (review.auto_merge_decision.should_auto_merge) {
          await this.commitChanges(context.projectPath, 'AI automatic refactoring complete');
          console.log('Auto-merge completed!');
        } else {
          console.log('Manual review required');
        }
        
        return { review };
      }
    })
  ],

  // Error handling and rollback
  onError: async (context, error) => {
    console.error('Workflow failed:', error.message);
    await this.rollbackChanges(context.projectPath);
    throw error;
  }
});

// Workflow execution function
export async function executeAutoRefactor(projectPath: string, applyChanges: boolean = false) {
  const context = {
    projectPath,
    applyChanges,
    startTime: Date.now()
  };
  
  try {
    const result = await autoRefactorWorkflow.execute(context);
    const duration = ((Date.now() - context.startTime) / 1000 / 60).toFixed(1);
    
    console.log(`Complete automatic refactoring finished! (${duration} min)`);
    return result;
  } catch (error) {
    console.error('Refactoring failed:', error.message);
    throw error;
  }
}
```

---

## Phase 3: Complete Auto-Execution Command (1 week)

### New CLI Command: `vf auto`

```typescript
// Add to src/cli.ts
program
  .command('auto')
  .argument('[path]', 'target project root', 'workspace')
  .option('-a, --apply', 'actually apply changes (not dry-run)')
  .option('-l, --language <lang>', 'target language', 'go')
  .option('-p, --pattern <pattern>', 'architecture pattern', 'clean-arch')
  .option('-t, --timeout <minutes>', 'timeout in minutes', '60')
  .description('Complete automatic refactoring with AI')
  .action(async (path: string, opts: { 
    apply?: boolean; 
    language?: string; 
    pattern?: string; 
    timeout?: string;
  }) => {
    console.log('AI complete automatic refactoring starting...');
    console.log(`   Target: ${path}`);
    console.log(`   Language: ${opts.language}`);
    console.log(`   Pattern: ${opts.pattern}`);
    console.log(`   Mode: ${opts.apply ? 'Apply' : 'Dry Run'}`);
    
    const startTime = Date.now();
    
    try {
      // Timeout setting
      const timeoutMs = parseInt(opts.timeout || '60') * 60 * 1000;
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout')), timeoutMs)
      );
      
      // Actual workflow execution
      const refactorPromise = executeAutoRefactor(path, opts.apply);
      
      const result = await Promise.race([refactorPromise, timeoutPromise]);
      
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      
      console.log(`\nAI automatic refactoring complete! (${duration} min)`);
      console.log('\nExecution Summary:');
      console.log(`   Created modules: ${result.boundaries?.length || 0}`);
      console.log(`   Converted files: ${result.refactorResult?.applied_patches?.length || 0}`);
      console.log(`   Generated tests: ${result.testResult?.generated_tests?.length || 0}`);
      console.log(`   Compile: ${result.validation?.compile?.success ? 'Success' : 'Failed'}`);
      console.log(`   Tests: ${result.validation?.tests?.success ? 'Success' : 'Failed'}`);
      console.log(`   Performance: ${result.validation?.performance?.improvement || 'N/A'}`);
      
      if (!opts.apply) {
        console.log('\nThis was a dry run. Use --apply flag to actually apply changes.');
      }
      
    } catch (error) {
      const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
      console.error(`\nRefactoring failed (${duration} min elapsed):`, error.message);
      console.log('\nAutomatic rollback executed.');
      process.exit(1);
    }
  });
```

---

## Phase 4: Enterprise-Level Advanced Features (2 weeks)

### Incremental Refactoring

```typescript
// src/core/agents/incremental-refactor-agent.ts
export class IncrementalRefactorAgent {
  // Gradual migration without stopping existing system
  async executeIncrementalRefactor(
    boundaries: DomainBoundary[],
    options: { 
      batchSize: number;
      testBetweenBatches: boolean;
      rollbackOnFailure: boolean;
    }
  ): Promise<IncrementalResult> {
    const batches = this.createBatches(boundaries, options.batchSize);
    
    for (const [index, batch] of batches.entries()) {
      console.log(`Executing batch ${index + 1}/${batches.length}...`);
      
      // Execute batch
      const result = await this.executeBatch(batch);
      
      // Inter-batch testing
      if (options.testBetweenBatches) {
        const testResult = await this.runRegressionTests();
        if (!testResult.success && options.rollbackOnFailure) {
          await this.rollbackBatch(batch);
          throw new Error(`Batch ${index + 1} test failed, rollback complete`);
        }
      }
      
      // Progress report
      console.log(`  ${result.convertedFiles.length} files converted`);
    }
  }
}
```

### Multi-Language Support

```typescript
// src/core/agents/multi-language-agent.ts
export class MultiLanguageAgent {
  async refactorPolyglotProject(
    projectPath: string,
    languages: ('go' | 'typescript' | 'python')[]
  ): Promise<MultiLanguageResult> {
    const results = {};
    
    for (const lang of languages) {
      console.log(`Converting ${lang} code...`);
      
      const langAgent = this.createLanguageAgent(lang);
      results[lang] = await langAgent.refactor(projectPath);
      
      // Generate cross-language interfaces
      await this.generateCrossLanguageInterfaces(results);
    }
    
    return results;
  }
}
```

---

## Core Implementation Principles

### 1. Actually Use Claude Code SDK
- ❌ Template generation
- ✅ **Actual code transformation**
- ✅ **Real-time quality checking**
- ✅ **Context-aware optimization**

### 2. Abandon Perfectionism
- Ship when 80% works
- Design with failure as assumption
- Focus on gradual improvement

### 3. Validation-First Development
```
Code Gen -> Compile -> Test -> Perf -> Deploy
    ↓fail      ↓fail   ↓fail   ↓fail
Auto-fix   Auto-fix Auto-fix Auto-rollback
```

### 4. Deliver Real AI Experience
```bash
$ vf auto ./my-legacy-project --apply
AI automatic refactoring starting...
[████████████████████████████] 100% - Complete (23 min)

Refactoring Complete!
   15 clean modules created
   Coverage 45% -> 87% improved  
   Response time 30% improved
   Security vulnerabilities: 0

Estimated cost reduction: $2.4M annually
Development efficiency: 3.2x improvement predicted

Production ready! 🚀
```

---

## Final Goal

**"AI that automatically refactors for you - magic tool"**

Level where you run command in morning, eat lunch, come back to perfectly refactored code.

Develop with intention to create industry standard. No compromise allowed.

**Deadline: Complete all phases within 3 weeks**

---

*"Humans write code, AI refactors - welcome to the new era"* 🤖✨