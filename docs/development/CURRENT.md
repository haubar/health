# 目前開發狀態

最後更新：2026-09-21

## 目前階段

第一階段「基礎架構」已完成，等待擁有者確認。在明確確認前，不開始第二階段。

## 下次接續位置

1. 閱讀 [`phase-01-foundation.md`](phase-01-foundation.md) 及擁有者對第一階段報告的回覆。
2. 獲得確認後，先建立第二階段紀錄，再編輯 Dashboard 程式。
3. 只實作已確認的第二階段範圍，完成測試、build 與回報後再次停下。

## 重要限制

- 中文規格為最高依據；英文規格文件必須維持全英文。
- V1 不提供正式 Demo 資料、手動健康資料、匯出、通知、心率、睡眠或 recovery。
- 只允許擁有者使用 Google 登入；browser 不可提供 `userId` 或 Blob key。
- Netlify Legacy Free：不得要求付費自訂 Functions region。Blobs 仍明確使用 `ap-southeast-1`。
- 在第四階段依當時官方文件驗證前，不實作 Google Health 欄位或 scope。

## 最近驗證結果

- `npm audit --audit-level=high`: 0 vulnerabilities.
- `npm test`: 3 files, 9 tests passed.
- `npm run build`: shared, Vue, and Functions typecheck passed; Vite production build passed.
