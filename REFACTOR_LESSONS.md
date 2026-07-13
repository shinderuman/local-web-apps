# app.js 分割リファクタの教訓（2026-07）

このリポジトリで実施した「app.js の関心ごと別ファイル分割（DB/State/View/Event 層 + dom-helpers）」の結果得られた教訓。
**結論: 今回の分割は過剰だった。`*-logic.js`（純粋計算関数）のみ維持し、db.js/state.js/view.js/events.js/dom-helpers.js は元に戻す（revert）。**

このドキュメントは、今後同じ過ちを繰り返さないための記録。フレームワークなしの小規模〜中規模な素のJSアプリにおけるファイル分割の判断基準を示す。

---

## 1. 何をやったか

各アプリの app.js に対し、以下の層分割を実施:

- `state.js`（状態オブジェクト集約）
- `db.js`（IndexedDB/localStorage の接続・CRUD）
- `view.js`（描画関数・DB直接呼び出し排除）
- `events.js`（イベントハンドラ・bindEvents）
- `dom-helpers.js`（純粋DOM生成）

アプリ別の適用:
- price-vault: 5層（state/db/view/events/app）
- wp-data-manager: 4層（state/db/view/app）
- smart-vault: 2層追加（db/state）
- url-vault: 2層追加（db/state）

## 2. なぜ過剰だったか

### db.js / state.js（全アプリ）
- **app.js の行数がほとんど減らない** — `db.transaction` がハンドラ内に多数残ったまま（url-vault で28箇所）。接続の取得だけ db.js に移し、実質ロジックは app.js 残存
- **state.js は状態定義を別ファイルに置いた程度** — `window.XXX_STATE.filterState` で公開してもカプセル化されておらず、getter/setter を作ると冗長化。存在意義が薄い
- **依存関係が増えただけ** — index.html の読込順、import 文、モジュール間参照が増え、認知負荷上昇

### view.js（price/wp）
- **意味はあったが、dom-helpers の延長** — 描画とDB取得を分けたが、結局 dom-helpers が十分に機能していれば view.js は薄くなる
- **DB直接呼び出しの排除は、app.js 側でオーケストレーションすれば不要** — `getAllProducts()` → `renderList(products)` と分けるより、`renderList` 内で `getAllProducts` を呼ぶ元の形の方が素直

### events.js（price-vault のみ）
- **高階関数の多用** — `saveProduct(constants, messages, handlers)` のカリー化だらけになり可読性低下
- **handlers の循環参照 workaround** — `handlers.onSelectCategory = selectCategory(constants, handlers)` のように後から埋める手法が必要
- **app.js が70行（起動のみ）になり存在意義薄** — ハンドラを events.js に移しただけで、実質 app.js の中身が別ファイルに移っただけ

### dom-helpers（全アプリ）
- **テストされていない** — jsdom が必要で導入せず。「テスト容易性向上」の恩恵を享受していない
- **再利用されていない** — 各アプリ専用で横断利用なし
- **総行数は不変（移動しただけ）** — モジュール化のオーバーヘッドでむしろ増加
- **コールバック注入で苦しい** — dom-helpers に移すためだけに `onDeleteProduct`/`onToggleDetails` 等の引数で渡す設計になり、events.js 過剰化の遠因に
- **関数の所在を追う手間増** — `createProductRow` が dom-helpers、`createRow` が app.js 等分散

## 3. 残すべきだったもの（維持）

**`*-logic.js`（純粋計算関数）のみ維持。** これらは分割の恩恵が明白:
- 実際にテストされている（`node --test` で検証）
- 副作用なしの純粋計算
- DOM非依存
- 価格計算/フィルタロジック/バリデーション等を単体テストできる

例: price-logic.js / category-logic.js / export-logic.js / horse-logic.js / filter-logic.js / item-logic.js / synopsis-logic.js / title-parser.js / ui-logic.js / format-logic.js / vendor-logic.js / parse-logic.js / health-logic.js

**`image-helpers.js`（url-vault）も維持。** canvas画像処理は純粋計算に近く、`IMAGE` 定数とセットで独立させる意義あり。

## 4. 判断基準（今後の指針）

フレームワークなしの小〜中規模な素のJSアプリでは:

### 分割すべき
- **純粋計算関数**（副作用なし・DOM非依存・テスト可能）→ `*-logic.js`
- 外部API通信ロジック（状態を持たない）→ 独立ファイル

### 分割すべきでない
- **状態オブジェクト**（state.js）— app.js の先頭に置くだけで十分。カプセル化しない公開は無意味
- **ストレージCRUD**（db.js）— 接続だけ別ファイルにしても、トランザクションがハンドラに残れば意味がない。完全に高レベルCRUDに集約できる規模なら別だが、今回のアプリでは過剰
- **DOM生成**（dom-helpers.js）— テストも再利用もないなら、app.js 内で `createElement + textContent` を使えば十分。innerHTML回避は dom-helpers でなくても達成できる
- **View/Event 層**（view.js/events.js）— フレームワークなしだと高階関数多用・循環参照workaroundで可読性低下。app.js に素直な関数定義で置く方が読みやすい

### 設計原則の機械適用は避ける
「関心の分離」「MVC/Flux」等の原則は、フレームワーク（React/Vue/Redux）の支えるインフラとセットで意味を発揮する。素のJS + IIFE+UMD では、原則を機械適用すると過剰になる。

## 5. やってはいけないこと（今回の具体的失敗）

- **コールバック注入で引数を増やす** — dom-helpers/events.js のためだけに `onStartItemEdit`/`onShowToast` 等を引数渡しすると、シグネチャが肥大化
- **高階関数のカリー化** — `saveProduct(constants, messages, handlers)` のような部分適用は可読性を下げる
- **handlers の循環参照 workaround** — `handlers.onXxx = fn(handlers)` の後埋めは理解しづらい
- **「状態を直接参照するか」だけで app.js 残しを判断** — 実際には「分離した先で結局 app.js の関心事を扱う」なら、分離の意味がない
- **「コミット済み・動作実績」を維持根拠にする** — 過去の事実は設計判断の根拠にならない。意味があるかだけで判断する
- **PoC だから過剰にやってみる** — 過剰か確認する意図はあったが、結局「過剰だった」の結論に至るまでに多大な工数を消費。最初から規模と制約（フレームワークなし）を踏まえて判断すべきだった

## 6. 今後同じ議論が出たら

「app.js を分割しましょう」という提案が出たら、まず問うべき:
1. その分割で**テストは書けるか**（書かないなら分離の主目的の1つを放棄）
2. **再利用されるか**（そのアプリ専用なら恩恵薄）
3. **フレームワークなしで循環依存・高階関数を生まないか**
4. **総行数・認知負荷は本当に下がるか**（移動しただけなら無意味）

いずれも「いいえ」なら、分割せず app.js に置く。

---

## 参照: revert 対象

- refactor/app-split ブランチの全コミット（db/state/view/events）
- main にマージ済みの dom-helpers.js 系コミット（各アプリ）
- 維持: `*-logic.js` / `image-helpers.js` / `js/lib/sortable.min.js`
