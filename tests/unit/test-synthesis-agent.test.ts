import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { TestSynthesisAgent } from '../../src/core/agents/test-synthesis-agent.js';
import { BusinessLogicExtractResult } from '../../src/core/types/business-logic.js';
import * as fs from 'fs/promises';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('../../src/core/utils/claude-code-business-logic-integration.js');

const mockedFs = vi.mocked(fs);

describe('TestSynthesisAgent', () => {
  let agent: TestSynthesisAgent;
  let tempDir: string;

  beforeEach(() => {
    tempDir = '/tmp/test-project';
    agent = new TestSynthesisAgent(tempDir);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('user story extraction from code', () => {
    it('should extract user stories from Go code without tests', async () => {
      const goCode = `
        package main
        
        import "errors"
        
        // CreateUser creates a new user in the system
        func CreateUser(email, password string) (*User, error) {
            if !isValidEmail(email) {
                return nil, errors.New("invalid email format")
            }
            
            if len(password) < 8 {
                return nil, errors.New("password too short")
            }
            
            user := &User{
                Email:    email,
                Password: hashPassword(password),
                Status:   "active",
            }
            
            return user, nil
        }
        
        // ValidateLogin validates user credentials
        func ValidateLogin(email, password string) bool {
            user := findUserByEmail(email)
            if user == nil {
                return false
            }
            
            return checkPassword(user.Password, password)
        }
      `;

      mockedFs.readFile.mockResolvedValue(goCode);

      const result = await agent.extractUserStoriesFromCode('/test/user.go');

      expect(result.userStories).toHaveLength(2);
      
      // CreateUser関数からのユーザーストーリー
      const createUserStory = result.userStories.find(s => 
        s.relatedCode.functions.includes('CreateUser')
      );
      expect(createUserStory).toBeDefined();
      expect(createUserStory?.title).toContain('create a new resource');
      expect(createUserStory?.acceptanceCriteria).toContain('Given valid input parameters');
      expect(createUserStory?.businessValue).toBe('medium');
      
      // ValidateLogin関数からのユーザーストーリー
      const validateStory = result.userStories.find(s => 
        s.relatedCode.functions.includes('ValidateLogin')
      );
      expect(validateStory).toBeDefined();
      expect(validateStory?.title).toContain('validate input');
    });

    it('should extract business context from code comments and function names', async () => {
      const goCode = `
        // Package auth handles user authentication and authorization
        // This module is critical for security and user management
        package auth
        
        // User represents a system user with authentication capabilities
        type User struct {
            ID       string
            Email    string
            Password string
            Role     string
        }
        
        // AuthenticateUser performs user authentication
        func AuthenticateUser(credentials Credentials) (*User, error) {
            // Business rule: Authentication must validate both email and password
            // Security constraint: Failed attempts should be logged
            return nil, nil
        }
      `;

      mockedFs.readFile.mockResolvedValue(goCode);

      const result = await agent.extractUserStoriesFromCode('/auth/auth.go');

      expect(result.businessContext.domain).toBe('Business Domain');
      expect(result.businessContext.keyEntities).toContain('User');
      expect(result.businessContext.workflows).toHaveLength(0); // No process functions
      expect(result.businessContext.constraints).toHaveLength(0); // Basic implementation
    });

    it('should generate test scenarios from user stories', async () => {
      const goCode = `
        func ProcessOrder(order Order) error {
            // Validate order
            if err := validateOrder(order); err != nil {
                return err
            }
            
            // Check inventory
            if !checkInventory(order.Items) {
                return errors.New("insufficient inventory")
            }
            
            // Calculate total
            total := calculateTotal(order.Items)
            order.Total = total
            
            // Process payment
            return processPayment(order)
        }
      `;

      mockedFs.readFile.mockResolvedValue(goCode);

      const result = await agent.extractUserStoriesFromCode('/order/order.go');

      expect(result.testScenarios).toHaveLength(1);
      
      const scenario = result.testScenarios[0];
      expect(scenario.scenario).toContain('Test');
      expect(scenario.given).toContain('System is initialized');
      expect(scenario.when).toContain('ProcessOrder');
      expect(scenario.then).toContain('Operation completes successfully');
      expect(scenario.priority).toBe('medium');
    });
  });

  describe('test case generation from business logic', () => {
    it('should generate test cases for business rules', async () => {
      const businessLogic: BusinessLogicExtractResult = {
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
            description: 'Order total calculation',
            code: 'calculateTotal(items)',
            location: { file: 'order.go', line: 45 },
            dependencies: ['items', 'tax'],
            complexity: 'medium'
          }
        ],
        dataAccess: [],
        workflows: [],
        complexity: { overall: 'medium', details: {} }
      };

      const testCases = await agent.generateTestCasesFromBusinessLogic(businessLogic, {
        language: 'go',
        testFramework: 'testify',
        includeIntegrationTests: true,
        generateUserStoryTests: true
      });

      expect(testCases).toHaveLength(2);
      
      // Email validation test
      const emailTest = testCases.find(tc => tc.businessRule?.includes('Email format'));
      expect(emailTest).toBeDefined();
      expect(emailTest?.category).toBe('business_rule');
      expect(emailTest?.language).toBe('go');
      expect(emailTest?.framework).toBe('testify');
      expect(emailTest?.code).toContain('TestValidationRule');
      expect(emailTest?.testData).toEqual([{ valid: 'test@example.com', invalid: 'invalid-email' }]);
      
      // Calculation test
      const calcTest = testCases.find(tc => tc.businessRule?.includes('Order total'));
      expect(calcTest).toBeDefined();
      expect(calcTest?.complexity).toBeUndefined(); // Not set for business rules
    });

    it('should generate test cases for workflows', async () => {
      const businessLogic: BusinessLogicExtractResult = {
        rules: [],
        dataAccess: [],
        workflows: [
          {
            name: 'OrderProcessing',
            description: 'Complete order processing workflow',
            steps: ['validate', 'checkInventory', 'calculateTotal', 'processPayment'],
            businessRules: ['validation', 'inventory'],
            complexity: 'high',
            triggers: ['user_action'],
            outcomes: ['order_completed']
          }
        ],
        complexity: { overall: 'high', details: {} }
      };

      const testCases = await agent.generateTestCasesFromBusinessLogic(businessLogic, {
        language: 'go',
        testFramework: 'testify'
      });

      expect(testCases).toHaveLength(1);
      
      const workflowTest = testCases[0];
      expect(workflowTest.category).toBe('workflow');
      expect(workflowTest.name).toBe('TestOrderProcessingWorkflow');
      expect(workflowTest.description).toContain('OrderProcessing workflow execution');
      expect(workflowTest.code).toContain('TestOrderProcessingWorkflow');
      expect(workflowTest.code).toContain('workflow.Execute');
      expect(workflowTest.expectedBehavior).toContain('completes successfully');
    });

    it('should generate test cases for data access patterns', async () => {
      const businessLogic: BusinessLogicExtractResult = {
        rules: [],
        dataAccess: [
          {
            operation: 'select',
            table: 'users',
            complexity: 'low',
            query: 'SELECT * FROM users WHERE email = ?',
            fields: ['id', 'email', 'status']
          },
          {
            operation: 'update',
            table: 'orders',
            complexity: 'medium',
            query: 'UPDATE orders SET status = ? WHERE id = ?',
            fields: ['status']
          }
        ],
        workflows: [],
        complexity: { overall: 'medium', details: {} }
      };

      const testCases = await agent.generateTestCasesFromBusinessLogic(businessLogic, {
        language: 'go',
        testFramework: 'testify',
        includeIntegrationTests: true
      });

      expect(testCases).toHaveLength(2);
      
      // Select test
      const selectTest = testCases.find(tc => tc.description.includes('select'));
      expect(selectTest).toBeDefined();
      expect(selectTest?.category).toBe('integration');
      expect(selectTest?.name).toBe('TestSelectUsers');
      expect(selectTest?.code).toContain('TestSelectUsers');
      expect(selectTest?.code).toContain('setupTestDB');
      expect(selectTest?.testData).toEqual([{ table: 'users', operation: 'select' }]);
      
      // Update test
      const updateTest = testCases.find(tc => tc.description.includes('update'));
      expect(updateTest).toBeDefined();
      expect(updateTest?.name).toBe('TestUpdateOrders');
    });
  });

  describe('complete test suite synthesis', () => {
    it('should synthesize complete test suite for multiple files', async () => {
      const userGoCode = `
        func CreateUser(email string) error {
          if !isValidEmail(email) {
            return errors.New("invalid email")
          }
          return nil
        }
      `;
      
      const orderGoCode = `
        func ProcessOrder(order Order) error {
          total := calculateTotal(order.Items)
          return processPayment(total)
        }
      `;

      mockedFs.readFile
        .mockResolvedValueOnce(userGoCode)
        .mockResolvedValueOnce(orderGoCode);

      const result = await agent.synthesizeCompleteTestSuite([
        '/user/user.go',
        '/order/order.go'
      ]);

      expect(result.userStories.userStories).toHaveLength(2);
      expect(result.testCases.length).toBeGreaterThan(0);
      expect(result.documentation).toBeDefined();
      expect(result.recommendations).toHaveLength(3);
      
      // ユーザーストーリーの検証
      const userStories = result.userStories.userStories;
      expect(userStories.some(s => s.relatedCode.functions.includes('CreateUser'))).toBe(true);
      expect(userStories.some(s => s.relatedCode.functions.includes('ProcessOrder'))).toBe(true);
      
      // ドキュメントの検証
      expect(result.documentation.businessRulesDocument).toBeDefined();
      expect(result.documentation.userStoryDocument).toBeDefined();
      expect(result.documentation.testStrategy).toBeDefined();
      
      // 推奨事項の検証
      expect(result.recommendations).toContain('ビジネスルールのテストを優先的に実装してください');
    });

    it('should handle files with no extractable business logic gracefully', async () => {
      const emptyCode = `
        package main
        
        import "fmt"
        
        func main() {
          fmt.Println("Hello World")
        }
      `;

      mockedFs.readFile.mockResolvedValue(emptyCode);

      const result = await agent.synthesizeCompleteTestSuite(['/main.go']);

      expect(result.userStories.userStories).toHaveLength(0);
      expect(result.testCases).toHaveLength(0);
      expect(result.documentation).toBeDefined();
      expect(result.recommendations).toHaveLength(3);
    });
  });

  describe('AI integration with fallback', () => {
    it('should use AI when available for enhanced user story extraction', async () => {
      // Claude Code統合のモック
      const mockClaudeCodeIntegration = {
        analyzeComplexBusinessLogic: vi.fn().mockResolvedValue({
          businessLogic: [
            {
              type: 'validation',
              description: 'Advanced email validation with domain checking',
              businessImpact: 'high',
              complexity: 'medium',
              code: 'validateEmailWithDomain(email)'
            }
          ],
          workflows: [
            {
              name: 'UserRegistration',
              steps: ['validateEmail', 'checkDuplicate', 'createUser', 'sendConfirmation'],
              businessRules: ['email validation', 'uniqueness constraint']
            }
          ],
          risks: ['Security risk: Email validation bypass']
        })
      };

      agent['claudeCodeIntegration'] = mockClaudeCodeIntegration as any;
      agent['useAI'] = true;

      const goCode = `
        func RegisterUser(email, password string) error {
          return nil
        }
      `;

      mockedFs.readFile.mockResolvedValue(goCode);

      const result = await agent.extractUserStoriesFromCode('/user.go');

      expect(mockClaudeCodeIntegration.analyzeComplexBusinessLogic).toHaveBeenCalled();
      expect(result.userStories).toHaveLength(1);
      expect(result.userStories[0].businessValue).toBe('high');
      expect(result.userStories[0].description).toContain('Advanced email validation');
    });

    it('should fall back to static analysis when AI fails', async () => {
      const mockClaudeCodeIntegration = {
        analyzeComplexBusinessLogic: vi.fn().mockRejectedValue(new Error('AI service unavailable'))
      };

      agent['claudeCodeIntegration'] = mockClaudeCodeIntegration as any;
      agent['useAI'] = true;

      const goCode = `
        func CreateUser(email string) error {
          return nil
        }
      `;

      mockedFs.readFile.mockResolvedValue(goCode);

      const result = await agent.extractUserStoriesFromCode('/user.go');

      expect(mockClaudeCodeIntegration.analyzeComplexBusinessLogic).toHaveBeenCalled();
      // Should fall back to static analysis
      expect(result.userStories).toHaveLength(1);
      expect(result.userStories[0].businessValue).toBe('medium'); // Default from static analysis
    });
  });
});