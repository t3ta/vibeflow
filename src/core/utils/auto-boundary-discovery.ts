import * as fs from 'fs';
import * as path from 'path';
import { ASTAnalyzer, ModuleCandidateNode, GoStruct, GoInterface, GoFunction, DatabaseAccess } from './ast-analyzer.js';
export interface AutoDiscoveredBoundary {
  name: string;
  description: string;
  confidence: number;
  files: string[];
  structs: string[];
  interfaces: string[];
  functions: string[];
  database_tables: string[];
  reasoning: string[];
  semantic_keywords: string[];
  dependency_clusters: string[];
}

export interface BoundaryDiscoveryResult {
  discovered_boundaries: AutoDiscoveredBoundary[];
  confidence_metrics: ConfidenceMetrics;
  clustering_analysis: ClusteringAnalysis;
  recommendations: BoundaryRecommendation[];
}

export interface ConfidenceMetrics {
  overall_confidence: number;
  semantic_consistency: number;
  structural_coherence: number;
  dependency_clarity: number;
  database_alignment: number;
}

export interface ClusteringAnalysis {
  optimal_cluster_count: number;
  cluster_quality_score: number;
  boundary_overlaps: BoundaryOverlap[];
  orphaned_files: string[];
}

export interface BoundaryOverlap {
  boundary1: string;
  boundary2: string;
  overlap_type: 'file' | 'dependency' | 'semantic';
  overlap_strength: number;
  resolution_suggestion: string;
}

export interface BoundaryRecommendation {
  type: 'merge' | 'split' | 'rename' | 'move_files';
  boundaries: string[];
  reason: string;
  expected_benefit: string;
  implementation_difficulty: 'low' | 'medium' | 'high';
}

