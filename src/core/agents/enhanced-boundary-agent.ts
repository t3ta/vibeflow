import * as fs from 'fs';
import { CodeAnalyzer, FileInfo, DependencyGraph } from '../utils/code-analyzer.js';
import { ConfigLoader } from '../utils/config-loader.js';
import { AutoBoundaryDiscovery, AutoDiscoveredBoundary, BoundaryDiscoveryResult } from '../utils/auto-boundary-discovery.js';
import { VibeFlowPaths } from '../utils/file-paths.js';
import { VibeFlowConfig, BoundaryConfig, DomainMap, DomainBoundary } from '../types/config.js';

export interface EnhancedBoundaryAnalysisResult {
  domainMap: DomainMap;
  autoDiscoveredBoundaries: AutoDiscoveredBoundary[];
  discoveryMetrics: BoundaryDiscoveryResult;
  hybridRecommendations: HybridRecommendation[];
  outputPath: string;
}

export interface HybridRecommendation {
  type: 'use_auto_boundary' | 'merge_with_manual' | 'manual_override';
  auto_boundary?: string;
  manual_boundary?: string;
  confidence: number;
  reason: string;
  action: string;
}

export class EnhancedBoundaryAgent {
  private projectRoot: string;
  private analyzer: CodeAnalyzer;
  private autoDiscovery: AutoBoundaryDiscovery;
  private paths: VibeFlowPaths;
  private config: VibeFlowConfig | null = null;
  private boundaryConfig: BoundaryConfig | null = null;

  constructor(projectRoot: string, config?: any, userBoundaries?: any[]) {
    this.projectRoot = projectRoot;
    this.analyzer = new CodeAnalyzer(projectRoot);
    this.autoDiscovery = new AutoBoundaryDiscovery(projectRoot);
    this.paths = new VibeFlowPaths(projectRoot);
    
    // 設定とユーザー境界はオプショナル（自動発見のため）
    if (config) {
      this.config = config;
    }
    
    if (userBoundaries) {
      // ユーザー定義境界があれば境界設定に追加
      // この処理は後で実装
    }
    
    if (!config) {
      console.log('⚠️  設定ファイルが指定されていないため、完全自動モードで実行します');
    }
  }

  async analyzeBoundaries(): Promise<EnhancedBoundaryAnalysisResult> {
    console.log('🤖 強化された境界分析を開始...');
    
    if (this.config) {
      console.log('🔧 手動設定とAI自動発見のハイブリッドモード');
      return await this.runHybridAnalysis();
    } else {
      console.log('✨ 完全AI自動境界発見モード');
      return await this.runFullyAutomaticAnalysis();
    }
  }

  private async runHybridAnalysis(): Promise<EnhancedBoundaryAnalysisResult> {
    // 1. 従来の手動境界分析
    const manualResult = await this.runManualBoundaryAnalysis();
    
    // 2. AI自動境界発見
    const autoResult = await this.autoDiscovery.discoverBoundaries();
    
    // 3. 手動と自動の結果を比較・統合
    const hybridBoundaries = await this.mergeManulaAndAutoBoundaries(
      manualResult.boundaries,
      autoResult.discovered_boundaries
    );
    
    // 4. ハイブリッド推奨事項生成
    const hybridRecommendations = await this.generateHybridRecommendations(
      manualResult.boundaries,
      autoResult.discovered_boundaries
    );
    
    // 5. 最終ドメインマップ作成
    const domainMap: DomainMap = {
      ...manualResult,
      boundaries: hybridBoundaries,
      metrics: {
        ...manualResult.metrics,
      },
    };
    
    // 6. 結果保存
    const outputPath = this.paths.domainMapPath;
    fs.writeFileSync(outputPath, JSON.stringify(domainMap, null, 2));
    
    console.log(`✅ ハイブリッド境界分析完了: ${hybridBoundaries.length}個の境界`);
    
    return {
      domainMap,
      autoDiscoveredBoundaries: autoResult.discovered_boundaries,
      discoveryMetrics: autoResult,
      hybridRecommendations,
      outputPath,
    };
  }

