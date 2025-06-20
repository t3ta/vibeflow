import * as fs from 'fs';
import * as yaml from 'js-yaml';
import { VibeFlowConfig, VibeFlowConfigSchema, BoundaryConfig, BoundaryConfigSchema } from '../types/config.js';

export class ConfigLoader {
  static loadVibeFlowConfig(configPath?: string): VibeFlowConfig {
    const defaultPath = 'vibeflow.config.yaml';
    const filePath = configPath || defaultPath;
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`VibeFlow config file not found: ${filePath}`);
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