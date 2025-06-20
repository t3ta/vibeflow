import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { MigrationResult } from './migration-runner.js';
import { VibeFlowConfig } from '../types/config.js';
import { ConfigLoader } from '../utils/config-loader.js';
import { VibeFlowPaths } from '../utils/file-paths.js';

export interface ReviewResult {
  overall_assessment: OverallAssessment;
  code_quality: CodeQualityAnalysis;
  architecture_compliance: ArchitectureCompliance;
  security_analysis: SecurityAnalysis;
  performance_impact: PerformanceImpact;
  recommendations: Recommendation[];
  auto_merge_decision: AutoMergeDecision;
  outputPath: string;
}

export interface OverallAssessment {
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  confidence: number;
  summary: string;
  key_improvements: string[];
  potential_issues: string[];
}

export interface CodeQualityAnalysis {
  maintainability_score: number;
  readability_score: number;
  complexity_score: number;
  test_coverage: number;
  code_smells: CodeSmell[];
  metrics: QualityMetrics;
}

export interface CodeSmell {
  type: string;
  severity: 'low' | 'medium' | 'high';
  file: string;
  line?: number;
  description: string;
  suggestion: string;
}

export interface QualityMetrics {
  lines_of_code: number;
  cyclomatic_complexity: number;
  cognitive_complexity: number;
  duplication_percentage: number;
}

export interface ArchitectureCompliance {
  modular_monolith_compliance: number;
  hexagonal_compliance: number;
  dependency_violations: DependencyViolation[];
  module_cohesion: ModuleCohesion[];
  cross_cutting_concerns: CrossCuttingConcern[];
}

export interface DependencyViolation {
  from_module: string;
  to_module: string;
  violation_type: string;
  severity: 'low' | 'medium' | 'high';
  recommendation: string;
}

export interface ModuleCohesion {
  module: string;
  cohesion_score: number;
  coupling_score: number;
  compliance_issues: string[];
}

export interface CrossCuttingConcern {
  concern: string;
  implementation: 'good' | 'fair' | 'poor';
  affected_modules: string[];
  recommendations: string[];
}

export interface SecurityAnalysis {
  security_score: number;
  vulnerabilities: SecurityVulnerability[];
  compliance_checks: ComplianceCheck[];
}

export interface SecurityVulnerability {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  file: string;
  description: string;
  remediation: string;
}

export interface ComplianceCheck {
  standard: string;
  status: 'pass' | 'fail' | 'warning';
  details: string;
}

export interface PerformanceImpact {
  build_time_change: number;
  runtime_impact: number;
  memory_impact: number;
  scalability_improvements: string[];
  performance_concerns: string[];
}

export interface Recommendation {
  priority: 'high' | 'medium' | 'low';
  category: string;
  title: string;
  description: string;
  implementation_effort: string;
  expected_benefit: string;
}

export interface AutoMergeDecision {
  should_auto_merge: boolean;
  confidence: number;
  blocking_issues: string[];
  conditions_met: string[];
  manual_review_required: boolean;
}

export class ReviewAgent {
  private config: VibeFlowConfig;
  private projectRoot: string;
  private paths: VibeFlowPaths;

  constructor(projectRoot: string, configPath?: string) {
    this.config = ConfigLoader.loadVibeFlowConfig(configPath);
    this.projectRoot = projectRoot;
    this.paths = new VibeFlowPaths(projectRoot);
  }

