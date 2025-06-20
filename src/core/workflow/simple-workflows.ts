import { z } from 'zod';
import {
  boundaryExtractionStep,
  architectureDesignStep,
  refactoringStep,
  testSynthesisStep,
  migrationRunnerStep,
  reviewStep,
} from '../agents/simple-steps';

// シンプルなワークフロー定義（ビルドを通すための暫定実装）
export const planWorkflowConfig = {
  id: 'plan-workflow',
  steps: [boundaryExtractionStep, architectureDesignStep],
  triggerSchema: z.object({
    projectPath: z.string().describe('Path to the project to analyze'),
    config: z.object({
      excludePatterns: z.array(z.string()).optional(),
      includePatterns: z.array(z.string()).optional(),
    }).optional(),
  }),
};

export const refactorWorkflowConfig = {
  id: 'refactor-workflow', 
  steps: [refactoringStep, testSynthesisStep, migrationRunnerStep, reviewStep],
  triggerSchema: z.object({
    projectPath: z.string().describe('Path to the project to refactor'),
    planPath: z.string().describe('Path to the plan.md file'),
    domainMapPath: z.string().describe('Path to the domain-map.json file'),
    options: z.object({
      dryRun: z.boolean().default(false),
      autoApply: z.boolean().default(false),
      skipTests: z.boolean().default(false),
    }).optional(),
  }),
};