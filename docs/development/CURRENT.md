# 目前開發狀態

最後更新：2026-09-21

## 目前階段

第二階段「儀表板」已完成，等待擁有者確認。在明確確認前，不開始第三階段。

## 下次接續位置

1. 閱讀 [`phase-02-dashboard.md`](phase-02-dashboard.md) 及擁有者對第二階段報告的回覆。
2. 獲得確認後，先建立第三階段紀錄，再編輯 analytics 程式。
3. 只實作已確認的第三階段範圍，完成測試、build 與回報後再次停下。

## 重要限制

- 中文規格為最高依據；英文規格文件必須維持全英文。
- V1 不提供正式 Demo 資料、手動健康資料、匯出、通知、心率、睡眠或 recovery。
- 只允許擁有者使用 Google 登入；browser 不可提供 `userId` 或 Blob key。
- Netlify Legacy Free：不得要求付費自訂 Functions region。Blobs 仍明確使用 `ap-southeast-1`。
- 在第四階段依當時官方文件驗證前，不實作 Google Health 欄位或 scope。

## 最近驗證結果

- `npm audit --audit-level=high`：0 vulnerabilities。
- `npm test`：3 個測試檔、9 項測試通過。
- `npm run build`：shared、Vue 與 Functions typecheck 通過；Vite production build 通過。
- 第二階段最後一次驗證：`npm test` 通過 3 個測試檔、9 項測試；`npm run build` 通過，ECharts 改為動態載入且不再產生大初始 chunk 警告。
