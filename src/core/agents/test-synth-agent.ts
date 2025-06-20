import * as fs from 'fs';
import * as path from 'path';
import { RefactorPlan, RefactorPatch } from './refactor-agent.js';
import { VibeFlowConfig } from '../types/config.js';
import { ConfigLoader } from '../utils/config-loader.js';
import { CodeAnalyzer, FileInfo } from '../utils/code-analyzer.js';

export interface TestSynthResult {
  test_relocations: TestRelocation[];
  generated_tests: GeneratedTest[];
  coverage_improvement: CoverageImprovement;
  outputPath: string;
}

export interface TestRelocation {
  original_test: string;
  new_location: string;
  module: string;
  dependencies_updated: string[];
}

export interface GeneratedTest {
  file: string;
  test_type: 'unit' | 'integration' | 'e2e';
  coverage_target: string[];
  content: string;
}

export interface CoverageImprovement {
  current_coverage: number;
  target_coverage: number;
  new_test_files: number;
  relocated_test_files: number;
}

export class TestSynthAgent {
  private config: VibeFlowConfig;
  private analyzer: CodeAnalyzer;

  constructor(projectRoot: string, configPath?: string) {
    this.config = ConfigLoader.loadVibeFlowConfig(configPath);
    this.analyzer = new CodeAnalyzer(projectRoot);
  }

  async synthesizeTests(refactorPlanPath: string): Promise<TestSynthResult> {
    console.log('🧪 テスト移行とテスト生成を処理中...');
    
    // 1. リファクタリング計画読み込み
    const refactorPlan = this.loadRefactorPlan(refactorPlanPath);
    
    // 2. 既存テストファイル分析
    const existingTests = await this.analyzeExistingTests();
    
    // 3. テストファイルの移行計画
    const testRelocations = this.planTestRelocations(refactorPlan, existingTests);
    
    // 4. 不足しているテストの生成
    const generatedTests = this.generateMissingTests(refactorPlan, existingTests);
    
    // 5. カバレッジ改善分析
    const coverageImprovement = this.analyzeCoverageImprovement(existingTests, generatedTests);
    
    // 6. 結果出力
    const outputPath = '__generated__/';
    await this.saveTestSynthResults({
      test_relocations: testRelocations,
      generated_tests: generatedTests,
      coverage_improvement: coverageImprovement,
      outputPath,
    });
    
    console.log(`✅ テスト合成完了: ${generatedTests.length}個の新規テスト、${testRelocations.length}個のテスト移行`);
    
    return {
      test_relocations: testRelocations,
      generated_tests: generatedTests,
      coverage_improvement: coverageImprovement,
      outputPath,
    };
  }

  private loadRefactorPlan(planPath: string): RefactorPlan {
    // Simplified implementation - load from manifest.json
    const manifestPath = path.join('.refactor', 'manifest.json');
    if (!fs.existsSync(manifestPath)) {
      throw new Error(`Refactor manifest not found: ${manifestPath}`);
    }
    
    const content = fs.readFileSync(manifestPath, 'utf8');
    const manifest = JSON.parse(content);
    
    return {
      patches: manifest.patches,
      summary: manifest.summary,
    };
  }

  private async analyzeExistingTests(): Promise<FileInfo[]> {
    const testPatterns = [
      '**/*_test.go',
      '**/test_*.go',
      '**/*Test.go',
      '**/tests/**/*.go',
    ];
    
    return await this.analyzer.analyzeFiles(testPatterns);
  }

  private planTestRelocations(refactorPlan: RefactorPlan, existingTests: FileInfo[]): TestRelocation[] {
    const relocations: TestRelocation[] = [];
    
    // Find tests that need to be moved based on refactor patches
    for (const patch of refactorPlan.patches) {
      if (patch.changes.some(c => c.type === 'create') && patch.target_file.startsWith('internal/')) {
        const module = this.extractModuleName(patch.target_file);
        const relatedTests = this.findRelatedTests(patch.target_file, existingTests);
        
        for (const test of relatedTests) {
          const newLocation = this.generateTestLocation(module, test.relativePath);
          relocations.push({
            original_test: test.relativePath,
            new_location: newLocation,
            module,
            dependencies_updated: this.calculateTestDependencies(test, patch),
          });
        }
      }
    }
    
    return relocations;
  }

