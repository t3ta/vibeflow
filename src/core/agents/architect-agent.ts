import * as fs from 'fs';
import { DomainMap, DomainBoundary, VibeFlowConfig, BoundaryConfig } from '../types/config.js';
import { ConfigLoader } from '../utils/config-loader.js';
import { VibeFlowPaths } from '../utils/file-paths.js';

export interface ArchitecturalPlan {
  overview: string;
  modules: ModuleDesign[];
  migration_strategy: MigrationStrategy;
  implementation_guide: ImplementationGuide;
  quality_gates: QualityGate[];
}

export interface ModuleDesign {
  name: string;
  description: string;
  current_state: ModuleState;
  target_state: ModuleState;
  refactoring_actions: RefactoringAction[];
  dependencies: ModuleDependency[];
  interfaces: InterfaceDefinition[];
}

export interface ModuleState {
  files: string[];
  lines_of_code: number;
  test_coverage: number;
  cyclomatic_complexity: number;
  coupling_score: number;
  cohesion_score: number;
}

export interface RefactoringAction {
  type: 'extract_interface' | 'move_file' | 'create_value_object' | 'split_function' | 'introduce_event';
  description: string;
  files_affected: string[];
  priority: 'high' | 'medium' | 'low';
  effort_estimate: string;
}

export interface ModuleDependency {
  module: string;
  type: 'interface' | 'event' | 'shared_data';
  description: string;
}

export interface InterfaceDefinition {
  name: string;
  purpose: string;
  methods: string[];
  go_definition?: string;
  typescript_definition?: string;
  python_definition?: string;
}

export interface MigrationStrategy {
  phases: MigrationPhase[];
  rollback_plan: string;
  validation_steps: string[];
}

export interface MigrationPhase {
  name: string;
  duration: string;
  modules: string[];
  actions: RefactoringAction[];
  success_criteria: string[];
  risks: Risk[];
}

export interface Risk {
  description: string;
  probability: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  mitigation: string;
}

export interface ImplementationGuide {
  directory_structure: DirectoryStructure;
  naming_conventions: NamingConvention[];
  code_patterns: CodePattern[];
  testing_strategy: TestingStrategy;
}

export interface DirectoryStructure {
  [module: string]: string[];
}

export interface NamingConvention {
  type: string;
  pattern: string;
  example: string;
}

export interface CodePattern {
  name: string;
  description: string;
  example: string;
  language: string;
}

export interface TestingStrategy {
  unit_tests: string;
  integration_tests: string;
  e2e_tests: string;
  coverage_target: number;
}

export interface QualityGate {
  name: string;
  description: string;
  metric: string;
  threshold: number;
  current_value: number;
}

export interface ArchitectAnalysisResult {
  plan: ArchitecturalPlan;
  outputPath: string;
}

export class ArchitectAgent {
  private config: VibeFlowConfig;
  private boundaryConfig: BoundaryConfig | null;
  private paths: VibeFlowPaths;

  constructor(projectRoot: string, configPath?: string, boundaryConfigPath?: string) {
    this.config = ConfigLoader.loadVibeFlowConfig(configPath);
    this.boundaryConfig = ConfigLoader.loadBoundaryConfig(boundaryConfigPath);
    this.paths = new VibeFlowPaths(projectRoot);
  }

  async generateArchitecturalPlan(domainMapPath: string): Promise<ArchitectAnalysisResult> {
    console.log('🏗️  モジュラーアーキテクチャを設計中...');
    
    // 1. ドメインマップ読み込み
    const domainMap = this.loadDomainMap(domainMapPath);
    
    // 2. モジュール設計
    const modules = this.designModules(domainMap.boundaries);
    
    // 3. 移行戦略策定
    const migrationStrategy = this.createMigrationStrategy(modules);
    
    // 4. 実装ガイド作成
    const implementationGuide = this.createImplementationGuide(modules);
    
    // 5. 品質ゲート定義
    const qualityGates = this.defineQualityGates(domainMap);
    
    // 6. アーキテクチャ計画統合
    const plan: ArchitecturalPlan = {
      overview: this.generateOverview(domainMap, modules),
      modules,
      migration_strategy: migrationStrategy,
      implementation_guide: implementationGuide,
      quality_gates: qualityGates,
    };

    // 7. 計画出力
    const outputPath = this.paths.planPath;
    const planMarkdown = this.generatePlanMarkdown(plan);
    fs.writeFileSync(outputPath, planMarkdown);
    
    console.log(`✅ アーキテクチャ計画を生成しました: ${this.paths.getRelativePath(outputPath)}`);
    
    return { plan, outputPath };
  }

