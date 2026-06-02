# 問題ファイルの作り方

このアプリでは、教科一覧と問題データを JSON ファイルで管理します。

複数の問題形式に対応しており、シンプルな Q&A 形式から、穴埋め、選択肢、マッチング、並べ替えなどの複雑な問題型が選べます。

## 1. 教科一覧の定義

`data/subjects.json` には、アプリで表示する教科の一覧を記載します。

例:

```json
[
  {
    "id": "rika",
    "name": "理科",
    "icon": "🔬",
    "file": "data/rika.json"
  }
]
```

項目の説明:
- `id`: 教科を一意に識別する文字列。ファイル名や統計キーとして使われます。
- `name`: 教科名。
- `icon`: 教科を表すアイコン（絵文字など）。
- `file`: 教科データの JSON ファイルパス（`index.html` からの相対パス）。

新しい教科を追加するには、この配列にオブジェクトを追加します。

---

## 2. 問題ファイルの構成

教科データは `data/<subject>.json` のような JSON ファイルで、次の形式にします。

例（シンプル形式）:

```json
{
  "subject": "理科",
  "version": "1.1",
  "units": [
    {
      "unit": "基礎操作",
      "questions": [
        {
          "id": 1,
          "type": "simple",
          "q": "ルーペで手に持った花を観察するとき、正しいピントの合わせ方は？",
          "a": "ルーペを目に近づけて持ち、花を前後に動かす",
          "explanation": ""
        },
        {
          "id": 2,
          "type": "simple",
          "q": "観察するものが動かせないとき、ルーペのピントはどう合わせるか？",
          "a": "ルーペを目に近づけて持ち、顔（自分）を前後に動かす",
          "explanation": ""
        }
      ]
    }
  ]
}
```

### ルートフィールド

- `subject`: 教科名（表示用）。
- `version`: データのバージョン番号。必要に応じて更新してください。
- `units`: 単元の配列。

### 単元オブジェクト

- `unit`: 単元名。
- `questions`: その単元に含まれる問題の配列。

### 問題オブジェクト（共通フィールド）

- `id`: 問題 ID。各教科内で一意になるようにします。
- `type`: 問題形式（省略可、デフォルト: "simple"）
  - `"simple"`: シンプルな Q&A（答えを見てから ○/× で判定）
  - `"fill_in_blank"`: 穴埋め問題
  - `"circle_correct"`: 選択肢問題
  - `"matching"`: マッチング問題
  - `"rearrange"`: 並べ替え問題
- `q`: 問題文。
- `explanation`: くわしい解説。空文字 `""` でも構いません。

---

## 3. 問題形式の詳細

### 3.1 simple（シンプル Q&A）

```json
{
  "id": 1,
  "type": "simple",
  "q": "問題文？",
  "a": "答え",
  "explanation": "詳しい解説"
}
```

- `a`: 答え（テキスト）

### 3.2 fill_in_blank（穴埋め）

```json
{
  "id": 2,
  "type": "fill_in_blank",
  "q": "次の文を完成させて。",
  "blanks": 2,
  "expectedAnswers": ["答え1", "答え2"],
  "a": "答え1 答え2（確認用）",
  "explanation": ""
}
```

- `blanks`: 空欄の個数
- `expectedAnswers`: 各空欄に対する正答のリスト
- `a`: 完成文全体（確認用）

### 3.3 circle_correct（選択肢）

```json
{
  "id": 3,
  "type": "circle_correct",
  "q": "正しい選択肢は？",
  "choices": ["誤り1", "正解", "誤り2"],
  "correctIndex": 1,
  "a": "正解",
  "explanation": ""
}
```

- `choices`: 選択肢の配列
- `correctIndex`: 正答の インデックス（0 から始まる）
- `a`: 正答テキスト

### 3.4 matching（マッチング）

```json
{
  "id": 4,
  "type": "matching",
  "q": "対応する項目を線でつなごう。",
  "items": [
    {"left": "項目A1", "right": "対応B1"},
    {"left": "項目A2", "right": "対応B2"}
  ],
  "a": "すべて正しく対応させた場合の説明",
  "explanation": ""
}
```

- `items`: 左右の対応ペアの配列

### 3.5 rearrange（並べ替え）

```json
{
  "id": 5,
  "type": "rearrange",
  "q": "単語を並べかえて文を完成させよう。",
  "words": ["word3", "word1", "word2"],
  "correctOrder": [1, 2, 0],
  "a": "word1 word2 word3",
  "explanation": ""
}
```

- `words`: シャッフルされた単語の配列
- `correctOrder`: 正しい順序を示すインデックスの配列
  - 例：`words` の インデックス 1, 2, 0 の順が正解

---

## 4. 追加の注意点

- `id` は数字でも文字列でも扱えるが、同じ教科内では重複しないようにしてください。
- `type` を省略した場合は自動的に `"simple"` として扱われます。
- 問題ファイルは `fetch()` で読み込むため、ブラウザで開くだけでは動作しません。`Live Server` などのローカルサーバーで起動してください。
- 教科データのファイル名は `data/subjects.json` の `file` プロパティと一致させます。

---

## 5. 新しい教科を追加する手順

1. `data/subjects.json` に新しい教科オブジェクトを追加する。
2. `data/` に新しい JSON ファイルを作成する。
3. その JSON ファイルに `subject` / `version` / `units` の構成を記載する。
4. `units` 配列内に `unit` と `questions` を定義する。
5. 各質問に `id`, `type`, `q`, `a`, `explanation` を入れる（`type` は省略可）。

---

## 6. 既存ファイルの例

現在の例では、`data/subjects.json` に `rika`（理科）と `english`（英語）が登録されており、それぞれのファイルに複数の単元と問題が定義されています。

これを参考に、新しい教科ファイルを作ってください。