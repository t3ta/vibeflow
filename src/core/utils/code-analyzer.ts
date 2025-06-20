import * as fs from 'fs';
import * as path from 'path';
import fastGlob from 'fast-glob';

export interface FileInfo {
  path: string;
  relativePath: string;
  content: string;
  lines: number;
  imports: string[];
  exports: string[];
  structs?: string[];  // Go
  interfaces?: string[]; // Go
  functions?: string[];
  classes?: string[];  // TypeScript/Python
}

export interface DependencyGraph {
  [filePath: string]: string[];
}

export class CodeAnalyzer {
  constructor(private rootPath: string) {}

  async analyzeFiles(patterns: string[], excludePatterns: string[] = []): Promise<FileInfo[]> {
    const files = await fastGlob(patterns, {
      cwd: this.rootPath,
      ignore: excludePatterns,
      absolute: false,
    });

    const fileInfos: FileInfo[] = [];
    
    for (const file of files) {
      const fullPath = path.join(this.rootPath, file);
      if (!fs.existsSync(fullPath)) continue;
      
      const content = fs.readFileSync(fullPath, 'utf8');
      const info = this.analyzeFile(fullPath, file, content);
      fileInfos.push(info);
    }

    return fileInfos;
  }

  private analyzeFile(fullPath: string, relativePath: string, content: string): FileInfo {
    const lines = content.split('\n').length;
    const ext = path.extname(fullPath);
    
    const info: FileInfo = {
      path: fullPath,
      relativePath,
      content,
      lines,
      imports: [],
      exports: [],
      functions: [],
    };

    switch (ext) {
      case '.go':
        this.analyzeGoFile(content, info);
        break;
      case '.ts':
      case '.tsx':
        this.analyzeTypeScriptFile(content, info);
        break;
      case '.py':
        this.analyzePythonFile(content, info);
        break;
    }

    return info;
  }

  private analyzeGoFile(content: string, info: FileInfo): void {
    const lines = content.split('\n');
    info.structs = [];
    info.interfaces = [];

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Import analysis
      if (trimmed.startsWith('import ')) {
        const importMatch = trimmed.match(/import\s+"([^"]+)"/);
        if (importMatch) {
          info.imports.push(importMatch[1]);
        }
      }
      
      // Multi-line imports
      if (trimmed.includes('import (')) {
        // TODO: Handle multi-line imports
      }
      
      // Struct analysis
      const structMatch = trimmed.match(/type\s+(\w+)\s+struct/);
      if (structMatch) {
        info.structs!.push(structMatch[1]);
      }
      
      // Interface analysis
      const interfaceMatch = trimmed.match(/type\s+(\w+)\s+interface/);
      if (interfaceMatch) {
        info.interfaces!.push(interfaceMatch[1]);
      }
      
      // Function analysis
      const funcMatch = trimmed.match(/func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)\s*\(/);
      if (funcMatch) {
        info.functions!.push(funcMatch[1]);
      }
    }
  }

  private analyzeTypeScriptFile(content: string, info: FileInfo): void {
    const lines = content.split('\n');
    info.classes = [];

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Import analysis
      const importMatch = trimmed.match(/import.*from\s+['"]([^'"]+)['"]/);
      if (importMatch) {
        info.imports.push(importMatch[1]);
      }
      
      // Export analysis
      if (trimmed.startsWith('export ')) {
        info.exports.push(trimmed);
      }
      
      // Class analysis
      const classMatch = trimmed.match(/(?:export\s+)?class\s+(\w+)/);
      if (classMatch) {
        info.classes!.push(classMatch[1]);
      }
      
      // Function analysis
      const funcMatch = trimmed.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/);
      if (funcMatch) {
        info.functions!.push(funcMatch[1]);
      }
    }
  }

  private analyzePythonFile(content: string, info: FileInfo): void {
    const lines = content.split('\n');
    info.classes = [];

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Import analysis
      const importMatch = trimmed.match(/(?:from\s+(\S+)\s+)?import\s+(.+)/);
      if (importMatch) {
        const module = importMatch[1] || importMatch[2];
        info.imports.push(module);
      }
      
      // Class analysis
      const classMatch = trimmed.match(/class\s+(\w+)/);
      if (classMatch) {
        info.classes!.push(classMatch[1]);
      }
      
      // Function analysis
      const funcMatch = trimmed.match(/def\s+(\w+)\s*\(/);
      if (funcMatch) {
        info.functions!.push(funcMatch[1]);
      }
    }
  }

  buildDependencyGraph(files: FileInfo[]): DependencyGraph {
    const graph: DependencyGraph = {};
    
    for (const file of files) {
      graph[file.relativePath] = [];
      
      for (const importPath of file.imports) {
        // Try to resolve relative imports to actual file paths
        const resolvedPath = this.resolveImportPath(importPath, file.relativePath);
        if (resolvedPath) {
          graph[file.relativePath].push(resolvedPath);
        }
      }
    }
    
    return graph;
  }

  private resolveImportPath(importPath: string, fromFile: string): string | null {
    // Simplified import resolution - in a real implementation,
    // this would need to handle language-specific module resolution
    
    if (importPath.startsWith('./') || importPath.startsWith('../')) {
      // Relative import
      const fromDir = path.dirname(fromFile);
      return path.normalize(path.join(fromDir, importPath));
    }
    
    // For now, just return the import path as-is for external modules
    return importPath.startsWith('.') ? null : importPath;
  }

  detectCircularDependencies(graph: DependencyGraph): string[][] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const cycles: string[][] = [];

    const dfs = (node: string, path: string[]): void => {
      if (recursionStack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          cycles.push(path.slice(cycleStart));
        }
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const dependencies = graph[node] || [];
      for (const dep of dependencies) {
        if (graph[dep]) { // Only follow dependencies that are in our file set
          dfs(dep, [...path]);
        }
      }

      recursionStack.delete(node);
    };

    for (const node in graph) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }
}