  private generateMissingTests(refactorPlan: RefactorPlan, existingTests: FileInfo[]): GeneratedTest[] {
    const generatedTests: GeneratedTest[] = [];
    const existingTestPaths = new Set(existingTests.map(t => t.relativePath));
    
    for (const patch of refactorPlan.patches) {
      if (patch.changes.some(c => c.type === 'create')) {
        const module = this.extractModuleName(patch.target_file);
        
        // Generate unit tests for new interfaces
        if (patch.target_file.includes('interface.go')) {
          const unitTest = this.generateInterfaceUnitTest(module, patch);
          generatedTests.push(unitTest);
        }
        
        // Generate integration tests for new handlers
        if (patch.target_file.includes('handler')) {
          const integrationTest = this.generateHandlerIntegrationTest(module, patch);
          generatedTests.push(integrationTest);
        }
        
        // Generate repository tests
        if (patch.target_file.includes('repository')) {
          const repoTest = this.generateRepositoryTest(module, patch);
          generatedTests.push(repoTest);
        }
      }
    }
    
    // Generate E2E tests for module interactions
    const modules = [...new Set(refactorPlan.patches.map(p => this.extractModuleName(p.target_file)))];
    if (modules.length > 1) {
      const e2eTest = this.generateE2ETest(modules);
      generatedTests.push(e2eTest);
    }
    
    return generatedTests;
  }

  private extractModuleName(filePath: string): string {
    const match = filePath.match(/internal\/([^\/]+)/);
    return match ? match[1] : 'unknown';
  }

  private findRelatedTests(sourceFile: string, existingTests: FileInfo[]): FileInfo[] {
    const baseName = path.basename(sourceFile, '.go');
    const possibleTestNames = [
      `${baseName}_test.go`,
      `test_${baseName}.go`,
      `${baseName}Test.go`,
    ];
    
    return existingTests.filter(test => 
      possibleTestNames.some(testName => test.relativePath.includes(testName))
    );
  }

  private generateTestLocation(module: string, originalPath: string): string {
    const fileName = path.basename(originalPath);
    return `internal/${module}/test/${fileName}`;
  }

  private calculateTestDependencies(test: FileInfo, patch: RefactorPatch): string[] {
    // Simple implementation - return imports that might need updating
    return test.imports.filter(imp => imp.includes(patch.target_file.replace('.go', '')));
  }

  private generateInterfaceUnitTest(module: string, patch: RefactorPatch): GeneratedTest {
    const interfaceName = `I${this.capitalize(module)}Service`;
    const content = `package ${module}_test

import (
    "context"
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/mock"
    "${module}/internal/${module}"
)

// Mock${interfaceName} is a mock implementation of ${interfaceName}
type Mock${interfaceName} struct {
    mock.Mock
}

func (m *Mock${interfaceName}) Get(ctx context.Context, id string) (*${module}.Entity, error) {
    args := m.Called(ctx, id)
    return args.Get(0).(*${module}.Entity), args.Error(1)
}

func (m *Mock${interfaceName}) Create(ctx context.Context, entity *${module}.Entity) error {
    args := m.Called(ctx, entity)
    return args.Error(0)
}

func (m *Mock${interfaceName}) Update(ctx context.Context, entity *${module}.Entity) error {
    args := m.Called(ctx, entity)
    return args.Error(0)
}

func (m *Mock${interfaceName}) Delete(ctx context.Context, id string) error {
    args := m.Called(ctx, id)
    return args.Error(0)
}

func TestGet_Success(t *testing.T) {
    // Arrange
    mockService := new(Mock${interfaceName})
    expectedEntity := &${module}.Entity{ID: "test-id"}
    mockService.On("Get", mock.Anything, "test-id").Return(expectedEntity, nil)
    
    // Act
    result, err := mockService.Get(context.Background(), "test-id")
    
    // Assert
    assert.NoError(t, err)
    assert.Equal(t, expectedEntity, result)
    mockService.AssertExpectations(t)
}

func TestCreate_Success(t *testing.T) {
    // Arrange
    mockService := new(Mock${interfaceName})
    entity := &${module}.Entity{ID: "test-id"}
    mockService.On("Create", mock.Anything, entity).Return(nil)
    
    // Act
    err := mockService.Create(context.Background(), entity)
    
    // Assert
    assert.NoError(t, err)
    mockService.AssertExpectations(t)
}
`;

    return {
      file: `internal/${module}/test/${module}_service_test.go`,
      test_type: 'unit',
      coverage_target: [`internal/${module}/interface.go`],
      content,
    };
  }

