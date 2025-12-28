# busnavi

広島駅南口 紙屋町 / 八丁堀 行きバス サイネージの React + Vite 実装です。Tailwind CSS でスタイルを構築し、GTFS CSV から時刻表を読み込んで表示します。

## セットアップ

```bash
npm install
```

## 開発モード

1. Vite 開発サーバーを起動
   ```bash
   npm run dev
   ```
2. コンソールに表示される URL（既定では `http://localhost:5173`）を開くと、現在日時に追従する LIVE 表示を確認できます。  
   - 「時刻設定」を開くと任意の日付・時刻に切り替え可能です（適用すると手動モードに移行します）。
   - 「現在時刻」ボタンで再び当日の LIVE 表示に戻ります。外部 WebSocket は不要です。

## ビルド

```bash
npm run build
npm run preview
```

`public/hiroshima_station_weekend_timetable.csv`/`public/hiroshima_station_weekday_timetable.csv` を差し替えると GTFS データを更新できます。開発サーバーのみで動作するため、追加の WebSocket やバックエンドは不要です。

## GitHub Pages への配置

1. `npm run build` を実行すると `dist/` に静的ファイル一式が生成されます。  
2. GitHub Pages を `dist/`（例: `gh-pages` ブランチにコピーする、アクションでデプロイするなど）から配信するよう設定してください。  
3. `vite.config.js` の `base: './'` のおかげで、`https://ユーザー名.github.io/リポジトリ名/` のようなサブパスでも動作します。
