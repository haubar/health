# 個人健康儀表板

只供專案擁有者本人使用的健康趨勢視覺化網站。前端採 Vue 3，後端使用 Netlify Functions，持久化資料使用 Netlify Blobs。V1 不是醫療診斷工具，也不提供 Demo 資料、手動輸入、資料匯出或通知。

目前進度與下一步以 [`docs/development/CURRENT.md`](docs/development/CURRENT.md) 為準；完整產品需求以中文規格 [`personal-health-dashboard-codex-plan-netlify-blobs-zh-TW.md`](personal-health-dashboard-codex-plan-netlify-blobs-zh-TW.md) 為準。

## 系統架構

```text
Google Health API
        ↓
Netlify Functions → provider / normalizer / repository
        ↓
Netlify Blobs（ap-southeast-1）
        ↓
Vue 3 Dashboard
```

- `web/`：Vue、Router、Pinia、響應式深色介面。
- `shared/`：前後端共用的型別、Zod schema 與常數。
- `netlify/functions/`：HTTP 與排程 Functions。
- `netlify/lib/`：session、回應格式、Blob factory、key builder 與 repositories。
- `docs/`：架構決策、階段紀錄與交接狀態。

瀏覽器永遠不能指定 `userId` 或任意 Blob key；Functions 必須從已驗證 session 取得使用者身分。健康來源回應必須經 provider／normalizer，頁面不可直接依賴 Google schema。

## 技術需求

- Node.js 22（Vite 7.3 支援 Node 22.12+；Netlify 依 `.nvmrc` 使用 Node 22 最新修補版）
- npm 10+
- Netlify CLI（只有需要本機整合 Functions 時才另外安裝，不放入專案依賴）

本機目前若仍預設 Node 18，先執行：

```bash
nvm use 22
npm install
```

## 環境變數

複製 `.env.example` 為 `.env`，但不要提交 `.env`。必要值：

- `GOOGLE_CLIENT_ID`、`GOOGLE_CLIENT_SECRET`：Google OAuth Web client。
- `GOOGLE_REDIRECT_URI`：本機預設為 `http://localhost:8888/.netlify/functions/auth-google-callback`。
- `OWNER_GOOGLE_EMAIL`：唯一允許登入的完整 Google 信箱，只能存在 server environment。
- `SESSION_SECRET`：至少 32 字元的獨立隨機密鑰。
- `HEALTH_TOKEN_ENCRYPTION_KEY`：第四階段儲存 refresh token 時使用的獨立密鑰。
- `NETLIFY_BLOBS_REGION`：固定為 `ap-southeast-1`。

任何未以 `VITE_` 開頭的值都不可進入前端 bundle。Production secrets 應在 Netlify UI 設定，不要寫入 `netlify.toml`。

## 本機開發

```bash
nvm use 22
npm install
npm run dev
```

上述指令只啟動前端，網站位於 Vite 顯示的本機網址。Functions 與 Google 登入需要系統已安裝 Netlify CLI，再執行 `npm run dev:netlify`，整合網址為 `http://localhost:8888`。CLI 刻意不納入 lockfile，避免其與網站無關的龐大開發相依鏈進入安全稽核；Netlify 雲端建置不需要專案安裝 CLI。

## 驗證

```bash
npm test
npm run build
```

`npm run build` 會先執行 shared、Vue 與 Functions typecheck，再建立 production bundle。每個開發階段都必須同時通過測試與 build。

## Google OAuth（第一階段）

目前已完成擁有者登入 session：OAuth callback 驗證 Google ID token、`email_verified` 與 `OWNER_GOOGLE_EMAIL`，session 最長 30 天並使用 HttpOnly cookie。第四階段才會在核對當時 Google Health 官方 endpoint／scope 後加入健康資料授權、refresh token 加密及真實同步；第一階段不會假裝已完成 Health 連線。

## Netlify 與 Legacy Free 方案

- 建置指令：`npm run build`
- 發布目錄：`web/dist`
- Functions 目錄：`netlify/functions`
- SPA fallback 已在 `netlify.toml` 設定。
- Site-wide Blobs 每次都由唯一 factory 明確指定 `ap-southeast-1`。
- 自訂 Functions region 目前是 Netlify Pro／Enterprise 功能，因此 Legacy Free 使用該站點可用的預設 Functions region，不以升級方案作為正常運作條件。
- 用量以舊帳號後台的 **Usage & billing** 為準，不套用新版 300 credits 假設。

正式 domain、site name 與 OAuth production redirect URI 留到部署階段決定。

## 資料保存與安全

- 正式 UI 只顯示實際同步資料；缺資料不等於 0。
- Refresh token 不得進入 browser、log 或未加密的 Blob。
- 登出時回應 `Clear-Site-Data`，第六階段 PWA 快取也必須遵守此界線。
- 取消 Google Health 連線只停止同步並隱藏資料，不永久刪除。
- V1 不提供站內永久刪除。部署擁有者如需刪除，應先停用排程與 OAuth，再以 Netlify Blobs 管理工具刪除所有 `health-*` stores 中該 `users/{userId}/` prefix；實作維運腳本前不要手動猜 key。此操作不會刪除 Google 端原始資料。

## 目前限制

- Google Health 真實 endpoint、scope、Google Fit／Health Connect 與 O'Care 資料路徑尚待第四階段用實際帳號驗證。
- 第一階段只有登入、資料存取邊界與無資料介面；尚未提供健康資料同步、圖表、分析或 PWA。
- Functions 與 Blobs 可能位於不同 region；Legacy Free 下接受此延遲以避免付費方案依賴。
