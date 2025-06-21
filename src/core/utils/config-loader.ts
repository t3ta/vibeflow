import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { VibeFlowConfig, VibeFlowConfigSchema, BoundaryConfig, BoundaryConfigSchema } from '../types/config.js';

export class ConfigLoader {
  static loadVibeFlowConfig(configPath?: string): VibeFlowConfig {
    const defaultPath = 'vibeflow.config.yaml';
    const filePath = configPath || defaultPath;
    
    if (!fs.existsSync(filePath)) {
      // Return default config if file doesn't exist
      return {
        project: {
          name: 'auto-discovered-project',
          language: 'go',
          root: '.'
        },
        analysis: {
          entry_points: ['main.go', 'cmd/'],
          exclude_patterns: ['**/*_test.go', '**/vendor/**', '**/.git/**'],
          include_patterns: ['**/*.go']
        },
        boundaries: {
          target_modules: {}
        },
        refactoring: {
          target_architecture: {
            pattern: 'clean-arch',
            module_structure: 'layered'
          },
          value_objects: {
            priority_high: ['User', 'Order', 'Product'],
            priority_medium: ['Event', 'Notification']
          },
          quality_gates: {
            test_coverage: {
              minimum: 70,
              current: 45
            },
            dependency_rules: ['no-circular', 'layer-isolation'],
            performance: {
              response_time_tolerance: 500
            }
          }
        },
        output: {
          artifacts: {
            domain_map: '.vibeflow/domain-map.json',
            plan: '.vibeflow/plan.md',
            patches: '.vibeflow/patches',
            metrics: '.vibeflow/metrics.json'
          }
        },
        migration: {
          phases: {}
        }
      };
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const rawConfig = yaml.load(content);
    
    const result = VibeFlowConfigSchema.safeParse(rawConfig);
    if (!result.success) {
      throw new Error(`Invalid VibeFlow config: ${result.error.message}`);
    }
    
    return result.data;
  }

  static loadBoundaryConfig(configPath?: string): BoundaryConfig | null {
    const defaultPath = 'boundary.yaml';
    const filePath = configPath || defaultPath;
    
    if (!fs.existsSync(filePath)) {
      return null; // boundary.yaml is optional
    }

    const content = fs.readFileSync(filePath, 'utf8');
    const rawConfig = yaml.load(content);
    
    const result = BoundaryConfigSchema.safeParse(rawConfig);
    if (!result.success) {
      throw new Error(`Invalid boundary config: ${result.error.message}`);
    }
    
    return result.data;
  }

  static saveConfig(config: any, filePath: string): void {
    const yamlContent = yaml.dump(config, {
      lineWidth: 120,
      noRefs: true,
      sortKeys: true,
    });
    
    fs.writeFileSync(filePath, yamlContent, 'utf8');
  }
}