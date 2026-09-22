# 第六階段：正式資料 Dashboard

日期：2026-09-21

## 完成內容

- 新增受登入保護的 `dashboard-data` GET function，以月份為單位查詢，避免單次讀取 90 天或 1 年原始 records 超過 Netlify 30 秒限制。
- 同步時預先保存 Asia/Taipei 每日摘要；Dashboard 優先讀取日摘要，尚未摘要化的日期才回查 records，並快取每月結果。
- 前端 `DashboardPage` 改為呼叫正式 API；移除空的固定展示值與 fixture fallback。
- 趨勢圖使用前後月切換，每次僅載入一個月，查詢時顯示健康／運動動畫 loading。
- 缺少的指標不顯示為零；沒有活動或身體資料時，對應卡片與圖表不渲染。

## 驗證

- `npm run typecheck` 通過。
- `git diff --check` 通過。
- 完整 Vite build 需在 Node.js 22 shell 重跑；目前執行環境仍回報 Node.js 18。

## 下一步

擁有者確認後，進行 Netlify Legacy Free 的環境變數、Functions 路由與正式部署驗證。
