import * as fs from 'fs';
import * as path from 'path';

/**
 * VibeFlow出力ファイルパス管理ユーティリティ
 */
export class VibeFlowPaths {
  private static readonly OUTPUT_DIR = '.vibeflow';
  
  private projectRoot: string;
  private outputRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.outputRoot = path.join(projectRoot, VibeFlowPaths.OUTPUT_DIR);
    this.ensureOutputDirectories();
  }

  /**
   * 出力ディレクトリを作成
   */
  private ensureOutputDirectories(): void {
    const directories = [
      this.outputRoot,
      path.join(this.outputRoot, 'patches'),
      path.join(this.outputRoot, 'tests'),
      path.join(this.outputRoot, 'results'),
      path.join(this.outputRoot, 'logs'),
    ];

    for (const dir of directories) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
  }

  /**
   * ドメインマップファイルパス
   */
  get domainMapPath(): string {
    return path.join(this.outputRoot, 'domain-map.json');
  }

  /**
   * 自動境界発見レポートファイルパス
   */
  get autoBoundaryReportPath(): string {
    return path.join(this.outputRoot, 'auto-boundary-discovery-report.json');
  }

  /**
   * アーキテクチャプランファイルパス
   */
  get planPath(): string {
    return path.join(this.outputRoot, 'plan.md');
  }

  /**
   * パッチディレクトリパス
   */
  get patchesDir(): string {
    return path.join(this.outputRoot, 'patches');
  }

  /**
   * テストディレクトリパス
   */
  get testsDir(): string {
    return path.join(this.outputRoot, 'tests');
  }

  /**
   * マイグレーション結果ファイルパス
   */
  get migrationResultPath(): string {
    return path.join(this.outputRoot, 'results', 'migration-result.json');
  }

  /**
   * レビューレポートファイルパス
   */
  get reviewReportPath(): string {
    return path.join(this.outputRoot, 'results', 'review-report.json');
  }

  /**
   * ログファイルパス
   */
  get logPath(): string {
    return path.join(this.outputRoot, 'logs', 'vibeflow.log');
  }

  /**
   * 出力ルートディレクトリパス
   */
  get outputRootPath(): string {
    return this.outputRoot;
  }

  /**
   * 相対パスでファイルパスを取得（表示用）
   */
  getRelativePath(filePath: string): string {
    return path.relative(this.projectRoot, filePath);
  }

  /**
   * .gitignoreに.vibeflow/を追加
   */
  updateGitignore(): void {
    const gitignorePath = path.join(this.projectRoot, '.gitignore');
    const vibeflowEntry = '.vibeflow/';
    
    try {
      let gitignoreContent = '';
      if (fs.existsSync(gitignorePath)) {
        gitignoreContent = fs.readFileSync(gitignorePath, 'utf8');
      }

      if (!gitignoreContent.includes(vibeflowEntry)) {
        gitignoreContent += gitignoreContent.endsWith('\n') ? '' : '\n';
        gitignoreContent += `${vibeflowEntry}\n`;
        fs.writeFileSync(gitignorePath, gitignoreContent);
      }
    } catch (error) {
      console.warn('⚠️  .gitignoreの更新に失敗:', error);
    }
  }
}