  private generateHandlerIntegrationTest(module: string, patch: RefactorPatch): GeneratedTest {
    const content = `package ${module}_test

import (
    "bytes"
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"
    "github.com/labstack/echo/v4"
    "github.com/stretchr/testify/assert"
    "${module}/internal/${module}"
)

func TestHandler_Get_Success(t *testing.T) {
    // Arrange
    e := echo.New()
    req := httptest.NewRequest(http.MethodGet, "/${module}/test-id", nil)
    rec := httptest.NewRecorder()
    c := e.NewContext(req, rec)
    c.SetParamNames("id")
    c.SetParamValues("test-id")
    
    // TODO: Initialize handler with dependencies
    // handler := NewHandler(mockService)
    
    // Act
    // err := handler.Get(c)
    
    // Assert
    // assert.NoError(t, err)
    // assert.Equal(t, http.StatusOK, rec.Code)
    
    t.Skip("Handler integration test needs implementation")
}

func TestHandler_Create_Success(t *testing.T) {
    // Arrange
    e := echo.New()
    entity := map[string]interface{}{"name": "test"}
    jsonBody, _ := json.Marshal(entity)
    req := httptest.NewRequest(http.MethodPost, "/${module}", bytes.NewBuffer(jsonBody))
    req.Header.Set(echo.HeaderContentType, echo.MIMEApplicationJSON)
    rec := httptest.NewRecorder()
    c := e.NewContext(req, rec)
    
    // TODO: Initialize handler with dependencies
    // handler := NewHandler(mockService)
    
    // Act
    // err := handler.Create(c)
    
    // Assert
    // assert.NoError(t, err)
    // assert.Equal(t, http.StatusCreated, rec.Code)
    
    t.Skip("Handler integration test needs implementation")
}
`;

    return {
      file: `internal/${module}/test/${module}_handler_integration_test.go`,
      test_type: 'integration',
      coverage_target: [`internal/${module}/handler/${module}.go`],
      content,
    };
  }

  private generateRepositoryTest(module: string, patch: RefactorPatch): GeneratedTest {
    const content = `package ${module}_test

import (
    "context"
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/suite"
    "gorm.io/gorm"
    "${module}/internal/${module}"
    "${module}/database"
)

type ${this.capitalize(module)}RepositoryTestSuite struct {
    suite.Suite
    db         *gorm.DB
    repository ${module}.Repository
}

func (suite *${this.capitalize(module)}RepositoryTestSuite) SetupSuite() {
    // TODO: Setup test database
    // suite.db = database.SetupTestDB()
    // suite.repository = NewRepository(suite.db)
}

func (suite *${this.capitalize(module)}RepositoryTestSuite) TearDownSuite() {
    // TODO: Cleanup test database
    // database.CleanupTestDB(suite.db)
}

func (suite *${this.capitalize(module)}RepositoryTestSuite) SetupTest() {
    // TODO: Clean test data before each test
    // suite.db.Exec("DELETE FROM ${module}s")
}

func (suite *${this.capitalize(module)}RepositoryTestSuite) TestCreate_Success() {
    // Arrange
    entity := &${module}.Entity{
        ID: "test-id",
        // TODO: Add other fields
    }
    
    // Act
    // err := suite.repository.Create(context.Background(), entity)
    
    // Assert
    // suite.NoError(err)
    // suite.NotEmpty(entity.ID)
    
    suite.T().Skip("Repository test needs implementation")
}

func (suite *${this.capitalize(module)}RepositoryTestSuite) TestGet_Success() {
    // Arrange
    entity := &${module}.Entity{
        ID: "test-id",
        // TODO: Add other fields
    }
    // TODO: Insert test data
    // suite.repository.Create(context.Background(), entity)
    
    // Act
    // result, err := suite.repository.Get(context.Background(), "test-id")
    
    // Assert
    // suite.NoError(err)
    // suite.Equal(entity.ID, result.ID)
    
    suite.T().Skip("Repository test needs implementation")
}

func Test${this.capitalize(module)}RepositoryTestSuite(t *testing.T) {
    suite.Run(t, new(${this.capitalize(module)}RepositoryTestSuite))
}
`;

    return {
      file: `internal/${module}/test/${module}_repository_test.go`,
      test_type: 'integration',
      coverage_target: [`internal/${module}/repository/${module}.go`],
      content,
    };
  }

