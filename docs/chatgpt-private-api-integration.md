# ChatGPT 每日健康摘要：私人 API 路線

## 現況
- 既有 `GET /.netlify/functions/daily-progress-export` 需要有效的網站登入 Session Cookie；未登入應回傳 401。
- 回傳最近七天的步數、活動時間、體重、同步時間與目標進度，缺失數值為 null。
- 此路線**不需要 Google Drive 授權**，也不應公開私人健康數據。
- ChatGPT 排程目前**尚未具備經驗證的私人 API 身分驗證通道**。請勿把 Session Cookie、OAuth token 或長期 API Key 塞進 ChatGPT 排程提示詞或網址。

## 待完成的真正整合
1. 建立或連接能讓 ChatGPT 在排程執行時呼叫的受保護連接器（例如具 OAuth 授權的自訂 MCP 服務），由該服務代表使用者呼叫網站私人摘要 API。
2. 確認 ChatGPT 排程執行環境支援該連接器；一般聊天可用不代表排程一定可用。
3. 驗證端到端：Netlify 取得當日健康資料 → 連接器讀取 → 20:00 ChatGPT 通知與 Email 包含真實數值。
4. 若排程無法使用連接器，改用可信的私有資料交換機制，或由網站自行推送通知；不得用公開健康資料網址取代授權。

## 安全原則
- 不新增公開的健康摘要端點。
- 不把個人健康資料寫入公開 GitHub repository。
- 不把私密憑證存進程式碼、查詢參數或 ChatGPT 提示詞。
- 來源未同步或授權失敗時，通知應明確說明無資料，不得猜測數值。
