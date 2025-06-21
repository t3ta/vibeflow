// Type definitions for Anthropic SDK (when available)
// import Anthropic from '@anthropic-ai/sdk';

// Temporary interface until SDK is installed
interface Anthropic {
  messages: {
    create: (params: any) => Promise<{ content: Array<{ text: string }> }>;
  };
}

// Mock constructor until SDK is available
function createAnthropicClient(config: { apiKey: string }): Anthropic {
  console.warn('⚠️  Anthropic SDK not installed - using mock');
  return {
    messages: {
      create: async (params: any) => {
        throw new Error('Anthropic SDK not installed. Run: npm install @anthropic-ai/sdk');
      }
    }
  };
}
import { RefactoredFile } from '../types/refactor.js';
import { getErrorMessage } from './error-utils.js';

export interface AIClientConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost: number;
}

/**
 * Real Claude AI integration for intelligent code transformation
 * This complements the template engine with AI capabilities
 */
export class ClaudeAIClient {
  private client: Anthropic;
  private config: AIClientConfig;
  private tokenUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    totalTokens: 0,
    estimatedCost: 0
  };

  // Pricing per 1M tokens (Claude 3 Sonnet)
  private readonly INPUT_COST_PER_1M = 3.00;
  private readonly OUTPUT_COST_PER_1M = 15.00;

  constructor(config: AIClientConfig) {
    this.config = {
      model: 'claude-3-sonnet-20240229',
      maxTokens: 4000,
      temperature: 0.3,
      ...config
    };

    this.client = createAnthropicClient({
      apiKey: this.config.apiKey
    });
  }

  /**
   * Improve template-generated code with AI
   */
  async improveCode(params: {
    originalCode: string;
    templateCode: string;
    boundary: string;
    instructions?: string;
  }): Promise<string> {
    const prompt = this.buildImprovementPrompt(params);
    
    try {
      const response = await this.client.messages.create({
        model: this.config.model!,
        max_tokens: this.config.maxTokens!,
        temperature: this.config.temperature!,
        messages: [{
          role: 'user',
          content: prompt
        }],
        system: this.getSystemPrompt()
      });

      const result = response.content[0].text;
      this.trackUsage(prompt, result);
      
      return result;
    } catch (error) {
      console.error('❌ AI improvement failed:', getErrorMessage(error));
      // Fallback to template code
      return params.templateCode;
    }
  }

  /**
   * Extract and preserve business logic during refactoring
   */
  async extractBusinessLogic(code: string): Promise<{
    logic: string[];
    patterns: string[];
    dependencies: string[];
  }> {
    const prompt = `Analyze this code and extract:
1. Core business logic and rules
2. Important patterns and algorithms
3. External dependencies

Code:
\`\`\`
${code}
\`\`\`

Return as JSON with keys: logic, patterns, dependencies`;

    try {
      const response = await this.client.messages.create({
        model: this.config.model!,
        max_tokens: 2000,
        temperature: 0.1,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const result = response.content[0].text;
      this.trackUsage(prompt, result);
      
      return JSON.parse(result);
    } catch (error) {
      console.error('❌ Business logic extraction failed:', getErrorMessage(error));
      return {
        logic: [],
        patterns: [],
        dependencies: []
      };
    }
  }

  /**
   * Get token usage and cost report
   */
  getUsageReport(): TokenUsage {
    return { ...this.tokenUsage };
  }

  /**
   * Reset token usage (e.g., for new session)
   */
  resetUsage(): void {
    this.tokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      estimatedCost: 0
    };
  }

  private buildImprovementPrompt(params: {
    originalCode: string;
    templateCode: string;
    boundary: string;
    instructions?: string;
  }): string {
    return `You are improving a code refactoring from a template.

Original Code:
\`\`\`
${params.originalCode}
\`\`\`

Template-Generated Code:
\`\`\`
${params.templateCode}
\`\`\`

Boundary: ${params.boundary}

Instructions:
${params.instructions || `
1. Preserve all business logic from the original code
2. Improve error handling and validation
3. Add appropriate logging
4. Optimize performance where possible
5. Ensure the code follows clean architecture principles
6. Keep the same structure as the template
`}

Return only the improved code without explanations.`;
  }

  private getSystemPrompt(): string {
    return `You are an expert software architect specializing in clean architecture and domain-driven design. 
You help improve code refactoring by:
- Preserving business logic and domain knowledge
- Enhancing code quality and maintainability
- Following SOLID principles
- Writing clear, self-documenting code
- Adding comprehensive error handling`;
  }

  private trackUsage(prompt: string, response: string): void {
    // Simple token estimation (actual implementation would use tiktoken)
    const inputTokens = Math.ceil(prompt.length / 4);
    const outputTokens = Math.ceil(response.length / 4);
    
    this.tokenUsage.inputTokens += inputTokens;
    this.tokenUsage.outputTokens += outputTokens;
    this.tokenUsage.totalTokens += inputTokens + outputTokens;
    
    const inputCost = (inputTokens / 1_000_000) * this.INPUT_COST_PER_1M;
    const outputCost = (outputTokens / 1_000_000) * this.OUTPUT_COST_PER_1M;
    this.tokenUsage.estimatedCost += inputCost + outputCost;
  }
}