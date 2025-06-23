import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BusinessLogicMigrationAgent } from '../../src/core/agents/business-logic-migration-agent.js';
import { DomainBoundary } from '../../src/core/types/config.js';
import { BusinessLogicExtractResult, LogicMigrationResult } from '../../src/core/types/business-logic.js';
import * as fs from 'fs/promises';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('../../src/core/utils/claude-code-integration.js');

const mockedFs = vi.mocked(fs);

describe('BusinessLogicMigrationAgent', () => {
  let agent: BusinessLogicMigrationAgent;
  let tempDir: string;
  let mockBoundary: DomainBoundary;

  beforeEach(() => {
    tempDir = '/tmp/test-project';
    agent = new BusinessLogicMigrationAgent(tempDir);
    
    mockBoundary = {
      name: 'user',
      description: 'User management domain',
      files: ['user.go'],
      dependencies: ['database'],
      semantic_keywords: ['user', 'auth', 'login'],
      confidence: 0.9,
      boundary_type: 'auto_discovered'
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('business logic extraction', () => {
    it('should extract business rules from Go code', async () => {
      // モノリシックなGoコードのサンプル
      const goCode = `
        package main
        
        import "errors"
        
        type User struct {
          ID       string
          Email    string
          Password string
          Status   string
        }
        
        func CreateUser(email, password string) (*User, error) {
          // 業務ルール: メールアドレス検証
          if !isValidEmail(email) {
            return nil, errors.New("invalid email format")
          }
          
          // 業務ルール: パスワード強度チェック
          if len(password) < 8 {
            return nil, errors.New("password must be at least 8 characters")
          }
          
          // 業務ルール: ユーザー重複チェック
          if userExists(email) {
            return nil, errors.New("user already exists")
          }
          
          user := &User{
            ID:       generateUserID(),
            Email:    email,
            Password: hashPassword(password),
            Status:   "active",
          }
          
          return user, nil
        }
        
        func isValidEmail(email string) bool {
          // 複雑なメール検証ロジック
          return len(email) > 0 && strings.Contains(email, "@")
        }
        
        func hashPassword(password string) string {
          // パスワードハッシュ化ロジック
          return "hashed_" + password
        }
      `;

      mockedFs.readFile.mockResolvedValue(goCode);

      const result = await agent.extractBusinessLogic('user.go');

      expect(result).toBeDefined();
      expect(result.rules).toHaveLength(3);
      expect(result.rules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'validation',
            description: 'Email format validation',
            code: expect.stringContaining('isValidEmail'),
            complexity: 'low'
          }),
          expect.objectContaining({
            type: 'validation', 
            description: 'Password strength requirement',
            code: expect.stringContaining('len(password) < 8'),
            complexity: 'low'
          }),
          expect.objectContaining({
            type: 'constraint',
            description: 'User uniqueness check',
            code: expect.stringContaining('userExists'),
            complexity: 'medium'
          })
        ])
      );
    });

    it('should extract complex business calculations', async () => {
      const goCode = `
        package main
        
        func CalculateShippingCost(weight float64, distance float64, isPriority bool) float64 {
          baseCost := 5.0
          
          // 重量による料金計算
          if weight > 10 {
            baseCost += (weight - 10) * 0.5
          }
          
          // 距離による料金計算
          distanceCost := distance * 0.1
          if distance > 100 {
            distanceCost *= 0.8 // 長距離割引
          }
          
          totalCost := baseCost + distanceCost
          
          // 優先配送料金
          if isPriority {
            totalCost *= 1.5
          }
          
          return totalCost
        }
      `;

      mockedFs.readFile.mockResolvedValue(goCode);

      const result = await agent.extractBusinessLogic('shipping.go');

      expect(result.rules).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            type: 'calculation',
            description: 'Shipping cost calculation',
            dependencies: ['weight', 'distance', 'isPriority'],
            complexity: 'high'
          })
        ])
      );
    });

    it('should identify data access patterns', async () => {
      const goCode = `
        package main
        
        import "database/sql"
        
        func GetUserByEmail(db *sql.DB, email string) (*User, error) {
          var user User
          query := "SELECT id, email, status FROM users WHERE email = ? AND status = 'active'"
          err := db.QueryRow(query, email).Scan(&user.ID, &user.Email, &user.Status)
          if err != nil {
            return nil, err
          }
          return &user, nil
        }
        
        func UpdateUserStatus(db *sql.DB, userID string, status string) error {
          query := "UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?"
          _, err := db.Exec(query, status, userID)
          return err
        }
      `;

      mockedFs.readFile.mockResolvedValue(goCode);

      const result = await agent.extractBusinessLogic('user_repository.go');

      expect(result.dataAccess).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            operation: 'select',
            table: 'users',
            conditions: ['email', 'status'],
            complexity: 'medium'
          }),
          expect.objectContaining({
            operation: 'update',
            table: 'users',
            fields: ['status', 'updated_at'],
            complexity: 'low'
          })
        ])
      );
    });
  });

  describe('business logic migration with Claude Code', () => {
    it('should migrate business rules to clean architecture', async () => {
      const mockClaudeCode = {
        analyzeCode: vi.fn().mockResolvedValue({
          businessLogic: [
            { type: 'validation', description: 'Email validation' },
            { type: 'calculation', description: 'Price calculation' }
          ]
        }),
        migrateBusinessLogic: vi.fn().mockResolvedValue({
          domainLayer: {
            entities: ['User', 'Order'],
            valueObjects: ['Email', 'Price'],
            businessRules: ['EmailValidator', 'PriceCalculator']
          },
          usecaseLayer: {
            services: ['UserService', 'OrderService'],
            businessFlows: ['CreateUserFlow', 'ProcessOrderFlow']
          },
          preservedLogic: ['All business rules preserved']
        }),
        getUsage: vi.fn().mockResolvedValue({ tokensUsed: 150, cost: 0.02 })
      };

      agent['claudeCode'] = mockClaudeCode as any;

      const extractResult: BusinessLogicExtractResult = {
        rules: [
          {
            type: 'validation',
            description: 'Email format validation',
            code: 'isValidEmail(email)',
            location: { file: 'user.go', line: 25 },
            dependencies: ['email'],
            complexity: 'low'
          }
        ],
        dataAccess: [],
        workflows: [],
        complexity: { overall: 'medium', details: {} }
      };

      const result = await agent.migrateBusinessLogic(
        'user.go',
        extractResult,
        mockBoundary
      );

      expect(result).toBeDefined();
      expect(result.migrated_code).toBeDefined();
      expect(result.migrated_code.domain_layer).toBeDefined();
      expect(result.migrated_code.usecase_layer).toBeDefined();
      expect(result.preserved_logic).toHaveLength(1);
      expect(mockClaudeCode.migrateBusinessLogic).toHaveBeenCalledWith({
        originalCode: expect.any(String),
        businessLogic: extractResult,
        targetBoundary: mockBoundary,
        architecture: 'clean'
      });
    });

    it('should preserve complex business workflows', async () => {
      const mockClaudeCode = {
        analyzeCode: vi.fn(),
        migrateBusinessLogic: vi.fn().mockResolvedValue({
          domainLayer: {
            workflows: ['OrderProcessingWorkflow'],
            businessRules: ['PaymentValidation', 'InventoryCheck']
          },
          usecaseLayer: {
            orchestrators: ['OrderOrchestrator'],
            businessFlows: ['CompleteOrderFlow']
          },
          preservedLogic: [
            'Payment validation logic preserved',
            'Inventory checking logic preserved',
            'Order state transitions preserved'
          ]
        }),
        getUsage: vi.fn().mockResolvedValue({ tokensUsed: 300, cost: 0.05 })
      };

      agent['claudeCode'] = mockClaudeCode as any;

      const complexWorkflow: BusinessLogicExtractResult = {
        rules: [],
        dataAccess: [],
        workflows: [
          {
            name: 'OrderProcessing',
            steps: ['ValidatePayment', 'CheckInventory', 'CreateOrder', 'SendConfirmation'],
            complexity: 'high',
            businessRules: ['PaymentRule', 'InventoryRule']
          }
        ],
        complexity: { overall: 'high', details: { workflows: 1 } }
      };

      const result = await agent.migrateBusinessLogic(
        'order_processor.go',
        complexWorkflow,
        mockBoundary
      );

      expect(result.preserved_logic).toHaveLength(3);
      expect(result.migrated_code.domain_layer.workflows).toBeDefined();
      expect(result.migrated_code.usecase_layer.orchestrators).toBeDefined();
    });

    it('should handle migration failures gracefully', async () => {
      const mockClaudeCode = {
        analyzeCode: vi.fn(),
        migrateBusinessLogic: vi.fn().mockRejectedValue(new Error('AI service unavailable')),
        getUsage: vi.fn().mockResolvedValue({ tokensUsed: 0, cost: 0 })
      };

      agent['claudeCode'] = mockClaudeCode as any;

      const extractResult: BusinessLogicExtractResult = {
        rules: [{ 
          type: 'validation', 
          description: 'Test rule',
          code: 'test code',
          location: { file: 'test.go', line: 1 },
          dependencies: [],
          complexity: 'low'
        }],
        dataAccess: [],
        workflows: [],
        complexity: { overall: 'low', details: {} }
      };

      // 失敗時はテンプレートベースのフォールバックを使用
      const result = await agent.migrateBusinessLogic(
        'test.go',
        extractResult,
        mockBoundary
      );

      expect(result).toBeDefined();
      expect(result.fallback_used).toBe(true);
      expect(result.preserved_logic).toEqual(['Business logic preserved in template format']);
    });
  });

  describe('business logic validation', () => {
    it('should validate migrated business logic correctness', async () => {
      const originalCode = 'func ValidateUser(user User) error { return nil }';
      const migratedCode = {
        domain_layer: {
          entities: ['User'],
          businessRules: ['UserValidator']
        },
        usecase_layer: {
          services: ['UserValidationService']
        }
      };

      mockedFs.readFile.mockResolvedValue(originalCode);

      const result = await agent.validateMigratedLogic(
        'user.go',
        migratedCode
      );

      expect(result).toBeDefined();
      expect(result.validation_passed).toBe(true);
      expect(result.coverage_percentage).toBeGreaterThan(0);
      expect(result.missing_logic).toHaveLength(0);
    });

    it('should detect missing business logic in migration', async () => {
      const originalCode = `
        func ProcessOrder(order Order) error {
          if !validatePayment(order.Payment) {
            return errors.New("invalid payment")
          }
          if !checkInventory(order.Items) {
            return errors.New("insufficient inventory") 
          }
          return createOrder(order)
        }
      `;

      const incompleteMigration = {
        domain_layer: {
          entities: ['Order']
        },
        usecase_layer: {
          services: ['OrderService']
        }
      };

      mockedFs.readFile.mockResolvedValue(originalCode);

      const result = await agent.validateMigratedLogic(
        'order.go',
        incompleteMigration
      );

      expect(result.validation_passed).toBe(false);
      expect(result.missing_logic).toEqual(
        expect.arrayContaining([
          'Payment validation logic',
          'Inventory checking logic'
        ])
      );
      expect(result.coverage_percentage).toBeLessThan(100);
    });
  });

  describe('integration with existing refactor flow', () => {
    it('should integrate with HybridRefactorAgent', async () => {
      // HybridRefactorAgentとの統合テスト
      const mockExtractResult: BusinessLogicExtractResult = {
        rules: [
          {
            type: 'validation',
            description: 'User validation',
            code: 'validateUser(user)',
            location: { file: 'user.go', line: 10 },
            dependencies: ['user'],
            complexity: 'medium'
          }
        ],
        dataAccess: [],
        workflows: [],
        complexity: { overall: 'medium', details: {} }
      };

      const extractSpy = vi.spyOn(agent, 'extractBusinessLogic')
        .mockResolvedValue(mockExtractResult);
      const migrateSpy = vi.spyOn(agent, 'migrateBusinessLogic')
        .mockResolvedValue({
          migrated_code: {
            domain_layer: { entities: ['User'] },
            usecase_layer: { services: ['UserService'] }
          },
          preserved_logic: ['User validation preserved'],
          fallback_used: false
        });

      const result = await agent.processFileWithBusinessLogic(
        'user.go',
        mockBoundary
      );

      expect(extractSpy).toHaveBeenCalledWith('user.go');
      expect(migrateSpy).toHaveBeenCalledWith('user.go', mockExtractResult, mockBoundary);
      expect(result).toBeDefined();
      expect(result.business_logic_migrated).toBe(true);
    });
  });
});