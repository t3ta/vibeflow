import { z } from 'zod';

export const ModuleConfigSchema = z.object({
  description: z.string(),
  paths: z.array(z.string()),
});

export const ProjectConfigSchema = z.object({
  name: z.string(),
  language: z.enum(['go', 'typescript', 'python']),
  root: z.string(),
});

export const AnalysisConfigSchema = z.object({
  entry_points: z.array(z.string()),
  exclude_patterns: z.array(z.string()),
  include_patterns: z.array(z.string()),
});

export const BoundariesConfigSchema = z.object({
  target_modules: z.record(ModuleConfigSchema),
});

export const RefactoringConfigSchema = z.object({
  target_architecture: z.object({
    pattern: z.string(),
    module_structure: z.string(),
  }),
  value_objects: z.object({
    priority_high: z.array(z.string()),
    priority_medium: z.array(z.string()),
  }),
  quality_gates: z.object({
    test_coverage: z.object({
      minimum: z.number(),
      current: z.number(),
    }),
    dependency_rules: z.array(z.string()),
    performance: z.object({
      response_time_tolerance: z.number(),
    }),
  }),
});

export const OutputConfigSchema = z.object({
  artifacts: z.object({
    domain_map: z.string(),
    plan: z.string(),
    patches: z.string(),
    metrics: z.string(),
  }),
});

export const MigrationPhaseSchema = z.object({
  name: z.string(),
  duration: z.string(),
  modules: z.array(z.string()),
});

export const MigrationConfigSchema = z.object({
  phases: z.record(MigrationPhaseSchema),
});

export const VibeFlowConfigSchema = z.object({
  project: ProjectConfigSchema,
  analysis: AnalysisConfigSchema,
  boundaries: BoundariesConfigSchema,
  refactoring: RefactoringConfigSchema,
  output: OutputConfigSchema,
  migration: MigrationConfigSchema,
});

export type ModuleConfig = z.infer<typeof ModuleConfigSchema>;
export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;
export type AnalysisConfig = z.infer<typeof AnalysisConfigSchema>;
export type BoundariesConfig = z.infer<typeof BoundariesConfigSchema>;
export type RefactoringConfig = z.infer<typeof RefactoringConfigSchema>;
export type OutputConfig = z.infer<typeof OutputConfigSchema>;
export type MigrationPhase = z.infer<typeof MigrationPhaseSchema>;
export type MigrationConfig = z.infer<typeof MigrationConfigSchema>;
export type VibeFlowConfig = z.infer<typeof VibeFlowConfigSchema>;

// Boundary YAML types
export const BoundaryModuleSchema = z.object({
  owns_tables: z.array(z.string()).optional(),
  provides_interfaces: z.array(z.string()).optional(),
  publishes_events: z.array(z.string()).optional(),
  subscribes_to: z.array(z.string()).optional(),
  depends_on: z.array(z.string()).optional(),
});

export const BoundaryConfigSchema = z.object({
  modules: z.record(BoundaryModuleSchema),
});

export type BoundaryModule = z.infer<typeof BoundaryModuleSchema>;
export type BoundaryConfig = z.infer<typeof BoundaryConfigSchema>;

// Domain map output types
export const DomainBoundarySchema = z.object({
  name: z.string(),
  description: z.string(),
  ubiquitousLanguage: z.array(z.string()).optional(),
  businessRules: z.array(z.string()).optional(),
  directories: z.array(z.string()).optional(),
  entities: z.array(z.string()).optional(),
  apiEndpoints: z.array(z.string()).optional(),
  files: z.array(z.string()),
  dependencies: z.object({
    internal: z.array(z.string()).optional(),
    external: z.array(z.string()).optional(),
  }).optional(),
  circular_dependencies: z.array(z.string()).optional(),
  metrics: z.object({
    cohesion: z.number(),
    coupling: z.number(),
    complexity: z.string(),
  }).optional(),
  // Backward compatibility
  cohesion_score: z.number().optional(),
  coupling_score: z.number().optional(),
});

export const DomainMapSchema = z.object({
  project: z.string(),
  language: z.string(),
  analyzed_at: z.string(),
  total_files: z.number(),
  boundaries: z.array(DomainBoundarySchema),
  metrics: z.object({
    overall_cohesion: z.number(),
    overall_coupling: z.number(),
    modularity_score: z.number(),
  }),
});

export type DomainBoundary = z.infer<typeof DomainBoundarySchema>;
export type DomainMap = z.infer<typeof DomainMapSchema>;