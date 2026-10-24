# LIGHT BIKE

光の壁を引き合うバイクゲーム。Next.js の学習用に作ったもの。

- 2D Canvas・CPU 対戦。勝つとステージが進み、速くなる
- 操作（PC）: 矢印キー / WASD で方向転換、SPACE で開始
- 操作（スマホ）: 横向きが基本。プレイ画面の右の方向ボタン（またはスワイプ）で方向転換、タップで開始、左の BOOST ボタンでブースト
- 走行中の SPACE でブースト。2 秒間スピードが最大 2 倍になる（負けるまでに 3 回）
- スコアは Server Action で Neon Postgres に保存し、`/ranking` に表示

## オンライン対戦（乱入）

- 誰かが CPU 戦をしていると、トップに **ENTRY** が出る。押すとその人の試合に乱入する（一番長く遊んでいる人が相手）
- 乱入された側には「挑戦者が現れた！」と出て、いまのラウンドが終わったら対戦が始まる。CPU 戦のステージ・スコアは残り、対戦のあと続きから遊べる
- 対戦は先に 3 勝した方の勝ち。速度はステージ 1 で固定、ブーストは各ラウンド 3 回。ランキングには載らない
- プレイ画面右上の「乱入 OK / NG」で、乱入を受け付けるかを切り替えられる（タブが裏にあるときは受け付けない）
- 通信は Supabase Realtime（Broadcast と Presence）。乱入された側（ホスト）だけがゲームを進め、乱入した側には盤面の差分を送る。DB は使わない

## 開発

```bash
npm install
npx vercel env pull .env.local   # DATABASE_URL と NEXT_PUBLIC_SUPABASE_* を取得
npm run dev
```

コミット前に `npm run lint` / `npx tsc --noEmit` / `npm run build` を通す。

テーブル定義は `db/migrations/` にある。

オンライン対戦には `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` が要る（無ければ ENTRY と「乱入 OK / NG」は出ず、CPU 戦だけになる）。手元で試すときは、2 つのウィンドウで開く（同じウィンドウのタブだと、裏のタブは乱入を受け付けない）。
