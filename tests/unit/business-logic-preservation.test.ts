import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BusinessLogicPreservationValidator } from '../../src/core/validators/business-logic-preservation-validator.js';
import { 
  BusinessLogicExtractResult, 
  BusinessLogicValidationResult,
  MigratedBusinessLogic 
} from '../../src/core/types/business-logic.js';
import * as fs from 'fs/promises';

// Mock dependencies
vi.mock('fs/promises');

const mockedFs = vi.mocked(fs);

describe('BusinessLogicPreservationValidator', () => {
  let validator: BusinessLogicPreservationValidator;
  let originalBusinessLogic: BusinessLogicExtractResult;
  let migratedCode: MigratedBusinessLogic;

  beforeEach(() => {
    validator = new BusinessLogicPreservationValidator();

    originalBusinessLogic = {
      rules: [
        {
          type: 'validation',
          description: 'Email format validation with domain restrictions',
          code: `
            func isValidEmail(email string) bool {
              if !strings.Contains(email, "@") {
                return false
              }
              forbiddenDomains := []string{"temp-mail.org", "10minutemail.com"}
              for _, domain := range forbiddenDomains {
                if strings.HasSuffix(email, "@"+domain) {
                  return false
                }
              }
              return emailRegex.MatchString(email)
            }
          `,
          location: { file: 'user.go', line: 25 },
          dependencies: ['email', 'forbiddenDomains', 'emailRegex'],
          complexity: 'medium'
        },
        {
          type: 'calculation',
          description: 'Order total calculation with discounts and tax',
          code: `
            func calculateOrderTotal(order *Order) (float64, error) {
              var total float64
              for _, item := range order.Items {
                itemTotal := item.Price * float64(item.Quantity)
                if item.Quantity >= 10 {
                  itemTotal *= 0.9 // 10% discount
                }
                total += itemTotal
              }
              tax := total * 0.08
              shipping := 0.0
              if total < 50.0 {
                shipping = 5.0
              }
              return total + tax + shipping, nil
            }
          `,
          location: { file: 'order.go', line: 45 },
          dependencies: ['order', 'items', 'discountRate', 'taxRate', 'shippingThreshold'],
          complexity: 'high'
        },
        {
          type: 'constraint',
          description: 'User account locking after failed login attempts',
          code: `
            func AuthenticateUser(email, password string) (*User, error) {
              user, err := getUserByEmail(email)
              if err != nil {
                return nil, err
              }
              if user.FailedLogins >= 5 {
                return nil, errors.New("account is locked")
              }
              if !verifyPassword(password, user.Password) {
                incrementFailedLogins(user.ID)
                return nil, errors.New("invalid credentials")
              }
              user.FailedLogins = 0
              updateUserLoginInfo(user)
              return user, nil
            }
          `,
          location: { file: 'auth.go', line: 15 },
          dependencies: ['email', 'password', 'user', 'failedLoginThreshold'],
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
        },
        {
          operation: 'update',
          table: 'users',
          fields: ['failed_logins', 'last_login'],
          complexity: 'low'
        }
      ],
      workflows: [
        {
          name: 'OrderProcessing',
          steps: ['ValidateUser', 'CheckInventory', 'CalculateTotal', 'ProcessPayment'],
          complexity: 'high',
          businessRules: ['UserValidation', 'InventoryCheck', 'PriceCalculation', 'PaymentValidation']
        }
      ],
      complexity: {
        overall: 'high',
        details: {
          cyclomaticComplexity: 20,
          businessRules: 3,
          dataAccess: 2,
          workflows: 1
        }
      }
    };

    migratedCode = {
      domain_layer: {
        entities: ['User', 'Order', 'OrderItem'],
        valueObjects: ['Email', 'Money'],
        businessRules: ['EmailValidator', 'PriceCalculator', 'AccountLockingPolicy'],
        workflows: ['OrderProcessingWorkflow']
      },
      usecase_layer: {
        services: ['UserService', 'OrderService', 'AuthenticationService'],
        businessFlows: ['CreateUserFlow', 'ProcessOrderFlow', 'AuthenticateUserFlow'],
        commands: ['CreateUserCommand', 'ProcessOrderCommand'],
        queries: ['GetUserByEmailQuery', 'GetOrderHistoryQuery']
      },
      infrastructure_layer: {
        repositories: ['UserRepository', 'OrderRepository'],
        adapters: ['EmailServiceAdapter', 'PaymentGatewayAdapter']
      }
    };

    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('business rule preservation validation', () => {
    it('should validate that all business rules are preserved', async () => {
      // 完全なマイグレーションのシミュレーション
      const completeValidation: BusinessLogicValidationResult = {
        validation_passed: true,
        coverage_percentage: 100,
        missing_logic: [],
        suggestions: [
          'Consider adding domain events for better decoupling',
          'Add more comprehensive error handling'
        ],
        confidence_score: 0.95
      };

      const result = await validator.validateBusinessRulePreservation(
        originalBusinessLogic,
        migratedCode
      );

      expect(result.validation_passed).toBe(true);
      expect(result.coverage_percentage).toBe(100);
      expect(result.missing_logic).toHaveLength(0);
      
      // 各業務ルールが適切に移行されていることを確認
      const ruleMapping = result.rule_mapping;
      expect(ruleMapping).toBeDefined();
      expect(ruleMapping['Email format validation']).toEqual({
        original_location: 'user.go:25',
        migrated_to: 'domain_layer.businessRules.EmailValidator',
        preservation_status: 'fully_preserved'
      });
      expect(ruleMapping['Order total calculation']).toEqual({
        original_location: 'order.go:45', 
        migrated_to: 'domain_layer.businessRules.PriceCalculator',
        preservation_status: 'fully_preserved'
      });
    });

    it('should detect missing business rules in migration', async () => {
      // 不完全なマイグレーションのシミュレーション
      const incompleteMigration: MigratedBusinessLogic = {
        domain_layer: {
          entities: ['User'],
          valueObjects: ['Email'],
          businessRules: ['EmailValidator'], // PriceCalculatorとAccountLockingPolicyが不足
        },
        usecase_layer: {
          services: ['UserService']
        }
      };

      const result = await validator.validateBusinessRulePreservation(
        originalBusinessLogic,
        incompleteMigration
      );

      expect(result.validation_passed).toBe(false);
      expect(result.coverage_percentage).toBeLessThan(100);
      expect(result.missing_logic).toEqual([
        'Order total calculation with discounts and tax',
        'User account locking after failed login attempts'
      ]);
      expect(result.suggestions).toContain('Implement missing PriceCalculator for order calculations');
      expect(result.suggestions).toContain('Implement missing AccountLockingPolicy for authentication');
    });

    it('should validate complex business workflows preservation', async () => {
      const workflowValidation = await validator.validateWorkflowPreservation(
        originalBusinessLogic.workflows,
        migratedCode
      );

      expect(workflowValidation.workflows_preserved).toBe(true);
      expect(workflowValidation.workflow_mapping).toBeDefined();
      expect(workflowValidation.workflow_mapping['OrderProcessing']).toEqual({
        original_steps: ['ValidateUser', 'CheckInventory', 'CalculateTotal', 'ProcessPayment'],
        migrated_to: 'domain_layer.workflows.OrderProcessingWorkflow',
        preservation_status: 'fully_preserved',
        step_mapping: {
          'ValidateUser': 'usecase_layer.services.AuthenticationService',
          'CheckInventory': 'infrastructure_layer.adapters.InventoryServiceAdapter',
          'CalculateTotal': 'domain_layer.businessRules.PriceCalculator', 
          'ProcessPayment': 'infrastructure_layer.adapters.PaymentGatewayAdapter'
        }
      });
    });

    it('should validate data access pattern preservation', async () => {
      const dataAccessValidation = await validator.validateDataAccessPreservation(
        originalBusinessLogic.dataAccess,
        migratedCode
      );

      expect(dataAccessValidation.data_access_preserved).toBe(true);
      expect(dataAccessValidation.pattern_mapping).toBeDefined();
      expect(dataAccessValidation.pattern_mapping['users_select']).toEqual({
        original_operation: 'select',
        original_table: 'users',
        migrated_to: 'infrastructure_layer.repositories.UserRepository',
        method_mapping: {
          'SELECT * FROM users WHERE email = ?': 'UserRepository.FindByEmail(email)',
          'UPDATE users SET failed_logins = ?': 'UserRepository.UpdateFailedLogins(userID, count)'
        }
      });
    });
  });

  describe('business logic semantics validation', () => {
    it('should validate that business logic semantics are preserved', async () => {
      // 元のコードを読み込んでセマンティクス解析
      mockedFs.readFile.mockImplementation((filePath: string) => {
        const fileName = filePath.toString();
        if (fileName.includes('user.go')) {
          return Promise.resolve(`
            func isValidEmail(email string) bool {
              if !strings.Contains(email, "@") {
                return false
              }
              // 禁止ドメインチェック - 重要な業務ルール
              forbiddenDomains := []string{"temp-mail.org", "10minutemail.com"}
              for _, domain := range forbiddenDomains {
                if strings.HasSuffix(email, "@"+domain) {
                  return false
                }
              }
              return emailRegex.MatchString(email)
            }
          `);
        }
        return Promise.resolve('');
      });

      const semanticsValidation = await validator.validateBusinessSemantics({
        originalFiles: ['user.go', 'order.go', 'auth.go'],
        migratedCode,
        validationCriteria: {
          checkLogicalEquivalence: true,
          checkBusinessRuleIntegrity: true,
          checkConstraintPreservation: true
        }
      });

      expect(semanticsValidation.semantics_preserved).toBe(true);
      expect(semanticsValidation.logical_equivalence_score).toBeGreaterThanOrEqual(0.9);
      expect(semanticsValidation.business_rule_integrity).toBe(true);
      expect(semanticsValidation.constraint_violations).toHaveLength(0);
    });

    it('should detect semantic changes in business logic', async () => {
      // セマンティクスが変更されたマイグレーション
      const alteredMigration: MigratedBusinessLogic = {
        domain_layer: {
          entities: ['User'],
          valueObjects: ['Email'],
          businessRules: ['WeakEmailValidator'], // 元の厳密な検証から緩い検証に変更
        },
        usecase_layer: {
          services: ['UserService']
        }
      };

      mockedFs.readFile.mockResolvedValue(`
        // 元の厳密な検証ロジック
        func isValidEmail(email string) bool {
          // 複雑な検証ルール
          if !strings.Contains(email, "@") {
            return false
          }
          forbiddenDomains := []string{"temp-mail.org", "10minutemail.com"}
          // ... 厳密な検証
        }
      `);

      const semanticsValidation = await validator.validateBusinessSemantics({
        originalFiles: ['user.go'],
        migratedCode: alteredMigration,
        validationCriteria: {
          checkLogicalEquivalence: true,
          allowSemanticChanges: false
        }
      });

      expect(semanticsValidation.semantics_preserved).toBe(false);
      expect(semanticsValidation.logical_equivalence_score).toBeLessThan(0.8);
      expect(semanticsValidation.semantic_changes).toContain('Email validation logic weakened');
      expect(semanticsValidation.risk_assessment).toEqual({
        level: 'high',
        reasons: ['Business rule integrity compromised', 'Security validation weakened']
      });
    });
  });

  describe('performance and complexity preservation', () => {
    it('should validate that business logic complexity is preserved', async () => {
      const complexityValidation = await validator.validateComplexityPreservation(
        originalBusinessLogic.complexity,
        migratedCode
      );

      expect(complexityValidation.complexity_preserved).toBe(true);
      expect(complexityValidation.complexity_change_score).toBeCloseTo(0, 1); // 変化がほぼない
      expect(complexityValidation.performance_impact).toEqual({
        expected_change: 'neutral_or_improved',
        reasoning: 'Clean architecture should improve maintainability without significant performance impact'
      });
    });

    it('should detect when migration increases complexity unnecessarily', async () => {
      // 過度に複雑なマイグレーション
      const overComplexMigration: MigratedBusinessLogic = {
        domain_layer: {
          entities: ['User', 'UserProfile', 'UserSettings', 'UserPreferences'],
          valueObjects: ['Email', 'EmailAddress', 'EmailValidation'],
          businessRules: ['EmailValidator', 'EmailFormatChecker', 'EmailDomainChecker', 'EmailSecurityChecker'],
          workflows: ['UserCreationWorkflow', 'UserValidationWorkflow']
        },
        usecase_layer: {
          services: ['UserService', 'UserValidationService', 'UserCreationService'],
          businessFlows: ['CreateUserFlow', 'ValidateUserFlow'],
          commands: ['CreateUserCommand', 'ValidateUserCommand'],
          queries: ['GetUserQuery', 'ValidateUserQuery']
        }
      };

      const complexityValidation = await validator.validateComplexityPreservation(
        originalBusinessLogic.complexity,
        overComplexMigration
      );

      expect(complexityValidation.complexity_preserved).toBe(false);
      expect(complexityValidation.complexity_change_score).toBeGreaterThan(0.5); // 大幅な増加
      expect(complexityValidation.warnings).toContain('Migration introduces unnecessary complexity');
      expect(complexityValidation.suggestions).toContain('Consider consolidating similar entities and services');
    });
  });

  describe('integration with migration pipeline', () => {
    it('should provide comprehensive validation report for migration pipeline', async () => {
      const comprehensiveReport = await validator.generateComprehensiveValidationReport({
        originalBusinessLogic,
        migratedCode,
        validationOptions: {
          checkBusinessRules: true,
          checkWorkflows: true,
          checkDataAccess: true,
          checkSemantics: true,
          checkComplexity: true,
          generateSuggestions: true
        }
      });

      expect(comprehensiveReport.overall_validation_passed).toBe(true);
      expect(comprehensiveReport.validation_scores).toBeDefined();
      expect(comprehensiveReport.validation_scores.business_rules).toBeGreaterThanOrEqual(0.9);
      expect(comprehensiveReport.validation_scores.workflows).toBeGreaterThanOrEqual(0.9);
      expect(comprehensiveReport.validation_scores.semantics).toBeGreaterThanOrEqual(0.9);
      
      expect(comprehensiveReport.migration_quality_score).toBeGreaterThanOrEqual(0.9);
      expect(comprehensiveReport.recommendations).toBeDefined();
      expect(comprehensiveReport.risk_assessment).toBeDefined();
    });

    it('should integrate with rollback mechanism on validation failure', async () => {
      // 検証失敗のシミュレーション
      const failedMigration: MigratedBusinessLogic = {
        domain_layer: {
          entities: ['User'],
          businessRules: [], // 業務ルールが不足
        },
        usecase_layer: {
          services: [] // サービスが不足
        }
      };

      const validationResult = await validator.validateWithRollbackRecommendation({
        originalBusinessLogic,
        migratedCode: failedMigration,
        rollbackThreshold: 0.7 // 70%未満の場合はロールバック推奨
      });

      expect(validationResult.validation_passed).toBe(false);
      expect(validationResult.overall_score).toBeLessThan(0.7);
      expect(validationResult.rollback_recommended).toBe(true);
      expect(validationResult.rollback_reason).toContain('Critical business logic missing');
      expect(validationResult.recovery_suggestions).toContain('Re-run migration with stricter preservation settings');
    });

    it('should provide detailed migration metrics for monitoring', async () => {
      const migrationMetrics = await validator.generateMigrationMetrics({
        originalBusinessLogic,
        migratedCode,
        migrationStartTime: new Date('2024-01-01T10:00:00Z'),
        migrationEndTime: new Date('2024-01-01T10:05:00Z')
      });

      expect(migrationMetrics.duration_ms).toBe(300000); // 5分
      expect(migrationMetrics.business_rules_migrated).toBe(3);
      expect(migrationMetrics.workflows_migrated).toBe(1);
      expect(migrationMetrics.data_access_patterns_migrated).toBe(2);
      expect(migrationMetrics.preservation_rate).toBeGreaterThanOrEqual(0.9);
      expect(migrationMetrics.quality_score).toBeGreaterThanOrEqual(0.9);
    });
  });
});