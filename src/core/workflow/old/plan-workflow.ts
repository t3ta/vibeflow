import { createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';
import { boundaryExtractionStep } from '../agents/boundary-agent';
import { architectureDesignStep } from '../agents/architect-agent';

// Plan workflow: BoundaryAgent → ArchitectAgent
export const planWorkflow = createWorkflow({
  name: 'plan-workflow',
  triggerSchema: z.object({
    projectPath: z.string().describe('Path to the project to analyze'),
    config: z.object({
      excludePatterns: z.array(z.string()).optional(),
      includePatterns: z.array(z.string()).optional(),
    }).optional(),
  }),
});

// ワークフローの構築
planWorkflow
  .step(boundaryExtractionStep)
  .then(architectureDesignStep)
  .commit();