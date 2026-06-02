# 問題ファイルの作り方（このアプリ向け・更新版）

このアプリは教科ごとの JSON データを読み込んでクイズを行います。ここでは現在の実装に合うよう、フィールドやローカル保存のルール、統計／復習機能との連携について整理します。

## 1. 教科一覧の定義

`data/subjects.json` に教科の一覧を置きます。例:

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

フィールド:
- `id`: 教科を一意に識別する文字列（統計・進捗保存でキーとして使用）。
- `name`: 表示用の教科名。
- `icon`: 教科のアイコン（任意）。
- `file`: 教科データの JSON ファイルパス（`index.html` からの相対パス）。

## 2. ルート構成

各教科ファイルは次の形です。

```json
{
  "subject": "理科",
  "version": "1.0",
  "units": [
    {
      "unit": "基礎",
      "questions": [ /* 質問オブジェクトの配列 */ ]
    }
  ]
}
```

フィールド:
- `subject`: 教科名（表示用）。
- `version`: データバージョン（変更時に更新）。
- `units`: 単元配列。各単元は `unit` と `questions` を持ちます。

## 3. 質問オブジェクト（共通）

- `id`: 教科内で一意な ID（数値または文字列）。`stats` の `weak` 配列はこの `id` を保持します。
- `type`: 問題種別（省略時は `simple`）。
- `q`: 問題文（表示用）。
- `a`: 正答の表示用テキスト（答えを表示するときに使われます）。
- `explanation`: 解説（任意、空文字でも可）。

現在の実装で使われている主な `type` とフィールド例は次の通りです。

### simple

シンプルな Q&A（答えを見てから ○/× を付ける）。

```json
{
  "id": 1,
  "type": "simple",
  "q": "水は何度で沸騰しますか？",
  "a": "100℃",
  "explanation": "標準気圧下での沸点は100℃です。"
}
```

実装メモ: 本アプリは「答えを表示してユーザーが ○/× で判定する」ワークフローを採用しています。`a` フィールドは表示用の解答（テキスト）として必ず用意してください。

### fill_in_blank

穴埋め。`items` または `expectedAnswers` を許容します（`english.json` の変換で使われる形式に合わせています）。

```json
{
  "id": "U1-F1",
  "type": "fill_in_blank",
  "q": "次の単語を完成させよ。",
  "items": [
    { "number": "1", "prefix": "", "answer": "thir", "suffix": "teen", "hint": "4文字" }
  ],
  "expectedAnswers": ["thir"],
  "a": "thir",
  "explanation": "13は thirteen の thir"
}
```

実装メモ: PDF 由来の `items` 配列（`number` / `prefix` / `answer` / `suffix` / `sentence` など）を保持している場合があります。アプリは `items` があるとそれを表示し、解答表示時に `answer` または `expectedAnswers` を結合して表示します。

### circle_correct

選択肢問題。`choices` と `correctIndex`、あるいは `items`（複数小問）形式をサポートします。

```json
{
  "id": "C1-1",
  "type": "circle_correct",
  "q": "次のうち正しいものは？",
  "choices": ["A","B","C"],
  "correctIndex": 1,
  "a": "B"
}
```

または小問複数形式:

```json
{
  "id": "SU3-3-1",
  "type": "circle_correct",
  "q": "20以上の数もわかるかな？",
  "items": [
    { "expression": "twenty", "choices": ["20","30"], "answer": "20" },
    { "expression": "forty", "choices": ["40","50"], "answer": "40" }
  ]
}
```

実装メモ: PDF 由来の形式では、`items` 配列内に `expression` + `choices` + `answer` を持つ複数問題として定義されることがあります。アプリは `items` を逐次表示し、解答表示で各 `answer` を行ごとに表示します。

### matching

マッチング。`items` に `left`/`right` ペアを定義します。