  private async runFullyAutomaticAnalysis(): Promise<EnhancedBoundaryAnalysisResult> {
    // 1. AI自動境界発見
    const autoResult = await this.autoDiscovery.discoverBoundaries();
    
    // 2. 自動発見された境界を従来形式に変換
    const domainBoundaries = this.convertAutoToDomainBoundaries(autoResult.discovered_boundaries);
    
    // 3. 基本的なコード分析も実行（メトリクス取得のため）
    const files = await this.analyzer.analyzeFiles(['**/*.go'], ['**/*_test.go', '**/vendor/**']);
    const dependencyGraph = this.analyzer.buildDependencyGraph(files);
    const metrics = this.calculateBasicMetrics(domainBoundaries, files.length);
    
    // 4. ドメインマップ作成
    const domainMap: DomainMap = {
      project: 'auto-discovered-project',
      language: 'go',
      analyzed_at: new Date().toISOString(),
      total_files: files.length,
      boundaries: domainBoundaries,
      metrics: {
        ...metrics,
      },
    };
    
    // 5. 結果保存
    const outputPath = this.paths.domainMapPath;
    fs.writeFileSync(outputPath, JSON.stringify(domainMap, null, 2));
    
    // 6. 詳細レポート保存
    const detailedReportPath = this.paths.autoBoundaryReportPath;
    fs.writeFileSync(detailedReportPath, JSON.stringify(autoResult, null, 2));
    
    // 7. .gitignore更新
    this.paths.updateGitignore();
    
    console.log(`✨ 完全自動境界発見完了: ${autoResult.discovered_boundaries.length}個の境界`);
    console.log(`📊 全体信頼度: ${autoResult.confidence_metrics.overall_confidence.toFixed(1)}%`);
    
    return {
      domainMap,
      autoDiscoveredBoundaries: autoResult.discovered_boundaries,
      discoveryMetrics: autoResult,
      hybridRecommendations: [],
      outputPath,
    };
  }

  private async runManualBoundaryAnalysis(): Promise<DomainMap> {
    // 従来のBoundaryAgentのロジックを使用
    const files = await this.analyzer.analyzeFiles(
      this.config!.analysis.include_patterns,
      this.config!.analysis.exclude_patterns
    );

    const dependencyGraph = this.analyzer.buildDependencyGraph(files);
    const circularDependencies = this.analyzer.detectCircularDependencies(dependencyGraph);
    const boundaries = this.extractDomainBoundaries(files, dependencyGraph, circularDependencies);
    const metrics = this.calculateBasicMetrics(boundaries, files.length);

    return {
      project: this.config!.project.name,
      language: this.config!.project.language,
      analyzed_at: new Date().toISOString(),
      total_files: files.length,
      boundaries,
      metrics,
    };
  }

  private extractDomainBoundaries(
    files: FileInfo[],
    dependencyGraph: DependencyGraph,
    circularDependencies: string[][]
  ): DomainBoundary[] {
    const boundaries: DomainBoundary[] = [];
    const configuredModules = this.config!.boundaries.target_modules;

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
      for (const file of files) {
        if (this.matchesPattern(file.relativePath, pattern)) {
          moduleFiles.push(file);
        }
      }
    }
    
