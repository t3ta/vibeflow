# ModularizeWorkflow

You are a senior TypeScript architect.

- Produce **design-level** artefacts only (no production-ready code, no hard-coded library versions).
- Use English for comments _inside code snippets_; use Japanese for all surrounding explanations.
- Output in **Markdown** with clear headings.
- Context: You are building components for **VibeFlow**, an autonomous refactoring pipeline powered by Mastra (workflow engine) and Claude Code (LLM).

## Goal

既存モノリシック API をモジュラーモノリスへ漸進的に移行する
Mastra ワークフロー **`vibeflow.modularize`** を設計してください。

## Deliverables

1. **コンポーネント図**（Mermaid）
2. **ワークフロー定義の擬似コード**
   - TypeScript 風だがパッケージ名・バージョンは伏せる
   - `workflow() / step() / parallel()` 呼び出し例のみ
3. **Rationale**（設計判断・代替案）

## Constraints

- 対象言語: TypeScript / Go / Python 混在
- ステップは **idempotent** かつ再実行可能
- 失敗時のロールバック戦略を記述
