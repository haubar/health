# 系統架構

## 系統邊界

本專案分成四個邊界：

1. `web` 負責呈現已驗證且已正規化的 view model，永遠不接收 provider token 或 Blob key。
2. Netlify Functions 負責驗證請求並協調 use case。
3. Provider adapter 將 Google Health response schema 與 domain model 隔離。
4. Typed repository 負責 key 建立、consistency 與 Netlify Blobs 存取。

`shared` 放置可安全同時供 browser 與 server bundle 使用的 contract。Server environment parsing、token handling 與 repository 都留在 `netlify/`。

## 相依方向

```text
Vue pages → stores/services → protected Functions
                                  ↓
                         use cases/providers
                                  ↓
                           repositories
                                  ↓
                         Netlify Blobs SDK
```

Page 不直接 import provider 或 storage code。Functions 不回傳 provider payload。Repository 接收精簡的 `JsonBlobStore` interface，因此不需要真正連接 Netlify site 就能測試儲存行為。

## 資料可見性

Navigation 由 capability 驅動。只有在同步完成且正規化資料至少有一筆可用紀錄時，區塊才會顯示。直接開啟路由仍須驗證登入，並回傳中性的無資料狀態。因為目前沒有正式資料，基礎架構階段只顯示 Dashboard 與 Settings。

## Runtime 選擇

- 使用 Node 22 與 ESM。
- 刻意使用 Vite 7.3，因為它受支援且能配合目前可用的 Node 22.17 runtime；版本升級會另行處理，不與功能階段混在一起。
- 固定使用 TypeScript 5.9，因為目前官方 Vue TypeScript 設定宣告 peer range 為 TypeScript 5.x；不使用強制安裝繞過相依衝突。
- 使用 Netlify 的 Fetch-style `Request`／`Response` Functions API，不使用舊版 event API。
- Site-wide Blob 存取集中管理，使用 Netlify 預設 region `us-east-2`。
- 不固定 Functions region，因為目前自訂 region 需要付費 Netlify 方案。
