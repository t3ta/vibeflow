# 🧩 ModularizeWorkflow 設計書

## 1. コンポーネント図（Mermaid）

```
graph TD
    A[Input: Codebase Snapshot] --> B[AnalyzeContextBoundaries]
    B --> C[GenerateModularStructurePlan]
    C --> D{Language}
    D -->|TypeScript| E[RefactorModulesTS]
    D -->|Go| F[RefactorModulesGo]
    D -->|Python| G[RefactorModulesPy]
    E --> H[WriteBackModules]
    F --> H
    G --> H
    H --> I[TestGeneratedModules]
    I --> J[VerifyModularConsistency]
    J --> K{Success?}
    K -->|Yes| L[EmitSuccessReport]
    K -->|No| M[Rollback & EmitErrorReport]
```

## 2. ワークフロー定義（擬似コード）

```ts
// Define the main modularization workflow
workflow("vibeflow.modularize", () => {
  step("analyzeContextBoundaries", async () => {
    // Analyze domain boundaries and coupling from the input codebase
  });

  step("generateModularStructurePlan", async () => {
    // Generate a plan to split the monolith into coherent modules
  });

  step("refactorModules", async () => {
    parallel({
      typescript: step("refactorModulesTS", async () => {
        // Apply module boundaries and extract packages for TypeScript code
      }),
      golang: step("refactorModulesGo", async () => {
        // Extract Go packages based on planned module split
      }),
      python: step("refactorModulesPy", async () => {
        // Refactor Python files into modular units
      }),
    });
  });

  step("writeBackModules", async () => {
    // Persist module files to disk (dry-run optional)
  });

  step("testModules", async () => {
    // Run unit and integration tests on newly generated modules
  });

  step("verifyModularConsistency", async () => {
    // Ensure no cross-boundary violations exist
  });

  step("handleOutcome", async () => {
    // If success, generate report
    // If failure, rollback and emit diagnostics
  });
});
```

## 3. Rationale（設計判断と代替案）

### ✅ 採用した設計判断

| 項目               | 内容                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| 冪等性             | 各ステップは入力に対して決定論的であり、何度でも再実行可能に保つ。ファイル出力には dry-run オプションを設ける。 |
| 並列実行           | 言語ごとのモジュール分割は相互に依存しないため、parallel による実行効率の向上を狙う。                           |
| モジュール構成計画 | 初期フェーズで「分割案」を生成し、以降の工程ではそれに従うことで LLM の暴走を抑える。                           |
| 言語特化処理       | TypeScript / Go / Python それぞれに固有の構文・依存構造があるため、個別に refactor ステップを分離。             |

### 🔁 代替案と比較

| 案                   | 概要                                | 理由                                                                            |
| -------------------- | ----------------------------------- | ------------------------------------------------------------------------------- |
| 統一ステップ         | すべての言語を 1 つのステップで処理 | LLM 制御が困難になり、言語ごとの失敗切り分けも難しいため不採用                  |
| コード書き換えを先行 | 分割せず直接コードをリライト        | コンテキスト不明なままの書き換えは事故リスクが高く、rollback も困難なため避けた |

### 🔁 ロールバック戦略

• 書き込み操作は中間ディレクトリへ出力
• 本番コードと分離し、ユーザーに diff を提示
• Git ベース環境では一時ブランチでの作業を推奨
• 失敗時の戦略
• 差分を \*.rollback.patch として保存
• エラーレポートには LLM の出力、パーサーログを含める
• モジュール不整合時は verifyModularConsistency にて即中断

---

## 4. TDD 向けテストケース一覧

### 🎯 ユニットテスト

| 対象ステップ                   | テスト項目                                                                 |
| ------------------------------ | -------------------------------------------------------------------------- |
| `analyzeContextBoundaries`     | 入力スナップショットから正しく境界が抽出されるか、エラー時のログ記録       |
| `generateModularStructurePlan` | 計画出力が構造的に正しいか、想定言語・構成に対応できるか                   |
| `refactorModulesTS/Go/Py`      | 各言語別の変換処理が空構成でも落ちないか、対象コードがない場合の skip 処理 |
| `writeBackModules`             | ファイル出力パスの計算、dry-run 時の書き込み抑制が有効か                   |
| `testModules`                  | リグレッション時の早期中断、テスト実行フックの動作確認                     |
| `verifyModularConsistency`     | 境界リークや未対応パスの検出精度、構造整合性チェックの正当性               |
| `handleOutcome`                | 成功・失敗時の条件分岐が想定通りか、レポート出力の有無と形式               |

### 🔁 統合テスト

- 対象プロジェクト全体を与えたときに、一貫したワークフローがエラーなく完走するか
- 言語ごとの `refactorModules` が独立してエラーに対処できるか（TypeScript のみエラー時も Go は続行される）
- dry-run フラグ付きで出力がスキップされること、rollback ファイルが適切に残されること

### 📎 モック戦略

- ファイル書き込み・削除・git 操作はすべて mock filesystem または tempdir にリダイレクト
- LLM 呼び出しステップ（Claude/Ollama）は入力と出力スナップショットで代替し、実呼び出しを避ける

---
