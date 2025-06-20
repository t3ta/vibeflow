import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { ClaudeCodeClient } from '../claude-code/client';
import { ARCHITECTURE_DESIGN_TOOLS } from '../claude-code/tools';
import { ARCHITECTURE_DESIGN_PROMPT } from '../claude-code/prompts/architect-agent';
import * as fs from 'fs/promises';
import * as path from 'path';

export const architectureDesignStep = createStep({
  id: 'architecture-design',
  outputSchema: z.object({
    planPath: z.string(),
    summary: z.object({
      moduleCount: z.number(),
      migrationPhases: z.number(),
      estimatedComplexity: z.enum(['low', 'medium', 'high']),
    }),
  }),
  execute: async ({ context }: { context: any }) => {
    // boundary-extractionのstep IDを使用
    if (context?.steps['boundary-extraction']?.status !== 'success') {
      throw new Error('boundary-extraction step failed');
    }
    
    const { domainMapPath, domainMap } = context.steps['boundary-extraction'].output;
    const { projectPath } = context.triggerData;
    
    const claudeClient = new ClaudeCodeClient({
      cwd: projectPath,
      allowedTools: ARCHITECTURE_DESIGN_TOOLS,
      maxTurns: 10,
    });

    console.log('🏗️  Designing modular architecture...');
    
    // Create architecture design based on domain map
    const designResult = await claudeClient.queryForResult(
      `${ARCHITECTURE_DESIGN_PROMPT}\n\nThe domain-map.json file is located at: ${domainMapPath}`,
      {
        systemPrompt: 'You are an expert software architect designing modular monolith architectures.',
      }
    );

    // The plan.md should be created by Claude Code
    const planPath = path.join(projectPath, 'plan.md');
    
    // Verify the file was created
    try {
      await fs.access(planPath);
    } catch (error) {
      throw new Error('Architecture plan was not created. Please check the Claude Code output.');
    }

    // Extract summary information from the plan
    const planContent = await fs.readFile(planPath, 'utf-8');
    
    // Simple extraction of module count and phases
    const moduleMatches = planContent.match(/### Module:/g);
    const moduleCount = moduleMatches ? moduleMatches.length : domainMap.boundaries.length;
    
    const phaseMatches = planContent.match(/Phase \d+:/g);
    const migrationPhases = phaseMatches ? phaseMatches.length : 3;
    
    // Estimate complexity based on boundaries and dependencies
    let estimatedComplexity: 'low' | 'medium' | 'high' = 'medium';
    if (domainMap.summary.circularDependencies.length > 0) {
      estimatedComplexity = 'high';
    } else if (domainMap.boundaries.length <= 3) {
      estimatedComplexity = 'low';
    }

    console.log(`✅ Architecture plan saved to: ${planPath}`);
    console.log(`📐 Designed ${moduleCount} modules with ${migrationPhases} migration phases`);

    return {
      planPath,
      summary: {
        moduleCount,
        migrationPhases,
        estimatedComplexity,
      },
    };
  },
});