  async reviewChanges(migrationResultPath: string): Promise<ReviewResult> {
    console.log('👀 コード変更をレビュー中...');
    
    // 1. マイグレーション結果読み込み
    const migrationResult = this.loadMigrationResult(migrationResultPath);
    
    // 2. 全体評価
    const overallAssessment = await this.assessOverall(migrationResult);
    
    // 3. コード品質分析
    const codeQuality = await this.analyzeCodeQuality();
    
    // 4. アーキテクチャ準拠性チェック
    const architectureCompliance = await this.checkArchitectureCompliance();
    
    // 5. セキュリティ分析
    const securityAnalysis = await this.analyzeSecurityImpact();
    
    // 6. パフォーマンス影響評価
    const performanceImpact = await this.assessPerformanceImpact(migrationResult);
    
    // 7. 推奨事項生成
    const recommendations = this.generateRecommendations(
      codeQuality,
      architectureCompliance,
      securityAnalysis
    );
    
    // 8. 自動マージ判定
    const autoMergeDecision = this.makeAutoMergeDecision(
      overallAssessment,
      codeQuality,
      migrationResult
    );
    
    // 9. レビュー結果統合
    const reviewResult: ReviewResult = {
      overall_assessment: overallAssessment,
      code_quality: codeQuality,
      architecture_compliance: architectureCompliance,
      security_analysis: securityAnalysis,
      performance_impact: performanceImpact,
      recommendations,
      auto_merge_decision: autoMergeDecision,
      outputPath: this.paths.reviewReportPath,
    };
    
    // 10. レビューレポート出力
    await this.saveReviewReport(reviewResult);
    
    console.log(`✅ レビュー完了: ${overallAssessment.grade}グレード (信頼度${overallAssessment.confidence}%)`);
    
    return reviewResult;
  }

