# Template Mode Guide

Template Mode is the default operation mode for VibeFlow, providing high-quality code generation using sophisticated templates and proven architectural patterns.

## Overview

Template Mode generates production-ready code following:
- Clean Architecture principles
- Domain-Driven Design (DDD) patterns
- SOLID principles
- Test-Driven Development practices

## Benefits

### 1. Predictable Output
- Consistent code structure across all modules
- Follows established best practices
- No surprises or experimental patterns

### 2. Fast Generation
- 2-3 seconds per file
- No API calls or external dependencies
- Works offline

### 3. Zero Cost
- No API usage fees
- No token limits
- Unlimited transformations

### 4. Production Ready
- Generated code compiles immediately
- Comprehensive test coverage
- Type-safe implementations

## Code Structure

Template Mode generates the following structure for each module:

```
internal/
└── customer/
    ├── domain/           # Core business logic
    │   ├── customer.go   # Domain entities
    │   ├── repository.go # Repository interfaces
    │   └── usecase.go    # Use case interfaces
    ├── usecase/          # Application logic
    │   └── customer_service.go
    ├── infrastructure/   # External dependencies
    │   └── customer_repository.go
    ├── handler/          # HTTP/API layer
    │   └── customer_handler.go
    └── test/            # Test suites
        ├── customer_test.go
        └── service_test.go
```

## Generated Code Quality

### Domain Layer
```go
// Clean, focused domain entities
type Customer struct {
    ID        string    
    CreatedAt time.Time 
    UpdatedAt time.Time 
    // Domain-specific fields
}

// Clear validation rules
func (c *Customer) Validate() error {
    if c.ID == "" {
        return errors.New("customer ID is required")
    }
    return nil
}
```

### Repository Pattern
```go
// Dependency inversion with interfaces
type CustomerRepository interface {
    Save(ctx context.Context, customer *Customer) (*Customer, error)
    GetByID(ctx context.Context, id string) (*Customer, error)
    Update(ctx context.Context, customer *Customer) (*Customer, error)
    Delete(ctx context.Context, id string) error
}
```

### Test Generation
```go
// Comprehensive test coverage
func TestCustomer_Validate(t *testing.T) {
    tests := []struct {
        name        string
        customer    *Customer
        expectError bool
    }{
        // Test cases with edge cases
    }
    // Table-driven tests
}
```

## Customization Options

While Template Mode uses fixed patterns, you can customize:

1. **Architecture Pattern**
   ```bash
   vf auto . --pattern clean-arch  # Default
   vf auto . --pattern hexagonal   # Coming soon
   vf auto . --pattern onion       # Coming soon
   ```

2. **Language Templates**
   ```bash
   vf auto . --language go         # Go templates
   vf auto . --language typescript # TypeScript templates
   vf auto . --language python     # Python templates
   ```

3. **Test Coverage**
   ```bash
   vf auto . --coverage 80  # Target 80% coverage
   ```

## When to Use Template Mode

Template Mode is ideal for:

1. **Greenfield Projects**
   - Starting with clean architecture
   - Establishing consistent patterns
   - Team onboarding

2. **Legacy Modernization**
   - Refactoring to modern patterns
   - Standardizing code structure
   - Improving testability

3. **Proof of Concepts**
   - Quick prototyping
   - Architecture validation
   - Pattern exploration

## Limitations

Template Mode has some limitations:

1. **Fixed Patterns**
   - Cannot adapt to unique requirements
   - May not fit all use cases
   - Limited customization

2. **No Context Awareness**
   - Doesn't understand existing code semantics
   - Cannot preserve custom business logic
   - May require manual adjustments

3. **Language Support**
   - Currently supports Go, TypeScript, Python
   - New languages require template development

## Best Practices

1. **Review Generated Code**
   - Always review before applying
   - Adjust for specific requirements
   - Ensure business logic preservation

2. **Use Version Control**
   - Commit before transformation
   - Review diffs carefully
   - Use branches for experiments

3. **Incremental Adoption**
   - Start with one module
   - Validate the approach
   - Scale gradually

## Next Steps

- Try AI Mode when available for adaptive transformations
- Contribute custom templates to the project
- Share feedback for template improvements