  private loadDomainMap(filePath: string): DomainMap {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Domain map file not found: ${filePath}`);
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as DomainMap;
  }

  private designModules(boundaries: DomainBoundary[]): ModuleDesign[] {
    return boundaries.map(boundary => this.designModule(boundary));
  }

  private designModule(boundary: DomainBoundary): ModuleDesign {
    const currentState: ModuleState = {
      files: boundary.files,
      lines_of_code: boundary.files.length * 100, // Rough estimate
      test_coverage: this.config.refactoring.quality_gates.test_coverage.current,
      cyclomatic_complexity: 5, // Default estimate
      coupling_score: boundary.coupling_score ?? boundary.metrics?.coupling ?? 0,
      cohesion_score: boundary.cohesion_score ?? boundary.metrics?.cohesion ?? 0,
    };

    const targetState: ModuleState = {
      ...currentState,
      test_coverage: this.config.refactoring.quality_gates.test_coverage.minimum,
      coupling_score: Math.max(0, (boundary.coupling_score ?? boundary.metrics?.coupling ?? 0) - 0.3),
      cohesion_score: Math.min(1, (boundary.cohesion_score ?? boundary.metrics?.cohesion ?? 0) + 0.2),
    };

    const refactoringActions = this.generateRefactoringActions(boundary, currentState, targetState);
    const dependencies = this.extractModuleDependencies(boundary);
    const interfaces = this.defineModuleInterfaces(boundary);

    return {
      name: boundary.name,
      description: boundary.description,
      current_state: currentState,
      target_state: targetState,
      refactoring_actions: refactoringActions,
      dependencies,
      interfaces,
    };
  }

  private generateRefactoringActions(
    boundary: DomainBoundary,
    currentState: ModuleState,
    targetState: ModuleState
  ): RefactoringAction[] {
    const actions: RefactoringAction[] = [];

    // High coupling → Interface extraction
    if (currentState.coupling_score > 0.5) {
      actions.push({
        type: 'extract_interface',
        description: `${boundary.name}モジュールの外部依存を削減するためのインターフェース抽出`,
        files_affected: (boundary.dependencies?.internal ?? []).slice(0, 3),
        priority: 'high',
        effort_estimate: '1-2週間',
      });
    }

    // Value objects for primitive obsession
    const valueObjects = this.config.refactoring.value_objects.priority_high;
    if (valueObjects.length > 0) {
      actions.push({
        type: 'create_value_object',
        description: `プリミティブ型の誤用を防ぐための値オブジェクト作成: ${valueObjects.join(', ')}`,
        files_affected: boundary.files.filter(f => f.includes('model') || f.includes('type')),
        priority: 'high',
        effort_estimate: '3-5日',
      });
    }

    // Low test coverage → Test enhancement
    if (currentState.test_coverage < targetState.test_coverage) {
      actions.push({
        type: 'split_function',
        description: `テストカバレッジ向上のための関数分割とテスト追加`,
        files_affected: boundary.files,
        priority: 'medium',
        effort_estimate: '1-2週間',
      });
    }

    // Circular dependencies → Event-driven architecture
    if (boundary.circular_dependencies && boundary.circular_dependencies.length > 0) {
      actions.push({
        type: 'introduce_event',
        description: `循環依存解消のためのイベント駆動アーキテクチャ導入`,
        files_affected: boundary.circular_dependencies,
        priority: 'high',
        effort_estimate: '2-3週間',
      });
    }

    return actions;
  }

  private extractModuleDependencies(boundary: DomainBoundary): ModuleDependency[] {
    const dependencies: ModuleDependency[] = [];
    
    if (this.boundaryConfig) {
      const moduleConfig = this.boundaryConfig.modules[boundary.name];
      if (moduleConfig) {
        moduleConfig.depends_on?.forEach(dep => {
          dependencies.push({
            module: dep.split('.')[0], // Extract module name from interface path
            type: 'interface',
            description: `${dep}インターフェースに依存`,
          });
        });
      }
    }

    return dependencies;
  }

  private defineModuleInterfaces(boundary: DomainBoundary): InterfaceDefinition[] {
    const interfaces: InterfaceDefinition[] = [];
    
    if (this.boundaryConfig) {
      const moduleConfig = this.boundaryConfig.modules[boundary.name];
      if (moduleConfig?.provides_interfaces) {
        moduleConfig.provides_interfaces.forEach(interfaceName => {
          interfaces.push({
            name: interfaceName,
            purpose: `${boundary.name}モジュールの主要サービスインターフェース`,
            methods: ['Get', 'Create', 'Update', 'Delete'], // Default CRUD
            go_definition: this.generateGoInterface(interfaceName),
          });
        });
      }
    }

    return interfaces;
  }

  private generateGoInterface(interfaceName: string): string {
    const serviceName = interfaceName.replace('.', '');
    return `type ${serviceName} interface {
    Get(ctx context.Context, id string) (*Entity, error)
    Create(ctx context.Context, entity *Entity) error
    Update(ctx context.Context, entity *Entity) error
    Delete(ctx context.Context, id string) error
}`;
  }

  private createMigrationStrategy(modules: ModuleDesign[]): MigrationStrategy {
    const configPhases = this.config.migration.phases;
    const phases: MigrationPhase[] = [];

    for (const [phaseKey, phaseConfig] of Object.entries(configPhases)) {
      const phaseModules = modules.filter(m => phaseConfig.modules.includes(m.name));
      const phaseActions = phaseModules.flatMap(m => m.refactoring_actions);

      phases.push({
        name: phaseConfig.name,
        duration: phaseConfig.duration,
        modules: phaseConfig.modules,
        actions: phaseActions,
        success_criteria: [
          'すべてのテストが通る',
          'パフォーマンスが10%以内の劣化',
          'メトリクスが目標値を達成',
        ],
        risks: [
          {
            description: 'マイグレーション中のデータ不整合',
            probability: 'medium',
            impact: 'high',
            mitigation: 'ロールバック計画の準備とバックアップ作成',
          },
        ],
      });
    }

    return {
      phases,
      rollback_plan: 'Gitを使用した段階的ロールバック。各フェーズ完了後にタグ作成。',
      validation_steps: [
        'テストスイート実行',
        'パフォーマンステスト',
        'セキュリティスキャン',
        'コードメトリクス検証',
      ],
    };
  }

  private createImplementationGuide(modules: ModuleDesign[]): ImplementationGuide {
    const directoryStructure: DirectoryStructure = {};
    
    modules.forEach(module => {
      directoryStructure[module.name] = [
        `internal/${module.name}/`,
        `internal/${module.name}/domain/`,
        `internal/${module.name}/usecase/`,
        `internal/${module.name}/repository/`,
        `internal/${module.name}/handler/`,
      ];
    });

    return {
      directory_structure: directoryStructure,
      naming_conventions: [
        {
          type: 'Interface',
          pattern: 'I{ServiceName}',
          example: 'ICustomerService',
        },
        {
          type: 'Repository',
          pattern: '{Entity}Repository',
          example: 'CustomerRepository',
        },
      ],
      code_patterns: [
        {
          name: 'Dependency Injection',
          description: 'Google Wireを使用した依存性注入',
          example: '//+build wireinject',
          language: 'go',
        },
      ],
      testing_strategy: {
        unit_tests: 'モジュール内の関数・メソッドレベル',
        integration_tests: 'モジュール間のインターフェーステスト',
        e2e_tests: 'APIエンドポイントレベル',
        coverage_target: this.config.refactoring.quality_gates.test_coverage.minimum,
      },
    };
  }

  private defineQualityGates(domainMap: DomainMap): QualityGate[] {
    return [
      {
        name: 'テストカバレッジ',
        description: '最低テストカバレッジ要件',
        metric: 'coverage_percentage',
        threshold: this.config.refactoring.quality_gates.test_coverage.minimum,
        current_value: this.config.refactoring.quality_gates.test_coverage.current,
      },
      {
        name: 'モジュラリティスコア',
        description: '全体的なモジュール性評価',
        metric: 'modularity_score',
        threshold: 0.7,
        current_value: domainMap.metrics.modularity_score,
      },
      {
        name: '循環依存',
        description: '循環依存の数',
        metric: 'circular_dependencies_count',
        threshold: 0,
        current_value: domainMap.boundaries.reduce((sum, b) => sum + (b.circular_dependencies?.length || 0), 0),
      },
    ];
  }

  private generateOverview(domainMap: DomainMap, modules: ModuleDesign[]): string {
    return `# ${domainMap.project} リファクタリング計画

## 現状分析
- 総ファイル数: ${domainMap.total_files}
- 識別されたモジュール: ${modules.length}個
- 全体的凝集度: ${domainMap.metrics.overall_cohesion}
- 全体的結合度: ${domainMap.metrics.overall_coupling}
- モジュラリティスコア: ${domainMap.metrics.modularity_score}

## 目標アーキテクチャ
${this.config.refactoring.target_architecture.pattern}パターンによる${this.config.refactoring.target_architecture.module_structure}アーキテクチャへの移行。

## 主要な改善点
- テストカバレッジを${this.config.refactoring.quality_gates.test_coverage.current}%から${this.config.refactoring.quality_gates.test_coverage.minimum}%に向上
- モジュール間の結合度削減
- 値オブジェクトによる型安全性向上
- イベント駆動による循環依存解消`;
  }

  private generatePlanMarkdown(plan: ArchitecturalPlan): string {
    let markdown = `# アーキテクチャ計画書

${plan.overview}

## モジュール設計

`;

    plan.modules.forEach(module => {
      markdown += `### ${module.name}

**説明**: ${module.description}

**現状**:
- ファイル数: ${module.current_state.files.length}
- 結合度: ${module.current_state.coupling_score}
- 凝集度: ${module.current_state.cohesion_score}

**目標**:
- 結合度: ${module.target_state.coupling_score}
- 凝集度: ${module.target_state.cohesion_score}

**リファクタリングアクション**:
${module.refactoring_actions.map(action => `- ${action.description} (${action.priority})`).join('\n')}

`;
    });

    markdown += `## 移行戦略

`;

    plan.migration_strategy.phases.forEach((phase, index) => {
      markdown += `### フェーズ${index + 1}: ${phase.name}

- 期間: ${phase.duration}
- 対象モジュール: ${phase.modules.join(', ')}
- アクション数: ${phase.actions.length}

`;
    });

    markdown += `## 品質ゲート

`;

    plan.quality_gates.forEach(gate => {
      markdown += `- **${gate.name}**: ${gate.current_value} → ${gate.threshold} (${gate.description})
`;
    });

    return markdown;
  }
}