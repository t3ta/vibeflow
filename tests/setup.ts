import { beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

// Global test setup
beforeAll(async () => {
  // Suppress console output during tests unless explicitly needed
  const originalConsole = console;
  global.console = {
    ...console,
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn()
  };
  
  // Store original for restoration
  (global as any).__originalConsole = originalConsole;
  
  // Create test results directory
  try {
    await fs.mkdir('./tests/results', { recursive: true });
  } catch (error) {
    // Directory might already exist
  }
});

afterAll(async () => {
  // Restore original console
  if ((global as any).__originalConsole) {
    global.console = (global as any).__originalConsole;
  }
});

beforeEach(() => {
  // Clear all mocks before each test
  vi.clearAllMocks();
  
  // Reset modules to ensure clean state
  vi.resetModules();
});

afterEach(() => {
  // Clean up any temporary files or state
  vi.restoreAllMocks();
});

// Utility functions for tests
export const createTempDir = async (prefix: string = 'vibeflow-test'): Promise<string> => {
  const tempDir = path.join('/tmp', `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`);
  await fs.mkdir(tempDir, { recursive: true });
  return tempDir;
};

export const cleanupTempDir = async (tempDir: string): Promise<void> => {
  try {
    await fs.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
};

export const createMockFile = async (filePath: string, content: string): Promise<void> => {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content);
};

export const createMockGoProject = async (projectDir: string): Promise<void> => {
  await createMockFile(path.join(projectDir, 'go.mod'), `
module test-project

go 1.21
`);

  await createMockFile(path.join(projectDir, 'main.go'), `
package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}
`);

  await createMockFile(path.join(projectDir, 'user.go'), `
package main

import (
    "errors"
    "time"
)

type User struct {
    ID        string    \`json:"id"\`
    Name      string    \`json:"name"\`
    Email     string    \`json:"email"\`
    CreatedAt time.Time \`json:"created_at"\`
}

func NewUser(name, email string) *User {
    return &User{
        ID:        generateID(),
        Name:      name,
        Email:     email,
        CreatedAt: time.Now(),
    }
}

func (u *User) Validate() error {
    if u.Name == "" {
        return errors.New("name is required")
    }
    if u.Email == "" {
        return errors.New("email is required")
    }
    return nil
}

func generateID() string {
    return "user-" + time.Now().Format("20060102150405")
}
`);

  await createMockFile(path.join(projectDir, 'product.go'), `
package main

import (
    "errors"
    "time"
)

type Product struct {
    ID          string    \`json:"id"\`
    Name        string    \`json:"name"\`
    Price       float64   \`json:"price"\`
    Description string    \`json:"description"\`
    CreatedAt   time.Time \`json:"created_at"\`
}

func NewProduct(name, description string, price float64) *Product {
    return &Product{
        ID:          generateProductID(),
        Name:        name,
        Description: description,
        Price:       price,
        CreatedAt:   time.Now(),
    }
}

func (p *Product) Validate() error {
    if p.Name == "" {
        return errors.New("product name is required")
    }
    if p.Price <= 0 {
        return errors.New("product price must be positive")
    }
    return nil
}

func generateProductID() string {
    return "prod-" + time.Now().Format("20060102150405")
}
`);
};

export const createMockTypeScriptProject = async (projectDir: string): Promise<void> => {
  await createMockFile(path.join(projectDir, 'package.json'), `
{
  "name": "test-project",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "test": "jest"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^18.0.0"
  }
}
`);

  await createMockFile(path.join(projectDir, 'tsconfig.json'), `
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "strict": true,
    "esModuleInterop": true
  },
  "include": ["src/**/*"]
}
`);

  await createMockFile(path.join(projectDir, 'src/user.ts'), `
export interface User {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export class UserService {
  private users: User[] = [];

  createUser(name: string, email: string): User {
    const user: User = {
      id: this.generateId(),
      name,
      email,
      createdAt: new Date()
    };

    this.validateUser(user);
    this.users.push(user);
    return user;
  }

  getUserById(id: string): User | undefined {
    return this.users.find(user => user.id === id);
  }

  private validateUser(user: User): void {
    if (!user.name) {
      throw new Error('Name is required');
    }
    if (!user.email) {
      throw new Error('Email is required');
    }
  }

  private generateId(): string {
    return 'user-' + Date.now().toString();
  }
}
`);

  await createMockFile(path.join(projectDir, 'src/product.ts'), `
export interface Product {
  id: string;
  name: string;
  price: number;
  description: string;
  createdAt: Date;
}

export class ProductService {
  private products: Product[] = [];

  createProduct(name: string, description: string, price: number): Product {
    const product: Product = {
      id: this.generateId(),
      name,
      description,
      price,
      createdAt: new Date()
    };

    this.validateProduct(product);
    this.products.push(product);
    return product;
  }

  getProductById(id: string): Product | undefined {
    return this.products.find(product => product.id === id);
  }

  private validateProduct(product: Product): void {
    if (!product.name) {
      throw new Error('Product name is required');
    }
    if (product.price <= 0) {
      throw new Error('Product price must be positive');
    }
  }

  private generateId(): string {
    return 'prod-' + Date.now().toString();
  }
}
`);
};

// Mock implementations for common dependencies
export const mockFileSystem = () => {
  const mockFs = vi.hoisted(() => ({
    readFile: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    stat: vi.fn(),
    access: vi.fn(),
    mkdir: vi.fn(),
    rm: vi.fn(),
    existsSync: vi.fn()
  }));

  vi.mock('fs/promises', () => mockFs);
  vi.mock('fs', () => ({ ...mockFs, existsSync: mockFs.existsSync }));

  return mockFs;
};

export const mockChildProcess = () => {
  const mockExecSync = vi.fn();
  vi.mock('child_process', () => ({
    execSync: mockExecSync
  }));
  return { execSync: mockExecSync };
};

// Test data generators
export const generateMockBoundary = (overrides: Partial<any> = {}) => ({
  name: 'test-boundary',
  description: 'Test boundary description',
  files: ['test.go'],
  dependencies: [],
  semantic_keywords: ['test'],
  confidence: 0.9,
  boundary_type: 'auto_discovered',
  ...overrides
});

export const generateMockRefactorResult = (overrides: Partial<any> = {}) => ({
  applied_patches: ['file1.go'],
  failed_patches: [],
  generated_files: ['internal/test/domain/test.go'],
  compilation_result: {
    success: true,
    errors: [],
    warnings: []
  },
  test_result: {
    success: true,
    passed: 10,
    failed: 0,
    failedTests: [],
    coverage: 85
  },
  metrics: {
    transformation_summary: {
      files_processed: 1,
      modules_created: 1
    }
  },
  ...overrides
});