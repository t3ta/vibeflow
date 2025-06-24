import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import { VibeFlowPaths } from '../utils/file-paths.js';
import { ClaudeCodeClient } from '../utils/claude-code-client.js';
import { RefactoredFile, RefactorResult } from '../types/refactor.js';
import { DomainBoundary } from '../types/config.js';
import { RefactorError, getErrorMessage } from '../utils/error-utils.js';
import { FileSafetyManager } from '../utils/file-safety.js';

export interface RefactorPlan {
  summary: {
    total_patches: number;
    target_modules: string[];
    estimated_time: string;
  };
  patches: RefactorPatch[];
}

export interface RefactorPatch {
  id: string;
  target_file: string;
  changes: PatchChange[];
  dependencies: string[];
  test_requirements: string[];
}

export interface PatchChange {
  type: 'create' | 'modify' | 'delete' | 'move';
  source_path?: string;
  target_path: string;
  content?: string;
  description: string;
}

export interface RefactorAgentResult {
  plan: RefactorPlan;
  outputPath: string;
}

/**
 * RefactorAgent - Soul Implementation
 * Actually uses Claude Code SDK for real code transformation
 */
export class RefactorAgent {
  private paths: VibeFlowPaths;
  private claudeClient: ClaudeCodeClient;
  protected projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.paths = new VibeFlowPaths(projectRoot);
    this.claudeClient = new ClaudeCodeClient({
      cwd: projectRoot,
      maxTurns: 5,
      systemPrompt: 'You are the world\'s best refactoring engineer. Transform legacy code into clean, maintainable architecture.'
    });
  }

  /**
   * Generate actual refactored code using Claude Code SDK
   * Not template generation, actual code transformation
   */
  async generateRefactoredCode(file: string, boundary: DomainBoundary): Promise<RefactoredFile> {
    console.log(`🤖 Transforming ${file} for ${boundary.name} module...`);
    
    const originalCode = await fs.readFile(file, 'utf8');
    
    const prompt = `
Transform this ${this.detectLanguage(file)} code to Domain-Driven Design architecture suitable for the "${boundary.name}" bounded context:

## Current Situation
- File: ${file}
- Target bounded context: ${boundary.name}
- Business capability: ${boundary.description}
- Ubiquitous language terms: ${boundary.ubiquitousLanguage?.join(', ') || 'Not specified'}
- Context dependencies: ${boundary.dependencies?.internal?.join(', ') || 'None'}

## Required Transformations
1. **Preserve Business Language**: Use exact business terminology from the bounded context
2. **Domain Layer Separation**: Extract pure business logic that captures domain rules and invariants
3. **Application Services**: Create use cases that orchestrate domain operations
4. **Infrastructure Independence**: Separate infrastructure concerns from business logic
5. **Aggregate Boundaries**: Respect business transaction and consistency boundaries
6. **Value Objects**: Model business concepts that don't have identity but have business rules

IMPORTANT: Maintain the business meaning and terminology identified in this bounded context. Do not introduce technical abstractions that obscure business concepts.

## Output Format
Return in JSON format:
{
  "refactored_files": [
    {
      "path": "internal/${boundary.name}/domain/${boundary.name}.go",
      "content": "package domain\\n\\n// Domain logic...",
      "description": "${boundary.name} domain entity"
    },
    {
      "path": "internal/${boundary.name}/usecase/${boundary.name}_service.go", 
      "content": "package usecase\\n\\n// Use case...",
      "description": "${boundary.name} service use case"
    }
  ],
  "interfaces": [
    {
      "name": "${boundary.name}Repository",
      "path": "internal/${boundary.name}/domain/repository.go",
      "content": "type ${boundary.name}Repository interface { ... }"
    }
  ],
  "tests": [
    {
      "path": "internal/${boundary.name}/domain/${boundary.name}_test.go",
      "content": "package domain\\n\\nfunc Test${boundary.name}..."
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

  /**
   * Execute actual refactoring - not plan generation, actual file operations
   */
  async executeRefactoring(boundaries: DomainBoundary[], applyChanges: boolean): Promise<RefactorResult> {
    console.log('🔧 AI automatic code transformation starting...');
    console.log(`Mode: ${applyChanges ? 'Apply Changes' : 'Dry Run'}`);
    
    const safetyManager = applyChanges ? new FileSafetyManager(this.projectRoot) : null;
    
    const results: RefactorResult = {
      applied_patches: [],
      failed_patches: [],
      created_files: [],
      modified_files: [],
      deleted_files: [],
      outputPath: ''
    };

    for (const boundary of boundaries) {
      console.log(`\n📁 Refactoring ${boundary.name} module (${boundary.files.length} files)...`);
      
      // 1. Create module structure
      if (applyChanges) {
        await this.createModuleStructure(boundary);
      }
      
      // 2. Actually transform each file
      for (const file of boundary.files) {
        try {
          console.log(`  🔄 Processing ${file}...`);
          const refactoredFiles = await this.generateRefactoredCode(file, boundary);
          
          if (applyChanges) {
            await this.applyRefactoredFiles(refactoredFiles, safetyManager || undefined);
            results.applied_patches.push(file);
            results.created_files.push(...refactoredFiles.refactored_files.map(f => f.path));
            results.created_files.push(...refactoredFiles.interfaces.map(i => i.path));
            results.created_files.push(...refactoredFiles.tests.map(t => t.path));
          } else {
            console.log(`    └─ Will split into ${refactoredFiles.refactored_files.length} files + ${refactoredFiles.interfaces.length} interfaces + ${refactoredFiles.tests.length} tests`);
          }
        } catch (error) {
          const errorMessage = getErrorMessage(error);
          console.error(`    ❌ Failed to transform ${file}: ${errorMessage}`);
          
          if (error instanceof RefactorError) {
            console.error(`       Boundary: ${error.boundary}`);
            if (error.details) {
              console.error(`       Details: ${JSON.stringify(error.details)}`);
            }
          }
          
          results.failed_patches.push({ file, error: errorMessage });
        }
      }
    }

    const summary = this.generateRefactorSummary(results, boundaries);
    console.log(summary);
    
    if (safetyManager && applyChanges) {
      const backupInfo = safetyManager.getBackupSummary();
      console.log(`📦 Safety Backup:`);
      console.log(`   Backed up ${backupInfo.count} files`);
      console.log(`   Location: ${backupInfo.location}`);
      console.log(`   Rollback available if needed`);
    }

    return results;
  }

  /**
   * Create clean architecture module structure
   */
  private async createModuleStructure(boundary: DomainBoundary): Promise<void> {
    const dirs = [
      `${this.projectRoot}/internal/${boundary.name}/domain`,
      `${this.projectRoot}/internal/${boundary.name}/usecase`, 
      `${this.projectRoot}/internal/${boundary.name}/infrastructure`,
      `${this.projectRoot}/internal/${boundary.name}/handler`,
      `${this.projectRoot}/internal/${boundary.name}/test`
    ];
    
    for (const dir of dirs) {
      await fs.mkdir(dir, { recursive: true });
    }
    
    console.log(`  📂 Created module structure for ${boundary.name}`);
  }

  /**
   * Apply refactored files to the filesystem
   */
  protected async applyRefactoredFiles(refactoredFiles: RefactoredFile, safetyManager?: FileSafetyManager): Promise<void> {
    // Create actual files
    for (const file of refactoredFiles.refactored_files) {
      const fullPath = path.join(this.projectRoot, file.path);
      if (safetyManager) {
        await safetyManager.safeWrite(fullPath, file.content);
      } else {
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
        await fs.writeFile(fullPath, file.content);
      }
      console.log(`    ✅ Created ${file.path}`);
    }
    
    // Create interfaces
    for (const iface of refactoredFiles.interfaces) {
      const fullPath = path.join(this.projectRoot, iface.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, iface.content);
      console.log(`    🔌 Created ${iface.name} interface`);
    }
    
    // Create tests
    for (const test of refactoredFiles.tests) {
      const fullPath = path.join(this.projectRoot, test.path);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, test.content);
      console.log(`    🧪 Created test ${test.path}`);
    }
  }

  /**
   * Detect programming language from file extension
   */
  private detectLanguage(file: string): string {
    const ext = path.extname(file).toLowerCase();
    switch (ext) {
      case '.go': return 'go';
      case '.ts': case '.tsx': return 'typescript';
      case '.js': case '.jsx': return 'javascript';
      case '.py': return 'python';
      case '.java': return 'java';
      case '.cs': return 'csharp';
      default: return 'unknown';
    }
  }

  /**
   * Generate refactor summary
   */
  private generateRefactorSummary(results: RefactorResult, boundaries: DomainBoundary[]): string {
    const totalFiles = boundaries.reduce((sum, b) => sum + b.files.length, 0);
    const successRate = totalFiles > 0 ? (results.applied_patches.length / totalFiles * 100).toFixed(1) : '0';
    
    return `
📊 Refactoring Results:
   ✅ Successfully transformed: ${results.applied_patches.length}/${totalFiles} files (${successRate}%)
   ❌ Failed transformations: ${results.failed_patches.length}
   📁 Created files: ${results.created_files.length}
   🏗️  Generated modules: ${boundaries.length}
   ⏱️  Average time per file: ${totalFiles > 0 ? '~2-3 seconds' : 'N/A'}
`;
  }

  /**
   * Generate actual refactor plan based on discovered boundaries
   */
  async generateRefactorPlan(planPath: string): Promise<RefactorAgentResult> {
    console.log('🔧 Generating refactor plan from architectural analysis...');
    
    // Load the architectural plan
    const planContent = fsSync.readFileSync(planPath, 'utf8');
    
    // Load domain map to get discovered boundaries
    const domainMapPath = path.join(this.projectRoot, '.vibeflow', 'domain-map.json');
    if (!fsSync.existsSync(domainMapPath)) {
      throw new Error('Domain map not found. Run boundary discovery first.');
    }
    
    const domainMap = JSON.parse(fsSync.readFileSync(domainMapPath, 'utf8'));
    const boundaries = domainMap.boundaries;
    
    // Generate actual refactor patches based on boundaries
    const patches: RefactorPatch[] = [];
    
    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i];
      const patchId = (i + 1).toString().padStart(3, '0');
      
      // Create patches for each file in the boundary
      for (const file of boundary.files) {
        const changes: PatchChange[] = [
          {
            type: 'create',
            target_path: `internal/${boundary.name}/domain/${path.basename(file, '.go')}_entity.go`,
            description: `Extract ${boundary.name} domain entity from ${file}`,
          },
          {
            type: 'create',
            target_path: `internal/${boundary.name}/usecase/${boundary.name}_service.go`,
            description: `Create ${boundary.name} service with business logic`,
          },
          {
            type: 'create',
            target_path: `internal/${boundary.name}/infrastructure/${boundary.name}_repository.go`,
            description: `Create ${boundary.name} repository implementation`,
          },
          {
            type: 'create',
            target_path: `internal/${boundary.name}/handler/${boundary.name}_handler.go`,
            description: `Create ${boundary.name} HTTP handler`,
          },
        ];
        
        patches.push({
          id: `${patchId}_${path.basename(file, '.go')}`,
          target_file: file,
          changes,
          dependencies: boundary.dependencies || [],
          test_requirements: [
            `internal/${boundary.name}/test/${boundary.name}_test.go`,
            `internal/${boundary.name}/test/${boundary.name}_integration_test.go`,
          ],
        });
      }
    }
    
    const plan: RefactorPlan = {
      summary: {
        total_patches: patches.length,
        target_modules: boundaries.map((b: any) => b.name),
        estimated_time: `${Math.ceil(patches.length * 2)}~${Math.ceil(patches.length * 3)} minutes`,
      },
      patches,
    };

    const outputPath = this.paths.patchesDir;
    const manifestPath = `${outputPath}/manifest.json`;

    // Create patches directory
    if (!fsSync.existsSync(outputPath)) {
      fsSync.mkdirSync(outputPath, { recursive: true });
    }

    fsSync.writeFileSync(manifestPath, JSON.stringify(plan, null, 2));

    console.log(`📝 Generated ${patches.length} refactor patches for ${boundaries.length} modules`);
    console.log(`   Target modules: ${boundaries.map((b: any) => b.name).join(', ')}`);

    return {
      plan,
      outputPath,
    };
  }
}