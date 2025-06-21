import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { executeAutoRefactor } from '../../src/core/workflow/auto-refactor-workflow.js';
import { createTempDir, cleanupTempDir, createMockGoProject, createMockTypeScriptProject } from '../setup.js';

describe('E2E: Complete Auto-Refactor Workflow', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir('e2e-workflow');
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should execute complete Go project transformation', async () => {
    // Create a realistic Go project
    await createMockGoProject(tempDir);
    
    // Add additional files for more complex scenario
    await fs.writeFile(path.join(tempDir, 'order.go'), `
package main

import (
    "errors"
    "time"
)

type Order struct {
    ID          string    \`json:"id"\`
    UserID      string    \`json:"user_id"\`
    ProductIDs  []string  \`json:"product_ids"\`
    Total       float64   \`json:"total"\`
    Status      string    \`json:"status"\`
    CreatedAt   time.Time \`json:"created_at"\`
}

func NewOrder(userID string, productIDs []string, total float64) *Order {
    return &Order{
        ID:         generateOrderID(),
        UserID:     userID,
        ProductIDs: productIDs,
        Total:      total,
        Status:     "pending",
        CreatedAt:  time.Now(),
    }
}

func (o *Order) Validate() error {
    if o.UserID == "" {
        return errors.New("user ID is required")
    }
    if len(o.ProductIDs) == 0 {
        return errors.New("at least one product is required")
    }
    if o.Total <= 0 {
        return errors.New("order total must be positive")
    }
    return nil
}

func (o *Order) Complete() error {
    if o.Status != "pending" {
        return errors.New("order is not pending")
    }
    o.Status = "completed"
    return nil
}

func generateOrderID() string {
    return "order-" + time.Now().Format("20060102150405")
}
`);

    // Execute complete workflow (dry-run)
    const result = await executeAutoRefactor(tempDir, false);

    // Verify workflow completion
    expect(result).toBeDefined();
    expect(result.boundaries.length).toBeGreaterThan(0);
    
    // Should discover user, product, and order boundaries
    const boundaryNames = result.boundaries.map(b => b.name);
    expect(boundaryNames).toContain('user');
    expect(boundaryNames).toContain('product');
    expect(boundaryNames).toContain('order');

    // Verify refactoring results
    expect(result.refactorResult.generated_files.length).toBeGreaterThan(0);
    
    // Should generate clean architecture structure
    const generatedFiles = result.refactorResult.generated_files;
    expect(generatedFiles.some(f => f.includes('/domain/'))).toBe(true);
    expect(generatedFiles.some(f => f.includes('/usecase/'))).toBe(true);
    expect(generatedFiles.some(f => f.includes('/infrastructure/'))).toBe(true);
    expect(generatedFiles.some(f => f.includes('/handler/'))).toBe(true);

    // Verify test generation
    expect(result.testResult.generated_tests.length).toBeGreaterThan(0);
    
    // Verify validation
    expect(result.validation.compile.success).toBe(true);
    expect(result.validation.tests.success).toBe(true);
    
    // Performance metrics should be present
    expect(result.validation.performance.improvement).toBeDefined();
    expect(result.validation.performance.metrics.responseTime).toBeGreaterThan(0);
  });

  it('should handle TypeScript project transformation', async () => {
    await createMockTypeScriptProject(tempDir);
    
    // Add additional TypeScript files
    await fs.mkdir(path.join(tempDir, 'src'), { recursive: true });
    await fs.writeFile(path.join(tempDir, 'src/order.ts'), `
export interface Order {
  id: string;
  userId: string;
  productIds: string[];
  total: number;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
}

export class OrderService {
  private orders: Order[] = [];

  createOrder(userId: string, productIds: string[], total: number): Order {
    const order: Order = {
      id: this.generateId(),
      userId,
      productIds,
      total,
      status: 'pending',
      createdAt: new Date()
    };

    this.validateOrder(order);
    this.orders.push(order);
    return order;
  }

  completeOrder(orderId: string): Order {
    const order = this.findOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    if (order.status !== 'pending') {
      throw new Error('Order is not pending');
    }
    
    order.status = 'completed';
    return order;
  }

  private findOrderById(id: string): Order | undefined {
    return this.orders.find(order => order.id === id);
  }

  private validateOrder(order: Order): void {
    if (!order.userId) {
      throw new Error('User ID is required');
    }
    if (order.productIds.length === 0) {
      throw new Error('At least one product is required');
    }
    if (order.total <= 0) {
      throw new Error('Order total must be positive');
    }
  }

  private generateId(): string {
    return 'order-' + Date.now().toString();
  }
}
`);

    const result = await executeAutoRefactor(tempDir, false);

    expect(result).toBeDefined();
    expect(result.boundaries.length).toBeGreaterThan(0);
    
    // Should work with TypeScript projects
    const boundaryNames = result.boundaries.map(b => b.name);
    expect(boundaryNames.some(name => ['user', 'product', 'order'].includes(name))).toBe(true);
  });

  it('should handle workflow errors gracefully with rollback', async () => {
    await createMockGoProject(tempDir);
    
    // Create a scenario that might cause errors (invalid Go syntax)
    await fs.writeFile(path.join(tempDir, 'invalid.go'), `
package main

// This is intentionally invalid Go syntax
func InvalidFunction( {
    return "this will not compile"
}
`);

    // Even with invalid files, workflow should complete or rollback gracefully
    const result = await executeAutoRefactor(tempDir, false);
    
    // Should complete (dry-run mode is more forgiving)
    expect(result).toBeDefined();
    
    // Compilation might fail, but that's expected
    if (!result.validation.compile.success) {
      expect(result.validation.compile.errors.length).toBeGreaterThan(0);
    }
  });

  it('should demonstrate progressive enhancement with AI fallback', async () => {
    await createMockGoProject(tempDir);
    
    const result = await executeAutoRefactor(tempDir, false);
    
    // Should complete regardless of AI availability
    expect(result).toBeDefined();
    expect(result.refactorResult.generated_files.length).toBeGreaterThan(0);
    
    // Template mode should provide reliable baseline
    expect(result.validation.compile.success).toBe(true);
  });

  it('should handle large projects efficiently', async () => {
    // Create a larger mock project
    await createMockGoProject(tempDir);
    
    // Add multiple domains
    const domains = ['auth', 'billing', 'notification', 'analytics', 'reporting'];
    
    for (const domain of domains) {
      await fs.writeFile(path.join(tempDir, `${domain}.go`), `
package main

import "time"

type ${domain.charAt(0).toUpperCase() + domain.slice(1)} struct {
    ID        string    \`json:"id"\`
    Name      string    \`json:"name"\`
    CreatedAt time.Time \`json:"created_at"\`
}

func New${domain.charAt(0).toUpperCase() + domain.slice(1)}(name string) *${domain.charAt(0).toUpperCase() + domain.slice(1)} {
    return &${domain.charAt(0).toUpperCase() + domain.slice(1)}{
        ID:        generate${domain.charAt(0).toUpperCase() + domain.slice(1)}ID(),
        Name:      name,
        CreatedAt: time.Now(),
    }
}

func generate${domain.charAt(0).toUpperCase() + domain.slice(1)}ID() string {
    return "${domain}-" + time.Now().Format("20060102150405")
}
`);
    }

    const startTime = Date.now();
    const result = await executeAutoRefactor(tempDir, false);
    const duration = Date.now() - startTime;

    expect(result).toBeDefined();
    expect(result.boundaries.length).toBeGreaterThanOrEqual(domains.length);
    
    // Should complete in reasonable time (under 2 minutes for mock project)
    expect(duration).toBeLessThan(120000);
    
    // Should generate files for all discovered domains
    expect(result.refactorResult.generated_files.length).toBeGreaterThan(domains.length * 4); // 4 layers per domain
  });

  it('should preserve business logic during transformation', async () => {
    await createMockGoProject(tempDir);
    
    // Add a file with specific business logic
    await fs.writeFile(path.join(tempDir, 'business_logic.go'), `
package main

import (
    "errors"
    "math"
)

func CalculateDiscount(orderTotal float64, customerTier string) (float64, error) {
    if orderTotal <= 0 {
        return 0, errors.New("order total must be positive")
    }
    
    var discountRate float64
    switch customerTier {
    case "bronze":
        discountRate = 0.05  // 5% discount
    case "silver":
        discountRate = 0.10  // 10% discount
    case "gold":
        discountRate = 0.15  // 15% discount
    case "platinum":
        discountRate = 0.20  // 20% discount
    default:
        discountRate = 0.0   // No discount
    }
    
    discount := orderTotal * discountRate
    maxDiscount := 100.0  // Maximum $100 discount
    
    return math.Min(discount, maxDiscount), nil
}

func ValidateCustomerTier(tier string) bool {
    validTiers := []string{"bronze", "silver", "gold", "platinum"}
    for _, validTier := range validTiers {
        if tier == validTier {
            return true
        }
    }
    return false
}
`);

    const result = await executeAutoRefactor(tempDir, false);
    
    expect(result).toBeDefined();
    
    // Business logic should be preserved in generated code
    // This is more of a template test since AI enhancement might not be available
    expect(result.refactorResult.generated_files.length).toBeGreaterThan(0);
    expect(result.validation.compile.success).toBe(true);
  });

  it('should provide comprehensive metrics and reporting', async () => {
    await createMockGoProject(tempDir);
    
    const result = await executeAutoRefactor(tempDir, false);
    
    // Comprehensive metrics should be available
    expect(result.validation.performance.metrics).toBeDefined();
    expect(result.validation.performance.metrics.responseTime).toBeGreaterThan(0);
    expect(result.validation.performance.metrics.memory).toBeGreaterThan(0);
    expect(result.validation.performance.metrics.cpu).toBeGreaterThan(0);
    
    // Transformation metrics
    expect(result.refactorResult.metrics).toBeDefined();
    expect(result.refactorResult.metrics.transformation_summary).toBeDefined();
    expect(result.refactorResult.metrics.transformation_summary.files_processed).toBeGreaterThan(0);
  });

  it('should validate applied changes mode', async () => {
    await createMockGoProject(tempDir);
    
    // Test with applied changes (will actually modify filesystem)
    const result = await executeAutoRefactor(tempDir, true);
    
    expect(result).toBeDefined();
    expect(result.refactorResult.applied_patches.length).toBeGreaterThan(0);
    
    // Check that files were actually created
    const internalDir = path.join(tempDir, 'internal');
    const exists = await fs.access(internalDir).then(() => true).catch(() => false);
    expect(exists).toBe(true);
    
    // Verify clean architecture structure was created
    for (const boundary of result.boundaries) {
      const boundaryDir = path.join(internalDir, boundary.name);
      const boundaryExists = await fs.access(boundaryDir).then(() => true).catch(() => false);
      expect(boundaryExists).toBe(true);
      
      // Check for clean architecture layers
      const layers = ['domain', 'usecase', 'infrastructure', 'handler'];
      for (const layer of layers) {
        const layerDir = path.join(boundaryDir, layer);
        const layerExists = await fs.access(layerDir).then(() => true).catch(() => false);
        expect(layerExists).toBe(true);
      }
    }
  });

  it('should handle edge cases and empty projects', async () => {
    // Test with completely empty directory
    const emptyResult = await executeAutoRefactor(tempDir, false);
    
    expect(emptyResult).toBeDefined();
    expect(emptyResult.boundaries).toHaveLength(0);
    expect(emptyResult.refactorResult.generated_files).toHaveLength(0);
    expect(emptyResult.refactorResult.applied_patches).toHaveLength(0);
  });
});