import { BaseAgent } from './base-agent.js';
import { z } from 'zod';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

const BuildErrorSchema = z.object({
  file: z.string(),
  line: z.number(),
  column: z.number(),
  type: z.enum(['import', 'type', 'syntax', 'dependency']),
  message: z.string(),
  context: z.string().optional(),
});

const BuildFixSchema = z.object({
  type: z.enum(['import', 'dependency', 'type', 'config']),
  file: z.string(),
  description: z.string(),
  patch: z.string(),
  confidence: z.number().min(0).max(1),
});

const BuildFixerInputSchema = z.object({
  projectPath: z.string(),
  buildErrors: z.array(BuildErrorSchema),
  refactoringManifest: z.any(), // Will be refined based on actual manifest structure
  language: z.enum(['go', 'typescript', 'python']),
});

const BuildFixerOutputSchema = z.object({
  fixes: z.array(BuildFixSchema),
  summary: z.object({
    totalErrors: z.number(),
    fixedErrors: z.number(),
    remainingErrors: z.number(),
    appliedFixes: z.array(z.string()),
  }),
  buildResult: z.object({
    success: z.boolean(),
    output: z.string(),
    duration: z.number(),
  }),
});

export type BuildFixerInput = z.infer<typeof BuildFixerInputSchema>;
export type BuildFixerOutput = z.infer<typeof BuildFixerOutputSchema>;
export type BuildError = z.infer<typeof BuildErrorSchema>;
export type BuildFix = z.infer<typeof BuildFixSchema>;

export class BuildFixerAgent extends BaseAgent<BuildFixerInput, BuildFixerOutput> {
  constructor() {
    super(
      'BuildFixerAgent',
      'Automatically fixes build errors after refactoring',
      BuildFixerInputSchema,
      BuildFixerOutputSchema
    );
  }

  async execute(input: BuildFixerInput): Promise<BuildFixerOutput> {
    this.logger.info('Starting build fix process', {
      projectPath: input.projectPath,
      errorCount: input.buildErrors.length,
      language: input.language,
    });

    const startTime = Date.now();
    const fixes: BuildFix[] = [];
    const appliedFixes: string[] = [];

    try {
      // Phase 1: Analyze and categorize errors
      const errorGroups = this.categorizeErrors(input.buildErrors);
      
      // Phase 2: Generate fixes based on language
      switch (input.language) {
        case 'go':
          await this.fixGoErrors(input, errorGroups, fixes);
          break;
        case 'typescript':
          await this.fixTypeScriptErrors(input, errorGroups, fixes);
          break;
        case 'python':
          await this.fixPythonErrors(input, errorGroups, fixes);
          break;
      }

      // Phase 3: Apply fixes incrementally
      for (const fix of fixes) {
        const applied = await this.applyFix(input.projectPath, fix);
        if (applied) {
          appliedFixes.push(fix.description);
          this.logger.info('Applied fix', { fix: fix.description });
        }
      }

      // Phase 4: Run final build to verify
      const buildResult = await this.runBuild(input.projectPath, input.language);
      
      // Phase 5: If build still fails, attempt advanced fixes
      if (!buildResult.success && input.language === 'go') {
        await this.applyAdvancedGoFixes(input.projectPath, buildResult.output);
        // Re-run build
        const finalBuildResult = await this.runBuild(input.projectPath, input.language);
        return {
          fixes,
          summary: {
            totalErrors: input.buildErrors.length,
            fixedErrors: appliedFixes.length,
            remainingErrors: this.countRemainingErrors(finalBuildResult.output),
            appliedFixes,
          },
          buildResult: {
            ...finalBuildResult,
            duration: Date.now() - startTime,
          },
        };
      }

      return {
        fixes,
        summary: {
          totalErrors: input.buildErrors.length,
          fixedErrors: appliedFixes.length,
          remainingErrors: this.countRemainingErrors(buildResult.output),
          appliedFixes,
        },
        buildResult: {
          ...buildResult,
          duration: Date.now() - startTime,
        },
      };
    } catch (error) {
      this.logger.error('Build fix process failed', { error });
      throw error;
    }
  }

  private categorizeErrors(errors: BuildError[]): Map<string, BuildError[]> {
    const groups = new Map<string, BuildError[]>();
    
    for (const error of errors) {
      const key = error.type;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(error);
    }
    
    return groups;
  }