export class AutoBoundaryDiscovery {
  private astAnalyzer: ASTAnalyzer;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.astAnalyzer = new ASTAnalyzer(projectRoot);
  }

  async discoverBoundaries(): Promise<BoundaryDiscoveryResult> {
    console.log('🤖 完全自動境界発見を開始...');
    
    // 1. AST解析でコード構造を抽出
    const astAnalysis = await this.astAnalyzer.analyzeGoProject();
    
    // 2. セマンティッククラスタリング
    const semanticClusters = await this.astAnalyzer.findSemanticClusters(
      astAnalysis.structs,
      astAnalysis.interfaces,
      astAnalysis.functions
    );
    
    // 3. 依存関係ベースクラスタリング
    const dependencyClusters = await this.performDependencyBasedClustering(
      astAnalysis.structs,
      astAnalysis.interfaces,
      astAnalysis.functions
    );
    
    // 4. データベーステーブルアクセスパターン分析
    const databaseClusters = await this.analyzeDataBaseAccessPatterns(
      astAnalysis.database_access,
      astAnalysis.functions
    );
    
    // 5. ファイルパス・ディレクトリ構造分析
    const structuralClusters = await this.analyzeStructuralPatterns(
      [...astAnalysis.structs, ...astAnalysis.interfaces, ...astAnalysis.functions]
    );
    
    // 6. 複数手法の結果をマージ
    const mergedBoundaries = await this.mergeClusteringResults([
      semanticClusters,
      dependencyClusters,
      databaseClusters,
      structuralClusters,
    ]);
    
    // 7. 境界の信頼度評価
    const boundariesWithConfidence = await this.evaluateBoundaryConfidence(
      mergedBoundaries,
      astAnalysis
    );
    
    // 8. 最適化と推奨事項生成
    const optimizedBoundaries = await this.optimizeBoundaries(boundariesWithConfidence);
    const recommendations = await this.generateRecommendations(optimizedBoundaries);
    
    // 9. 結果分析
    const confidenceMetrics = this.calculateConfidenceMetrics(optimizedBoundaries);
    const clusteringAnalysis = this.analyzeClusteringQuality(optimizedBoundaries);
    
    console.log(`✨ ${optimizedBoundaries.length}個の境界を自動発見（信頼度${confidenceMetrics.overall_confidence.toFixed(1)}%）`);
    
    return {
      discovered_boundaries: optimizedBoundaries,
      confidence_metrics: confidenceMetrics,
      clustering_analysis: clusteringAnalysis,
      recommendations,
    };
  }

  private async performDependencyBasedClustering(
    structs: GoStruct[],
    interfaces: GoInterface[],
    functions: GoFunction[]
  ): Promise<ModuleCandidateNode[]> {
    console.log('🔗 依存関係ベースクラスタリング実行中...');
    
    const allNodes = [...structs, ...interfaces, ...functions];
    
    // 大規模データセットの場合はサンプリングして処理速度を向上
    const maxNodes = 100;
    const sampledNodes = allNodes.length > maxNodes ? 
      this.sampleNodes(allNodes, maxNodes) : allNodes;
    
    try {
      // 簡単な距離ベースクラスタリングを使用（K-meansより高速）
      const clusters = this.performSimpleDistanceClustering(sampledNodes);
      return clusters;
    } catch (error) {
      console.warn('依存関係クラスタリングに失敗:', error);
      return [];
    }
  }


  private calculateDependencyStrength(node1: any, node2: any): number {
    let strength = 0;
    
    // Direct dependencies
    if (node1.dependencies?.includes(node2.name)) {
      strength += 0.8;
    }
    
    // Function calls
    if (node1.calls?.includes(node2.name)) {
      strength += 0.6;
    }
    
    // Same file
    if (node1.file === node2.file) {
      strength += 0.4;
    }
    
    // Same directory
    if (path.dirname(node1.file) === path.dirname(node2.file)) {
      strength += 0.2;
    }
    
    // Semantic similarity
    const semanticSim = this.calculateSemanticSimilarity(node1.name, node2.name);
    strength += semanticSim * 0.3;
    
    return Math.min(strength, 1.0);
  }

  private calculateSemanticSimilarity(name1: string, name2: string): number {
    // Use word tokenization and similarity
    const tokens1 = this.extractSemanticTokens(name1);
    const tokens2 = this.extractSemanticTokens(name2);
    
    if (tokens1.length === 0 || tokens2.length === 0) return 0;
    
    const commonTokens = tokens1.filter(token => tokens2.includes(token));
    const totalTokens = new Set([...tokens1, ...tokens2]).size;
    
    return totalTokens > 0 ? commonTokens.length / totalTokens : 0;
  }

  private extractSemanticTokens(name: string): string[] {
    // Simple tokenization without external library
    const words = name
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/_/g, ' ')
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2);
    
    return words;
  }


  private sampleNodes(nodes: any[], maxCount: number): any[] {
    if (nodes.length <= maxCount) return nodes;
    
    const step = Math.floor(nodes.length / maxCount);
    const sampled = [];
    
    for (let i = 0; i < nodes.length; i += step) {
      sampled.push(nodes[i]);
      if (sampled.length >= maxCount) break;
    }
    
    return sampled;
  }

  private performSimpleDistanceClustering(nodes: any[]): ModuleCandidateNode[] {
    const clusters: ModuleCandidateNode[] = [];
    const processed = new Set<number>();
    
    for (let i = 0; i < nodes.length; i++) {
      if (processed.has(i)) continue;
      
      const cluster = [nodes[i]];
      processed.add(i);
      
      // 類似ノードを同じクラスターに追加
      for (let j = i + 1; j < nodes.length; j++) {
        if (processed.has(j)) continue;
        
        const similarity = this.calculateDependencyStrength(nodes[i], nodes[j]);
        if (similarity > 0.3) { // 閾値を下げて高速化
          cluster.push(nodes[j]);
          processed.add(j);
        }
      }
      
      if (cluster.length >= 2) {
        const clusterName = this.generateClusterName(cluster);
        const files = [...new Set(cluster.map(n => n.file))];
        
        clusters.push({
          name: clusterName,
          files,
          structs: cluster.filter(n => n.type === 'struct'),
          interfaces: cluster.filter(n => n.type === 'interface'),
          functions: cluster.filter(n => n.type === 'function'),
          database_access: [],
          semantic_keywords: this.extractClusterKeywords(cluster),
          cohesion_score: this.calculateClusterCohesion(cluster),
          external_dependencies: [],
        });
      }
    }
    
    return clusters;
  }


  private generateClusterName(nodes: any[]): string {
    const keywords = new Map<string, number>();
    
    for (const node of nodes) {
      const tokens = this.extractSemanticTokens(node.name);
      for (const token of tokens) {
        keywords.set(token, (keywords.get(token) || 0) + 1);
      }
    }
    
    // Find most common meaningful keyword
    const sortedKeywords = Array.from(keywords.entries())
      .filter(([keyword]) => keyword.length > 3 && !['type', 'model', 'data'].includes(keyword))
      .sort((a, b) => b[1] - a[1]);
    
    return sortedKeywords.length > 0 ? sortedKeywords[0][0] : 'module';
  }

  private extractClusterKeywords(nodes: any[]): string[] {
    const keywords = new Set<string>();
    
    for (const node of nodes) {
      const tokens = this.extractSemanticTokens(node.name);
      tokens.forEach(token => keywords.add(token));
    }
    
    return Array.from(keywords);
  }

  private calculateClusterCohesion(nodes: any[]): number {
    if (nodes.length <= 1) return 1.0;
    
    let totalSimilarity = 0;
    let comparisons = 0;
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const similarity = this.calculateSemanticSimilarity(nodes[i].name, nodes[j].name);
        totalSimilarity += similarity;
        comparisons++;
      }
    }
    
    return comparisons > 0 ? totalSimilarity / comparisons : 0;
  }

  private async analyzeDataBaseAccessPatterns(
    databaseAccess: DatabaseAccess[],
    functions: GoFunction[]
  ): Promise<ModuleCandidateNode[]> {
    console.log('🗄️  データベースアクセスパターン分析中...');
    
    const tableClusters = new Map<string, GoFunction[]>();
    
    // Group functions by database tables they access
    for (const access of databaseAccess) {
      const func = functions.find(f => f.name === access.function && f.file === access.file);
      if (!func) continue;
      
      if (!tableClusters.has(access.table)) {
        tableClusters.set(access.table, []);
      }
      
      if (!tableClusters.get(access.table)!.includes(func)) {
        tableClusters.get(access.table)!.push(func);
      }
    }
    
    const clusters: ModuleCandidateNode[] = [];
    
    for (const [table, funcs] of tableClusters) {
      if (funcs.length < 2) continue;
      
      const files = [...new Set(funcs.map(f => f.file))];
      const keywords = this.extractClusterKeywords(funcs);
      
      clusters.push({
        name: this.generateTableBasedModuleName(table, keywords),
        files,
        structs: [],
        interfaces: [],
        functions: funcs,
        database_access: databaseAccess.filter(da => da.table === table),
        semantic_keywords: keywords,
        cohesion_score: this.calculateClusterCohesion(funcs),
        external_dependencies: [],
      });
    }
    
    return clusters;
  }

  private generateTableBasedModuleName(table: string, keywords: string[]): string {
    // Try to extract meaningful name from table name
    const tableTokens = this.extractSemanticTokens(table);
    
    if (tableTokens.length > 0) {
      return tableTokens[0];
    }
    
    // Fall back to most common keyword
    const keywordCounts = new Map<string, number>();
    for (const keyword of keywords) {
      keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
    }
    
    const sortedKeywords = Array.from(keywordCounts.entries())
      .sort((a, b) => b[1] - a[1]);
    
    return sortedKeywords.length > 0 ? sortedKeywords[0][0] : table;
  }

  private async analyzeStructuralPatterns(nodes: any[]): Promise<ModuleCandidateNode[]> {
    console.log('📁 ファイル・ディレクトリ構造分析中...');
    
    const directoryClusters = new Map<string, any[]>();
    
    // Group by directory
    for (const node of nodes) {
      const dir = path.dirname(node.file);
      const dirName = path.basename(dir);
      
      if (!directoryClusters.has(dirName)) {
        directoryClusters.set(dirName, []);
      }
      
      directoryClusters.get(dirName)!.push(node);
    }
    
    const clusters: ModuleCandidateNode[] = [];
    
    for (const [dirName, dirNodes] of directoryClusters) {
      if (dirNodes.length < 3) continue; // Skip small directories
      
      const files = [...new Set(dirNodes.map(n => n.file))];
      const keywords = this.extractClusterKeywords(dirNodes);
      
      clusters.push({
        name: dirName === '.' ? 'root' : dirName,
        files,
        structs: dirNodes.filter(n => n.type === 'struct'),
        interfaces: dirNodes.filter(n => n.type === 'interface'),
        functions: dirNodes.filter(n => n.type === 'function'),
        database_access: [],
        semantic_keywords: keywords,
        cohesion_score: this.calculateClusterCohesion(dirNodes),
        external_dependencies: [],
      });
    }
    
    return clusters;
  }

  private async mergeClusteringResults(
    clusteringSets: ModuleCandidateNode[][]
  ): Promise<ModuleCandidateNode[]> {
    console.log('🔄 クラスタリング結果をマージ中...');
    
    const allClusters = clusteringSets.flat();
    if (allClusters.length === 0) return [];
    
    // Merge clusters with high file overlap
    const merged: ModuleCandidateNode[] = [];
    const processed = new Set<number>();
    
    for (let i = 0; i < allClusters.length; i++) {
      if (processed.has(i)) continue;
      
      const cluster = allClusters[i];
      const similar: ModuleCandidateNode[] = [cluster];
      
      for (let j = i + 1; j < allClusters.length; j++) {
        if (processed.has(j)) continue;
        
        const other = allClusters[j];
        const overlap = this.calculateFileOverlap(cluster.files, other.files);
        
        if (overlap > 0.5) { // 50% file overlap threshold
          similar.push(other);
          processed.add(j);
        }
      }
      
      processed.add(i);
      
      if (similar.length > 1) {
        const mergedCluster = this.mergeClusterCandidates(similar);
        merged.push(mergedCluster);
      } else {
        merged.push(cluster);
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

  private mergeClusterCandidates(clusters: ModuleCandidateNode[]): ModuleCandidateNode {
    const allFiles = [...new Set(clusters.flatMap(c => c.files))];
    const allStructs = [...new Set(clusters.flatMap(c => c.structs))];
    const allInterfaces = [...new Set(clusters.flatMap(c => c.interfaces))];
    const allFunctions = [...new Set(clusters.flatMap(c => c.functions))];
    const allKeywords = [...new Set(clusters.flatMap(c => c.semantic_keywords))];
    const allDbAccess = [...new Set(clusters.flatMap(c => c.database_access))];
    
    // Choose best name based on keyword frequency
    const name = this.chooseBestClusterName(clusters);
    
    // Average cohesion scores
    const avgCohesion = clusters.reduce((sum, c) => sum + c.cohesion_score, 0) / clusters.length;
    
    return {
      name,
      files: allFiles,
      structs: allStructs,
      interfaces: allInterfaces,
      functions: allFunctions,
      database_access: allDbAccess,
      semantic_keywords: allKeywords,
      cohesion_score: avgCohesion,
      external_dependencies: [],
    };
  }

  private chooseBestClusterName(clusters: ModuleCandidateNode[]): string {
    const keywordScores = new Map<string, number>();
    
    for (const cluster of clusters) {
      for (const keyword of cluster.semantic_keywords) {
        const score = (keywordScores.get(keyword) || 0) + cluster.cohesion_score;
        keywordScores.set(keyword, score);
      }
    }
    
    const sortedKeywords = Array.from(keywordScores.entries())
      .sort((a, b) => b[1] - a[1]);
    
    return sortedKeywords.length > 0 ? sortedKeywords[0][0] : clusters[0].name;
  }

  private async evaluateBoundaryConfidence(
    boundaries: ModuleCandidateNode[],
    astAnalysis: any
  ): Promise<AutoDiscoveredBoundary[]> {
    console.log('📊 境界信頼度評価中...');
    
    const result: AutoDiscoveredBoundary[] = [];
    
    for (const boundary of boundaries) {
      const confidence = this.calculateBoundaryConfidence(boundary, boundaries);
      const reasoning = this.generateBoundaryReasoning(boundary);
      const description = this.generateBoundaryDescription(boundary);
      
      result.push({
        name: boundary.name,
        description,
        confidence,
        files: boundary.files,
        structs: boundary.structs.map(s => s.name),
        interfaces: boundary.interfaces.map(i => i.name),
        functions: boundary.functions.map(f => f.name),
        database_tables: [...new Set(boundary.database_access.map(da => da.table))],
        reasoning,
        semantic_keywords: boundary.semantic_keywords,
        dependency_clusters: boundary.external_dependencies,
      });
    }
    
    return result;
  }

  private calculateBoundaryConfidence(
    boundary: ModuleCandidateNode,
    allBoundaries: ModuleCandidateNode[]
  ): number {
    let confidence = 0;
    
    // Semantic coherence (30%)
    const semanticScore = boundary.cohesion_score;
    confidence += semanticScore * 0.3;
    
    // Size appropriateness (20%)
    const sizeScore = this.evaluateBoundarySize(boundary);
    confidence += sizeScore * 0.2;
    
    // Database alignment (25%)
    const dbScore = this.evaluateDatabaseAlignment(boundary);
    confidence += dbScore * 0.25;
    
    // Isolation score (25%)
    const isolationScore = this.evaluateBoundaryIsolation(boundary, allBoundaries);
    confidence += isolationScore * 0.25;
    
    return Math.min(confidence, 1.0);
  }

  private evaluateBoundarySize(boundary: ModuleCandidateNode): number {
    const totalElements = boundary.structs.length + boundary.interfaces.length + boundary.functions.length;
    
    // Optimal size is 5-20 elements
    if (totalElements >= 5 && totalElements <= 20) {
      return 1.0;
    } else if (totalElements >= 3 && totalElements <= 30) {
      return 0.8;
    } else if (totalElements >= 2 && totalElements <= 50) {
      return 0.6;
    } else {
      return 0.3;
    }
  }

  private evaluateDatabaseAlignment(boundary: ModuleCandidateNode): number {
    if (boundary.database_access.length === 0) return 0.5; // Neutral for no DB access
    
    const uniqueTables = new Set(boundary.database_access.map(da => da.table));
    
    // Prefer boundaries that access 1-3 related tables
    if (uniqueTables.size >= 1 && uniqueTables.size <= 3) {
      return 1.0;
    } else if (uniqueTables.size <= 5) {
      return 0.7;
    } else {
      return 0.4;
    }
  }

  private evaluateBoundaryIsolation(
    boundary: ModuleCandidateNode,
    allBoundaries: ModuleCandidateNode[]
  ): number {
    const boundaryFiles = new Set(boundary.files);
    let maxOverlap = 0;
    
    for (const other of allBoundaries) {
      if (other === boundary) continue;
      
      const overlap = this.calculateFileOverlap(boundary.files, other.files);
      maxOverlap = Math.max(maxOverlap, overlap);
    }
    
    return 1.0 - maxOverlap; // Higher score for less overlap
  }

  private generateBoundaryReasoning(boundary: ModuleCandidateNode): string[] {
    const reasons: string[] = [];
    
    if (boundary.semantic_keywords.length > 0) {
      reasons.push(`セマンティック一貫性: ${boundary.semantic_keywords.slice(0, 3).join(', ')}`);
    }
    
    if (boundary.database_access.length > 0) {
      const tables = [...new Set(boundary.database_access.map(da => da.table))];
      reasons.push(`データベーステーブル: ${tables.slice(0, 3).join(', ')}`);
    }
    
    if (boundary.cohesion_score > 0.7) {
      reasons.push(`高い内部凝集度: ${(boundary.cohesion_score * 100).toFixed(1)}%`);
    }
    
    if (boundary.files.length > 0) {
      const dirs = [...new Set(boundary.files.map(f => path.dirname(f)))];
      if (dirs.length === 1) {
        reasons.push(`単一ディレクトリ: ${path.basename(dirs[0])}`);
      }
    }
    
    return reasons;
  }

  private generateBoundaryDescription(boundary: ModuleCandidateNode): string {
    const mainKeyword = boundary.semantic_keywords[0] || boundary.name;
    const elementCount = boundary.structs.length + boundary.interfaces.length + boundary.functions.length;
    
    return `${mainKeyword}に関連する機能を含むモジュール（${elementCount}個の要素）`;
  }

  private async optimizeBoundaries(boundaries: AutoDiscoveredBoundary[]): Promise<AutoDiscoveredBoundary[]> {
    // Filter out low-confidence boundaries
    const highConfidenceBoundaries = boundaries.filter(b => b.confidence > 0.5);
    
    // Sort by confidence
    return highConfidenceBoundaries.sort((a, b) => b.confidence - a.confidence);
  }

  private async generateRecommendations(boundaries: AutoDiscoveredBoundary[]): Promise<BoundaryRecommendation[]> {
    const recommendations: BoundaryRecommendation[] = [];
    
    // Check for potential merges
    for (let i = 0; i < boundaries.length; i++) {
      for (let j = i + 1; j < boundaries.length; j++) {
        const boundary1 = boundaries[i];
        const boundary2 = boundaries[j];
        
        const overlap = this.calculateFileOverlap(boundary1.files, boundary2.files);
        const semanticSimilarity = this.calculateSemanticSimilarity(
          boundary1.semantic_keywords.join(' '),
          boundary2.semantic_keywords.join(' ')
        );
        
        if (overlap > 0.3 || semanticSimilarity > 0.7) {
          recommendations.push({
            type: 'merge',
            boundaries: [boundary1.name, boundary2.name],
            reason: `高い重複（ファイル${(overlap * 100).toFixed(1)}%、セマンティック${(semanticSimilarity * 100).toFixed(1)}%）`,
            expected_benefit: 'コード重複の削減とモジュール一貫性の向上',
            implementation_difficulty: 'medium',
          });
        }
      }
    }
    
    // Check for boundaries that should be split
    for (const boundary of boundaries) {
      if (boundary.files.length > 20 || boundary.semantic_keywords.length > 5) {
        recommendations.push({
          type: 'split',
          boundaries: [boundary.name],
          reason: `モジュールが大きすぎる（${boundary.files.length}ファイル、${boundary.semantic_keywords.length}キーワード）`,
          expected_benefit: 'モジュールの理解しやすさと保守性の向上',
          implementation_difficulty: 'high',
        });
      }
    }
    
    return recommendations;
  }

  private calculateConfidenceMetrics(boundaries: AutoDiscoveredBoundary[]): ConfidenceMetrics {
    const confidences = boundaries.map(b => b.confidence);
    const overallConfidence = confidences.length > 0 
      ? confidences.reduce((sum, c) => sum + c, 0) / confidences.length 
      : 0;
    
    return {
      overall_confidence: overallConfidence * 100,
      semantic_consistency: 85, // Placeholder
      structural_coherence: 78, // Placeholder
      dependency_clarity: 82,   // Placeholder
      database_alignment: 90,   // Placeholder
    };
  }

  private analyzeClusteringQuality(boundaries: AutoDiscoveredBoundary[]): ClusteringAnalysis {
    return {
      optimal_cluster_count: boundaries.length,
      cluster_quality_score: 85, // Placeholder
      boundary_overlaps: [],
      orphaned_files: [],
    };
  }
}