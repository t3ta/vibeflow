import { createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { refactoringStep } from '../agents/refactor-agent';
import { testSynthesisStep } from '../agents/test-synth-agent';
import { migrationRunnerStep } from '../agents/migration-runner';
import { reviewStep } from '../agents/review-agent';

// Refactor workflow: RefactorAgent → TestSynthAgent → MigrationRunner → ReviewAgent
export const refactorWorkflow = createWorkflow({
  name: 'refactor-workflow',
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
});

// ワークフローの構築
refactorWorkflow
  .step(refactoringStep)
  .then(testSynthesisStep)
  .then(migrationRunnerStep)
  .then(reviewStep)
  .commit();