import { query as claudeCodeQuery, type Options } from '@anthropic-ai/claude-code';
import { RefactoredFile } from '../types/refactor.js';
import { getErrorMessage } from './error-utils.js';
import * as path from 'path';

export interface ClaudeCodeIntegrationConfig {
  projectRoot: string;
  maxTurns?: number;
  model?: string;
}

/**
 * Real Claude Code SDK integration
 * This provides actual AI-powered code transformation
 */
export class ClaudeCodeIntegration {
  private config: ClaudeCodeIntegrationConfig;

  constructor(config: ClaudeCodeIntegrationConfig) {
    this.config = {
      maxTurns: 3,
      model: 'claude-3-sonnet-20240229',
      ...config
    };
  }

  /**
   * Transform code using Claude Code SDK
   */
  async transformCode(params: {
    file: string;
    boundary: string;
    pattern: string;
    instructions?: string;
  }): Promise<RefactoredFile> {
    const prompt = this.buildTransformationPrompt(params);

    try {
      // Execute Claude Code transformation
      const messages: any[] = [];
      const response = claudeCodeQuery({
        prompt,
        options: {
          cwd: this.config.projectRoot,
          maxTurns: this.config.maxTurns!,
          model: this.config.model
        }
      });

      // Collect all messages
      for await (const message of response) {
        messages.push(message);
      }

      // Parse the result to extract refactored files
      const lastMessage = messages[messages.length - 1];
      const content = lastMessage?.content || '';
      return this.parseClaudeCodeResult(content, params);
    } catch (error) {
      console.error('❌ Claude Code transformation failed:', getErrorMessage(error));
      throw error;
    }
  }

  /**
   * Improve existing code with AI insights
   */
  async improveCode(params: {
    originalFile: string;
    templateCode: string;
    boundary: string;
  }): Promise<string> {
    const prompt = `
I have a template-generated refactored code that needs improvement.

Original file: ${params.originalFile}
Boundary: ${params.boundary}

Template code:
\`\`\`
${params.templateCode}
\`\`\`

Please improve this code by:
1. Preserving all business logic from the original file
2. Enhancing error handling and validation
3. Adding appropriate logging
4. Optimizing performance where possible
5. Ensuring clean architecture principles

Return only the improved code.
`;

    try {
      const messages: any[] = [];
      const response = claudeCodeQuery({
        prompt,
        options: {
          cwd: this.config.projectRoot,
          maxTurns: 1,
          model: this.config.model
        }
      });

      // Collect all messages
      for await (const message of response) {
        messages.push(message);
      }

      // Extract improved code from result
      const lastMessage = messages[messages.length - 1];
      const content = lastMessage?.content || '';
      const codeMatch = content.match(/```[\w]*\n([\s\S]*?)```/);
      return codeMatch ? codeMatch[1] : params.templateCode;
    } catch (error) {
      console.warn('⚠️  Code improvement failed, using template');
      return params.templateCode;
    }
  }

  /**
   * Analyze code for refactoring opportunities
   */
  async analyzeCode(file: string): Promise<{
    businessLogic: string[];
    patterns: string[];
    dependencies: string[];
    suggestions: string[];
  }> {
    const prompt = `
Analyze the code in ${file} and identify:
1. Core business logic and rules
2. Design patterns used
3. External dependencies
4. Refactoring suggestions

Return as JSON with keys: businessLogic, patterns, dependencies, suggestions
`;

    try {
      const messages: any[] = [];
      const response = claudeCodeQuery({
        prompt,
        options: {
          cwd: this.config.projectRoot,
          maxTurns: 1,
          model: this.config.model
        }
      });

      // Collect all messages
      for await (const message of response) {
        messages.push(message);
      }

      // Parse JSON from result
      const lastMessage = messages[messages.length - 1];
      const content = lastMessage?.content || '';
      const jsonMatch = content.match(/```json\n([\s\S]*?)```/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[1]);
      }

      // Fallback parsing
      return {
        businessLogic: [],
        patterns: [],
        dependencies: [],
        suggestions: []
      };
    } catch (error) {
      console.error('❌ Code analysis failed:', getErrorMessage(error));
      return {
        businessLogic: [],
        patterns: [],
        dependencies: [],
        suggestions: []
      };
    }
  }

  private buildTransformationPrompt(params: {
    file: string;
    boundary: string;
    pattern: string;
    instructions?: string;
  }): string {
    return params.instructions || `
Transform the code in ${params.file} following these requirements:

1. Refactor into clean architecture pattern
2. Move to boundary: ${params.boundary}
3. Create separate files for:
   - Domain entities and interfaces
   - Use cases / application services
   - Infrastructure implementations
   - HTTP/API handlers
4. Generate comprehensive tests
5. Follow ${params.pattern} pattern

Structure:
- internal/${params.boundary}/domain/
- internal/${params.boundary}/usecase/
- internal/${params.boundary}/infrastructure/
- internal/${params.boundary}/handler/

Return the transformed code as separate files with clear boundaries.
`;
  }

  private parseClaudeCodeResult(result: string, params: any): RefactoredFile {
    // Parse Claude Code output to extract multiple files
    const files: RefactoredFile = {
      refactored_files: [],
      interfaces: [],
      tests: []
    };

    // Simple parsing - in reality, Claude Code might return structured data
    const fileMatches = result.matchAll(/File: (.*?)\n```[\w]*\n([\s\S]*?)```/g);
    
    for (const match of fileMatches) {
      const filePath = match[1];
      const content = match[2];
      
      if (filePath.includes('/domain/') && filePath.includes('interface')) {
        files.interfaces.push({
          name: path.basename(filePath, '.go'),
          path: filePath,
          content
        });
      } else if (filePath.includes('_test.')) {
        files.tests.push({
          path: filePath,
          content
        });
      } else {
        files.refactored_files.push({
          path: filePath,
          content,
          description: `Refactored from ${params.file}`
        });
      }
    }

    // If no files were parsed, create a default structure
    if (files.refactored_files.length === 0) {
      console.warn('⚠️  Could not parse Claude Code result, using fallback');
      // Return minimal structure
      files.refactored_files.push({
        path: `internal/${params.boundary}/domain/entity.go`,
        content: '// Claude Code transformation result\n' + result,
        description: 'Claude Code output'
      });
    }

    return files;
  }

  /**
   * Get usage statistics
   */
  async getUsage(): Promise<{
    tokensUsed: number;
    cost: number;
  }> {
    // Claude Code SDK might provide usage stats
    // For now, return estimates
    return {
      tokensUsed: 0,
      cost: 0
    };
  }
}