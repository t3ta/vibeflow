import * as fs from 'fs';
import * as path from 'path';
import { ArchitecturalPlan, ModuleDesign, RefactoringAction } from './architect-agent.js';
import { VibeFlowConfig } from '../types/config.js';
import { ConfigLoader } from '../utils/config-loader.js';
import { VibeFlowPaths } from '../utils/file-paths.js';

export interface CodePatch {
  file: string;
  action: 'create' | 'modify' | 'delete' | 'move';
  original_content?: string;
  new_content: string;
  description: string;
}

export interface RefactorPlan {
  patches: CodePatch[];
  summary: RefactorSummary;
}

export interface RefactorSummary {
  total_patches: number;
  files_affected: number;
  actions_by_type: Record<string, number>;
  estimated_effort: string;
}

export interface RefactorAnalysisResult {
  plan: RefactorPlan;
  outputPath: string;
}

export class RefactorAgent {
  private config: VibeFlowConfig;
  private projectRoot: string;
  private paths: VibeFlowPaths;

  constructor(projectRoot: string, configPath?: string) {
    this.config = ConfigLoader.loadVibeFlowConfig(configPath);
    this.projectRoot = projectRoot;
    this.paths = new VibeFlowPaths(projectRoot);
  }

  async generateRefactorPlan(architecturalPlanPath: string): Promise<RefactorAnalysisResult> {
    console.log('🔧 Go言語リファクタリングパッチを生成中...');
    
    // 1. アーキテクチャ計画読み込み
    const architecturalPlan = this.loadArchitecturalPlan(architecturalPlanPath);
    
    // 2. パッチ生成
    const patches = await this.generatePatches(architecturalPlan);
    
    // 3. サマリ作成
    const summary = this.createSummary(patches);
    
    // 4. リファクタリング計画統合
    const plan: RefactorPlan = {
      patches,
      summary,
    };

    // 5. パッチファイル出力
    const outputPath = this.paths.patchesDir;
    await this.savePatches(plan, outputPath);
    
    console.log(`✅ ${patches.length}個のパッチを生成しました: ${this.paths.getRelativePath(outputPath)}`);
    
    return { plan, outputPath };
  }

