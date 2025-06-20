# ArchitectAgent 設計仕様

VibeFlow における ArchitectAgent の設計仕様を、設計成果物（Design-level Artefacts）としてまとめます。

---

## 1. 責務定義

ArchitectAgent は以下の入力情報をもとに、最終的なモジュール設計文書 `plan.md` を生成するアーキテクトエージェントです。

### 入力

- **domain-map.json**
  自動抽出されたドメイン構造。ファイルパスや関数の命名、依存関係を含む構造情報。
- **boundary.yaml**
  人手で定義されたコンテキスト境界。例: 各ユースケースに対応したドメイン名・機能の分類・業務単位。

### 出力

- **plan.md**
  モジュール構造、依存ポリシー、配置方針などを記述したパッケージ分割案ドキュメント。

### 主な責務

| 責務               | 説明                                                                          |
| ------------------ | ----------------------------------------------------------------------------- |
| 境界統合           | domain-map.json と boundary.yaml をマージし、実際の構造と意図された構造を統合 |
| パッケージ分割設計 | 統合結果をもとに理想的なモジュール単位を設計                                  |
| 依存構造の検証     | 循環依存やリーク境界のチェック                                                |
| 差分レビュー支援   | 現行構成との差分をハイライトし、レビューに役立つ視覚的出力を補助              |

---

## 2. plan.md の章立てテンプレ

```markdown
# Modularization Plan

## 1. Executive Summary

目的、対象スコープ、主な変更点のサマリー。

## 2. Context & Domain Overview

- Extracted Domain Map
- Defined Context Boundaries
- Integration Commentary

## 3. Proposed Package Structure

- Package List with Responsibility
- Layer & Boundary Diagram (Mermaid)
- Directory Layout Example

## 4. Dependency Policies

- Allowed Dependencies
- Forbidden Imports (examples)
- Shared Utility Placement Policy

## 5. Migration Strategy

- Refactoring Order
- Coexistence Period Plan
- Rollback Plan

## 6. Appendix

- Source boundary.yaml
- Extracted domain-map.json
- Validation Reports
```

---

## 3. 検証ルール

以下の静的ルールに基づき、構造妥当性を検証します。

- 🔁 **循環依存チェック**

  - モジュール（パッケージ）間の有向グラフを構築
  - トポロジカルソート不可のサイクルが存在すればエラーとする

- ⛔️ **境界リークチェック**

  - boundary.yaml 上で「依存禁止」とされたコンテキスト間での import を静的解析
  - 特に、UI 層 → ドメイン層、Application 層 → Infrastructure 層の逆流を重点チェック

- 📦 **冗長ユーティリティ判定**
  - 複数パッケージで同名・類似関数が独立定義されていないかを類似度比較で検出

---

## 4. レビュー支援方針

設計ドキュメント `plan.md` のレビュー支援を目的として、以下の差分ハイライト手法を導入します。

- ✅ **差分出力形式**

  - Markdown DIFF 形式
    - `-` (削除), `+` (追加) を使った差分表示
  - ファイル・関数単位の移動提案
    - `Moved: src/legacy/foo.ts -> packages/foo/src/index.ts` 形式で記述

- 🖼 **可視化支援**
  - 依存グラフ差分（Mermaid flowchart）
  - Before / After の構成図を並列表記
  - `red` → forbidden / `green` → allowed
  - 色付きコード例コメント
  - 元コードブロックと移動後コードブロックのペアを表示

---

## 5. テスト戦略（TDD 向け）

### 🎯 ユニットテスト

| 対象モジュール        | テスト項目                                                           |
| --------------------- | -------------------------------------------------------------------- |
| `domainMapLoader`     | `domain-map.json` の構文検証、必須フィールドの存在チェック           |
| `boundaryYamlParser`  | YAML 形式の妥当性検証、context 名の重複チェック                      |
| `boundaryIntegrator`  | `domain-map` + `boundary.yaml` の統合ロジック、優先順位ルールの適用  |
| `dependencyChecker`   | 循環依存の検出、トポロジカルソート不可ケースのエラー検知             |
| `leakDetector`        | 不許可境界間 import の静的解析、逆流パターン検知（例：infra -> app） |
| `redundantUtilFinder` | 類似関数の定義検出、閾値を使った類似度判定                           |
| `planGenerator`       | `plan.md` 各章の出力フォーマット検証、空構成でも破綻しないこと       |
| `diffHighlighter`     | Markdown 差分形式の生成検証、コード移動検出の整合性チェック          |

### 🔁 統合テスト

- `domain-map.json` + `boundary.yaml` を入力とし、`plan.md` が正しく出力されるか検証
- 境界違反が存在するプロジェクトでエラーや警告が正しく出るか
- 境界変更（例：context の統合や削除）により差分が適切に表示されるか

### 📎 モック戦略

- ファイル入出力系は抽象化してユニットテストではモック化
- `MermaidWriter`, `MarkdownWriter` など出力レンダラはインターフェース化して出力差分を検証可能にする

---
