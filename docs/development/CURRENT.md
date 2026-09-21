# 目前開發狀態

最後更新：2026-09-21

## 目前階段

第四階段「Google Health API」已完成實作，等待擁有者確認。

## 下次接續位置

1. 閱讀 [`phase-04-google-health.md`](phase-04-google-health.md) 及擁有者對第四階段報告的回覆。
2. 獲得確認後，再開始第五階段「自動化同步」。

## 重要限制

- 中文規格為最高依據；英文規格文件必須維持全英文。
- V1 不提供正式 Demo 資料、手動健康資料、匯出、通知、心率、睡眠或 recovery。
- 只允許擁有者使用 Google 登入；browser 不可提供 `userId` 或 Blob key。
- Netlify Legacy Free：不得要求付費自訂 Functions region。Blobs 仍明確使用 `ap-southeast-1`。
- Google Health 欄位與 scope 僅依官方 REST/API 文件實作；V1 不查詢心率、睡眠或 recovery。

## 最近驗證結果

- `npm audit --audit-level=high`：0 vulnerabilities。
- `npm test`：3 個測試檔、9 項測試通過。
- `npm run build`：shared、Vue 與 Functions typecheck 通過；Vite production build 通過。
- 第二階段最後一次驗證：`npm test` 通過 3 個測試檔、9 項測試；`npm run build` 通過，ECharts 改為動態載入且不再產生大初始 chunk 警告。
- 第三階段最後一次驗證：`npm test` 通過 4 個測試檔、15 項測試；`npm run build` 通過。
- 第四階段：Functions/shared typecheck 通過；本機 Node.js 18 無法執行要求 Node.js 20.19+ 的 Vite build，需在符合專案 engines 的 Node 版本重跑。
