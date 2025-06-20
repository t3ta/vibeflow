# BoundaryAgent 設計ドキュメント

VibeFlow コンポーネント設計成日: 2025-06-20

---

## 1. 責務定義（Inputs / Outputs / Invariants）

### 🎯 概要

**BoundaryAgent** は、コードベースおよび DB スキーマ定義から「コンテキスト境界（bounded contexts）」候補を抽出し、`domain-map.json` に出力する役割を担う。これはモジュラーモノリス移行の初期ステップとして、構造的リファクタリングに必要な認識の土台を提供する。

---

### ✅ Inputs

| 種別                      | 説明                                                 |
| ------------------------- | ---------------------------------------------------- |
| `sourceDir: string`       | 対象となるアプリケーションのソースコードディレクトリ |
| `schemaFiles: string[]`   | SQL / Prisma / DBML 等の DB スキーマファイル群       |
| `config?: BoundaryConfig` | 境界検出の挙動を制御する設定（閾値、除外規則など）   |

---

### 📤 Outputs

| ファイル名        | 説明                                                           |
| ----------------- | -------------------------------------------------------------- |
| `domain-map.json` | 検出されたコンテキスト境界およびエンティティ群のマッピング情報 |

---

### 🔒 Invariants（保持すべき不変条件）

- **ファイル入出力の副作用を持たない純粋処理とする（I/O 層は分離）**
- **依存関係グラフの構築はパッケージ・モジュールレベルで行う**
- **出力形式（`domain-map.json`）は VibeFlow 全体で共通の仕様に準拠する**

---

## 2. アルゴリズム概要

### 🧠 境界抽出の戦略

1. **コード依存解析**

   - クラス／関数／変数定義の参照関係を解析（import/export, call graph）
   - 関連度スコアによりクラスタリングを実施（例: Louvain 法など）

2. **DB スキーマ構造の抽出**

   - テーブル定義と外部キー制約から ER グラフを構築
   - 結合密度に基づくテーブルクラスタリング

3. **命名規則と距離による補正**

   - パス／ネーミング上の近接性（例: `user/` vs `account/`）を境界ヒントとして加点
   - 同一クラスタ内の「語彙の共起」なども評価に加える

4. **暫定境界の構築**
   - 上記スコアを統合し、暫定的な "bounded context" を構成
   - 境界名は代表エンティティ名や共通接頭辞から推定

---

### 🛠 解析ツール候補

| 用途                       | ツール例                                           |
| -------------------------- | -------------------------------------------------- |
| TypeScript AST 解析        | `ts-morph`, `typescript` Compiler API              |
| Graph 構築・クラスタリング | `graphlib`, `ml-modularity`, `community-detection` |
| SQL スキーマ解析           | `pgsql-ast-parser`, 自前の正規表現ベース抽出器     |
| Prisma 構文解析            | `@prisma/sdk`, `prisma-schema-parser`              |
| DBML 解析                  | `dbml-cli`, `dbml-js`                              |

---

## 3. `domain-map.json` スキーマ定義

```jsonc
{
  "contexts": {
    "User": {
      "modules": ["src/user", "src/account"],
      "entities": ["User", "Account", "Profile"],
      "relations": ["User -> Account", "Account -> Profile"]
    },
    "Order": {
      "modules": ["src/order", "src/invoice"],
      "entities": ["Order", "Invoice"],
      "relations": ["Order -> Invoice"]
    }
  },
  "meta": {
    "generatedAt": "2025-06-20T12:00:00Z",
    "sourceHash": "abc123def456"
  }
}
```

    •	contexts: 境界（Bounded Context）ごとの構成情報
    •	modules: 物理的モジュール（ディレクトリ／ファイル）
    •	entities: ドメインエンティティ（TypeScriptクラス / テーブル名など）
    •	relations: エンティティ間の参照／依存関係
    •	meta: 生成時のメタ情報

⸻

---

## 4. テスト戦略

### ✅ ユニットテスト

| 対象モジュール        | テスト項目                                                   |
| --------------------- | ------------------------------------------------------------ |
| `astParser`           | import/export 抽出の精度検証（ESM/CommonJS/TS）              |
| `graphBuilder`        | ノード構築と依存エッジの整合性、循環検出                     |
| `schemaParser`        | SQL/Prisma/DBML の各構文から正しいテーブル定義が抽出されるか |
| `clusterer`           | クラスタリングの安定性、スコアパラメータの影響範囲テスト     |
| `nameHeuristics`      | パス／語彙の近接性スコア付与の効果検証                       |
| `domainMapSerializer` | `domain-map.json` の出力フォーマット妥当性とスキーマ準拠性   |

AST パーサ クラス/関数定義と import 構造の抽出精度
Graph 構築器 ノード間の依存関係正確性と循環依存の検出
スキーマパーサ Prisma/SQL/DBML それぞれの構文解釈精度
クラスタリング器 境界クラスタリングの安定性と再現性テスト

### 🔁 統合テスト

- 複数の入力ディレクトリ + スキーマ構成で、期待通りのクラスタが生成されるか検証
- 境界候補の数、構成内容が設定値（閾値・除外）で制御可能か
- 再実行時の安定性（構成変化がない場合に出力が変化しないこと）
- Fixture プロジェクトを用意し、以下を検証：
  - sourceDir + schemaFiles → domain-map.json が一意に定まるか
  - スキーマ変更に応じて適切に再クラスタリングされるか
  - 設定ファイル（除外ルールなど）に従って適切に処理がスキップされるか

### 📎 モック戦略

- AST / スキーマファイルはスナップショットを使い、構文木の差分を検証可能に
- `fs` などの I/O 層はすべて DI 化してモック化（pure function 設計の原則を遵守）

⸻

---

🔚 備考
• 検出結果は後続の ArchitectAgent による手動補正・設計見直しフェーズで使用される
• 境界抽出は確率的な推論を含むため、出力の「自信度スコア」付与を将来的に検討可能
