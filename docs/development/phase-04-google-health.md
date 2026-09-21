# 第四階段：Google Health API

日期：2026-09-21

## 範圍

- 建立 Google Health OAuth scope 與 offline refresh token 流程。
- 以 AES-256-GCM 加密 refresh token，保存於使用者專屬 Blob key。
- 建立可擴充的 GoogleHealthProvider，讀取 V1 活動、身體組成與運動資料。
- 不加入 demo 資料、手動輸入、心率、睡眠或 recovery。

## 完成內容

- `auth-google` 要求官方 activity/measurements read-only scopes。
- callback 驗證 owner、實際授予 scopes，並保存加密連線狀態。
- Provider 支援 steps、distance、active-minutes、exercise、weight、body-fat，使用官方 DataPoint 欄位與分頁。
- 新增加密單元測試與官方欄位整合文件。

## 驗證與限制

- `npm run typecheck` 通過。
- `npm test` 的新加密測試通過；既有 session 測試在目前 Node.js 18 環境因缺少 Web Crypto 失敗。
- `npm run build` 已完成 typecheck，但目前 Node.js 18 不符合 Vite 要求的 Node.js 20.19+，因此 Vite production build 需在符合 engines 的環境重跑。

## 下一步

擁有者確認後，進入第五階段：以已保存的連線建立自動同步、去重與資料不足時隱藏入口的流程。
