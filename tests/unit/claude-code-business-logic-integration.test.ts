import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ClaudeCodeBusinessLogicIntegration } from '../../src/core/utils/claude-code-business-logic-integration.js';
import { 
  BusinessLogicExtractResult, 
  ClaudeCodeBusinessLogicRequest,
  ClaudeCodeBusinessLogicResponse 
} from '../../src/core/types/business-logic.js';
import * as fs from 'fs/promises';

// Mock dependencies
vi.mock('fs/promises');

const mockedFs = vi.mocked(fs);

describe('ClaudeCodeBusinessLogicIntegration', () => {
  let integration: ClaudeCodeBusinessLogicIntegration;
  let mockBusinessLogic: BusinessLogicExtractResult;

  beforeEach(() => {
    integration = new ClaudeCodeBusinessLogicIntegration({
      projectRoot: '/tmp/test-project',
      model: 'claude-3-sonnet',
      maxTokens: 4096
    });

    mockBusinessLogic = {
      rules: [
        {
          type: 'validation',
          description: 'Email format validation',
          code: 'isValidEmail(email)',
          location: { file: 'user.go', line: 25 },
          dependencies: ['email'],
          complexity: 'low'
        },
        {
          type: 'calculation',
          description: 'Order total calculation with discounts',
          code: 'calculateOrderTotal(order)',
          location: { file: 'order.go', line: 45 },
          dependencies: ['order', 'items', 'tax', 'shipping'],
          complexity: 'high'
        }
      ],
      dataAccess: [
        {
          operation: 'select',
          table: 'users',
          conditions: ['email', 'status'],
          complexity: 'medium',
          query: 'SELECT * FROM users WHERE email = ? AND status = ?'
        }
      ],
      workflows: [
        {
          name: 'OrderProcessing',
          steps: ['ValidateUser', 'CheckInventory', 'CalculateTotal', 'ProcessPayment'],
          complexity: 'high',
          businessRules: ['UserValidation', 'InventoryCheck', 'PriceCalculation']
        }
      ],
      complexity: {
        overall: 'high',
        details: {
          cyclomaticComplexity: 15,
          businessRules: 2,
          dataAccess: 1,
          workflows: 1
        }
      }
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('business logic analysis with Claude Code', () => {
    it('should analyze complex business logic using Claude Code', async () => {
      const goCode = await fs.readFile('./tests/fixtures/business-logic-samples.go', 'utf8');
      
      // Mock Claude Code API response
      const mockAnalysisResponse = {
        businessLogic: [
          {
            type: 'validation',
            description: 'Complex email validation with domain restrictions',
            complexity: 'high',
            businessImpact: 'critical'
          },
          {
            type: 'calculation',
            description: 'Multi-tier pricing calculation with discounts',
            complexity: 'high',
            businessImpact: 'high'
          },
          {
            type: 'workflow',
            description: 'Order processing workflow with approval logic',
            complexity: 'high',
            businessImpact: 'critical'
          }
        ],
        dataAccess: [
          {
            pattern: 'complex_join',
            complexity: 'high',
            tables: ['orders', 'order_items', 'users'],
            businessCriticality: 'high'
          }
        ],
        risks: [
          'Complex validation logic may be hard to maintain',
          'Pricing calculation scattered across multiple functions'
        ],
        recommendations: [
          'Extract validation rules to domain layer',
          'Centralize pricing logic in dedicated service'
        ]
      };

      // Mock the Claude Code client
      const mockClaudeCodeClient = {
        analyzeBusinessLogic: vi.fn().mockResolvedValue(mockAnalysisResponse),
        getUsage: vi.fn().mockResolvedValue({ tokensUsed: 250, cost: 0.03 })
      };

      integration['claudeCode'] = mockClaudeCodeClient as any;

      const result = await integration.analyzeComplexBusinessLogic(goCode, {
        language: 'go',
        focusAreas: ['validations', 'calculations', 'workflows'],
        includeRisks: true
      });

      expect(result).toBeDefined();
      expect(result.businessLogic).toHaveLength(3);
      expect(result.risks).toHaveLength(2);
      expect(result.recommendations).toHaveLength(2);
      expect(mockClaudeCodeClient.analyzeBusinessLogic).toHaveBeenCalledWith({
        code: goCode,
        language: 'go',
        analysisType: 'comprehensive',
        focusAreas: ['validations', 'calculations', 'workflows'],
        includeRisks: true
      });
    });

    it('should extract business rules with context understanding', async () => {
      const mockExtractionResponse = {
        extractedRules: [
          {
            id: 'user_validation_001',
            type: 'validation',
            name: 'EmailDomainValidation',
            description: 'Validates email format and domain restrictions',
            businessContext: 'Prevents registration from temporary email services',
            implementation: {
              originalCode: 'isValidEmail(email)',
              suggestedDomainCode: 'EmailValidator.ValidateWithDomainRestrictions(email)',
              suggestedUsecaseCode: 'userService.ValidateEmail(email)'
            },
            dependencies: ['email', 'forbiddenDomains'],
            testCases: [
              { input: 'test@example.com', expected: true },
              { input: 'test@temp-mail.org', expected: false }
            ]
          },
          {
            id: 'order_calculation_001',
            type: 'calculation',
            name: 'OrderTotalCalculation',
            description: 'Calculates order total with discounts, tax, and shipping',
            businessContext: 'Core pricing logic affecting revenue',
            implementation: {
              originalCode: 'calculateOrderTotal(order)',
              suggestedDomainCode: 'PriceCalculator.CalculateTotal(order)',
              suggestedUsecaseCode: 'orderService.CalculateOrderTotal(order)'
            },
            dependencies: ['order', 'discountRules', 'taxRate', 'shippingRules'],
            testCases: [
              { input: 'orderWith10Items', expected: 'discountApplied' },
              { input: 'orderUnder50Dollars', expected: 'shippingFeeAdded' }
            ]
          }
        ],
        workflows: [
          {
            id: 'order_processing_workflow',
            name: 'OrderProcessingWorkflow',
            description: 'Complete order processing from validation to confirmation',
            steps: [
              { name: 'ValidateUser', businessLogic: ['user_validation_001'] },
              { name: 'CheckInventory', businessLogic: ['inventory_check_001'] },
              { name: 'CalculateTotal', businessLogic: ['order_calculation_001'] },
              { name: 'ProcessPayment', businessLogic: ['payment_validation_001'] }
            ],
            errorHandling: ['InvalidUserError', 'InsufficientInventoryError', 'PaymentError'],
            businessRules: ['MinimumOrderAmount', 'ApprovalThreshold']
          }
        ]
      };

      const mockClaudeCodeClient = {
        extractBusinessRules: vi.fn().mockResolvedValue(mockExtractionResponse),
        getUsage: vi.fn().mockResolvedValue({ tokensUsed: 180, cost: 0.025 })
      };

      integration['claudeCode'] = mockClaudeCodeClient as any;

      const result = await integration.extractBusinessRulesWithContext(
        'user.go',
        {
          includeTestCases: true,
          suggestArchitecture: 'clean',
          preserveBusinessContext: true
        }
      );

      expect(result.extractedRules).toHaveLength(2);
      expect(result.workflows).toHaveLength(1);
      expect(result.extractedRules[0].testCases).toHaveLength(2);
      expect(result.extractedRules[0].implementation.suggestedDomainCode).toContain('EmailValidator');
    });
  });

  describe('business logic migration with Claude Code', () => {
    it('should migrate business logic to clean architecture', async () => {
      const mockMigrationResponse: ClaudeCodeBusinessLogicResponse = {
        domainLayer: {
          entities: ['User', 'Order', 'OrderItem'],
          valueObjects: ['Email', 'Money', 'Quantity'],
          businessRules: ['EmailValidator', 'PriceCalculator', 'InventoryChecker'],
          workflows: ['OrderProcessingWorkflow']
        },
        usecaseLayer: {
          services: ['UserService', 'OrderService', 'PricingService'],
          businessFlows: ['CreateUserFlow', 'ProcessOrderFlow', 'CalculatePricingFlow'],
          orchestrators: ['OrderOrchestrator']
        },
        preservedLogic: [
          'Email validation with domain restrictions preserved',
          'Complex pricing calculation logic preserved',
          'Order approval workflow preserved',
          'Inventory checking logic preserved'
        ],
        confidence: 0.95,
        warnings: [
          'Complex pricing logic may need manual review',
          'Database transaction boundaries should be verified'
        ]
      };

      const mockClaudeCodeClient = {
        migrateBusinessLogic: vi.fn().mockResolvedValue(mockMigrationResponse),
        getUsage: vi.fn().mockResolvedValue({ tokensUsed: 320, cost: 0.045 })
      };

      integration['claudeCode'] = mockClaudeCodeClient as any;

      const migrationRequest: ClaudeCodeBusinessLogicRequest = {
        originalCode: 'func CreateUser(...) { ... }',
        businessLogic: mockBusinessLogic,
        targetBoundary: {
          name: 'user',
          description: 'User management domain',
          dependencies: ['database', 'email']
        },
        architecture: 'clean',
        preserveMode: 'strict'
      };

      const result = await integration.migrateBusinessLogicToArchitecture(migrationRequest);

      expect(result).toBeDefined();
      expect(result.domainLayer.entities).toHaveLength(3);
      expect(result.domainLayer.businessRules).toHaveLength(3);
      expect(result.usecaseLayer.services).toHaveLength(3);
      expect(result.preservedLogic).toHaveLength(4);
      expect(result.confidence).toBe(0.95);
      expect(result.warnings).toHaveLength(2);

      expect(mockClaudeCodeClient.migrateBusinessLogic).toHaveBeenCalledWith(migrationRequest);
    });

    it('should generate clean architecture code with preserved business logic', async () => {
      const mockGeneratedCode = {
        domainLayer: {
          'entities/user.go': `
package domain

type User struct {
    id       UserID
    email    Email
    password Password
    status   UserStatus
}

func (u *User) ChangeEmail(newEmail Email) error {
    if !newEmail.IsValid() {
        return ErrInvalidEmail
    }
    u.email = newEmail
    return nil
}`,
          'entities/order.go': `
package domain

type Order struct {
    id     OrderID
    userID UserID
    items  []OrderItem
    total  Money
}

func (o *Order) CalculateTotal(calculator PriceCalculator) error {
    total, err := calculator.Calculate(o.items)
    if err != nil {
        return err
    }
    o.total = total
    return nil
}`,
          'valueobjects/email.go': `
package domain

type Email struct {
    value string
}

func NewEmail(value string) (Email, error) {
    if !isValidEmailFormat(value) {
        return Email{}, ErrInvalidEmailFormat
    }
    if isDomainForbidden(value) {
        return Email{}, ErrForbiddenEmailDomain
    }
    return Email{value: strings.ToLower(value)}, nil
}`,
          'services/price_calculator.go': `
package domain

type PriceCalculator interface {
    Calculate(items []OrderItem) (Money, error)
    ApplyDiscounts(total Money, rules []DiscountRule) Money
}`
        },
        usecaseLayer: {
          'services/user_service.go': `
package usecase

type UserService struct {
    userRepo UserRepository
    emailValidator EmailValidator
}

func (s *UserService) CreateUser(email, password string) (*User, error) {
    emailVO, err := NewEmail(email)
    if err != nil {
        return nil, err
    }
    
    if s.userRepo.ExistsByEmail(emailVO) {
        return nil, ErrUserAlreadyExists
    }
    
    user := NewUser(GenerateUserID(), emailVO, password)
    return s.userRepo.Save(user)
}`,
          'services/order_service.go': `
package usecase

type OrderService struct {
    orderRepo OrderRepository
    priceCalculator PriceCalculator
    inventoryService InventoryService
}

func (s *OrderService) ProcessOrder(userID UserID, items []OrderItem) (*Order, error) {
    if err := s.inventoryService.CheckAvailability(items); err != nil {
        return nil, err
    }
    
    order := NewOrder(GenerateOrderID(), userID, items)
    if err := order.CalculateTotal(s.priceCalculator); err != nil {
        return nil, err
    }
    
    return s.orderRepo.Save(order)
}`
        }
      };

      const mockClaudeCodeClient = {
        generateCleanArchitectureCode: vi.fn().mockResolvedValue(mockGeneratedCode),
        getUsage: vi.fn().mockResolvedValue({ tokensUsed: 450, cost: 0.06 })
      };

      integration['claudeCode'] = mockClaudeCodeClient as any;

      const result = await integration.generateArchitectureCode({
        businessLogic: mockBusinessLogic,
        architecture: 'clean',
        targetBoundary: 'user',
        preserveBusinessRules: true,
        generateTests: true
      });

      expect(result.domainLayer).toBeDefined();
      expect(result.usecaseLayer).toBeDefined();
      expect(Object.keys(result.domainLayer)).toHaveLength(4);
      expect(Object.keys(result.usecaseLayer)).toHaveLength(2);
      
      // 業務ロジックが保存されていることを確認
      expect(result.domainLayer['valueobjects/email.go']).toContain('isValidEmailFormat');
      expect(result.domainLayer['valueobjects/email.go']).toContain('isDomainForbidden');
      expect(result.usecaseLayer['services/order_service.go']).toContain('CheckAvailability');
    });

    it('should handle complex business workflows', async () => {
      const complexWorkflow = {
        name: 'OrderProcessingWorkflow',
        steps: [
          'AuthenticateUser',
          'ValidateOrderItems', 
          'CheckInventoryAvailability',
          'CalculatePricingWithDiscounts',
          'ValidatePaymentMethod',
          'ProcessPayment',
          'UpdateInventory',
          'CreateOrder',
          'SendConfirmationEmail'
        ],
        businessRules: [
          'OnlyActiveUsersCanOrder',
          'MinimumOrderAmount',
          'InventoryReservation',
          'PricingCalculationWithTax',
          'PaymentValidation',
          'ApprovalThresholdCheck'
        ],
        errorHandling: [
          'UserNotActiveError',
          'InsufficientInventoryError',
          'PaymentProcessingError',
          'EmailDeliveryError'
        ],
        complexity: 'high' as const
      };

      const mockWorkflowMigration = {
        domainLayer: {
          workflows: ['OrderProcessingWorkflow'],
          businessRules: [
            'UserStatusChecker',
            'OrderAmountValidator', 
            'InventoryChecker',
            'PriceCalculator',
            'PaymentValidator'
          ]
        },
        usecaseLayer: {
          orchestrators: ['OrderProcessingOrchestrator'],
          businessFlows: ['ProcessOrderFlow'],
          services: ['OrderService', 'PaymentService', 'InventoryService', 'NotificationService']
        },
        infrastructureLayer: {
          repositories: ['OrderRepository', 'UserRepository', 'InventoryRepository'],
          adapters: ['PaymentGatewayAdapter', 'EmailServiceAdapter']
        },
        preservedLogic: [
          'User authentication and authorization logic preserved',
          'Inventory checking and reservation logic preserved',
          'Complex pricing calculation with discounts preserved',
          'Payment processing workflow preserved',
          'Error handling and rollback logic preserved'
        ]
      };

      const mockClaudeCodeClient = {
        migrateComplexWorkflow: vi.fn().mockResolvedValue(mockWorkflowMigration),
        getUsage: vi.fn().mockResolvedValue({ tokensUsed: 380, cost: 0.05 })
      };

      integration['claudeCode'] = mockClaudeCodeClient as any;

      const result = await integration.migrateComplexWorkflow({
        workflow: complexWorkflow,
        targetArchitecture: 'clean',
        preserveTransactionBoundaries: true,
        generateErrorHandling: true
      });

      expect(result.domainLayer.workflows).toContain('OrderProcessingWorkflow');
      expect(result.usecaseLayer.orchestrators).toContain('OrderProcessingOrchestrator');
      expect(result.preservedLogic).toHaveLength(5);
      expect(result.infrastructureLayer?.repositories).toHaveLength(3);
    });
  });

  describe('business logic validation and verification', () => {
    it('should validate migrated business logic completeness', async () => {
      const originalBusinessLogic = mockBusinessLogic;
      const migratedCode = {
        domain_layer: {
          entities: ['User', 'Order'],
          valueObjects: ['Email'],
          businessRules: ['EmailValidator', 'PriceCalculator']
        },
        usecase_layer: {
          services: ['UserService', 'OrderService']
        }
      };

      const mockValidationResult = {
        completeness: {
          score: 0.95,
          missing: [],
          preserved: ['EmailValidation', 'PriceCalculation']
        },
        businessRuleCoverage: {
          total: 2,
          covered: 2,
          percentage: 100
        },
        workflowCoverage: {
          total: 1,
          covered: 1,
          percentage: 100
        },
        suggestions: [
          'Consider adding more comprehensive error handling',
          'Add domain events for better separation of concerns'
        ],
        confidence: 0.95
      };

      const mockClaudeCodeClient = {
        validateBusinessLogicMigration: vi.fn().mockResolvedValue(mockValidationResult),
        getUsage: vi.fn().mockResolvedValue({ tokensUsed: 120, cost: 0.015 })
      };

      integration['claudeCode'] = mockClaudeCodeClient as any;

      const result = await integration.validateMigratedBusinessLogic({
        originalBusinessLogic,
        migratedCode,
        validationCriteria: {
          checkCompleteness: true,
          checkBusinessRuleCoverage: true,
          checkWorkflowCoverage: true,
          requireFullCoverage: false
        }
      });

      expect(result.completeness.score).toBe(0.95);
      expect(result.businessRuleCoverage.percentage).toBe(100);
      expect(result.workflowCoverage.percentage).toBe(100);
      expect(result.suggestions).toHaveLength(2);
    });

    it('should detect missing business logic in migration', async () => {
      const incompleteValidationResult = {
        completeness: {
          score: 0.65,
          missing: ['InventoryCheckLogic', 'PaymentValidationLogic'],
          preserved: ['EmailValidation']
        },
        businessRuleCoverage: {
          total: 3,
          covered: 1,
          percentage: 33.3
        },
        criticalMissing: [
          {
            type: 'business_rule',
            name: 'InventoryValidation',
            impact: 'high',
            reason: 'Critical for order processing'
          },
          {
            type: 'workflow_step',
            name: 'PaymentProcessing',
            impact: 'critical',
            reason: 'Essential for order completion'
          }
        ],
        recommendations: [
          'Add InventoryChecker to domain layer',
          'Implement PaymentValidator service',
          'Ensure all business rules are covered before production deployment'
        ]
      };

      const mockClaudeCodeClient = {
        validateBusinessLogicMigration: vi.fn().mockResolvedValue(incompleteValidationResult),
        getUsage: vi.fn().mockResolvedValue({ tokensUsed: 90, cost: 0.012 })
      };

      integration['claudeCode'] = mockClaudeCodeClient as any;

      const result = await integration.validateMigratedBusinessLogic({
        originalBusinessLogic: mockBusinessLogic,
        migratedCode: {
          domain_layer: { entities: ['User'] },
          usecase_layer: { services: ['UserService'] }
        },
        validationCriteria: {
          checkCompleteness: true,
          requireFullCoverage: true
        }
      });

      expect(result.completeness.score).toBe(0.65);
      expect(result.missing).toHaveLength(2);
      expect(result.criticalMissing).toHaveLength(2);
      expect(result.businessRuleCoverage.percentage).toBe(33.3);
    });
  });

  describe('error handling and fallback', () => {
    it('should handle Claude Code API failures gracefully', async () => {
      const mockClaudeCodeClient = {
        migrateBusinessLogic: vi.fn().mockRejectedValue(new Error('API rate limit exceeded')),
        getUsage: vi.fn().mockResolvedValue({ tokensUsed: 0, cost: 0 })
      };

      integration['claudeCode'] = mockClaudeCodeClient as any;

      const request: ClaudeCodeBusinessLogicRequest = {
        originalCode: 'func CreateUser() {}',
        businessLogic: mockBusinessLogic,
        targetBoundary: { name: 'user', description: 'User domain', dependencies: [] },
        architecture: 'clean'
      };

      // エラー時はフォールバック結果を返す
      const result = await integration.migrateBusinessLogicWithFallback(request);

      expect(result).toBeDefined();
      expect(result.fallbackUsed).toBe(true);
      expect(result.error).toContain('API rate limit exceeded');
      expect(result.preservedLogic).toEqual(['Business logic preserved in fallback mode']);
    });

    it('should provide usage statistics and cost tracking', async () => {
      const mockUsageStats = {
        sessionUsage: {
          totalTokens: 1200,
          totalCost: 0.18,
          requestCount: 5,
          averageTokensPerRequest: 240
        },
        apiLimits: {
          dailyTokenLimit: 100000,
          remainingTokens: 98800,
          rateLimitStatus: 'healthy'
        },
        recommendations: [
          'Consider batching similar requests',
          'Current usage is within optimal range'
        ]
      };

      const mockClaudeCodeClient = {
        getDetailedUsage: vi.fn().mockResolvedValue(mockUsageStats)
      };

      integration['claudeCode'] = mockClaudeCodeClient as any;

      const stats = await integration.getUsageStatistics();

      expect(stats.sessionUsage.totalTokens).toBe(1200);
      expect(stats.sessionUsage.totalCost).toBe(0.18);
      expect(stats.apiLimits.remainingTokens).toBe(98800);
      expect(stats.recommendations).toHaveLength(2);
    });
  });
});