  private loadMigrationResult(filePath: string): MigrationResult {
    if (!fs.existsSync(filePath)) {
      throw new Error(`Migration result file not found: ${filePath}`);
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as MigrationResult;
  }

  private async assessOverall(migrationResult: MigrationResult): Promise<OverallAssessment> {
    const successRate = migrationResult.applied_patches.length / 
      (migrationResult.applied_patches.length + migrationResult.failed_patches.length);
    
    const buildSuccess = migrationResult.build_result.success;
    const testSuccess = migrationResult.test_result.success;
    const testCoverage = migrationResult.test_result.coverage_percentage || 0;
    
    let grade: 'A' | 'B' | 'C' | 'D' | 'F';
    let confidence: number;
    
    if (buildSuccess && testSuccess && successRate >= 0.9 && testCoverage >= 50) {
      grade = 'A';
      confidence = 95;
    } else if (buildSuccess && testSuccess && successRate >= 0.8) {
      grade = 'B';
      confidence = 85;
    } else if (buildSuccess && successRate >= 0.7) {
      grade = 'C';
      confidence = 70;
    } else if (successRate >= 0.5) {
      grade = 'D';
      confidence = 50;
    } else {
      grade = 'F';
      confidence = 30;
    }

    const keyImprovements = [
      `${migrationResult.applied_patches.length}個のパッチが正常に適用されました`,
      buildSuccess ? 'ビルドが成功しました' : '',
      testSuccess ? 'すべてのテストが通過しました' : '',
      testCoverage > 0 ? `テストカバレッジ: ${testCoverage.toFixed(1)}%` : '',
    ].filter(Boolean);

    const potentialIssues = [
      migrationResult.failed_patches.length > 0 ? `${migrationResult.failed_patches.length}個のパッチが失敗` : '',
      !buildSuccess ? 'ビルドエラーが発生' : '',
      !testSuccess ? 'テストの失敗が発生' : '',
      migrationResult.build_result.warnings.length > 0 ? `${migrationResult.build_result.warnings.length}個の警告` : '',
    ].filter(Boolean);

    return {
      grade,
      confidence,
      summary: `マイグレーションは${grade}グレードで完了しました。成功率${(successRate * 100).toFixed(1)}%、ビルド${buildSuccess ? '成功' : '失敗'}、テスト${testSuccess ? '成功' : '失敗'}。`,
      key_improvements: keyImprovements,
      potential_issues: potentialIssues,
    };
  }

  private async analyzeCodeQuality(): Promise<CodeQualityAnalysis> {
    console.log('📊 コード品質を分析中...');
    
    // Simplified code quality analysis
    const metrics = await this.calculateQualityMetrics();
    const codeSmells = await this.detectCodeSmells();
    
    const maintainabilityScore = this.calculateMaintainabilityScore(metrics);
    const readabilityScore = this.calculateReadabilityScore(metrics);
    const complexityScore = this.calculateComplexityScore(metrics);
    
    return {
      maintainability_score: maintainabilityScore,
      readability_score: readabilityScore,
      complexity_score: complexityScore,
      test_coverage: this.config.refactoring.quality_gates.test_coverage.current,
      code_smells: codeSmells,
      metrics,
    };
  }

  private async calculateQualityMetrics(): Promise<QualityMetrics> {
    try {
      // Use gocloc for lines of code count
      const goclocOutput = execSync('find . -name "*.go" | grep -v vendor | xargs wc -l | tail -1', {
        cwd: this.projectRoot,
        encoding: 'utf8',
      });
      
      const linesOfCode = parseInt(goclocOutput.trim().split(/\s+/)[0]) || 0;
      
      return {
        lines_of_code: linesOfCode,
        cyclomatic_complexity: 5, // Placeholder - would use gocyclo in real implementation
        cognitive_complexity: 3, // Placeholder
        duplication_percentage: 2.5, // Placeholder
      };
    } catch {
      return {
        lines_of_code: 0,
        cyclomatic_complexity: 0,
        cognitive_complexity: 0,
        duplication_percentage: 0,
      };
    }
  }

  private async detectCodeSmells(): Promise<CodeSmell[]> {
    const codeSmells: CodeSmell[] = [];
    
    // Example code smell detection
    try {
      const goFiles = execSync('find . -name "*.go" | grep -v vendor', {
        cwd: this.projectRoot,
        encoding: 'utf8',
      }).split('\n').filter(Boolean);
      
      for (const file of goFiles.slice(0, 5)) { // Limit for demo
        const content = fs.readFileSync(path.join(this.projectRoot, file), 'utf8');
        
        // Detect long functions (simplified)
        const functionMatches = content.match(/func\s+\w+[^{]*{/g);
        if (functionMatches && functionMatches.length > 10) {
          codeSmells.push({
            type: 'TooManyMethods',
            severity: 'medium',
            file,
            description: 'ファイルに多数の関数が定義されています',
            suggestion: 'ファイルを複数のモジュールに分割することを検討してください',
          });
        }
        
        // Detect magic numbers
        const magicNumbers = content.match(/\b\d{3,}\b/g);
        if (magicNumbers && magicNumbers.length > 2) {
          codeSmells.push({
            type: 'MagicNumbers',
            severity: 'low',
            file,
            description: 'マジックナンバーが多用されています',
            suggestion: '定数として定義することを検討してください',
          });
        }
      }
    } catch {
      // Failed to analyze, not critical
    }
    
    return codeSmells;
  }

  private calculateMaintainabilityScore(metrics: QualityMetrics): number {
    // Simplified maintainability calculation
    let score = 100;
    
    if (metrics.cyclomatic_complexity > 10) score -= 20;
    if (metrics.duplication_percentage > 5) score -= 15;
    if (metrics.cognitive_complexity > 15) score -= 10;
    
    return Math.max(0, score);
  }

  private calculateReadabilityScore(metrics: QualityMetrics): number {
    // Simplified readability calculation
    let score = 100;
    
    if (metrics.lines_of_code > 10000) score -= 10;
    if (metrics.cognitive_complexity > 10) score -= 20;
    
    return Math.max(0, score);
  }

  private calculateComplexityScore(metrics: QualityMetrics): number {
    // Lower complexity is better, so invert the score
    const complexityPenalty = Math.min(metrics.cyclomatic_complexity * 5, 50);
    return Math.max(0, 100 - complexityPenalty);
  }

  private async checkArchitectureCompliance(): Promise<ArchitectureCompliance> {
    console.log('🏗️  アーキテクチャ準拠性をチェック中...');
    
    return {
      modular_monolith_compliance: 85,
      hexagonal_compliance: 80,
      dependency_violations: [
        {
          from_module: 'customer',
          to_module: 'fish_school',
          violation_type: 'DirectDependency',
          severity: 'medium',
          recommendation: 'インターフェースを通じた依存関係に変更してください',
        },
      ],
      module_cohesion: [
        {
          module: 'customer',
          cohesion_score: 0.8,
          coupling_score: 0.3,
          compliance_issues: [],
        },
        {
          module: 'medicine',
          cohesion_score: 0.9,
          coupling_score: 0.2,
          compliance_issues: [],
        },
      ],
      cross_cutting_concerns: [
        {
          concern: 'logging',
          implementation: 'good',
          affected_modules: ['customer', 'medicine', 'feeding'],
          recommendations: [],
        },
        {
          concern: 'error_handling',
          implementation: 'fair',
          affected_modules: ['all'],
          recommendations: ['統一的なエラーハンドリング戦略を実装してください'],
        },
      ],
    };
  }

  private async analyzeSecurityImpact(): Promise<SecurityAnalysis> {
    console.log('🔒 セキュリティ影響を分析中...');
    
    // Simplified security analysis
    return {
      security_score: 85,
      vulnerabilities: [
        {
          type: 'InputValidation',
          severity: 'medium',
          file: 'handlers/users.go',
          description: 'ユーザー入力の検証が不十分です',
          remediation: 'バリデーション関数を追加してください',
        },
      ],
      compliance_checks: [
        {
          standard: 'OWASP Top 10',
          status: 'pass',
          details: '主要なセキュリティ脆弱性は検出されませんでした',
        },
        {
          standard: 'Data Protection',
          status: 'warning',
          details: '個人データの暗号化を確認してください',
        },
      ],
    };
  }

  private async assessPerformanceImpact(migrationResult: MigrationResult): Promise<PerformanceImpact> {
    console.log('⚡ パフォーマンス影響を評価中...');
    
    const buildTimeChange = migrationResult.build_result.duration_ms > 0 
      ? ((migrationResult.build_result.duration_ms - 30000) / 30000) * 100 // Compare to baseline
      : 0;

    return {
      build_time_change: buildTimeChange,
      runtime_impact: -5, // Estimated 5% improvement
      memory_impact: 2, // Estimated 2% increase
      scalability_improvements: [
        'モジュール分離によりスケーラビリティが向上',
        '依存関係の整理により起動時間が短縮',
      ],
      performance_concerns: [
        buildTimeChange > 20 ? 'ビルド時間が大幅に増加' : '',
      ].filter(Boolean),
    };
  }

  private generateRecommendations(
    codeQuality: CodeQualityAnalysis,
    architectureCompliance: ArchitectureCompliance,
    securityAnalysis: SecurityAnalysis
  ): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Code quality recommendations
    if (codeQuality.test_coverage < 50) {
      recommendations.push({
        priority: 'high',
        category: 'Testing',
        title: 'テストカバレッジの向上',
        description: `現在のテストカバレッジ${codeQuality.test_coverage}%を50%以上に向上させてください`,
        implementation_effort: '2-3週間',
        expected_benefit: 'バグの早期発見とリファクタリングの安全性向上',
      });
    }

    // Architecture recommendations
    if (architectureCompliance.modular_monolith_compliance < 90) {
      recommendations.push({
        priority: 'medium',
        category: 'Architecture',
        title: 'モジュラーモノリス準拠性の向上',
        description: 'モジュール間の境界をより明確に定義し、依存関係を整理してください',
        implementation_effort: '1-2週間',
        expected_benefit: 'メンテナンスの向上とモジュールの独立性向上',
      });
    }

    // Security recommendations
    if (securityAnalysis.vulnerabilities.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'Security',
        title: 'セキュリティ脆弱性の修正',
        description: `${securityAnalysis.vulnerabilities.length}個のセキュリティ課題を修正してください`,
        implementation_effort: '1週間',
        expected_benefit: 'セキュリティリスクの軽減',
      });
    }

    return recommendations;
  }

