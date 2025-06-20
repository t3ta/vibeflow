import * as fs from 'fs';
import * as path from 'path';

export interface ASTNode {
  type: string;
  name: string;
  file: string;
  line: number;
  dependencies: string[];
  properties?: ASTProperty[];
  methods?: ASTMethod[];
}

export interface ASTProperty {
  name: string;
  type: string;
  tags?: string[];
}

export interface ASTMethod {
  name: string;
  parameters: ASTParameter[];
  returnType: string;
  calls: string[];
}

export interface ASTParameter {
  name: string;
  type: string;
}

export interface GoStruct extends ASTNode {
  type: 'struct';
  properties: ASTProperty[];
  methods: ASTMethod[];
  implementsInterfaces: string[];
  embeds: string[];
}

export interface GoInterface extends ASTNode {
  type: 'interface';
  methods: ASTMethod[];
  extends: string[];
}

export interface GoFunction extends ASTNode {
  type: 'function';
  receiver?: string;
  parameters: ASTParameter[];
  returnType: string;
  calls: string[];
  tables_accessed: string[];
}

export interface DatabaseAccess {
  table: string;
  operation: 'select' | 'insert' | 'update' | 'delete';
  file: string;
  function: string;
}

export interface ModuleCandidateNode {
  name: string;
  files: string[];
  structs: GoStruct[];
  interfaces: GoInterface[];
  functions: GoFunction[];
  database_access: DatabaseAccess[];
  semantic_keywords: string[];
  cohesion_score: number;
  external_dependencies: string[];
}

export class ASTAnalyzer {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  async analyzeGoProject(): Promise<{
    structs: GoStruct[];
    interfaces: GoInterface[];
    functions: GoFunction[];
    database_access: DatabaseAccess[];
  }> {
    console.log('🔍 Goプロジェクトを詳細分析中...');
    
    const goFiles = await this.findGoFiles();
    
    // 大規模プロジェクトの場合は重要なファイルのみをサンプリング
    const maxFiles = 150;
    const filesToAnalyze = goFiles.length > maxFiles ? 
      this.selectImportantFiles(goFiles, maxFiles) : goFiles;
    
    if (filesToAnalyze.length < goFiles.length) {
      console.log(`⚡ パフォーマンス向上のため${filesToAnalyze.length}/${goFiles.length}ファイルをサンプリング分析`);
    }
    
    const structs: GoStruct[] = [];
    const interfaces: GoInterface[] = [];
    const functions: GoFunction[] = [];
    const databaseAccess: DatabaseAccess[] = [];

    for (const file of filesToAnalyze) {
      const content = fs.readFileSync(file, 'utf8');
      const relativePath = path.relative(this.projectRoot, file);
      
      const fileAnalysis = this.analyzeGoFile(content, relativePath);
      
      structs.push(...fileAnalysis.structs);
      interfaces.push(...fileAnalysis.interfaces);
      functions.push(...fileAnalysis.functions);
      databaseAccess.push(...fileAnalysis.database_access);
    }

    console.log(`📊 分析完了: ${structs.length}構造体, ${interfaces.length}インターフェース, ${functions.length}関数`);
    
    return { structs, interfaces, functions, database_access: databaseAccess };
  }

