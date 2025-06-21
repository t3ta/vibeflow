import { z } from 'zod';

export interface Logger {
  info: (message: string, data?: any) => void;
  warn: (message: string, data?: any) => void;
  error: (message: string, data?: any) => void;
  debug: (message: string, data?: any) => void;
}

class ConsoleLogger implements Logger {
  constructor(private name: string) {}

  info(message: string, data?: any): void {
    console.log(`[${this.name}] INFO: ${message}`, data || '');
  }

  warn(message: string, data?: any): void {
    console.warn(`[${this.name}] WARN: ${message}`, data || '');
  }

  error(message: string, data?: any): void {
    console.error(`[${this.name}] ERROR: ${message}`, data || '');
  }

  debug(message: string, data?: any): void {
    if (process.env.DEBUG) {
      console.log(`[${this.name}] DEBUG: ${message}`, data || '');
    }
  }
}

export abstract class BaseAgent<TInput, TOutput> {
  protected logger: Logger;

  constructor(
    protected name: string,
    protected description: string,
    protected inputSchema: z.ZodSchema<TInput>,
    protected outputSchema: z.ZodSchema<TOutput>
  ) {
    this.logger = new ConsoleLogger(name);
  }

  async run(input: TInput): Promise<TOutput> {
    this.logger.info(`Starting ${this.name}`, { input });

    // Validate input
    const validatedInput = this.inputSchema.parse(input);

    // Execute agent logic
    const result = await this.execute(validatedInput);

    // Validate output
    const validatedOutput = this.outputSchema.parse(result);

    this.logger.info(`Completed ${this.name}`, { output: validatedOutput });

    return validatedOutput;
  }

  abstract execute(input: TInput): Promise<TOutput>;

  getDescription(): string {
    return this.description;
  }

  getName(): string {
    return this.name;
  }
}