  private async fixGoErrors(
    input: BuildFixerInput,
    errorGroups: Map<string, BuildError[]>,
    fixes: BuildFix[]
  ): Promise<void> {
    // Fix import errors
    const importErrors = errorGroups.get('import') || [];
    for (const error of importErrors) {
      const fix = await this.generateGoImportFix(input, error);
      if (fix) fixes.push(fix);
    }

    // Fix dependency errors
    const depErrors = errorGroups.get('dependency') || [];
    if (depErrors.length > 0) {
      const goModFixes = await this.generateGoModFixes(input);
      fixes.push(...goModFixes);
    }

    // Fix type errors
    const typeErrors = errorGroups.get('type') || [];
    for (const error of typeErrors) {
      const fix = await this.generateGoTypeFix(input, error);
      if (fix) fixes.push(fix);
    }
  }

  private async generateGoImportFix(
    input: BuildFixerInput,
    error: BuildError
  ): Promise<BuildFix | null> {
    const importPattern = /cannot find module|cannot find package|no required module provides package/;
    
    if (!importPattern.test(error.message)) {
      return null;
    }

    // Extract the problematic import path
    const matches = error.message.match(/"([^"]+)"/);
    if (!matches) return null;
    
    const oldImportPath = matches[1];
    
    // Check if this import was moved during refactoring
    const newImportPath = this.findNewImportPath(input.refactoringManifest, oldImportPath);
    
    if (!newImportPath) return null;

    const fileContent = fs.readFileSync(error.file, 'utf-8');
    const updatedContent = fileContent.replace(
      new RegExp(`"${oldImportPath}"`, 'g'),
      `"${newImportPath}"`
    );

