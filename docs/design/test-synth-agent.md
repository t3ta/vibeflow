# TestSynthAgent 設計書

## 目的

**TestSynthAgent** は、VibeFlow ワークフローにおいてコンテキスト境界ごとにテストコードの再配置とスケルトン生成を行うエージェントです。既存コードのカバレッジ向上とテスト構造の整理を支援します。

---

## 1. テスト生成ポリシー

### ✅ カバレッジ目標

| 項目               | 方針                                                                |
| ------------------ | ------------------------------------------------------------------- |
| 境界単位の最低目標 | statement coverage 70%以上（Fail-safe 境界は 50% 以上で警告止まり） |
| カバレッジ指標     | statement, branch, function, line の 4 指標を記録                   |
| カバレッジ比較     | 既存との差分を metrics.json として保存                              |

### ✅ モック方針

| シナリオ                               | モックポリシー                                     |
| -------------------------------------- | -------------------------------------------------- |
| DB や外部 API 呼び出しがある関数       | jest/ts-mockito 等で明示的にモック化               |
| 境界をまたぐ内部関数呼び出し           | 呼び出し元の境界でのみテスト。呼び出し先はスタブ化 |
| DI コンテナでの注入があるクラス等      | 各依存をスタブ or Factory で差し替え               |
| 生成テストで依存が足りない場合         | スケルトンには TODO コメント付きで仮モックを付与   |
| テスト対象外にすべき実装（例：Logger） | 自動で **mocks** フォルダにスタブ定義し、再利用    |

---

## 2. 言語別テンプレ配置規則

### ✅ TypeScript（jest, vitest）

```
<repo-root>/
  packages/
    <boundary-name>/
      src/
        index.ts
      test/
        __generated__/
          <module>.test.ts   // AI 生成スケルトン
        <module>.test.ts     // 既存 or 手動テスト
```

- `__generated__` ディレクトリは再生成可能領域
- 既存のテストと競合しない命名に留意
- `.test.ts` は `import { describe, it, expect } from 'vitest'` などを自動補完

### ✅ Go（testing.T）

```
<repo-root>/
  internal/
    <boundary-name>/
      service.go
      service_test.go
      test_generated/
        service_test.go   // AI 生成テストスケルトン
```

- `test_generated/` は明示的に削除可
- `*_test.go` に対し `func TestXXX(t *testing.T)` を自動挿入
- `go:build !manual` タグでスケルトン限定実行可能にする

---

## 3. CI 連携手順（coverage レポート作成）

### ✅ coverage 生成

| 言語 | コマンド例                                   |
| ---- | -------------------------------------------- |
| TS   | `vitest run --coverage` または `nyc ts-node` |
| Go   | `go test ./... -coverprofile=coverage.out`   |

### ✅ 出力アーティファクト

- `coverage/` ディレクトリにレポート保存
- `lcov.info`, `html/index.html`, `summary.json`
- 差分結果を `coverage-diff.json` に記録（前回との比較用）

### ✅ CI フロー統合例（GitHub Actions）

```yaml
- name: Run Tests & Collect Coverage
  run: |
    npm run test:coverage
    cp coverage/lcov.info artifacts/coverage.lcov
- name: Upload Coverage Artifact
  uses: actions/upload-artifact@v3
  with:
    name: coverage-report
    path: artifacts/coverage.lcov
```

### ✅ カバレッジゲート条件

- Pull Request の場合:
  - `coverage-diff.json` にて減少があれば警告 or ブロック
  - 自動コメントで詳細を通知（ReviewAgent 経由）

---

## 4. TDD向けテストケース一覧

### 🎯 ユニットテスト

| 対象モジュール      | テスト項目                                                                 |
|-------------------|----------------------------------------------------------------------------|
| `TestLocator`     | 境界単位でテスト対象ソースを列挙、既存テストとの対応関係の整合性              |
| `SkeletonGenerator` | スケルトン生成のテンプレート埋め込み、関数の引数不足時の TODO 補完            |
| `MockResolver`    | 外部依存の自動モック対象抽出、スタブ出力が適切に `mocks/` に入るか               |
| `CoverageComparator` | `coverage-diff.json` 生成と閾値ロジックの適用、Fail-safe判定の枝分かれ         |
| `TemplateWriter`  | `__generated__/` への書き出し、上書き防止と競合回避ロジックの検証               |

### 🔁 統合テスト

- `plan.md` に沿って各境界のテストスケルトンが正しく生成され、構文エラーがないこと
- `coverage-diff.json` が正しく更新され、CI ステップと連携できる形式であること
- モック定義が不足している関数で `TODO` コメント付きのスタブが挿入されているか

### 📎 モック戦略

- TypeScript/Goともに AST はモックせずスナップショットで保持し、構文変化も検出可能に
- `fs` 書き込みは tempdir で制御し、再生成領域と手動テストの分離が保持されているかを検査

---
