# VibeFlow

VibeFlow は、モノリシックなバックエンドコードベースをクリーンに分離されたモジュラーモノリスに変換する自律的リファクタリングパイプラインです。Mastra ワークフローエンジンと claude.ai/code で駆動される言語モデルを組み合わせて、境界検出からコードレビューまでのリファクタリングプロセス全体を自動化します。

## 概要

VibeFlow は以下の特徴を持つリファクタリング自動化ツールです：

- 🔍 **境界自動検出**: コードベースから論理的な境界を自動的に抽出
- 🏗️ **アーキテクチャ設計**: モジュラーモノリスへの移行計画を自動生成
- 🔧 **自動リファクタリング**: 言語固有のパッチを生成して適用
- 🧪 **テスト移行**: テストの再配置と不足ケースの自動生成
- 🔄 **安全なマイグレーション**: Git 統合によるロールバック可能な変更
- 📊 **AI 支援レビュー**: 品質メトリクスと自動マージ判定

## サポート言語

- TypeScript
- Go
- Python

## インストール

```bash
npm install -g vibeflow
```

## 使用方法

### 基本的なワークフロー

1. **リファクタリング計画の生成**

   ```bash
   vf plan ./src
   ```

   コードベースを分析し、モジュラー設計の提案を生成します。

2. **リファクタリングの実行**

   ```bash
   vf refactor ./src
   ```

   生成された計画に基づいてコードを変換します。

3. **自動適用モード**
   ```bash
   vf refactor -a ./src
   ```
   パッチを確認なしで自動適用します。

## マルチエージェントアーキテクチャ

```
BoundaryAgent → ArchitectAgent → RefactorAgent → TestSynthAgent
                                      ↓
                               MigrationRunner → ReviewAgent
```

### エージェントの役割

| エージェント    | 役割                                      | 出力               |
| --------------- | ----------------------------------------- | ------------------ |
| BoundaryAgent   | コンテキスト境界の抽出                    | `domain-map.json`  |
| ArchitectAgent  | モジュラー設計の提案                      | `plan.md`          |
| RefactorAgent   | 言語固有のパッチ生成                      | `.refactor/`       |
| TestSynthAgent  | テストの再配置とスキャフォールディング    | `__generated__/`   |
| MigrationRunner | パッチの実行（失敗時ロールバック）        | `result.json`      |
| ReviewAgent     | AI アシストコードレビューと自動マージ判定 | `review-report.md` |

## 生成されるアーティファクト

| ファイル             | 説明                         |
| -------------------- | ---------------------------- |
| `domain-map.json`    | 抽出された境界情報           |
| `boundary.yaml`      | 手動境界オーバーライド       |
| `plan.md`            | アーキテクチャ設計提案       |
| `.refactor/`         | 生成されたパッチディレクトリ |
| `metrics.json`       | コード品質メトリクス         |
| `result.json`        | ビルド/テスト結果            |
| `coverage-diff.json` | テストカバレッジ変更         |
| `review-report.md`   | AI レビューレポート          |

## 設定

### `vibeflow.config.yaml`

```yaml
# LLMプロバイダー設定
llm:
  provider: claude # または 'ollama'
  model: claude-3-sonnet

# 境界検出設定
boundary:
  minComponentSize: 100
  maxCoupling: 0.3

# リファクタリング設定
refactor:
  preserveStructure: true
  generateTests: true
```

### `boundary.yaml` (手動オーバーライド)

```yaml
boundaries:
  - name: auth
    patterns:
      - "src/auth/**"
      - "src/middleware/auth.ts"
  - name: payments
    patterns:
      - "src/billing/**"
      - "src/payments/**"
```

## 開発

### プロジェクト構造

```
src/
├── cli.ts          # CLIエントリーポイント
├── core/           # コアエージェント実装
│   ├── agents/     # 個別エージェントロジック
│   ├── workflow/   # Mastraワークフロー定義
│   └── utils/      # 共有ユーティリティ
└── tools/          # 言語固有のリファクタリングツール
    ├── typescript/ # TypeScript AST操作
    ├── go/         # Goリファクタリングロジック
    └── python/     # Pythonリファクタリングロジック
```

### 新しいエージェントの追加

1. `src/core/agents/`にエージェントモジュールを作成
2. 入出力アーティファクトスキーマを定義
3. 検証ロジックを実装
4. Mastra ワークフローパイプラインに追加
5. 必要に応じて CLI コマンドを更新

### 新しい言語のサポート

1. `src/tools/`に言語ディレクトリを追加
2. AST 解析と操作を実装
3. 言語固有のリファクタリングルールを作成
4. `workspace/`にテストケースを追加
5. RefactorAgent を更新して新しいツールを使用

## 設計原則

1. **冪等性**: 各ステップは安全に再実行可能
2. **Git 統合**: すべての変更は Git 経由でロールバック可能
3. **検証優先**: 循環依存と境界リークの検出
4. **言語非依存**: 言語ごとに分離されたリファクタリングロジック
5. **段階的進行**: 各エージェントは検証可能なアーティファクトを生成

## トラブルシューティング

### パイプラインの問題をデバッグする

1. 各ステージの完了アーティファクトを確認
2. ドライランモードで変更をプレビュー
3. 適用されたパッチの git diff を確認
4. `metrics.json`で品質指標をレビュー
5. `result.json`でビルド/テストの失敗を確認

## ライセンス

MIT

## コントリビューション

プルリクエストを歓迎します。大きな変更の場合は、まず issue を開いて変更内容について議論してください。

## ステータス

現在アーリーアルファ版です。本番環境での使用は推奨されません。