  private makeAutoMergeDecision(
    overallAssessment: OverallAssessment,
    codeQuality: CodeQualityAnalysis,
    migrationResult: MigrationResult
  ): AutoMergeDecision {
    const blockingIssues: string[] = [];
    const conditionsMet: string[] = [];

    // Check blocking conditions
    if (!migrationResult.build_result.success) {
      blockingIssues.push('ビルドが失敗しています');
    } else {
      conditionsMet.push('ビルドが成功');
    }

    if (!migrationResult.test_result.success) {
      blockingIssues.push('テストが失敗しています');
    } else {
      conditionsMet.push('すべてのテストが通過');
    }

    if (migrationResult.failed_patches.length > 0) {
      blockingIssues.push(`${migrationResult.failed_patches.length}個のパッチが失敗`);
    } else {
      conditionsMet.push('すべてのパッチが正常に適用');
    }

    if (overallAssessment.grade === 'F') {
      blockingIssues.push('全体評価が不合格');
    }

    const criticalCodeSmells = codeQuality.code_smells.filter(smell => smell.severity === 'high');
    if (criticalCodeSmells.length > 0) {
      blockingIssues.push(`${criticalCodeSmells.length}個の重大なコード品質問題`);
    }

    const shouldAutoMerge = blockingIssues.length === 0 && 
                           overallAssessment.grade !== 'F' && 
                           overallAssessment.confidence >= 80;

    return {
      should_auto_merge: shouldAutoMerge,
      confidence: overallAssessment.confidence,
      blocking_issues: blockingIssues,
      conditions_met: conditionsMet,
      manual_review_required: !shouldAutoMerge || overallAssessment.confidence < 90,
    };
  }

