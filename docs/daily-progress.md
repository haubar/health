# 每日健康進度摘要（功能分支）

- `GET /.netlify/functions/daily-progress-export`：必須持有網站有效 Google 登入 Session，否則回傳 HTTP 401。
- 回傳台灣時區最近 7 天摘要、使用者步數與體重目標、當日步數差額及最近一次量測體重。
- 缺少資料時回傳 `null` 和 `missing_data`，不以零步或零公斤推定。
- 此 API **不提供 ChatGPT 的背景讀取授權**；ChatGPT 自動化不能直接使用瀏覽器 Cookie。要達成真正無人值守的每日 20:00 推播，仍需設計獨立通知管道（如 LINE 或電子郵件）並以 Netlify 伺服器端排程實作。
- 目前沒有可靠的飲食攝取熱量來源，不可用步數反推實際熱量赤字。建議以安全、適度活動及既有飲食計畫為準，不做極端補償。
- 合併前執行 `npm ci && npm test && npm run build`，並確認未登入時 401、登入後只可讀取自己的資料。