  private selectImportantFiles(files: string[], maxCount: number): string[] {
    // 重要度に基づいてファイルを選択
    const scored = files.map(file => {
      const relativePath = path.relative(this.projectRoot, file);
      let score = 0;
      
      // ルートディレクトリのファイルを優先
      const depth = relativePath.split('/').length;
      score += Math.max(0, 5 - depth);
      
      // 特定のパターンのファイルを優先
      if (relativePath.includes('handler') || relativePath.includes('controller')) score += 3;
      if (relativePath.includes('service') || relativePath.includes('usecase')) score += 3;
      if (relativePath.includes('repository') || relativePath.includes('dao')) score += 3;
      if (relativePath.includes('model') || relativePath.includes('entity')) score += 2;
      if (relativePath.includes('domain') || relativePath.includes('core')) score += 2;
      
      // ファイルサイズが大きいものを優先
      try {
        const stats = fs.statSync(file);
        score += Math.min(3, stats.size / 10000); // 10KB毎に1ポイント、最大3ポイント
      } catch {}
      
      return { file, score };
    });
    
    // スコア順にソートして上位を選択
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, maxCount).map(item => item.file);
  }

  private async findGoFiles(): Promise<string[]> {
    const { execSync } = await import('child_process');
    
    try {
      const output = execSync('find . -name "*.go" -not -path "./vendor/*" -not -path "*_test.go"', {
        cwd: this.projectRoot,
        encoding: 'utf8',
      });
      
      return output
        .split('\n')
        .filter(Boolean)
        .map(file => path.resolve(this.projectRoot, file));
    } catch {
      // Fallback to glob if find command fails
      const fastGlob = (await import('fast-glob')).default;
      return await fastGlob(['**/*.go', '!**/vendor/**', '!**/*_test.go'], {
        cwd: this.projectRoot,
        absolute: true,
      });
    }
  }

  private analyzeGoFile(content: string, filePath: string): {
    structs: GoStruct[];
    interfaces: GoInterface[];
    functions: GoFunction[];
    database_access: DatabaseAccess[];
  } {
    const lines = content.split('\n');
    const structs: GoStruct[] = [];
    const interfaces: GoInterface[] = [];
    const functions: GoFunction[] = [];
    const databaseAccess: DatabaseAccess[] = [];

    // Parse structs
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Struct definition
      const structMatch = line.match(/type\s+(\w+)\s+struct\s*{?$/);
      if (structMatch) {
        const struct = this.parseStruct(lines, i, structMatch[1], filePath);
        if (struct) structs.push(struct);
      }
      
      // Interface definition
      const interfaceMatch = line.match(/type\s+(\w+)\s+interface\s*{?$/);
      if (interfaceMatch) {
        const iface = this.parseInterface(lines, i, interfaceMatch[1], filePath);
        if (iface) interfaces.push(iface);
      }
      
      // Function definition
      const funcMatch = line.match(/func\s*(?:\(\s*(\w+)\s+\*?(\w+)\s*\))?\s*(\w+)\s*\(/);
      if (funcMatch) {
        const func = this.parseFunction(lines, i, funcMatch, filePath);
        if (func) {
          functions.push(func);
          
          // Extract database access patterns
          const dbAccess = this.extractDatabaseAccess(func);
          databaseAccess.push(...dbAccess);
        }
      }
    }

    return { structs, interfaces, functions, database_access: databaseAccess };
  }

  private parseStruct(lines: string[], startLine: number, name: string, filePath: string): GoStruct | null {
    const properties: ASTProperty[] = [];
    const dependencies: string[] = [];
    const implementsInterfaces: string[] = [];
    const embeds: string[] = [];

    let i = startLine + 1;
    let braceCount = 1;
    
    // Handle single-line struct or find opening brace
    if (!lines[startLine].includes('{')) {
      while (i < lines.length && !lines[i].includes('{')) {
        i++;
      }
      if (i >= lines.length) return null;
    }

    i++; // Move past opening brace
    
    while (i < lines.length && braceCount > 0) {
      const line = lines[i].trim();
      
      if (line.includes('{')) braceCount++;
      if (line.includes('}')) braceCount--;
      
      if (braceCount === 1 && line && !line.startsWith('//')) {
        // Parse struct field
        const fieldMatch = line.match(/^(\w+)\s+(.+?)(?:\s+`([^`]+)`)?$/);
        if (fieldMatch) {
          const [, fieldName, fieldType, tags] = fieldMatch;
          
          properties.push({
            name: fieldName,
            type: fieldType.trim(),
            tags: tags ? [tags] : [],
          });
          
          // Extract dependencies from field types
          if (fieldType.includes('.')) {
            const typeParts = fieldType.split('.');
            if (typeParts.length > 1) {
              dependencies.push(typeParts[0]);
            }
          }
        }
        
        // Check for embedded types
        const embedMatch = line.match(/^([A-Z]\w+)$/);
        if (embedMatch) {
          embeds.push(embedMatch[1]);
        }
      }
      
      i++;
    }

    return {
      type: 'struct',
      name,
      file: filePath,
      line: startLine + 1,
      dependencies,
      properties,
      methods: [], // Will be populated later by linking
      implementsInterfaces,
      embeds,
    };
  }

  private parseInterface(lines: string[], startLine: number, name: string, filePath: string): GoInterface | null {
    const methods: ASTMethod[] = [];
    const extendsArray: string[] = [];
    const dependencies: string[] = [];

    let i = startLine + 1;
    let braceCount = 1;
    
    // Handle single-line interface or find opening brace
    if (!lines[startLine].includes('{')) {
      while (i < lines.length && !lines[i].includes('{')) {
        i++;
      }
      if (i >= lines.length) return null;
    }

    i++; // Move past opening brace
    
    while (i < lines.length && braceCount > 0) {
      const line = lines[i].trim();
      
      if (line.includes('{')) braceCount++;
      if (line.includes('}')) braceCount--;
      
      if (braceCount === 1 && line && !line.startsWith('//')) {
        // Parse interface method
        const methodMatch = line.match(/^(\w+)\s*\(([^)]*)\)\s*(.*)$/);
        if (methodMatch) {
          const [, methodName, params, returnType] = methodMatch;
          
          const parameters = this.parseParameters(params);
          
          methods.push({
            name: methodName,
            parameters,
            returnType: returnType.trim(),
            calls: [],
          });
        }
        
        // Check for embedded interfaces
        const embedMatch = line.match(/^([A-Z]\w+)$/);
        if (embedMatch) {
          extendsArray.push(embedMatch[1]);
        }
      }
      
      i++;
    }

    return {
      type: 'interface',
      name,
      file: filePath,
      line: startLine + 1,
      dependencies,
      methods,
      extends: extendsArray,
    };
  }

  private parseFunction(lines: string[], startLine: number, match: RegExpMatchArray, filePath: string): GoFunction | null {
    const [, receiver, receiverType, funcName] = match;
    const line = lines[startLine];
    
    // Extract parameters and return type
    const paramMatch = line.match(/\(([^)]*)\)(?:\s*\(([^)]*)\)|\s+(.+?))?(?:\s*{|$)/);
    if (!paramMatch) return null;
    
    const [, params, multiReturnTypes, singleReturnType] = paramMatch;
    const parameters = this.parseParameters(params);
    const returnType = multiReturnTypes || singleReturnType || 'void';
    
    // Parse function body for function calls and database access
    const calls: string[] = [];
    const tablesAccessed: string[] = [];
    
    let i = startLine + 1;
    let braceCount = 1;
    
    while (i < lines.length && braceCount > 0) {
      const bodyLine = lines[i].trim();
      
      if (bodyLine.includes('{')) braceCount++;
      if (bodyLine.includes('}')) braceCount--;
      
      // Extract function calls
      const callMatches = bodyLine.match(/(\w+(?:\.\w+)*)\s*\(/g);
      if (callMatches) {
        for (const call of callMatches) {
          const callName = call.replace(/\s*\($/, '');
          calls.push(callName);
        }
      }
      
      // Extract database table access patterns
      const tablePatterns = [
        /\.Table\s*\(\s*["`](\w+)["`]\s*\)/g,
        /\.Model\s*\(\s*&(\w+){/g,
        /SELECT\s+.+?\s+FROM\s+(\w+)/gi,
        /INSERT\s+INTO\s+(\w+)/gi,
        /UPDATE\s+(\w+)\s+SET/gi,
        /DELETE\s+FROM\s+(\w+)/gi,
      ];
      
      for (const pattern of tablePatterns) {
        const matches = bodyLine.match(pattern);
        if (matches) {
          for (const match of matches) {
            const tableMatch = match.match(/(\w+)/);
            if (tableMatch) {
              tablesAccessed.push(tableMatch[1]);
            }
          }
        }
      }
      
      i++;
    }

    return {
      type: 'function',
      name: funcName,
      file: filePath,
      line: startLine + 1,
      dependencies: [],
      receiver: receiver ? `${receiver} ${receiverType}` : undefined,
      parameters,
      returnType: returnType.trim(),
      calls: [...new Set(calls)], // Remove duplicates
      tables_accessed: [...new Set(tablesAccessed)],
    };
  }

  private parseParameters(paramString: string): ASTParameter[] {
    if (!paramString.trim()) return [];
    
    const parameters: ASTParameter[] = [];
    const params = paramString.split(',');
    
    for (const param of params) {
      const trimmed = param.trim();
      const parts = trimmed.split(/\s+/);
      
      if (parts.length >= 2) {
        parameters.push({
          name: parts[0],
          type: parts.slice(1).join(' '),
        });
      } else if (parts.length === 1 && parts[0]) {
        // Type only parameter
        parameters.push({
          name: '',
          type: parts[0],
        });
      }
    }
    
    return parameters;
  }

  private extractDatabaseAccess(func: GoFunction): DatabaseAccess[] {
    const access: DatabaseAccess[] = [];
    
    for (const table of func.tables_accessed) {
      // Determine operation type from function calls
      let operation: 'select' | 'insert' | 'update' | 'delete' = 'select';
      
      const funcName = func.name.toLowerCase();
      const calls = func.calls.join(' ').toLowerCase();
      
      if (funcName.includes('create') || funcName.includes('insert') || calls.includes('create')) {
        operation = 'insert';
      } else if (funcName.includes('update') || calls.includes('update')) {
        operation = 'update';
      } else if (funcName.includes('delete') || calls.includes('delete')) {
        operation = 'delete';
      }
      
      access.push({
        table,
        operation,
        file: func.file,
        function: func.name,
      });
    }
    
    return access;
  }

  // Advanced analysis methods
  async findSemanticClusters(
    structs: GoStruct[],
    interfaces: GoInterface[],
    functions: GoFunction[]
  ): Promise<ModuleCandidateNode[]> {
    console.log('🧠 セマンティッククラスター分析を実行中...');
    
    // Extract semantic keywords from names
    const allNodes = [...structs, ...interfaces, ...functions];
    const semanticGroups = this.extractSemanticGroups(allNodes);
    
    // Create module candidates based on semantic similarity
    const candidates: ModuleCandidateNode[] = [];
    
    for (const [semantic, nodes] of semanticGroups.entries()) {
      if (nodes.length < 2) continue; // Skip single-item groups
      
      const files = [...new Set(nodes.map(n => n.file))];
      const moduleStructs = structs.filter(s => nodes.includes(s));
      const moduleInterfaces = interfaces.filter(i => nodes.includes(i));
      const moduleFunctions = functions.filter(f => nodes.includes(f));
      
      const cohesionScore = this.calculateSemanticCohesion(nodes);
      const externalDeps = this.findExternalDependencies(nodes, allNodes);
      
      candidates.push({
        name: semantic,
        files,
        structs: moduleStructs,
        interfaces: moduleInterfaces,
        functions: moduleFunctions,
        database_access: [], // Will be populated later
        semantic_keywords: [semantic],
        cohesion_score: cohesionScore,
        external_dependencies: externalDeps,
      });
    }
    
    // Merge similar candidates
    const mergedCandidates = this.mergeSimilarCandidates(candidates);
    
    console.log(`🎯 ${mergedCandidates.length}個のモジュール候補を発見`);
    
    return mergedCandidates;
  }

  private extractSemanticGroups(nodes: ASTNode[]): Map<string, ASTNode[]> {
    const groups = new Map<string, ASTNode[]>();
    
    const keywords = [
      'user', 'customer', 'account', 'auth',
      'fish', 'school', 'preserve', 'pond',
      'medicine', 'drug', 'treatment', 'vaccine',
      'daily', 'feeding', 'weight', 'food',
      'environment', 'water', 'temperature',
      'shipment', 'transport', 'delivery',
      'graph', 'trace', 'path', 'node',
      'report', 'analytics', 'metrics',
      'notification', 'alert', 'message',
    ];
    
    for (const node of nodes) {
      const nodeName = node.name.toLowerCase();
      const fileName = path.basename(node.file).toLowerCase();
      
      let matched = false;
      
      for (const keyword of keywords) {
        if (nodeName.includes(keyword) || fileName.includes(keyword)) {
          if (!groups.has(keyword)) {
            groups.set(keyword, []);
          }
          groups.get(keyword)!.push(node);
          matched = true;
          break;
        }
      }
      
      // If no keyword match, group by directory
      if (!matched) {
        const dir = path.dirname(node.file);
        const dirName = path.basename(dir);
        
        if (!groups.has(dirName)) {
          groups.set(dirName, []);
        }
        groups.get(dirName)!.push(node);
      }
    }
    
    return groups;
  }

  private calculateSemanticCohesion(nodes: ASTNode[]): number {
    if (nodes.length <= 1) return 1.0;
    
    // Calculate cohesion based on shared dependencies and naming patterns
    let totalConnections = 0;
    let actualConnections = 0;
    
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        totalConnections++;
        
        const node1 = nodes[i];
        const node2 = nodes[j];
        
        // Check for shared dependencies
        const sharedDeps = node1.dependencies.filter(dep => 
          node2.dependencies.includes(dep)
        );
        
        if (sharedDeps.length > 0) {
          actualConnections++;
          continue;
        }
        
        // Check for naming similarity
        const similarity = this.calculateNameSimilarity(node1.name, node2.name);
        if (similarity > 0.5) {
          actualConnections += similarity;
        }
      }
    }
    
    return totalConnections > 0 ? actualConnections / totalConnections : 0;
  }

  private calculateNameSimilarity(name1: string, name2: string): number {
    // Simple Levenshtein distance-based similarity
    const distance = this.levenshteinDistance(name1.toLowerCase(), name2.toLowerCase());
    const maxLength = Math.max(name1.length, name2.length);
    return maxLength > 0 ? 1 - (distance / maxLength) : 0;
  }

  private levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + indicator
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private findExternalDependencies(moduleNodes: ASTNode[], allNodes: ASTNode[]): string[] {
    const moduleNames = new Set(moduleNodes.map(n => n.name));
    const externalDeps = new Set<string>();
    
    for (const node of moduleNodes) {
      for (const dep of node.dependencies) {
        if (!moduleNames.has(dep)) {
          // Check if it's an internal dependency (exists in project)
          const isInternal = allNodes.some(n => n.name === dep);
          if (isInternal) {
            externalDeps.add(dep);
          }
        }
      }
    }
    
    return Array.from(externalDeps);
  }

  private mergeSimilarCandidates(candidates: ModuleCandidateNode[]): ModuleCandidateNode[] {
    const merged: ModuleCandidateNode[] = [];
    const processed = new Set<number>();
    
    for (let i = 0; i < candidates.length; i++) {
      if (processed.has(i)) continue;
      
      const candidate = candidates[i];
      const similar: ModuleCandidateNode[] = [candidate];
      
      for (let j = i + 1; j < candidates.length; j++) {
        if (processed.has(j)) continue;
        
        const other = candidates[j];
        
        // Check for overlap in files or semantic similarity
        const fileOverlap = candidate.files.filter(f => other.files.includes(f)).length;
        const semanticSimilarity = this.calculateSemanticSimilarity(
          candidate.semantic_keywords,
          other.semantic_keywords
        );
        
        if (fileOverlap > 0 || semanticSimilarity > 0.7) {
          similar.push(other);
          processed.add(j);
        }
      }
      
      processed.add(i);
      
      if (similar.length > 1) {
        // Merge similar candidates
        const mergedCandidate = this.mergeModuleCandidates(similar);
        merged.push(mergedCandidate);
      } else {
        merged.push(candidate);
      }
    }
    
    return merged;
  }

  private calculateSemanticSimilarity(keywords1: string[], keywords2: string[]): number {
    const set1 = new Set(keywords1);
    const set2 = new Set(keywords2);
    const intersection = new Set([...set1].filter(x => set2.has(x)));
    const union = new Set([...set1, ...set2]);
    
    return union.size > 0 ? intersection.size / union.size : 0;
  }

  private mergeModuleCandidates(candidates: ModuleCandidateNode[]): ModuleCandidateNode {
    const allFiles = [...new Set(candidates.flatMap(c => c.files))];
    const allStructs = [...new Set(candidates.flatMap(c => c.structs))];
    const allInterfaces = [...new Set(candidates.flatMap(c => c.interfaces))];
    const allFunctions = [...new Set(candidates.flatMap(c => c.functions))];
    const allKeywords = [...new Set(candidates.flatMap(c => c.semantic_keywords))];
    const allExternalDeps = [...new Set(candidates.flatMap(c => c.external_dependencies))];
    
    // Choose the best name (most common keyword or most descriptive)
    const name = this.chooseBestModuleName(allKeywords, candidates);
    
    // Average cohesion scores
    const avgCohesion = candidates.reduce((sum, c) => sum + c.cohesion_score, 0) / candidates.length;
    
    return {
      name,
      files: allFiles,
      structs: allStructs,
      interfaces: allInterfaces,
      functions: allFunctions,
      database_access: [],
      semantic_keywords: allKeywords,
      cohesion_score: avgCohesion,
      external_dependencies: allExternalDeps,
    };
  }

  private chooseBestModuleName(keywords: string[], candidates: ModuleCandidateNode[]): string {
    // Prefer more specific/business domain keywords
    const priorityKeywords = ['customer', 'fish', 'medicine', 'feeding', 'environment'];
    
    for (const priority of priorityKeywords) {
      if (keywords.includes(priority)) {
        return priority;
      }
    }
    
    // Fall back to most common keyword
    const keywordCounts = new Map<string, number>();
    for (const candidate of candidates) {
      for (const keyword of candidate.semantic_keywords) {
        keywordCounts.set(keyword, (keywordCounts.get(keyword) || 0) + 1);
      }
    }
    
    let bestKeyword = keywords[0];
    let maxCount = 0;
    
    for (const [keyword, count] of keywordCounts) {
      if (count > maxCount) {
        maxCount = count;
        bestKeyword = keyword;
      }
    }
    
    return bestKeyword;
  }
}