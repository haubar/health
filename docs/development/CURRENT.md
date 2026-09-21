# 目前開發狀態

最後更新：2026-09-21

## 目前階段

第六階段「正式資料 Dashboard」已完成，Google Health 正式環境同步已確認正常；目前先維持純 Google Health，暫不整合 Google Fit 或其他資料來源。

## 下次接續位置

1. 若繼續優化，先設計 Google Health、Google Fit、Health Connect 的獨立資料來源與同步策略。
2. 各資料來源必須使用獨立 OAuth token；Google Health API 會拒絕含有 Google Fit scope 的 token（`DISALLOWED_OAUTH_SCOPES`）。
3. Google Fit 僅在另行規劃完成後再加入，不要直接混入目前 Google Health OAuth 或正式 records。

## 重要限制

- 中文規格為最高依據；英文規格文件必須維持全英文。
- V1 不提供正式 Demo 資料、手動健康資料、匯出、通知、心率、睡眠或 recovery。
- 只允許擁有者使用 Google 登入；browser 不可提供 `userId` 或 Blob key。
- Netlify Legacy Free：不得要求付費自訂 Functions region。Blobs 仍明確使用 `ap-southeast-1`。
- Google Health 欄位與 scope 僅依官方 REST/API 文件實作；V1 不查詢心率、睡眠或 recovery。
- 目前版本已移除 Google Fit 唯讀檢查功能；Google Fit 的獨立授權與比較功能尚未實作。

## 最近驗證結果

- `npm audit --audit-level=high`：0 vulnerabilities。
- `npm test`：5 個測試檔、17 項測試通過。
- `npm run build`：Node.js 22.17.1 下 shared、Vue 與 Functions typecheck 通過；Vite production build 通過。
- `git diff --check`：通過。
- 最新 commit：`b70db90`，移除 Google Fit 檢查並恢復純 Google Health OAuth。
- Settings 會依是否已有資料顯示「開始同步」或「重新同步」；同步 endpoint 會回傳總筆數與各類型筆數。
- 正式環境已確認 Google Health 同步正常；重新登入後使用純 Google Health token 可避免 `DISALLOWED_OAUTH_SCOPES`。
- 第二階段最後一次驗證：`npm test` 通過 3 個測試檔、9 項測試；`npm run build` 通過，ECharts 改為動態載入且不再產生大初始 chunk 警告。
- 第三階段最後一次驗證：`npm test` 通過 4 個測試檔、15 項測試；`npm run build` 通過。
- 第四階段：Functions/shared typecheck 通過；本機 Node.js 18 無法執行要求 Node.js 20.19+ 的 Vite build，需在符合專案 engines 的 Node 版本重跑。
- 第五階段：Functions/shared typecheck 通過；同步 endpoint 會以登入者身分抓取最近 30 天正式資料並以 record key 去重保存。
- 第六階段：Dashboard API 會讀取登入者保存的正式 records，依 Asia/Taipei 日期聚合；前端不再使用 fixture，無資料的卡片與圖表保持隱藏。已加入首次同步入口，並在 Node.js 22.17.1 完成完整測試與 production build。
