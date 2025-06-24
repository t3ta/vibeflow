import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';

/**
 * MetadataCache - 静的解析結果をキャッシュしてLLM呼び出しを最適化
 */
export class MetadataCache {
  private cacheDir: string;
  private fileMetadata = new Map<string, FileMetadata>();
  
  constructor(projectRoot: string) {
    this.cacheDir = path.join(projectRoot, '.vibeflow', 'metadata-cache');
  }

  /**
   * ファイルの事前分析とメタデータ生成
   */
  async analyzeAndCacheFiles(files: string[]): Promise<ProjectMetadata> {
    console.log(`🔍 ${files.length}ファイルの事前分析開始...`);
    
    await this.ensureCacheDirectory();
    
    // 並列処理でファイルを分析
    const metadataPromises = files.map(file => this.analyzeFile(file));
    const allMetadata = await Promise.all(metadataPromises);
    
    const projectMetadata: ProjectMetadata = {
      files: allMetadata.filter(m => m !== null) as FileMetadata[],
      dependencies: this.buildDependencyGraph(allMetadata.filter(m => m !== null) as FileMetadata[]),
      businessClusters: await this.identifyBusinessClusters(allMetadata.filter(m => m !== null) as FileMetadata[]),
      codePatterns: this.extractCodePatterns(allMetadata.filter(m => m !== null) as FileMetadata[]),
      complexityMetrics: this.calculateComplexityMetrics(allMetadata.filter(m => m !== null) as FileMetadata[])
    };

    await this.saveProjectMetadata(projectMetadata);
    console.log(`✅ プロジェクトメタデータキャッシュ完了`);
    
    return projectMetadata;
  }

  /**
   * 個別ファイルの静的解析
   */
  private async analyzeFile(filePath: string): Promise<FileMetadata | null> {
    try {
      // キャッシュチェック
      const cached = await this.loadCachedMetadata(filePath);
      if (cached && !await this.hasFileChanged(filePath, cached.lastModified)) {
        return cached;
      }

      const content = await fs.readFile(filePath, 'utf8');
      const stats = await fs.stat(filePath);
      
      const metadata: FileMetadata = {
        path: filePath,
        hash: this.calculateFileHash(content),
        lastModified: stats.mtime,
        size: stats.size,
        language: this.detectLanguage(filePath),
        
        // 構造的メタデータ
        structure: await this.analyzeCodeStructure(content, filePath),
        
        // ビジネス的メタデータ  
        businessContext: await this.analyzeBusinessContext(content),
        
        // 技術的メタデータ
        technicalComplexity: this.calculateTechnicalComplexity(content),
        
        // 依存関係メタデータ
        dependencies: this.extractDependencies(content, filePath),
        
        // LLM最適化用メタデータ
        llmHints: this.generateLLMHints(content, filePath)
      };

      await this.saveCachedMetadata(filePath, metadata);
      return metadata;
      
    } catch (error) {
      console.warn(`⚠️ ファイル分析失敗: ${filePath}`, error);
      return null;
    }
  }

  /**
   * コード構造の分析
   */
  private async analyzeCodeStructure(content: string, filePath: string): Promise<CodeStructure> {
    const language = this.detectLanguage(filePath);
    
    if (language === 'go') {
      return this.analyzeGoStructure(content);
    } else if (language === 'typescript') {
      return this.analyzeTypeScriptStructure(content);
    } else if (language === 'python') {
      return this.analyzePythonStructure(content);
    }
    
    return { functions: [], types: [], imports: [], exports: [] };
  }

