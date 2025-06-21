import { RefactorAgent } from './refactor-agent.js';
import { ClaudeCodeIntegration } from '../utils/claude-code-integration.js';
import { DomainBoundary } from '../types/config.js';
import { RefactoredFile, RefactorResult } from '../types/refactor.js';
import { getErrorMessage } from '../utils/error-utils.js';
import * as fs from 'fs/promises';

/**
 * Hybrid Refactor Agent: Combines template generation with AI enhancement
 * 
 * Strategy:
 * 1. Use templates for structure (fast, free, predictable)
 * 2. Use AI for customization (intelligent, adaptive, context-aware)
 * 3. Fallback to template-only if AI fails (resilient)
 */
export class HybridRefactorAgent extends RefactorAgent {
  private claudeCode?: ClaudeCodeIntegration;
  private useAI: boolean;

  constructor(projectRoot: string) {
    super(projectRoot);
    
    // Initialize Claude Code SDK (uses OAuth, no API key needed)
    try {
      this.claudeCode = new ClaudeCodeIntegration({
        projectRoot: this.projectRoot
      });
      this.useAI = true;
      console.log('🤖 Claude Code SDK available');
    } catch {
      this.useAI = false;
      console.log('📋 Template-only mode (Claude Code SDK not available)');
    }
  }

  /**
   * Override the base refactoring method to add AI enhancement
   */
  async executeRefactoring(boundaries: DomainBoundary[], applyChanges: boolean): Promise<RefactorResult> {
    console.log('🔧 Hybrid refactoring starting...');
    console.log(`Mode: ${this.useAI ? 'Template + AI' : 'Template Only'}`);
    
    const results: RefactorResult = {
      applied_patches: [],
      failed_patches: [],
      created_files: [],
      modified_files: [],
      deleted_files: [],
      outputPath: '',
      aiEnhanced: this.useAI,
      tokenUsage: undefined
    };

    for (const boundary of boundaries) {
      console.log(`\n📁 Processing boundary: ${boundary.name}`);
      
      for (const file of boundary.files) {
        try {
          console.log(`  📄 Transforming: ${file}`);
          
          // Step 1: Generate base structure with templates
          const templateResult = await this.generateRefactoredCode(file, boundary);
          
          // Step 2: Enhance with AI if available
          let finalResult = templateResult;
          if (this.useAI && this.claudeCode) {
            finalResult = await this.enhanceWithAI(file, templateResult, boundary);
          }
          
          // Step 3: Apply changes if requested
          if (applyChanges) {
            await this.applyRefactoredFiles(finalResult);
            results.applied_patches.push(file);
            results.created_files.push(...finalResult.refactored_files.map(f => f.path));
          }
          
          console.log(`    ✅ Success: ${finalResult.refactored_files.length} files generated`);
          
        } catch (error) {
          const errorMessage = getErrorMessage(error);
          console.error(`    ❌ Failed: ${errorMessage}`);
          results.failed_patches.push({ file, error: errorMessage });
        }
      }
    }

    // Add usage report if AI was used
    if (this.useAI && this.claudeCode) {
      const usage = await this.claudeCode.getUsage();
      results.tokenUsage = {
        inputTokens: usage.tokensUsed,
        outputTokens: 0,
        totalTokens: usage.tokensUsed,
        estimatedCost: usage.cost
      };
      console.log(`\n💰 AI Usage: ${usage.tokensUsed} tokens ($${usage.cost.toFixed(4)})`);
    }

    return results;
  }

  /**
   * Enhance template-generated code with AI
   */
  private async enhanceWithAI(
    originalFile: string,
    templateResult: RefactoredFile,
    boundary: DomainBoundary
  ): Promise<RefactoredFile> {
    console.log(`    🤖 Enhancing with AI...`);
    
    try {
      // Analyze code first
      const analysis = await this.claudeCode!.analyzeCode(originalFile);
      console.log(`       Found ${analysis.businessLogic.length} business rules`);
      
      // Option 1: Use Claude Code to transform the entire file
      if (process.env.USE_FULL_CLAUDE_CODE === 'true') {
        const transformedResult = await this.claudeCode!.transformCode({
          file: originalFile,
          boundary: boundary.name,
          pattern: 'clean-architecture'
        });
        return transformedResult;
      }
      
      // Option 2: Enhance template-generated files with Claude Code
      const enhancedFiles = await Promise.all(
        templateResult.refactored_files.map(async (file) => {
          const improvedCode = await this.claudeCode!.improveCode({
            originalFile,
            templateCode: file.content,
            boundary: boundary.name
          });
          
          return {
            ...file,
            content: improvedCode
          };
        })
      );
      
      return {
        ...templateResult,
        refactored_files: enhancedFiles
      };
      
    } catch (error) {
      console.warn(`       ⚠️  AI enhancement failed, using template only`);
      return templateResult;
    }
  }

  /**
   * Build specific instructions based on file type
   */
  private buildEnhancementInstructions(
    filePath: string,
    businessLogic: any
  ): string {
    const instructions = [];
    
    // File-specific instructions
    if (filePath.includes('/domain/')) {
      instructions.push('Focus on domain logic and business rules');
      instructions.push('Ensure all validations from original code are preserved');
    } else if (filePath.includes('/usecase/')) {
      instructions.push('Preserve transaction boundaries');
      instructions.push('Maintain the same business flow as original');
    } else if (filePath.includes('/infrastructure/')) {
      instructions.push('Keep all database queries and external integrations');
      instructions.push('Preserve connection handling and error recovery');
    } else if (filePath.includes('/handler/')) {
      instructions.push('Maintain API compatibility');
      instructions.push('Preserve request validation and response format');
    }
    
    // Add business logic preservation
    if (businessLogic.logic.length > 0) {
      instructions.push(`Preserve these business rules: ${businessLogic.logic.join(', ')}`);
    }
    
    return instructions.join('\n');
  }

  /**
   * Cost estimation before running
   */
  async estimateCost(boundaries: DomainBoundary[]): Promise<{
    fileCount: number;
    estimatedTokens: number;
    estimatedCost: number;
    estimatedTime: string;
  }> {
    let fileCount = 0;
    let estimatedTokens = 0;
    
    for (const boundary of boundaries) {
      fileCount += boundary.files.length;
      for (const file of boundary.files) {
        try {
          const content = await fs.readFile(file, 'utf8');
          // Rough estimation: 1 token per 4 characters
          estimatedTokens += Math.ceil(content.length / 4) * 4; // x4 for template + improvements
        } catch {
          estimatedTokens += 2000; // Default estimate
        }
      }
    }
    
    // Claude 3 Sonnet pricing
    const inputCost = (estimatedTokens * 0.7 / 1_000_000) * 3.00;
    const outputCost = (estimatedTokens * 0.3 / 1_000_000) * 15.00;
    const estimatedCost = inputCost + outputCost;
    
    const estimatedMinutes = Math.ceil(fileCount * 0.5); // ~30s per file with AI
    
    return {
      fileCount,
      estimatedTokens,
      estimatedCost,
      estimatedTime: `${estimatedMinutes} minutes`
    };
  }
}