    return {
      type: 'import',
      file: error.file,
      description: `Update import path from "${oldImportPath}" to "${newImportPath}"`,
      patch: this.generatePatch(fileContent, updatedContent),
      confidence: 0.9,
    };
  }

  private async generateGoModFixes(input: BuildFixerInput): Promise<BuildFix[]> {
    const fixes: BuildFix[] = [];
    const projectPath = input.projectPath;
    
    // Find all go.mod files in the new module structure
    const goModFiles = await glob('**/go.mod', { 
      cwd: projectPath,
      ignore: ['vendor/**', 'node_modules/**'],
    });

    // Generate go.mod for new modules if missing
    const newModules = this.extractNewModules(input.refactoringManifest);
    
    for (const module of newModules) {
      const modulePath = path.join(projectPath, module.path);
      const goModPath = path.join(modulePath, 'go.mod');
      
      if (!fs.existsSync(goModPath)) {
        const goModContent = this.generateGoModContent(module);
        fixes.push({
          type: 'config',
          file: goModPath,
          description: `Create go.mod for module ${module.name}`,
          patch: goModContent,
          confidence: 0.95,
        });
      }
    }

    // Update root go.mod with replace directives for local modules
    const rootGoModPath = path.join(projectPath, 'go.mod');
    if (fs.existsSync(rootGoModPath)) {
      const updatePatch = this.generateGoModReplacePatch(rootGoModPath, newModules);
      if (updatePatch) {
        fixes.push({
          type: 'config',
          file: rootGoModPath,
          description: 'Update root go.mod with local module replace directives',
          patch: updatePatch,
          confidence: 0.9,
        });
      }
    }

    return fixes;
  }

  private async generateGoTypeFix(
    input: BuildFixerInput,
    error: BuildError
  ): Promise<BuildFix | null> {
    // Handle type errors caused by moved types
    const typeNotFoundPattern = /undefined: (\w+)|cannot find type (\w+)/;
    const matches = error.message.match(typeNotFoundPattern);
    
    if (!matches) return null;
    
    const typeName = matches[1] || matches[2];
    const newLocation = this.findTypeNewLocation(input.refactoringManifest, typeName);
    
    if (!newLocation) return null;

    const fileContent = fs.readFileSync(error.file, 'utf-8');
    
    // Add import for the new location if not present
    const importPath = this.getImportPathForType(newLocation);
    const importAlias = this.getImportAlias(importPath);
    
    let updatedContent = fileContent;
    
    // Add import if not present
    if (!updatedContent.includes(importPath)) {
      const importStatement = `import ${importAlias} "${importPath}"`;
      updatedContent = this.addImportToGoFile(updatedContent, importStatement);
    }
    
    // Update type references
    updatedContent = updatedContent.replace(
      new RegExp(`\\b${typeName}\\b`, 'g'),
      `${importAlias}.${typeName}`
    );

    return {
      type: 'type',
      file: error.file,
      description: `Update type reference for ${typeName} to ${importAlias}.${typeName}`,
      patch: this.generatePatch(fileContent, updatedContent),
      confidence: 0.85,
    };
  }

  private async applyAdvancedGoFixes(projectPath: string, buildOutput: string): Promise<void> {
    this.logger.info('Applying advanced Go fixes');
    
    try {
      // Run go mod tidy to clean up dependencies
      execSync('go mod tidy', { cwd: projectPath, encoding: 'utf-8' });
      
      // Run go mod download to ensure all dependencies are available
      execSync('go mod download', { cwd: projectPath, encoding: 'utf-8' });
      
      // Find and fix circular dependencies
      const circularDeps = this.detectCircularDependencies(buildOutput);
      if (circularDeps.length > 0) {
        await this.fixCircularDependencies(projectPath, circularDeps);
      }
      
      // Update vendor directory if it exists
      if (fs.existsSync(path.join(projectPath, 'vendor'))) {
        execSync('go mod vendor', { cwd: projectPath, encoding: 'utf-8' });
      }
    } catch (error) {
      this.logger.warn('Advanced Go fixes partially failed', { error });
    }
  }

  private async fixTypeScriptErrors(
    input: BuildFixerInput,
    errorGroups: Map<string, BuildError[]>,
    fixes: BuildFix[]
  ): Promise<void> {
    // TypeScript-specific fixes
    const importErrors = errorGroups.get('import') || [];
    for (const error of importErrors) {
      const fix = await this.generateTypeScriptImportFix(input, error);
      if (fix) fixes.push(fix);
    }

    // Update tsconfig.json paths if needed
    const tsconfigFix = await this.generateTsConfigFix(input);
    if (tsconfigFix) fixes.push(tsconfigFix);
  }

  private async fixPythonErrors(
    input: BuildFixerInput,
    errorGroups: Map<string, BuildError[]>,
    fixes: BuildFix[]
  ): Promise<void> {
    // Python-specific fixes
    const importErrors = errorGroups.get('import') || [];
    for (const error of importErrors) {
      const fix = await this.generatePythonImportFix(input, error);
      if (fix) fixes.push(fix);
    }

    // Update __init__.py files if needed
    const initFixes = await this.generatePythonInitFixes(input);
    fixes.push(...initFixes);
  }

  private async applyFix(projectPath: string, fix: BuildFix): Promise<boolean> {
    try {
      if (fix.type === 'config' && !fs.existsSync(fix.file)) {
        // Create new file
        const dir = path.dirname(fix.file);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(fix.file, fix.patch);
      } else {
        // Apply patch to existing file
        const currentContent = fs.readFileSync(fix.file, 'utf-8');
        const updatedContent = this.applyPatch(currentContent, fix.patch);
        fs.writeFileSync(fix.file, updatedContent);
      }
      return true;
    } catch (error) {
      this.logger.error('Failed to apply fix', { fix: fix.description, error });
      return false;
    }
  }

  private async runBuild(
    projectPath: string,
    language: 'go' | 'typescript' | 'python'
  ): Promise<{ success: boolean; output: string }> {
    const buildCommands: Record<string, string> = {
      go: 'go build ./...',
      typescript: 'npm run build',
      python: 'python -m py_compile **/*.py',
    };

    const command = buildCommands[language];
    
    try {
      const output = execSync(command, {
        cwd: projectPath,
        encoding: 'utf-8',
        stdio: 'pipe',
      });
      
      return { success: true, output };
    } catch (error: any) {
      return { 
        success: false, 
        output: error.stdout || error.stderr || error.message 
      };
    }
  }

  // Helper methods
  private findNewImportPath(manifest: any, oldPath: string): string | null {
    // Implementation depends on manifest structure
    // This is a placeholder
    return null;
  }

  private extractNewModules(manifest: any): Array<{ name: string; path: string }> {
    // Extract module information from refactoring manifest
    if (manifest?.newModules && Array.isArray(manifest.newModules)) {
      return manifest.newModules;
    }
    
    // If manifest has movedPackages, convert them to modules
    if (manifest?.movedPackages) {
      return Object.entries(manifest.movedPackages).map(([oldPath, newPath]) => ({
        name: newPath as string,
        path: (newPath as string).replace(/\./g, '/'),
      }));
    }
    
    return [];
  }

  private generateGoModContent(module: { name: string; path: string }): string {
    return `module ${module.name}

go 1.21

require (
    // Dependencies will be added by go mod tidy
)
`;
  }

  private generateGoModReplacePatch(goModPath: string, modules: Array<{ name: string; path: string }>): string | null {
    const content = fs.readFileSync(goModPath, 'utf-8');
    let updatedContent = content;
    
    // Add replace directives for local modules
    const replaceBlock = modules
      .map(m => `replace ${m.name} => ./${m.path}`)
      .join('\n');
    
    if (!content.includes('replace')) {
      updatedContent += `\n${replaceBlock}\n`;
    } else {
      // Insert before existing replace block
      updatedContent = updatedContent.replace(
        /^replace/m,
        `${replaceBlock}\n\nreplace`
      );
    }
    
    return this.generatePatch(content, updatedContent);
  }

  private generatePatch(original: string, updated: string): string {
    // Simple patch format for now
    return updated;
  }

  private applyPatch(content: string, patch: string): string {
    // Simple patch application for now
    return patch;
  }

  private countRemainingErrors(buildOutput: string): number {
    if (!buildOutput || buildOutput.trim() === '') {
      return 0;
    }
    
    const errorPatterns = [
      /error:/gi,
      /Error:/gi,
      /FAILED/g,
      /cannot find/g,
      /undefined:/g,
    ];
    
    let count = 0;
    for (const pattern of errorPatterns) {
      const matches = buildOutput.match(pattern);
      count += matches ? matches.length : 0;
    }
    
    return count;
  }

  private findTypeNewLocation(manifest: any, typeName: string): string | null {
    // Placeholder implementation
    return null;
  }

  private getImportPathForType(location: string): string {
    // Placeholder implementation
    return location;
  }

  private getImportAlias(importPath: string): string {
    const parts = importPath.split('/');
    return parts[parts.length - 1];
  }

  private addImportToGoFile(content: string, importStatement: string): string {
    const importBlockMatch = content.match(/import\s*\([^)]*\)/s);
    
    if (importBlockMatch) {
      // Add to existing import block
      const updatedBlock = importBlockMatch[0].replace(
        /\)/,
        `\t${importStatement}\n)`
      );
      return content.replace(importBlockMatch[0], updatedBlock);
    } else {
      // Add new import block after package declaration
      return content.replace(
        /^package\s+\w+$/m,
        `$&\n\n${importStatement}`
      );
    }
  }

  private detectCircularDependencies(buildOutput: string): string[] {
    const circularPattern = /import cycle not allowed/g;
    const dependencies: string[] = [];
    
    // Extract circular dependency information from build output
    // This is a simplified implementation
    
    return dependencies;
  }

  private async fixCircularDependencies(projectPath: string, dependencies: string[]): Promise<void> {
    // Implement circular dependency resolution
    // This might involve creating interfaces or moving shared types
  }

  private async generateTypeScriptImportFix(input: BuildFixerInput, error: BuildError): Promise<BuildFix | null> {
    const importPattern = /Cannot find module|Module not found/;
    if (!importPattern.test(error.message)) {
      return null;
    }

    // Extract the problematic import path
    const matches = error.message.match(/'([^']+)'|"([^"]+)"/);
    if (!matches) return null;

    const oldImportPath = matches[1] || matches[2];
    
    // Check if this is a moved file in the refactoring manifest
    const manifest = input.refactoringManifest as any;
    const newImportPath = manifest?.movedFiles?.[oldImportPath];
    
    if (!newImportPath) return null;

    const fileContent = fs.readFileSync(error.file, 'utf-8');
    const updatedContent = fileContent.replace(
      new RegExp(`['"]${oldImportPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'g'),
      `'${newImportPath}'`
    );

    return {
      type: 'import',
      file: error.file,
      description: `Update TypeScript import path from "${oldImportPath}" to "${newImportPath}"`,
      patch: this.generatePatch(fileContent, updatedContent),
      confidence: 0.85,
    };
  }

  private async generateTsConfigFix(input: BuildFixerInput): Promise<BuildFix | null> {
    // tsconfig.json fix implementation
    return null;
  }

  private async generatePythonImportFix(input: BuildFixerInput, error: BuildError): Promise<BuildFix | null> {
    const importPattern = /No module named|ModuleNotFoundError/;
    if (!importPattern.test(error.message)) {
      return null;
    }

    // Extract the problematic module name
    const matches = error.message.match(/'([^']+)'|"([^"]+)"/);
    if (!matches) return null;

    const oldModuleName = matches[1] || matches[2];
    
    // Check if this module was moved in the refactoring manifest
    const manifest = input.refactoringManifest as any;
    const newModuleName = manifest?.movedModules?.[oldModuleName];
    
    if (!newModuleName) return null;

    const fileContent = fs.readFileSync(error.file, 'utf-8');
    const updatedContent = fileContent.replace(
      new RegExp(`import\\s+${oldModuleName}\\b`, 'g'),
      `import ${newModuleName}`
    ).replace(
      new RegExp(`from\\s+${oldModuleName}\\b`, 'g'),
      `from ${newModuleName}`
    );

    return {
      type: 'import',
      file: error.file,
      description: `Update Python import from "${oldModuleName}" to "${newModuleName}"`,
      patch: this.generatePatch(fileContent, updatedContent),
      confidence: 0.8,
    };
  }

  private async generatePythonInitFixes(input: BuildFixerInput): Promise<BuildFix[]> {
    // Python __init__.py fix implementation
    return [];
  }
}