  /**
   * Go言語の構造解析
   */
  private analyzeGoStructure(content: string): CodeStructure {
    const structure: CodeStructure = {
      functions: [],
      types: [],
      imports: [],
      exports: []
    };

    // パッケージとインポート
    const packageMatch = content.match(/package\s+(\w+)/);
    const importMatches = content.matchAll(/import\s*(?:\(\s*([\s\S]*?)\s*\)|"([^"]+)")/g);
    
    for (const match of importMatches) {
      const importBlock = match[1] || match[2];
      if (importBlock) {
        structure.imports.push(...this.parseGoImports(importBlock));
      }
    }

    // 構造体とインターフェース
    const structMatches = content.matchAll(/type\s+(\w+)\s+struct\s*{([\s\S]*?)}/g);
    for (const match of structMatches) {
      structure.types.push({
        name: match[1],
        kind: 'struct',
        fields: this.parseGoStructFields(match[2]),
        annotations: this.extractGoTags(match[2])
      });
    }

    // 関数
    const funcMatches = content.matchAll(/func\s*(?:\(.*?\))?\s*(\w+)\s*\((.*?)\)\s*(?:\((.*?)\))?\s*(?:\w+\s*)?{/g);
    for (const match of funcMatches) {
      structure.functions.push({
        name: match[1],
        parameters: this.parseGoParameters(match[2]),
        returnTypes: match[3] ? this.parseGoReturnTypes(match[3]) : [],
        isExported: /^[A-Z]/.test(match[1])
      });
    }

    return structure;
  }

  /**
   * ビジネスコンテキストの分析
   */
  private async analyzeBusinessContext(content: string): Promise<BusinessContext> {
    const businessKeywords = [
      'user', 'customer', 'order', 'payment', 'invoice', 'product', 'inventory',
      'fish', 'pond', 'feeding', 'vaccine', 'health', 'aquaculture', 'harvest',
      'daily', 'report', 'status', 'measurement', 'supplement', 'medicine'
    ];

    const domainConcepts: string[] = [];
    const businessRules: string[] = [];
    const entityRelationships: EntityRelationship[] = [];

    // ビジネス用語の抽出
    for (const keyword of businessKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      if (regex.test(content)) {
        domainConcepts.push(keyword);
      }
    }

    // ビジネスルールの検出
    const rulePatterns = [
      /if\s+.*\s*{\s*\/\/\s*(.*business.*rule.*)/gi,
      /validate.*\((.*)\)/gi,
      /check.*\((.*)\)/gi
    ];

    for (const pattern of rulePatterns) {
      const matches = content.matchAll(pattern);
      for (const match of matches) {
        businessRules.push(match[1] || match[0]);
      }
    }

    // エンティティ関係の推定
    const structMatches = content.matchAll(/type\s+(\w+)\s+struct\s*{([\s\S]*?)}/g);
    for (const match of structMatches) {
      const entityName = match[1];
      const fields = match[2];
      
      // 外部キー的なフィールドを探す
      const fkMatches = fields.matchAll(/(\w+)ID\s+\w+/g);
      for (const fkMatch of fkMatches) {
        const relatedEntity = fkMatch[1];
        entityRelationships.push({
          from: entityName,
          to: relatedEntity,
          type: 'belongs_to'
        });
      }
    }

    return {
      domainConcepts,
      businessRules,
      entityRelationships,
      confidenceScore: this.calculateBusinessConfidence(domainConcepts, businessRules)
    };
  }

  /**
   * 技術的複雑度の計算
   */
  private calculateTechnicalComplexity(content: string): TechnicalComplexity {
    const lines = content.split('\n');
    const nonEmptyLines = lines.filter(line => line.trim() && !line.trim().startsWith('//')).length;
    
    // サイクロマティック複雑度の簡易計算
    const complexityKeywords = ['if', 'else', 'for', 'while', 'switch', 'case', '&&', '||'];
    let cyclomaticComplexity = 1;
    
    for (const keyword of complexityKeywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = content.match(regex);
      if (matches) {
        cyclomaticComplexity += matches.length;
      }
    }

    // 関数数
    const functionCount = (content.match(/func\s+/g) || []).length;
    
    // ネストレベル
    const maxNestLevel = this.calculateMaxNestLevel(content);

    return {
      linesOfCode: nonEmptyLines,
      cyclomaticComplexity,
      functionCount,
      maxNestLevel,
      complexityScore: this.normalizeComplexityScore(cyclomaticComplexity, functionCount, maxNestLevel)
    };
  }

  /**
   * LLM最適化ヒントの生成
   */
  private generateLLMHints(content: string, filePath: string): LLMHints {
    const fileName = path.basename(filePath);
    
    return {
      suggestedApproach: this.suggestLLMApproach(content),
      contextPriority: this.calculateContextPriority(content),
      templateCompatible: this.isTemplateCompatible(content),
      estimatedTokens: this.estimateTokenUsage(content),
      batchingRecommendation: this.recommendBatching(filePath, content)
    };
  }

  /**
   * LLMアプローチの提案
   */
  private suggestLLMApproach(content: string): 'full_llm' | 'template' | 'static_only' {
    // 複雑なビジネスロジックがある場合
    const hasComplexLogic = /switch\s*{[\s\S]*case/g.test(content) ||
                           /complex.*calculation/gi.test(content) ||
                           /business.*rule/gi.test(content);
    
    if (hasComplexLogic) return 'full_llm';
    
    // CRUD操作のみの場合
    const isCrudOnly = /func\s+(Create|Read|Update|Delete|Get|Set)\w*/g.test(content) &&
                       !/func\s+Validate/g.test(content);
    
    if (isCrudOnly) return 'template';
    
    // 設定・定数のみの場合
    const isConfigOnly = /const\s+\w+\s*=/g.test(content) &&
                         !/func\s+/g.test(content);
    
    if (isConfigOnly) return 'static_only';
    
    return 'full_llm';
  }

  /**
   * プロジェクトメタデータの保存
   */
  private async saveProjectMetadata(metadata: ProjectMetadata): Promise<void> {
    const filePath = path.join(this.cacheDir, 'project-metadata.json');
    await fs.writeFile(filePath, JSON.stringify(metadata, null, 2));
  }

  /**
   * キャッシュディレクトリの確保
   */
  private async ensureCacheDirectory(): Promise<void> {
    await fs.mkdir(this.cacheDir, { recursive: true });
  }

  // ヘルパーメソッド群の実装
  private buildDependencyGraph(files: FileMetadata[]): DependencyGraph {
    return { nodes: files.map(f => f.path), edges: [] };
  }

  private async identifyBusinessClusters(files: FileMetadata[]): Promise<BusinessCluster[]> {
    return files.map(f => ({
      name: path.basename(f.path, path.extname(f.path)),
      files: [f.path],
      concepts: f.businessContext.domainConcepts,
      confidence: f.businessContext.confidenceScore
    }));
  }

  private extractCodePatterns(files: FileMetadata[]): CodePattern[] {
    return [{ name: 'CRUD', pattern: 'Create|Read|Update|Delete', frequency: 1, examples: [] }];
  }

  private calculateComplexityMetrics(files: FileMetadata[]): ProjectComplexity {
    const complexities = files.map(f => f.technicalComplexity.complexityScore);
    return {
      averageComplexity: complexities.reduce((a, b) => a + b, 0) / complexities.length,
      maxComplexity: Math.max(...complexities),
      totalFunctions: files.reduce((sum, f) => sum + f.structure.functions.length, 0),
      complexityDistribution: {}
    };
  }

  private extractDependencies(content: string, filePath: string): FileDependency[] {
    const imports = content.match(/import\s+.*from\s+["']([^"']+)["']/g) || [];
    return imports.map(imp => ({
      path: imp,
      type: 'import' as const,
      isExternal: !imp.includes('./')
    }));
  }

  private analyzeTypeScriptStructure(content: string): CodeStructure {
    return { functions: [], types: [], imports: [], exports: [] };
  }

  private analyzePythonStructure(content: string): CodeStructure {
    return { functions: [], types: [], imports: [], exports: [] };
  }

  private parseGoImports(importBlock: string): string[] {
    return importBlock.split('\n').filter(line => line.trim()).map(line => line.trim().replace(/['"]/g, ''));
  }

  private parseGoStructFields(fields: string): string[] {
    return fields.split('\n').filter(line => line.trim()).map(line => line.trim().split(/\s+/)[0]);
  }

  private extractGoTags(fields: string): string[] {
    const tags = fields.match(/`[^`]+`/g) || [];
    return tags.map(tag => tag.slice(1, -1));
  }

  private parseGoParameters(params: string): string[] {
    return params.split(',').map(p => p.trim()).filter(p => p);
  }

  private parseGoReturnTypes(returns: string): string[] {
    return returns.split(',').map(r => r.trim()).filter(r => r);
  }

  private calculateBusinessConfidence(concepts: string[], rules: string[]): number {
    return Math.min(1, (concepts.length * 0.3 + rules.length * 0.7) / 10);
  }

  private calculateMaxNestLevel(content: string): number {
    const lines = content.split('\n');
    let maxNest = 0;
    let currentNest = 0;
    
    for (const line of lines) {
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      currentNest += openBraces - closeBraces;
      maxNest = Math.max(maxNest, currentNest);
    }
    
    return maxNest;
  }

  private normalizeComplexityScore(cyclomatic: number, functions: number, nesting: number): number {
    return Math.min(10, (cyclomatic * 0.4 + functions * 0.3 + nesting * 0.3) / 10);
  }

  private calculateContextPriority(content: string): number {
    const businessKeywords = ['business', 'rule', 'validate', 'calculate', 'process'];
    const keywordCount = businessKeywords.reduce((count, keyword) => {
      return count + (content.match(new RegExp(keyword, 'gi'))?.length || 0);
    }, 0);
    return Math.min(100, keywordCount * 10);
  }

  private isTemplateCompatible(content: string): boolean {
    const crudPatterns = /func\s+(Create|Read|Update|Delete|Get|Set)\w*/g;
    return crudPatterns.test(content);
  }

  private estimateTokenUsage(content: string): number {
    return Math.ceil(content.length / 4); // 簡易推定: 4文字 = 1トークン
  }

  private recommendBatching(filePath: string, content: string): string[] {
    const baseName = path.basename(filePath, path.extname(filePath));
    return [`${baseName}_service`, `${baseName}_repository`, `${baseName}_handler`];
  }

  private calculateFileHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  private detectLanguage(filePath: string): 'go' | 'typescript' | 'python' | 'unknown' {
    const ext = path.extname(filePath);
    switch (ext) {
      case '.go': return 'go';
      case '.ts': case '.tsx': return 'typescript';
      case '.py': return 'python';
      default: return 'unknown';
    }
  }

  private async hasFileChanged(filePath: string, lastModified: Date): Promise<boolean> {
    try {
      const stats = await fs.stat(filePath);
      return stats.mtime > lastModified;
    } catch {
      return true;
    }
  }

  private async loadCachedMetadata(filePath: string): Promise<FileMetadata | null> {
    try {
      const cacheFile = path.join(this.cacheDir, this.getCacheFileName(filePath));
      const content = await fs.readFile(cacheFile, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }

  private async saveCachedMetadata(filePath: string, metadata: FileMetadata): Promise<void> {
    const cacheFile = path.join(this.cacheDir, this.getCacheFileName(filePath));
    await fs.writeFile(cacheFile, JSON.stringify(metadata, null, 2));
  }

  private getCacheFileName(filePath: string): string {
    const hash = crypto.createHash('md5').update(filePath).digest('hex');
    return `${hash}.json`;
  }
}

// 型定義
export interface FileMetadata {
  path: string;
  hash: string;
  lastModified: Date;
  size: number;
  language: 'go' | 'typescript' | 'python' | 'unknown';
  structure: CodeStructure;
  businessContext: BusinessContext;
  technicalComplexity: TechnicalComplexity;
  dependencies: FileDependency[];
  llmHints: LLMHints;
}

export interface ProjectMetadata {
  files: FileMetadata[];
  dependencies: DependencyGraph;
  businessClusters: BusinessCluster[];
  codePatterns: CodePattern[];
  complexityMetrics: ProjectComplexity;
}

export interface CodeStructure {
  functions: FunctionInfo[];
  types: TypeInfo[];
  imports: string[];
  exports: string[];
}

export interface BusinessContext {
  domainConcepts: string[];
  businessRules: string[];
  entityRelationships: EntityRelationship[];
  confidenceScore: number;
}

export interface TechnicalComplexity {
  linesOfCode: number;
  cyclomaticComplexity: number;
  functionCount: number;
  maxNestLevel: number;
  complexityScore: number;
}

export interface LLMHints {
  suggestedApproach: 'full_llm' | 'template' | 'static_only';
  contextPriority: number;
  templateCompatible: boolean;
  estimatedTokens: number;
  batchingRecommendation: string[];
}

export interface FunctionInfo {
  name: string;
  parameters: string[];
  returnTypes: string[];
  isExported: boolean;
}

export interface TypeInfo {
  name: string;
  kind: 'struct' | 'interface' | 'class';
  fields: string[];
  annotations: string[];
}

export interface EntityRelationship {
  from: string;
  to: string;
  type: 'belongs_to' | 'has_many' | 'has_one';
}

export interface FileDependency {
  path: string;
  type: 'import' | 'export';
  isExternal: boolean;
}

export interface DependencyGraph {
  nodes: string[];
  edges: { from: string; to: string; type: string }[];
}

export interface BusinessCluster {
  name: string;
  files: string[];
  concepts: string[];
  confidence: number;
}

export interface CodePattern {
  name: string;
  pattern: string;
  frequency: number;
  examples: string[];
}

export interface ProjectComplexity {
  averageComplexity: number;
  maxComplexity: number;
  totalFunctions: number;
  complexityDistribution: { [key: string]: number };
}