```json
{
  "id": "M1-1",
  "type": "matching",
  "q": "対応するものをつなごう",
  "items": [ {"left":"1","right":"one"}, {"left":"2","right":"two"} ],
  "a": "1 → one\n2 → two"
}
```

`items` の要素例: `{"left": "A", "right": "B"}`。PDF 変換では `left/right` の代わりに別キーとなる場合があるため、変換スクリプトで `left`/`right` へ正規化してください。

### rearrange / rearrange_with_extra

語句の並べ替え。`items` を使う形式や単一 `words` + `correctOrder` 形式の両方に対応。

```json
{
  "id": "R1-1",
  "type": "rearrange",
  "q": "語句を並べかえて文を作ろう。",
  "items": [ { "number": 1, "japanese": "私は〜です", "words": ["I","am","Sota"], "answer": "I am Sota." } ]
}
```

### dictation / write_word / write_sentence など

記述系の問題は `items` 内それぞれを `simple` と同等に扱い、答えは `a` や `answer` に保持します。表示レンダリングは `js/app.js` の各種レンダラに依存します。

## 4. 実装向けの拡張ルールと注意点

- 表示ワークフロー: アプリは「問題を提示 → ユーザーが答えを見る（`revealAnswer()`）→ ユーザーが `○/×` 判定（`judge()`）」を基本にしています。したがって自動採点のための正規化（`correctIndex` や `expectedAnswers`）はあくまで表示や参照用に使われます。
- `items` の多様性: PDF 由来データには以下のような `items` 形式が混在します。変換スクリプトで可能な限り下記の標準形へ揃えてください。
  - マッチング: `{ "left": "A", "right": "B" }`
  - 穴埋め: `{ "number": "1", "prefix": "", "answer": "thir", "suffix": "teen", "hint": "4文字" }` または `{ "number": 1, "sentence": "___ am from Tokyo." }`
  - 選択式（複数）: `{ "expression": "twenty", "choices": ["20","30"], "answer": "20" }`
  - 並べ替え（複数）: `{ "number": 1, "japanese": "…", "words": [...], "answer": "完成文" }`

- 安全性: 現状アプリ内で `innerHTML` を利用している箇所があります。問題文や選択肢に HTML が含まれると XSS 的な表示崩れが起きる可能性があるため、データ生成時に `&`, `<`, `>` をエスケープするか、`q` と表示用のフィールドを別に持つことを推奨します。

- ストレージキー: このアプリは以下の localStorage キーを使用します。ドキュメントや外部ツールがこれらを参照/操作する場合は注意してください。
  - `quiz_stats` — 科目別の集計（`stats` オブジェクト）
  - `quiz_progress` — 中断したクイズの進行保存（再開用）
  - `quiz_last_result` — 直近の結果サマリ（結果画面で表示）

- ID の扱い: `id` は文字列でも数値でも可ですが、科目内で一意にしてください。PDF からの変換では `SU3-1-1` のような文字列 ID を多用しています。

## 5. 例: PDF 由来の複合問題をアプリ形式へ変換した例

元（PDF由来）:

```json
{
  "id": "SU3-3-1",
  "type": "circle_correct",
  "instruction": "20以上の数もわかるかな？",
  "items": [ { "expression": "twenty", "choices": ["20","30"], "answer": "20" }, ... ]
}
```

変換後（アプリ入力）:

```json
{
  "id": "SU3-3-1",
  "type": "circle_correct",
  "q": "20以上の数もわかるかな？",
  "items": [ { "expression": "twenty", "choices": ["20","30"], "answer": "20" }, ... ],
  "a": "1. 20\n2. ..."
}
```

変換スクリプトの利用を推奨します。`scripts/convert_english_questions.py` のように、PDF 元データを走査して上記標準形へ整形する小スクリプトを用意すると保守が楽になります。

---

このドキュメントはアプリの実装（`js/app.js`）に合わせて整理しています。必要なら `render` の挙動（例: 表示フォーマット）に合わせた追加のフィールド例を追記します。