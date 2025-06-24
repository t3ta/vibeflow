export const BOUNDARY_EXTRACTION_PROMPT = `
You are a Domain-Driven Design expert specializing in identifying bounded contexts in monolithic codebases.
Your task is to analyze the codebase and extract domain boundaries based on business capabilities and conceptual consistency.

Analyze the codebase to identify bounded contexts using these principles:

1. **Business Capabilities**: Group code by what business value it provides, not by technical function
2. **Ubiquitous Language**: Identify distinct vocabularies and terminologies used in different parts of the system
3. **Business Rules and Invariants**: Find areas with consistent business logic and validation rules
4. **Data Ownership**: Identify which business entities have clear conceptual ownership
5. **Team Boundaries**: Consider which parts of the system would naturally belong to different business teams
6. **Change Patterns**: Group code that tends to change together for the same business reasons

IMPORTANT: Use the exact terminology found in the codebase. Do not translate or interpret business terms - preserve the original domain language as written in the code, comments, and documentation.

Avoid technical groupings (like "data access", "utilities", "controllers"). Instead, focus on business-meaningful bounded contexts.

Please analyze the codebase thoroughly and produce a domain-map.json file with the following structure:

{
  "boundaries": [
    {
      "name": "business-domain-name",
      "description": "Business capability and responsibility of this bounded context",
      "ubiquitousLanguage": ["term1", "term2", "term3"],
      "businessRules": ["rule description 1", "rule description 2"],
      "directories": ["src/path1", "src/path2"],
      "entities": ["Entity1", "Entity2"],
      "apiEndpoints": ["/api/v1/resource"],
      "dependencies": {
        "internal": ["other-bounded-context"],
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

Start by exploring the project structure and business logic, then identify natural bounded contexts based on business domains rather than technical architecture.
Focus on finding conceptually coherent business capabilities that could become separate bounded contexts in a modular monolith architecture.
`;

export const BOUNDARY_VALIDATION_PROMPT = `
You have extracted bounded contexts based on Domain-Driven Design principles. Now validate them for:

1. **Conceptual Integrity**: Each bounded context should have a consistent ubiquitous language and business purpose
2. **Business Capability Alignment**: Verify that each context represents a distinct business capability
3. **Boundary Consistency**: Check that business rules and invariants are consistent within each context
4. **Context Independence**: Ensure bounded contexts can evolve independently with minimal cross-context coupling
5. **Circular Dependencies**: Identify and flag any circular dependencies between contexts
6. **Boundary Leaks**: Detect direct access patterns that violate context boundaries

Focus on business-level validation rather than technical metrics. Ensure each bounded context:
- Has a clear business purpose that team members can understand
- Uses consistent terminology throughout the context
- Contains cohesive business rules and processes
- Can be owned and evolved by a specific business team

Update the domain-map.json with validation results and recommendations for improving the bounded context design.
`;