  private generateE2ETest(modules: string[]): GeneratedTest {
    const content = `package e2e_test

import (
    "encoding/json"
    "net/http"
    "testing"
    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/suite"
)

type E2ETestSuite struct {
    suite.Suite
    baseURL string
    client  *http.Client
}

func (suite *E2ETestSuite) SetupSuite() {
    suite.baseURL = "http://localhost:8080" // TODO: Configure test server
    suite.client = &http.Client{}
    
    // TODO: Start test server
    // testServer := setupTestServer()
    // suite.baseURL = testServer.URL
}

func (suite *E2ETestSuite) TearDownSuite() {
    // TODO: Cleanup test server
}

func (suite *E2ETestSuite) TestModuleInteraction_${modules.join('_')}() {
    // Test interaction between ${modules.join(' and ')} modules
    
    // TODO: Implement cross-module integration test
    // 1. Create entity in first module
    // 2. Verify it's accessible from second module
    // 3. Update entity and verify changes propagate
    // 4. Delete entity and verify cleanup
    
    suite.T().Skip("E2E test needs implementation with actual server")
}

func (suite *E2ETestSuite) TestHealthCheck() {
    // Act
    resp, err := suite.client.Get(suite.baseURL + "/health")
    
    // Assert
    suite.NoError(err)
    suite.Equal(http.StatusOK, resp.StatusCode)
    
    var health map[string]interface{}
    err = json.NewDecoder(resp.Body).Decode(&health)
    suite.NoError(err)
    suite.Equal("ok", health["status"])
}

func TestE2ETestSuite(t *testing.T) {
    suite.Run(t, new(E2ETestSuite))
}
`;

    return {
      file: '__generated__/e2e/module_interaction_test.go',
      test_type: 'e2e',
      coverage_target: modules.map(m => `internal/${m}/**`),
      content,
    };
  }

  private analyzeCoverageImprovement(existingTests: FileInfo[], generatedTests: GeneratedTest[]): CoverageImprovement {
    const currentCoverage = this.config.refactoring.quality_gates.test_coverage.current;
    const targetCoverage = this.config.refactoring.quality_gates.test_coverage.minimum;
    
    return {
      current_coverage: currentCoverage,
      target_coverage: targetCoverage,
      new_test_files: generatedTests.length,
      relocated_test_files: 0, // Will be calculated from relocations
    };
  }

  private async saveTestSynthResults(result: TestSynthResult): Promise<void> {
    // Create output directory
    if (!fs.existsSync(result.outputPath)) {
      fs.mkdirSync(result.outputPath, { recursive: true });
    }

    // Save generated tests
    for (const test of result.generated_tests) {
      const testDir = path.dirname(test.file);
      if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
      }
      fs.writeFileSync(test.file, test.content);
    }

    // Save test relocation plan
    const relocationPath = path.join(result.outputPath, 'test_relocations.json');
    fs.writeFileSync(relocationPath, JSON.stringify(result.test_relocations, null, 2));

    // Save coverage improvement analysis
    const coveragePath = path.join(result.outputPath, 'coverage_improvement.json');
    fs.writeFileSync(coveragePath, JSON.stringify(result.coverage_improvement, null, 2));

    // Save summary
    const summaryPath = path.join(result.outputPath, 'test_synthesis_summary.json');
    const summary = {
      generated_tests: result.generated_tests.length,
      test_relocations: result.test_relocations.length,
      coverage_improvement: result.coverage_improvement,
      files_created: result.generated_tests.map(t => t.file),
    };
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}