  private loadArchitecturalPlan(filePath: string): ArchitecturalPlan {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Architectural plan file not found: ${filePath}`);
    }
    
    // For now, assume the plan is stored as JSON
    // In a real implementation, we'd parse the markdown
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Since we generated markdown, we need to parse it or use a JSON version
    // For simplicity, let's create a mock architectural plan
    return this.createMockArchitecturalPlan();
  }

  private createMockArchitecturalPlan(): ArchitecturalPlan {
    // This is a simplified version for demonstration
    return {
      overview: "Mock architectural plan",
      modules: [
        {
          name: "customer",
          description: "顧客管理",
          current_state: {
            files: ["handlers/users.go", "repositories/user.go"],
            lines_of_code: 500,
            test_coverage: 18.6,
            cyclomatic_complexity: 8,
            coupling_score: 0.7,
            cohesion_score: 0.4,
          },
          target_state: {
            files: ["internal/customer/handler.go", "internal/customer/repository.go"],
            lines_of_code: 500,
            test_coverage: 50,
            cyclomatic_complexity: 5,
            coupling_score: 0.4,
            cohesion_score: 0.6,
          },
          refactoring_actions: [
            {
              type: 'extract_interface',
              description: 'CustomerServiceインターフェースの抽出',
              files_affected: ["repositories/user.go", "services/user.go"],
              priority: 'high',
              effort_estimate: '1週間',
            },
            {
              type: 'move_file',
              description: 'ファイルをモジュール構造に移行',
              files_affected: ["handlers/users.go"],
              priority: 'medium',
              effort_estimate: '2日',
            },
          ],
          dependencies: [],
          interfaces: [],
        },
      ],
      migration_strategy: {
        phases: [],
        rollback_plan: "",
        validation_steps: [],
      },
      implementation_guide: {
        directory_structure: {},
        naming_conventions: [],
        code_patterns: [],
        testing_strategy: {
          unit_tests: "",
          integration_tests: "",
          e2e_tests: "",
          coverage_target: 50,
        },
      },
      quality_gates: [],
    };
  }

  private async generatePatches(plan: ArchitecturalPlan): Promise<CodePatch[]> {
    const patches: CodePatch[] = [];

    for (const module of plan.modules) {
      const modulePatches = await this.generateModulePatches(module);
      patches.push(...modulePatches);
    }

    return patches;
  }

  private async generateModulePatches(module: ModuleDesign): Promise<CodePatch[]> {
    const patches: CodePatch[] = [];

    for (const action of module.refactoring_actions) {
      switch (action.type) {
        case 'extract_interface':
          patches.push(...await this.generateInterfaceExtractionPatches(module, action));
          break;
        case 'move_file':
          patches.push(...await this.generateFileMovePatches(module, action));
          break;
        case 'create_value_object':
          patches.push(...await this.generateValueObjectPatches(module, action));
          break;
        case 'introduce_event':
          patches.push(...await this.generateEventPatches(module, action));
          break;
      }
    }

    return patches;
  }

  private async generateInterfaceExtractionPatches(
    module: ModuleDesign,
    action: RefactoringAction
  ): Promise<CodePatch[]> {
    const patches: CodePatch[] = [];
    const interfaceName = `I${this.capitalize(module.name)}Service`;
    
    // Create interface file
    const interfaceContent = this.generateGoInterface(interfaceName, module.name);
    patches.push({
      file: `internal/${module.name}/interface.go`,
      action: 'create',
      new_content: interfaceContent,
      description: `${interfaceName}インターフェースの作成`,
    });

    // Modify existing service files to implement interface
    for (const file of action.files_affected) {
      if (fs.existsSync(path.join(this.projectRoot, file))) {
        const originalContent = fs.readFileSync(path.join(this.projectRoot, file), 'utf8');
        const modifiedContent = this.addInterfaceImplementation(originalContent, interfaceName);
        
        patches.push({
          file,
          action: 'modify',
          original_content: originalContent,
          new_content: modifiedContent,
          description: `${file}に${interfaceName}実装を追加`,
        });
      }
    }

    return patches;
  }

  private async generateFileMovePatches(
    module: ModuleDesign,
    action: RefactoringAction
  ): Promise<CodePatch[]> {
    const patches: CodePatch[] = [];

    for (const file of action.files_affected) {
      const sourcePath = path.join(this.projectRoot, file);
      if (fs.existsSync(sourcePath)) {
        const originalContent = fs.readFileSync(sourcePath, 'utf8');
        const targetPath = this.generateTargetPath(file, module.name);
        
        // Create new file in target location
        patches.push({
          file: targetPath,
          action: 'create',
          new_content: this.updatePackageDeclaration(originalContent, module.name),
          description: `${file}を${targetPath}に移動`,
        });
        
        // Delete original file
        patches.push({
          file,
          action: 'delete',
          new_content: '',
          description: `元の${file}を削除`,
        });
      }
    }

    return patches;
  }

  private async generateValueObjectPatches(
    module: ModuleDesign,
    action: RefactoringAction
  ): Promise<CodePatch[]> {
    const patches: CodePatch[] = [];
    const valueObjects = this.config.refactoring.value_objects.priority_high;

    for (const vo of valueObjects) {
      const voContent = this.generateValueObject(vo, module.name);
      patches.push({
        file: `internal/${module.name}/domain/${vo.toLowerCase()}.go`,
        action: 'create',
        new_content: voContent,
        description: `${vo}値オブジェクトの作成`,
      });
    }

    return patches;
  }

  private async generateEventPatches(
    module: ModuleDesign,
    action: RefactoringAction
  ): Promise<CodePatch[]> {
    const patches: CodePatch[] = [];
    
    // Create event definitions
    const eventContent = this.generateEventDefinitions(module.name);
    patches.push({
      file: `internal/${module.name}/domain/events.go`,
      action: 'create',
      new_content: eventContent,
      description: `${module.name}モジュールのイベント定義`,
    });

    // Create event publisher
    const publisherContent = this.generateEventPublisher(module.name);
    patches.push({
      file: `internal/${module.name}/event_publisher.go`,
      action: 'create',
      new_content: publisherContent,
      description: `${module.name}モジュールのイベントパブリッシャー`,
    });

    return patches;
  }

  private generateGoInterface(interfaceName: string, moduleName: string): string {
    return `package ${moduleName}

import (
    "context"
)

// ${interfaceName} defines the contract for ${moduleName} operations
type ${interfaceName} interface {
    Get(ctx context.Context, id string) (*Entity, error)
    Create(ctx context.Context, entity *Entity) error
    Update(ctx context.Context, entity *Entity) error
    Delete(ctx context.Context, id string) error
}

// Entity represents the main entity for ${moduleName} module
type Entity struct {
    ID        string \`json:"id" gorm:"primaryKey"\`
    CreatedAt time.Time \`json:"created_at"\`
    UpdatedAt time.Time \`json:"updated_at"\`
}
`;
  }

  private addInterfaceImplementation(content: string, interfaceName: string): string {
    // Simple implementation - in reality, this would be more sophisticated
    const lines = content.split('\n');
    const packageIndex = lines.findIndex(line => line.startsWith('package '));
    
    if (packageIndex !== -1) {
      // Add interface implementation comment
      lines.splice(packageIndex + 1, 0, '', `// Implements ${interfaceName} interface`);
    }

    return lines.join('\n');
  }

  private generateTargetPath(originalPath: string, moduleName: string): string {
    const fileName = path.basename(originalPath);
    const fileType = this.inferFileType(originalPath);
    
    return `internal/${moduleName}/${fileType}/${fileName}`;
  }

  private inferFileType(filePath: string): string {
    if (filePath.includes('handler') || filePath.includes('controller')) return 'handler';
    if (filePath.includes('repository')) return 'repository';
    if (filePath.includes('service') || filePath.includes('usecase')) return 'usecase';
    if (filePath.includes('model') || filePath.includes('domain')) return 'domain';
    return 'misc';
  }

  private updatePackageDeclaration(content: string, moduleName: string): string {
    return content.replace(/^package\s+\w+/, `package ${moduleName}`);
  }

  private generateValueObject(valueObjectName: string, moduleName: string): string {
    return `package domain

import (
    "errors"
    "fmt"
)

// ${valueObjectName} represents a value object for ${valueObjectName.toLowerCase()}
type ${valueObjectName} struct {
    value string
}

// New${valueObjectName} creates a new ${valueObjectName} with validation
func New${valueObjectName}(value string) (*${valueObjectName}, error) {
    if value == "" {
        return nil, errors.New("${valueObjectName.toLowerCase()} cannot be empty")
    }
    
    return &${valueObjectName}{value: value}, nil
}

// String returns the string representation
func (v ${valueObjectName}) String() string {
    return v.value
}

// Value returns the underlying value
func (v ${valueObjectName}) Value() string {
    return v.value
}

// Equals checks equality with another ${valueObjectName}
func (v ${valueObjectName}) Equals(other ${valueObjectName}) bool {
    return v.value == other.value
}
`;
  }

  private generateEventDefinitions(moduleName: string): string {
    const capitalizedModule = this.capitalize(moduleName);
    return `package domain

import (
    "time"
)

// Event represents a domain event
type Event interface {
    AggregateID() string
    EventType() string
    OccurredOn() time.Time
}

// ${capitalizedModule}Created event
type ${capitalizedModule}Created struct {
    aggregateID string
    occurredOn  time.Time
    Data        ${capitalizedModule}CreatedData
}

type ${capitalizedModule}CreatedData struct {
    ID   string \`json:"id"\`
    Name string \`json:"name"\`
}

func New${capitalizedModule}Created(aggregateID string, data ${capitalizedModule}CreatedData) *${capitalizedModule}Created {
    return &${capitalizedModule}Created{
        aggregateID: aggregateID,
        occurredOn:  time.Now(),
        Data:        data,
    }
}

func (e ${capitalizedModule}Created) AggregateID() string { return e.aggregateID }
func (e ${capitalizedModule}Created) EventType() string   { return "${moduleName}.created" }
func (e ${capitalizedModule}Created) OccurredOn() time.Time { return e.occurredOn }
`;
  }

  private generateEventPublisher(moduleName: string): string {
    return `package ${moduleName}

import (
    "context"
    "${moduleName}/domain"
)

// EventPublisher publishes domain events
type EventPublisher interface {
    Publish(ctx context.Context, event domain.Event) error
}

// InMemoryEventPublisher is a simple in-memory event publisher
type InMemoryEventPublisher struct {
    handlers map[string][]EventHandler
}

// EventHandler handles domain events
type EventHandler func(ctx context.Context, event domain.Event) error

// NewInMemoryEventPublisher creates a new in-memory event publisher
func NewInMemoryEventPublisher() *InMemoryEventPublisher {
    return &InMemoryEventPublisher{
        handlers: make(map[string][]EventHandler),
    }
}

// Subscribe adds an event handler for a specific event type
func (p *InMemoryEventPublisher) Subscribe(eventType string, handler EventHandler) {
    p.handlers[eventType] = append(p.handlers[eventType], handler)
}

// Publish publishes an event to all registered handlers
func (p *InMemoryEventPublisher) Publish(ctx context.Context, event domain.Event) error {
    handlers, exists := p.handlers[event.EventType()]
    if !exists {
        return nil // No handlers registered
    }

    for _, handler := range handlers {
        if err := handler(ctx, event); err != nil {
            return err // In a real implementation, consider error handling strategy
        }
    }

    return nil
}
`;
  }

  private createSummary(patches: CodePatch[]): RefactorSummary {
    const actionsByType: Record<string, number> = {};
    const affectedFiles = new Set<string>();

    for (const patch of patches) {
      actionsByType[patch.action] = (actionsByType[patch.action] || 0) + 1;
      affectedFiles.add(patch.file);
    }

    return {
      total_patches: patches.length,
      files_affected: affectedFiles.size,
      actions_by_type: actionsByType,
      estimated_effort: this.estimateEffort(patches.length),
    };
  }

  private estimateEffort(patchCount: number): string {
    if (patchCount < 10) return '1-2日';
    if (patchCount < 30) return '1週間';
    if (patchCount < 100) return '2-3週間';
    return '1ヶ月以上';
  }

  private async savePatches(plan: RefactorPlan, outputDir: string): Promise<void> {
    // Create output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Save individual patch files
    for (const [index, patch] of plan.patches.entries()) {
      const patchFileName = `${String(index + 1).padStart(3, '0')}-${patch.action}-${path.basename(patch.file)}.patch`;
      const patchContent = this.generatePatchFile(patch);
      fs.writeFileSync(path.join(outputDir, patchFileName), patchContent);
    }

    // Save summary
    const summaryPath = path.join(outputDir, 'summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(plan.summary, null, 2));

    // Save patch manifest
    const manifestPath = path.join(outputDir, 'manifest.json');
    const manifest = {
      patches: plan.patches.map((patch, index) => ({
        id: index + 1,
        file: patch.file,
        action: patch.action,
        description: patch.description,
      })),
      summary: plan.summary,
    };
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  }

  private generatePatchFile(patch: CodePatch): string {
    let content = `# ${patch.description}\n\n`;
    content += `Action: ${patch.action}\n`;
    content += `File: ${patch.file}\n\n`;

    if (patch.action === 'modify' && patch.original_content) {
      content += `## Original Content\n\n\`\`\`go\n${patch.original_content}\n\`\`\`\n\n`;
    }

    content += `## New Content\n\n\`\`\`go\n${patch.new_content}\n\`\`\`\n`;

    return content;
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}