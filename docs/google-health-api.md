# Google Health API 整合規格

本文件記錄 V1 對 Google Health API 的實作邊界。所有欄位與授權 scope 均以 [Google Health API REST reference](https://developers.google.com/health/reference/rest)、[資料型別](https://developers.google.com/health/data-types) 及 [filters/scopes](https://developers.google.com/health/filters) 為準。

## 授權

- 只使用擁有者的 Google OAuth 登入。
- 要求 activity and fitness read-only，以及 health metrics and measurements read-only scope。
- 使用 `access_type=offline` 取得 refresh token；refresh token 以 AES-256-GCM 加密後存入 Netlify Blobs。
- 只接受 callback 中實際授予的 Google Health scope；若沒有 refresh token 或沒有任何 Health scope，登入失敗。

## V1 讀取資料

已實作的資料型別為 steps、distance、active-minutes、exercise、weight、body-fat。Google 的距離以 millimeters 轉為 meters，體重以 grams 轉為 kilograms；active minutes 會加總各 activity level。sample 類型使用 `sampleTime.physicalTime`。

V1 不查詢 heart rate、HRV、sleep、recovery，也不把缺少的資料當成零。active energy 與 total calories 待正式確認其 REST union 欄位後再加入，避免猜測欄位。

## API 邊界

Provider 使用 `users/{ownerId}/dataTypes/{type}/dataPoints` 分頁讀取，並依資料型別使用 interval 或 sample-time filter。token 不會寫入 log；同步層後續才會負責去重、保存與增量游標。
