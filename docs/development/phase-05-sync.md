# 第五階段：自動同步

日期：2026-09-21

## 完成內容

- 新增 `sync-health` POST function，只有有效 owner session 才能執行。
- 使用已加密的 Google refresh token，每次同步 30 天正式資料；再次同步時從上次最早日期往前讀取下一個月。
- 以使用者、資料型別、日期與來源 record id 組成 Blob key，重複同步會覆寫同一筆資料，不產生重複。
- 新增同步狀態保存：開始時間、完成時間、目前批次範圍、下一個歷史日期、狀態、資料筆數與錯誤類型。
- 不將缺少的資料寫成零；沒有資料的類型仍保持空集合。

## 驗證

- `npm run typecheck` 通過。
- `git diff --check` 通過。
- 完整 Vitest 仍受目前 shell 顯示的 Node.js 18 缺少 Web Crypto 影響；需要用 Node.js 22 重新執行完整測試與 Vite build。

## 下一步

擁有者確認後，進入第六階段：把同步結果接到正式 Dashboard API 與入口隱藏邏輯，並在 Netlify Legacy Free 限制內完成部署設定。
