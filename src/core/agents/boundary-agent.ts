import * as fs from 'fs';
import { CodeAnalyzer, FileInfo, DependencyGraph } from '../utils/code-analyzer.js';
import { ConfigLoader } from '../utils/config-loader.js';
import { VibeFlowConfig, BoundaryConfig, DomainMap, DomainBoundary } from '../types/config.js';

export interface BoundaryAnalysisResult {
  domainMap: DomainMap;
  outputPath: string;
}

export class BoundaryAgent {
  private analyzer: CodeAnalyzer;
  private config: VibeFlowConfig;

  constructor(projectRoot: string, configPath?: string, boundaryConfigPath?: string) {
    this.analyzer = new CodeAnalyzer(projectRoot);
    this.config = ConfigLoader.loadVibeFlowConfig(configPath);
    // boundaryConfig is loaded but not used in current implementation
    ConfigLoader.loadBoundaryConfig(boundaryConfigPath);
  }

  async analyzeBoundaries(): Promise<BoundaryAnalysisResult> {
    console.log('🔍 コードベース構造を分析中...');
    
    // 1. ファイル分析
    const files = await this.analyzer.analyzeFiles(
      this.config.analysis.include_patterns,
      this.config.analysis.exclude_patterns
    );

    console.log(`📁 ${files.length}個のファイルを分析しました`);

    // 2. 依存関係グラフ構築
    const dependencyGraph = this.analyzer.buildDependencyGraph(files);
    
    // 3. 循環依存検出
    const circularDependencies = this.analyzer.detectCircularDependencies(dependencyGraph);
    
    if (circularDependencies.length > 0) {
      console.log(`⚠️  ${circularDependencies.length}個の循環依存を検出しました`);
    }

    // 4. ドメイン境界分析
    const boundaries = this.extractDomainBoundaries(files, dependencyGraph, circularDependencies);
    
    // 5. メトリクス計算
    const metrics = this.calculateMetrics(boundaries);

    // 6. ドメインマップ生成
    const domainMap: DomainMap = {
      project: this.config.project.name,
      language: this.config.project.language,
      analyzed_at: new Date().toISOString(),
      total_files: files.length,
      boundaries,
      metrics,
    };

    // 7. 出力
    const outputPath = this.config.output.artifacts.domain_map;
    fs.writeFileSync(outputPath, JSON.stringify(domainMap, null, 2));
    
    console.log(`✅ ドメインマップを生成しました: ${outputPath}`);
    
    return { domainMap, outputPath };
  }

  private extractDomainBoundaries(
    files: FileInfo[],
    dependencyGraph: DependencyGraph,
    circularDependencies: string[][]
  ): DomainBoundary[] {
    const boundaries: DomainBoundary[] = [];
    const configuredModules = this.config.boundaries.target_modules;

    for (const [moduleName, moduleConfig] of Object.entries(configuredModules)) {
      const moduleFiles = this.findModuleFiles(files, moduleConfig.paths);
      const dependencies = this.calculateModuleDependencies(moduleFiles, dependencyGraph);
      const circularDeps = this.findCircularDependenciesForModule(moduleFiles, circularDependencies);
      
      const cohesionScore = this.calculateCohesion(moduleFiles, dependencyGraph);
      const couplingScore = this.calculateCoupling(moduleFiles, dependencies);

      const boundary: DomainBoundary = {
        name: moduleName,
        description: moduleConfig.description,
        files: moduleFiles.map(f => f.relativePath),
        dependencies: {
          internal: dependencies,
          external: []
        },
        circular_dependencies: circularDeps,
        cohesion_score: cohesionScore,
        coupling_score: couplingScore,
      };

      boundaries.push(boundary);
    }

    return boundaries;
  }

  private findModuleFiles(files: FileInfo[], patterns: string[]): FileInfo[] {
    const moduleFiles: FileInfo[] = [];
    
    for (const pattern of patterns) {
      // Simple pattern matching - in a real implementation, use a proper glob matcher
      for (const file of files) {
        if (this.matchesPattern(file.relativePath, pattern)) {
          moduleFiles.push(file);
        }
      }
    }
    
    return moduleFiles;
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    // Convert glob-like pattern to regex
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')  // ** matches any path
      .replace(/\*/g, '[^/]*') // * matches any filename characters
      .replace(/\./g, '\\.');   // Escape dots
    
    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(filePath);
  }

  private calculateModuleDependencies(moduleFiles: FileInfo[], dependencyGraph: DependencyGraph): string[] {
    const externalDependencies = new Set<string>();
    const moduleFilePaths = new Set(moduleFiles.map(f => f.relativePath));

    for (const file of moduleFiles) {
      const fileDeps = dependencyGraph[file.relativePath] || [];
      
      for (const dep of fileDeps) {
        if (!moduleFilePaths.has(dep)) {
          // This is an external dependency
          externalDependencies.add(dep);
        }
      }
    }

    return Array.from(externalDependencies);
  }

  private findCircularDependenciesForModule(moduleFiles: FileInfo[], circularDependencies: string[][]): string[] {
    const moduleFilePaths = new Set(moduleFiles.map(f => f.relativePath));
    const moduleCycles: string[] = [];

    for (const cycle of circularDependencies) {
      // Check if any file in the cycle belongs to this module
      const cycleInModule = cycle.some(filePath => moduleFilePaths.has(filePath));
      if (cycleInModule) {
        moduleCycles.push(cycle.join(' → '));
      }
    }

    return moduleCycles;
  }

  private calculateCohesion(moduleFiles: FileInfo[], dependencyGraph: DependencyGraph): number {
    if (moduleFiles.length <= 1) return 1.0;

    const moduleFilePaths = new Set(moduleFiles.map(f => f.relativePath));
    let internalConnections = 0;
    let totalPossibleConnections = 0;

    for (const file of moduleFiles) {
      const fileDeps = dependencyGraph[file.relativePath] || [];
      const internalDeps = fileDeps.filter(dep => moduleFilePaths.has(dep));
      
      internalConnections += internalDeps.length;
      totalPossibleConnections += moduleFiles.length - 1; // Can connect to all other files in module
    }

    return totalPossibleConnections > 0 ? internalConnections / totalPossibleConnections : 0;
  }

  private calculateCoupling(moduleFiles: FileInfo[], externalDependencies: string[]): number {
    if (moduleFiles.length === 0) return 0;
    
    // Coupling is the ratio of external dependencies to total files in the module
    return externalDependencies.length / moduleFiles.length;
  }

  private calculateMetrics(boundaries: DomainBoundary[]) {
    const totalCohesion = boundaries.reduce((sum, b) => sum + (b.cohesion_score ?? 0), 0);
    const totalCoupling = boundaries.reduce((sum, b) => sum + (b.coupling_score ?? 0), 0);
    
    const overallCohesion = boundaries.length > 0 ? totalCohesion / boundaries.length : 0;
    const overallCoupling = boundaries.length > 0 ? totalCoupling / boundaries.length : 0;
    
    // Modularity score combines cohesion (higher is better) and coupling (lower is better)
    const modularityScore = Math.max(0, overallCohesion - overallCoupling);

    return {
      overall_cohesion: Math.round(overallCohesion * 100) / 100,
      overall_coupling: Math.round(overallCoupling * 100) / 100,
      modularity_score: Math.round(modularityScore * 100) / 100,
    };
  }
}