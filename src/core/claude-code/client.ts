import { query, type SDKMessage, type Options } from '@anthropic-ai/claude-code';
import { z } from 'zod';

export interface ClaudeCodeClientOptions {
  cwd?: string;
  maxTurns?: number;
  systemPrompt?: string;
  allowedTools?: string[];
  outputFormat?: 'text' | 'json' | 'stream-json';
}

export class ClaudeCodeClient {
  private defaultOptions: ClaudeCodeClientOptions;

  constructor(options: ClaudeCodeClientOptions = {}) {
    this.defaultOptions = {
      maxTurns: 10,
      outputFormat: 'json',
      ...options,
    };
  }

  async query(
    prompt: string,
    options: ClaudeCodeClientOptions = {}
  ): Promise<SDKMessage[]> {
    const mergedOptions = { ...this.defaultOptions, ...options };
    const messages: SDKMessage[] = [];

    const queryOptions: Options = {
      maxTurns: mergedOptions.maxTurns,
      customSystemPrompt: mergedOptions.systemPrompt,
      allowedTools: mergedOptions.allowedTools,
      cwd: mergedOptions.cwd,
      abortController: new AbortController(),
    };

    for await (const message of query({
      prompt,
      options: queryOptions,
    })) {
      messages.push(message);
    }

    return messages;
  }

  async queryForResult(
    prompt: string,
    options: ClaudeCodeClientOptions = {}
  ): Promise<string> {
    const messages = await this.query(prompt, options);
    const resultMessage = messages.find(msg => msg.type === 'result');
    
    if (resultMessage?.type === 'result' && resultMessage.subtype === 'success') {
      return resultMessage.result;
    }
    
    throw new Error('Query did not return a successful result');
  }

  extractJsonFromResult(result: string): any {
    // JSONコードブロックを抽出
    const jsonMatch = result.match(/```json\n([\s\S]*?)\n```/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]);
      } catch (e) {
        throw new Error(`Failed to parse JSON from result: ${e}`);
      }
    }
    
    // 直接JSONとして解析を試みる
    try {
      return JSON.parse(result);
    } catch (e) {
      throw new Error(`Result is not valid JSON: ${e}`);
    }
  }
}