    return moduleFiles;
  }

  private matchesPattern(filePath: string, pattern: string): boolean {
    const regexPattern = pattern
      .replace(/\*\*/g, '.*')
      .replace(/\*/g, '[^/]*')
      .replace(/\./g, '\\.');
    
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
      totalPossibleConnections += moduleFiles.length - 1;
    }

    return totalPossibleConnections > 0 ? internalConnections / totalPossibleConnections : 0;
  }

  private calculateCoupling(moduleFiles: FileInfo[], externalDependencies: string[]): number {
    if (moduleFiles.length === 0) return 0;
    return externalDependencies.length / moduleFiles.length;
  }

  private calculateBasicMetrics(boundaries: DomainBoundary[], totalFiles: number) {
    const totalCohesion = boundaries.reduce((sum, b) => sum + (b.cohesion_score ?? 0), 0);
    const totalCoupling = boundaries.reduce((sum, b) => sum + (b.coupling_score ?? 0), 0);
    
    const overallCohesion = boundaries.length > 0 ? totalCohesion / boundaries.length : 0;
    const overallCoupling = boundaries.length > 0 ? totalCoupling / boundaries.length : 0;
    const modularityScore = Math.max(0, overallCohesion - overallCoupling);

    return {
      overall_cohesion: Math.round(overallCohesion * 100) / 100,
      overall_coupling: Math.round(overallCoupling * 100) / 100,
      modularity_score: Math.round(modularityScore * 100) / 100,
    };
  }

  private convertAutoToDomainBoundaries(autoBoundaries: AutoDiscoveredBoundary[]): DomainBoundary[] {
    return autoBoundaries.map(auto => ({
      name: auto.name,
      description: auto.description,
      files: auto.files,
      dependencies: {
        internal: auto.dependency_clusters,
        external: []
      },
      circular_dependencies: [], // Would need additional analysis
      cohesion_score: auto.confidence, // Use confidence as proxy for cohesion
      coupling_score: Math.max(0, 1 - auto.confidence), // Inverse of confidence
    }));
  }

  private async mergeManulaAndAutoBoundaries(
    manual: DomainBoundary[],
    auto: AutoDiscoveredBoundary[]
  ): Promise<DomainBoundary[]> {
    const merged: DomainBoundary[] = [...manual];
    
    // Add high-confidence auto-discovered boundaries that don't overlap with manual ones
    for (const autoBoundary of auto) {
      if (autoBoundary.confidence < 0.8) continue; // Only high-confidence boundaries
      
      const hasOverlap = manual.some(manualBoundary => 
        this.calculateFileOverlap(manualBoundary.files, autoBoundary.files) > 0.3
      );
      
      if (!hasOverlap) {
        const domainBoundary = this.convertAutoToDomainBoundary(autoBoundary);
        merged.push(domainBoundary);
      }
    }
    
    return merged;
  }

  private calculateFileOverlap(files1: string[], files2: string[]): number {
    const set1 = new Set(files1);
    const set2 = new Set(files2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private convertAutoToDomainBoundary(auto: AutoDiscoveredBoundary): DomainBoundary {
    return {
      name: auto.name,
      description: auto.description,
      files: auto.files,
      dependencies: {
        internal: auto.dependency_clusters,
        external: []
      },
      circular_dependencies: [],
      cohesion_score: auto.confidence,
      coupling_score: Math.max(0, 1 - auto.confidence),
    };
  }

  private async generateHybridRecommendations(
    manual: DomainBoundary[],
    auto: AutoDiscoveredBoundary[]
  ): Promise<HybridRecommendation[]> {
    const recommendations: HybridRecommendation[] = [];
    
    // Compare manual vs auto boundaries
    for (const autoBoundary of auto) {
      if (autoBoundary.confidence < 0.7) continue;
      
      const matchingManual = manual.find(m => 
        this.calculateFileOverlap(m.files, autoBoundary.files) > 0.5
      );
      
      if (matchingManual) {
        if (autoBoundary.confidence > 0.9) {
          recommendations.push({
            type: 'merge_with_manual',
            auto_boundary: autoBoundary.name,
            manual_boundary: matchingManual.name,
            confidence: autoBoundary.confidence,
            reason: `AI境界「${autoBoundary.name}」は手動境界「${matchingManual.name}」と高い類似性`,
            action: `境界定義を統合し、AIの提案を取り入れることを推奨`,
          });
        }
      } else {
        recommendations.push({
          type: 'use_auto_boundary',
          auto_boundary: autoBoundary.name,
          confidence: autoBoundary.confidence,
          reason: `高信頼度のAI発見境界「${autoBoundary.name}」が手動設定にない`,
          action: `この境界を新しいモジュールとして追加することを推奨`,
        });
      }
    }
    
    // Check for manual boundaries that AI disagrees with
    for (const manualBoundary of manual) {
      const matchingAuto = auto.find(a => 
        this.calculateFileOverlap(a.files, manualBoundary.files) > 0.3
      );
      
      if (!matchingAuto || matchingAuto.confidence < 0.5) {
        recommendations.push({
          type: 'manual_override',
          manual_boundary: manualBoundary.name,
          confidence: matchingAuto?.confidence || 0,
          reason: `手動境界「${manualBoundary.name}」をAIが支持していない`,
          action: `境界定義の見直しまたはAI分析の詳細確認が必要`,
        });
      }
    }
    
    return recommendations;
  }
}