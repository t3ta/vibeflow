import * as fs from 'fs';
import * as path from 'path';

export interface GoProjectInfo {
  /** Whether a Go project was found */
  hasGoProject: boolean;
  /** Path to the directory containing go.mod */
  goModulePath?: string;
  /** The working directory to use for Go commands */
  workingDirectory?: string;
  /** Module name from go.mod */
  moduleName?: string;
}

/**
 * Detects Go project structure and finds the correct working directory for Go commands
 * @param projectRoot The root directory to search from
 * @returns Information about the Go project structure
 */
export function detectGoProject(projectRoot: string): GoProjectInfo {
  // Common subdirectories where Go modules might be located
  const commonGoDirs = [
    '', // Project root
    'backend',
    'server',
    'api',
    'cmd',
    'app',
    'service',
    'services',
    'go',
    'golang',
  ];

  for (const subDir of commonGoDirs) {
    const searchPath = path.join(projectRoot, subDir);
    const goModPath = path.join(searchPath, 'go.mod');
    
    if (fs.existsSync(goModPath)) {
      try {
        const goModContent = fs.readFileSync(goModPath, 'utf-8');
        const moduleMatch = goModContent.match(/^module\s+(.+)$/m);
        const moduleName = moduleMatch ? moduleMatch[1].trim() : undefined;
        
        return {
          hasGoProject: true,
          goModulePath: goModPath,
          workingDirectory: searchPath,
          moduleName,
        };
      } catch (error) {
        // Continue searching if we can't read the go.mod file
        console.warn(`Could not read go.mod at ${goModPath}:`, error);
        continue;
      }
    }
  }

  return {
    hasGoProject: false,
  };
}

/**
 * Finds all Go modules in the project (for multi-module projects)
 * @param projectRoot The root directory to search from
 * @returns Array of Go project information for each module found
 */
export function findAllGoModules(projectRoot: string): GoProjectInfo[] {
  const modules: GoProjectInfo[] = [];
  
  // Search recursively for go.mod files, but avoid common exclusions
  const excludeDirs = new Set(['node_modules', 'vendor', '.git', '.vibeflow', 'dist', 'build']);
  
  function searchDirectory(dir: string, depth: number = 0): void {
    // Limit search depth to avoid infinite recursion
    if (depth > 5) return;
    
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && !excludeDirs.has(entry.name)) {
          const subDir = path.join(dir, entry.name);
          searchDirectory(subDir, depth + 1);
        } else if (entry.name === 'go.mod') {
          const goModPath = path.join(dir, 'go.mod');
          try {
            const goModContent = fs.readFileSync(goModPath, 'utf-8');
            const moduleMatch = goModContent.match(/^module\s+(.+)$/m);
            const moduleName = moduleMatch ? moduleMatch[1].trim() : undefined;
            
            modules.push({
              hasGoProject: true,
              goModulePath: goModPath,
              workingDirectory: dir,
              moduleName,
            });
          } catch (error) {
            console.warn(`Could not read go.mod at ${goModPath}:`, error);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
      return;
    }
  }
  
  searchDirectory(projectRoot);
  return modules;
}

/**
 * Gets the appropriate working directory for Go commands
 * @param projectRoot The project root directory
 * @returns The working directory where Go commands should be executed, or null if no Go project found
 */
export function getGoWorkingDirectory(projectRoot: string): string | null {
  const goProject = detectGoProject(projectRoot);
  return goProject.hasGoProject ? goProject.workingDirectory! : null;
}

/**
 * Executes a callback with the correct Go working directory
 * @param projectRoot The project root directory
 * @param callback Function to execute with the Go working directory
 * @returns The result of the callback, or null if no Go project found
 */
export function withGoWorkingDirectory<T>(
  projectRoot: string,
  callback: (workingDir: string) => T
): T | null {
  const workingDir = getGoWorkingDirectory(projectRoot);
  if (!workingDir) {
    return null;
  }
  return callback(workingDir);
}