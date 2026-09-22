# 第一階段 — 基礎架構

日期：2026-09-21  
狀態：已完成，等待擁有者確認

## 實作範圍

- `web`、`shared` npm workspace 與根目錄 Netlify code。
- Vue 3、TypeScript、Vite、Router、Pinia 與 Tailwind 基礎架構。
- 響應式深色 shell、擁有者登入、受保護路由、桌面側邊欄與手機底部導覽。
- 簽署的 30 天 session、OAuth state 驗證、Google identity 驗證、精確擁有者信箱 allowlist、登出快取清除。
- 集中的 Netlify Blob factory、驗證過的 key builder、可重用 JSON repository 與 strong consistency settings repository。
- 穩定 key、路徑隔離、consistency 選擇、冪等覆寫、缺漏／損壞文件及簽署 session 的單元測試。
- Netlify build、Functions、SPA fallback、headers 與本機開發設定。

## 重要決策

- 即時健康 OAuth／scopes 與 token 保存留到第四階段。第一階段只實作 identity login，避免錯誤宣稱 Google Health 已連線。
- 正式 UI 不包含 fixture 或產生的紀錄。已登入 Dashboard 使用誠實的無資料狀態。
- 在同步 capability 出現前，導覽只顯示 Dashboard 與 Settings。直接網址使用一個可重用且安全的無資料頁面。
- 固定使用 Vite 7.3，因為它是目前受支援且相容已安裝 Node 22.17.1 的版本；`.nvmrc` 讓 Netlify 與日後本機修補版本使用 Node 22。
- 固定使用 TypeScript 5.9，因為目前 `@vue/tsconfig` 版本要求 TypeScript 5.x。最初選用 TypeScript 7 時發生 peer dependency resolution 失敗，因此修正版本而不是使用 `--force`。
- Netlify CLI 刻意不放入專案依賴。最新版造成 image-processing chain 的 5 個 high 弱點；npm 建議的降版又帶入 55 個舊弱點，包含 5 個 critical。Netlify 雲端 build 不需要 CLI，因此本機整合開發使用另外管理的 CLI，專案 lockfile 只保留實際 build 或測試需要的程式。
- Netlify 官方文件指出自訂 Functions region 需要 Pro／Enterprise。Legacy Free 因此使用該站點可用的預設 Functions region；site-wide Blob store 使用預設 region `us-east-2`。

## 程式復用與擴充點

- `HealthProvider` 讓未來 provider 不會滲入 UI 與 analytics。
- `JsonBlobStore` 與 `JsonRepository` 避免 Functions 到處散落 SDK 呼叫。
- `blobKeys` 是唯一允許建立持久化路徑的位置。
- 共用 API／session／health schema 避免前後端重複定義 contract。
- 一個 `DataUnavailablePage` 處理所有隱藏資料區塊的直接存取。

## 驗證結果

已於 2026-09-21 使用 Node 22.17.1 完成：

```text
npm audit --audit-level=high
found 0 vulnerabilities

npm test
3 test files passed
9 tests passed

npm run build
shared typecheck passed
Vue typecheck passed
Netlify Functions typecheck passed
Vite production build passed
```

第一次 build 發現 `@netlify/blobs` 沒有公開匯出內部 consistency type。現在由 adapter 自行管理精確的 `'strong' | 'eventual'` contract，讓 repository 不依賴 SDK 內部型別；修正後再次執行測試與 build 均通過。

## 後續階段的未解風險

- 真實 Google Health API availability、scopes、webhook 行為，以及 Google Fit／Health Connect／O'Care 資料可見性，需要在第四階段用實際帳號驗證。
- Netlify Blobs integration test 需要已連結的 Netlify development context；第一階段單元測試使用記憶體 adapter，不會寫入正式資料。
- PWA cache 與離線登入畫面留到第六階段。