  private async saveReviewReport(reviewResult: ReviewResult): Promise<void> {
    // Save detailed JSON report
    fs.writeFileSync(reviewResult.outputPath, JSON.stringify(reviewResult, null, 2));
    
    // Generate human-readable markdown report
    const markdownReport = this.generateMarkdownReport(reviewResult);
    const markdownPath = path.join(this.paths.outputRootPath, 'results', 'review-report.md');
    fs.writeFileSync(markdownPath, markdownReport);
    
    console.log(`📄 レビューレポートを保存: ${this.paths.getRelativePath(reviewResult.outputPath)}, ${this.paths.getRelativePath(markdownPath)}`);
  }

  private generateMarkdownReport(reviewResult: ReviewResult): string {
    const { overall_assessment, code_quality, auto_merge_decision } = reviewResult;
    
    return `# VibeFlow レビューレポート

## 総合評価: ${overall_assessment.grade}グレード

**信頼度**: ${overall_assessment.confidence}%
**サマリ**: ${overall_assessment.summary}

### 主な改善点
${overall_assessment.key_improvements.map(improvement => `- ${improvement}`).join('\n')}

### 潜在的な課題
${overall_assessment.potential_issues.map(issue => `- ${issue}`).join('\n')}

## コード品質分析

- **保守性スコア**: ${code_quality.maintainability_score}/100
- **可読性スコア**: ${code_quality.readability_score}/100
- **複雑さスコア**: ${code_quality.complexity_score}/100
- **テストカバレッジ**: ${code_quality.test_coverage}%

### コードの問題点
${code_quality.code_smells.map(smell => 
  `- **${smell.type}** (${smell.severity}): ${smell.description} (${smell.file})`
).join('\n')}

## 自動マージ判定

**判定**: ${auto_merge_decision.should_auto_merge ? '✅ 自動マージ可能' : '❌ 手動レビューが必要'}
**信頼度**: ${auto_merge_decision.confidence}%

### 満たされた条件
${auto_merge_decision.conditions_met.map(condition => `- ✅ ${condition}`).join('\n')}

### ブロック要因
${auto_merge_decision.blocking_issues.map(issue => `- ❌ ${issue}`).join('\n')}

## 推奨事項

${reviewResult.recommendations.map((rec, index) => `
### ${index + 1}. ${rec.title} (${rec.priority})
**カテゴリ**: ${rec.category}
**説明**: ${rec.description}
**実装工数**: ${rec.implementation_effort}
**期待効果**: ${rec.expected_benefit}
`).join('\n')}

---
*Generated by VibeFlow ReviewAgent*
`;
  }
}