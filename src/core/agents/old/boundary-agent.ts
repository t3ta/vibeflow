import { createStep } from '@mastra/core/workflows';
import { z } from 'zod';
import { ClaudeCodeClient } from '../claude-code/client';
import { BOUNDARY_EXTRACTION_TOOLS } from '../claude-code/tools';
import { BOUNDARY_EXTRACTION_PROMPT, BOUNDARY_VALIDATION_PROMPT } from '../claude-code/prompts/boundary-agent';
import * as fs from 'fs/promises';
import * as path from 'path';

// Domain boundary schema
const domainBoundarySchema = z.object({
  name: z.string(),
  description: z.string(),
  directories: z.array(z.string()),
  entities: z.array(z.string()),
  apiEndpoints: z.array(z.string()),
  dependencies: z.object({
    internal: z.array(z.string()),
    external: z.array(z.string()),
  }),
  metrics: z.object({
    cohesion: z.number(),
    coupling: z.number(),
    complexity: z.enum(['low', 'medium', 'high']),
  }),
});

const domainMapSchema = z.object({
  boundaries: z.array(domainBoundarySchema),
  summary: z.object({
    totalBoundaries: z.number(),
    circularDependencies: z.array(z.array(z.string())),
    recommendations: z.array(z.string()),
  }),
});

export type DomainMap = z.infer<typeof domainMapSchema>;

export const boundaryExtractionStep = createStep({
  id: 'boundary-extraction',
  outputSchema: z.object({
    domainMapPath: z.string(),
    domainMap: domainMapSchema,
  }),
  execute: async ({ context }: { context: any }) => {
    // Get trigger data from context
    const { projectPath, config } = context?.triggerData || { projectPath: '', config: {} };
    
    const claudeClient = new ClaudeCodeClient({
      cwd: projectPath,
      allowedTools: BOUNDARY_EXTRACTION_TOOLS,
      maxTurns: 15,
    });

    console.log('🔍 Analyzing codebase structure...');
    
    // Step 1: Extract boundaries
    const extractionResult = await claudeClient.queryForResult(
      BOUNDARY_EXTRACTION_PROMPT,
      {
        systemPrompt: 'You are an expert at identifying domain boundaries in codebases.',
      }
    );

    // Extract JSON from result
    let domainMap: DomainMap;
    try {
      domainMap = claudeClient.extractJsonFromResult(extractionResult);
    } catch (error) {
      throw new Error(`Failed to extract domain map: ${error}`);
    }

    // Step 2: Validate boundaries
    console.log('✓ Validating boundaries...');
    const validationResult = await claudeClient.queryForResult(
      BOUNDARY_VALIDATION_PROMPT,
      {
        systemPrompt: 'You are validating the extracted domain boundaries.',
      }
    );

    // Update domain map with validation results
    try {
      const validatedMap = claudeClient.extractJsonFromResult(validationResult);
      domainMap = { ...domainMap, ...validatedMap };
    } catch (error) {
      console.warn('Could not parse validation results, using original map');
    }

    // Save domain map
    const outputPath = path.join(projectPath, 'domain-map.json');
    await fs.writeFile(outputPath, JSON.stringify(domainMap, null, 2));

    console.log(`✅ Domain map saved to: ${outputPath}`);
    console.log(`📊 Found ${domainMap.boundaries.length} domain boundaries`);

    return {
      domainMapPath: outputPath,
      domainMap,
    };
  },
});