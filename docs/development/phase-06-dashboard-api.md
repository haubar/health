# 第六階段：正式資料 Dashboard

日期：2026-09-21

## 完成內容

- 新增受登入保護的 `dashboard-data` GET function，支援 7D、30D、90D、1Y。
- 從使用者專屬 records Blob 讀取資料，使用既有分析引擎依 Asia/Taipei 日期聚合。
- 前端 `DashboardPage` 改為呼叫正式 API；移除空的固定展示值與 fixture fallback。
- 缺少的指標不顯示為零；沒有活動或身體資料時，對應卡片與圖表不渲染。

## 驗證

- `npm run typecheck` 通過。
- `git diff --check` 通過。
- 完整 Vite build 需在 Node.js 22 shell 重跑；目前執行環境仍回報 Node.js 18。

## 下一步

擁有者確認後，進行 Netlify Legacy Free 的環境變數、Functions 路由與正式部署驗證。
