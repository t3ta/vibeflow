export const BOUNDARY_EXTRACTION_PROMPT = `
You are a code analysis expert specializing in identifying domain boundaries in monolithic codebases.
Your task is to analyze the codebase and extract context boundaries based on:

1. Directory structure and module organization
2. Import/export relationships and dependency graphs
3. Database schema and data relationships
4. API endpoints and their groupings
5. Business logic cohesion
6. Data access patterns

Please analyze the codebase thoroughly and produce a domain-map.json file with the following structure:

{
  "boundaries": [
    {
      "name": "boundary-name",
      "description": "Purpose and responsibility of this boundary",
      "directories": ["src/path1", "src/path2"],
      "entities": ["Entity1", "Entity2"],
      "apiEndpoints": ["/api/v1/resource"],
      "dependencies": {
        "internal": ["other-boundary"],
        "external": ["npm-package"]
      },
      "metrics": {
        "cohesion": 0.85,
        "coupling": 0.15,
        "complexity": "medium"
      }
    }
  ],
  "summary": {
    "totalBoundaries": 5,
    "circularDependencies": [],
    "recommendations": []
  }
}

Start by exploring the project structure, then analyze the code to identify natural boundaries.
Focus on finding cohesive units that could become separate modules in a modular monolith architecture.
`;

export const BOUNDARY_VALIDATION_PROMPT = `
You have extracted domain boundaries. Now validate them for:

1. Circular dependencies
2. Boundary leaks (cross-boundary direct access)
3. Cohesion metrics
4. Coupling metrics

Update the domain-map.json with validation results and recommendations.
`;