# Personal Health Dashboard V1 — Codex 中文開發規格

## 1. 專案目標

建立一套部署於 Netlify 的「個人健康趨勢分析網站」。

V1 以 **Google Health API** 作為主要健康資料來源，使用 **Netlify Functions** 處理 OAuth、API、同步與分析，並以 **Netlify Blobs** 作為持久化儲存層。

這是一套個人健康與運動趨勢分析工具，不是醫療診斷系統。

V1 以網站內視覺化檢視健康資料為主，不提供將已同步資料匯出成檔案的功能。

V1 不提供瀏覽器推播、手機推播、Email 摘要或其他主動通知；所有健康資料、分數、Insights 與每週摘要僅在通過登入驗證後於網站內查看。

V1 只以 Google Health API 實際可取得、且使用者帳號確實有紀錄的指標作為正式資料展示與分析依據。沒有資料的指標顯示適當空狀態，不捏造、不以 0 代替；未支援的指標不要求補入。V1 不提供手動輸入健康資料。原始時間以 UTC 保存；每日統計固定依台灣時間 `Asia/Taipei` 分日。

V1 使用者介面以繁體中文（`zh-TW`）為主要且唯一必做語系。日期、時間及數字採台灣地區格式，健康指標名稱優先使用清楚的繁體中文；必要時可在中文後保留常見英文縮寫，例如 BMI。V1 不要求英文介面或語系切換功能。

V1 統一使用公制：體重以公斤（kg）、距離以公里（km）、身高與腰圍以公分（cm）顯示。Normalized records 與聚合資料採明確的標準單位保存；若來源單位不同，Normalizer 負責轉換並保留來源單位資訊供查核。前端不得自行猜測單位。

V1 採深色介面，不要求亮色主題或主題切換。Dashboard 卡片、圖表、提示與各種狀態須在深色背景下具備清楚對比；不可只以顏色區分數據系列、正負趨勢或錯誤狀態，須搭配標籤、圖示或線型。

V1 僅供專案擁有者一人使用，不提供公開註冊或多使用者帳號管理。網站登入使用連接健康資料的同一個 Google 帳號，不另設網站帳號。伺服器端須驗證該 Google 帳號是獲准的專案擁有者，建立受保護的 session；健康資料 API 從 session 推導 `userId`，不得由 browser 指定。

目前健康資料主要來自 Android 手機的 Google Fit App，且手機已安裝 Google Health App。規劃階段暫時假設 Google Fit 的步數可透過 Google Health API 取得；此為待驗證假設，不代表目前已確認同步成功。V1 仍以 Google Health API 為網站資料來源；在實作真實同步前，須確認 Google Fit 資料是否已透過 Health Connect 同步到 Google Health，並以實際 API 讀取驗證可取得的資料類型。不得假設 Google Fit 畫面中的所有資料都會自動出現在 Google Health API。

使用者另有使用 O'Care 3（歐瑟若體重／體脂計 App；`charder.charder.ocare3`）。App 說明列有體重、體脂等量測值，廠商公告支援串接 Google Fit；使用者已確認可在 Google Fit 看見 O'Care 的體重或體脂紀錄。使用者目前不確定 Health Connect 是否也有該紀錄，V1 在實作真實同步前須驗證這些紀錄是否繼續出現在 Health Connect、Google Health 及 Google Health API；在整條路徑確認前，不將此資料視為網站已可同步。此 App 的存在不代表腰圍、血壓或備註可由 Google Health API 讀取。

若 Google Health 帳號中還有其他 App 或裝置的資料，V1 也一併納入已授權的資料來源。聚合時須避免多來源重疊造成重複計算；依各資料類型的官方 API 能力採用整合資料流或明確的去重規則，並保留來源資訊供查核。

核心資料流：

```text
Google / Fitbit / Pixel Watch 健康資料
                ↓
         Google Health API
                ↓ OAuth 2.0
         Netlify Functions
                ↓
          Netlify Blobs
                ↓
     健康分析 / 每日聚合
                ↓
          Vue 3 Dashboard
```

不要加入 Supabase、PostgreSQL 或額外的常駐 Backend Server，除非後續需求明確要求。

---

## 2. 技術棧

### Frontend
- Vue 3
- TypeScript
- Vite
- Vue Router
- Pinia
- Tailwind CSS
- ECharts
- date-fns
- Zod

### Backend / Hosting
- Netlify
- Netlify Functions
- Netlify Scheduled Functions
- Netlify Blobs

### Health Data
- Google Health API
- Google OAuth 2.0

### Testing
- Vitest
- API / Function tests
- 必要的 E2E smoke tests

---

## 3. 專案目錄

建立 monorepo：

```text
personal-health/
├── web/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── stores/
│   │   ├── composables/
│   │   ├── services/
│   │   └── types/
│   ├── public/
│   ├── package.json
│   └── vite.config.ts
│
├── netlify/
│   ├── functions/
│   │   ├── auth-google.ts
│   │   ├── auth-google-callback.ts
│   │   ├── health-sync.ts
│   │   ├── health-summary.ts
│   │   ├── health-activity.ts
│   │   ├── health-body.ts
│   │   ├── health-workouts.ts
│   │   ├── health-trends.ts
│   │   ├── health-score.ts
│   │   ├── health-insights.ts
│   │   ├── health-timeline.ts
│   │   ├── daily-health-analysis.ts
│   │   └── weekly-health-summary.ts
│   │
│   └── lib/
│       ├── blobs.ts
│       ├── auth.ts
│       ├── crypto.ts
│       ├── google-health.ts
│       ├── response.ts
│       ├── validation.ts
│       ├── keys.ts
│       ├── health/
│       └── repositories/
│
├── shared/
│   ├── types/
│   ├── health/
│   └── constants/
│
├── docs/
│   ├── architecture.md
│   ├── google-health-api.md
│   ├── health-score.md
│   ├── blob-storage.md
│   └── api.md
│
├── netlify.toml
├── package.json
├── .env.example
└── README.md
```

---

## 4. Google Health API

### 原則

V1 使用 Google Health API，不使用舊版 Google Fit API。

實作 API endpoint、scope、request/response field 時，不得自行猜測。必須依 Google Health API 當下官方文件實作。

建立 Provider abstraction：

```ts
interface HealthProvider {
  getSteps(range: DateRange): Promise<StepRecord[]>
  getWeight(range: DateRange): Promise<WeightRecord[]>
  getBodyFat(range: DateRange): Promise<BodyFatRecord[]>
  getWorkouts(range: DateRange): Promise<WorkoutRecord[]>
}
```

V1：

```text
GoogleHealthProvider
```

未來允許增加：

```text
HealthConnectProvider
GarminProvider
AppleHealthProvider
ManualProvider
```

Dashboard 與分析邏輯不得直接依賴 Google API response schema。

---

## 5. OAuth 2.0

第一次連線：

```text
使用者
 ↓
Connect Google Health
 ↓
Google OAuth
 ↓
授權 Health scopes
 ↓
Netlify OAuth Callback
 ↓
取得 Access Token / Refresh Token
 ↓
加密 Refresh Token
 ↓
Netlify Blobs
 ↓
第一次 Health Sync
```

需要支援 offline access，使 Netlify Scheduled Functions 可以在使用者未開啟網站時更新資料。

### 安全要求

- `GOOGLE_CLIENT_SECRET` 只能存在 Netlify server environment。
- Refresh Token 不可傳送至 browser。
- Refresh Token 寫入 Netlify Blobs 前必須進行 application-level encryption。
- OAuth callback 必須驗證 state。
- 不得在 log 中輸出 access token、refresh token 或完整健康 payload。
- Health scope 採最小權限原則。

### 登入、連線與資料可見性

- V1 僅允許已核准的專案擁有者 Google 帳號登入，不提供公開註冊。
- 唯一允許登入的 Google 帳號信箱由 server-only 環境變數 `OWNER_GOOGLE_EMAIL` 設定。OAuth callback 須先驗證 Google ID token 的簽章、issuer、audience、期限及 `email_verified`，再以正規化後的完整信箱精確比對；不符合即拒絕建立 session。不得將允許清單或信箱嵌入前端 bundle。
- Google 登入即為 V1 唯一使用者驗證方式，不另設網站密碼、PIN 或生物辨識解鎖。Session 最長有效 30 天；cookie 須使用 `HttpOnly`、`Secure`、適當的 `SameSite` 設定，過期後要求重新登入。登出或帳號驗證失效時立即使現有 session 失效。
- 登出後不得顯示或透過 API 讀取健康資料。
- 在網站中取消 Google Health 連線時，停止同步並保留已匯入的資料，但 Dashboard 與健康資料 API 不得顯示或回傳這些資料；畫面僅顯示連線狀態與重新連線入口。
- 重新連線同一個已核准的 Google 帳號後，既有資料自動恢復顯示並啟動同步更新；同步完成前應標示最後更新時間，不得將舊資料誤呈現為即時資料。
- V1 不提供網站內永久刪除已儲存健康資料的功能；取消連線僅停止同步並隱藏資料，不執行刪除。README／隱私說明仍須提供專案擁有者管理與永久刪除網站所存資料的操作方式，並明確區分網站儲存資料與 Google 原始資料。

---

## 6. V1 健康資料

優先支援：

### Activity
- Steps
- Distance
- Active calories
- Total calories
- Exercise / Workout

### Sleep
- V1 不同步睡眠資料，因目前沒有記錄睡眠的 App 或裝置。
- 不申請 sleep scope、不查詢、不保存、不計分，也不建立 Sleep 頁面。
- 未來有實際睡眠資料來源後再另行擴充。

### Heart
- V1 不同步 Heart rate、Resting heart rate 或 HRV，因目前沒有量測心率的裝置。
- 不查詢、不保存、不計分，也不建立 Heart 頁面。
- 未來有裝置與實際資料後再另行擴充。

### Body
- Weight
- Body fat
- Lean mass（若有）
- Height
- BMI（自行由 height + weight 計算）

Optional data 缺少時必須正常運作。

禁止將：

```text
missing data
```

當成：

```text
0
```

---

## 7. Normalized Health Record

所有 Provider 資料先轉成統一格式。

範例：

```ts
interface HealthRecord {
  id: string
  userId: string
  provider: 'google_health'
  sourceRecordId: string
  sourceApp?: string

  type:
    | 'steps'
    | 'distance'
    | 'weight'
    | 'body_fat'
    | 'exercise'
    | 'active_calories'
    | 'total_calories'

  startTime: string
  endTime?: string

  value?: number
  unit?: string

  metadata?: Record<string, unknown>
}
```

Raw Google Health response 與 normalized data 必須解耦。

---

# 8. Netlify Blobs 儲存設計

使用 `@netlify/blobs`。

同步後的歷史健康資料、聚合結果、分數、Insights 與 Timeline 預設持續保存，不設定自動到期或定期刪除；直到專案擁有者依 README 中的維運流程手動刪除。取消 Google Health 連線不改變此保存規則。若日後加入備份，備份需遵守相同的敏感資料保護與刪除流程；V1 不要求額外備份服務。

**不要加入 Supabase / PostgreSQL。**

Netlify Blobs 是 key/value object storage，不是 relational database。

因此：

- 不使用 SQL
- 不依賴 JOIN
- 不依賴 relational unique constraint
- 不做任意欄位 query
- 以 key convention + prefix listing 設計讀取模式
- Dashboard 常用資料必須預先聚合

## Stores

### health-profiles

```text
users/{userId}/profile.json
```

保存：

```text
displayName
timezone
units
createdAt
updatedAt
```

V1 不讀取或保存生日與生理性別，也不為這兩項資料申請額外 OAuth scope。`displayName` 只用於已登入介面；`timezone` 固定採 `Asia/Taipei`，`units` 固定採公制。身高若由已授權的 health metrics 資料取得，作為帶時間的 normalized health record 保存，不放入靜態 profile，也不得由生日或性別推算任何健康判斷。

---

### health-auth

```text
users/{userId}/google-health.json
```

保存：

```text
provider
encryptedRefreshToken
scopes
status
expiresAt
lastSyncAt
```

此 Store 使用 strong consistency。

---

### health-records

```text
users/{userId}/records/{dataType}/{yyyy}/{mm}/{recordId}.json
```

保存 normalized health records。

`recordId` 必須穩定。

相同 Google Health source record 每次同步都必須對應相同 Blob key。

如此可透過：

```text
set same key
```

完成 idempotent overwrite。

---

### health-daily

```text
users/{userId}/daily/{yyyy}/{mm}/{yyyy-mm-dd}.json
```

每日只保存一份 aggregate JSON。

例如：

```json
{
  "date": "2026-09-21",
  "steps": 8432,
  "distanceM": 5820,
  "activeMinutes": 82,
  "exerciseMinutes": 32,
  "activeCalories": 428,
  "totalCalories": 2180,
  "weightKg": 78.3,
  "bodyFatPercentage": null
}
```

Dashboard 主要讀這個 Store，而不是每次重新掃描 raw records。

---

### health-scores

```text
users/{userId}/scores/{yyyy}/{mm}/{yyyy-mm-dd}.json
```

保存：

```text
activityScore
bodyScore
overallScore
dataCompleteness
details
algorithmVersion
```

---

### health-insights

```text
users/{userId}/insights/{yyyy}/{mm}/{yyyy-mm-dd}.json
```

一天一個 Insight array。

---

### health-timeline

```text
users/{userId}/timeline/{yyyy}/{mm}/{yyyy-mm}.json
```

Timeline 以月為單位保存。

---

### health-settings

```text
users/{userId}/goals.json
```

保存：

```text
dailyStepGoal
weeklyExerciseMinutesGoal
weightGoalKg
units
```

`dailyStepGoal` 由系統提供預設值 8,000 步，`weeklyExerciseMinutesGoal` 預設為每週 150 分鐘；兩者皆可在 Settings 修改。這些數值只是產品初始設定，不代表醫療判斷或通用健康門檻。`weightGoalKg` 預設未設定，不自動推定；只有使用者在 Settings 明確填入後，才顯示體重目標／進度並允許 Body Score 使用 goal progress。清除體重目標後，相關進度立即隱藏並重新計算分數。

使用 strong consistency。

---

### health-sync

同步狀態：

```text
users/{userId}/state/google-health.json
```

保存：

```text
cursor
watermark
lastSuccessAt
lastAttemptAt
status
```

同步紀錄：

```text
users/{userId}/runs/{yyyy}/{mm}/{timestamp}-{syncId}.json
```

---

## 9. Blobs 使用規則

### Consistency

以下資料使用 strong consistency：

- OAuth connection
- Refresh token state
- User settings
- Sync cursor / watermark

以下可使用 eventual consistency：

- 歷史 health records
- 已完成 daily aggregate
- 已完成 scores
- 歷史 insights

Site-wide store 固定使用同一 region。

所有 `getStore()` 呼叫必須使用一致的 Blob region。

V1 使用 Netlify Blobs 預設 region `us-east-2`。唯一的 Blob store factory 不傳入 `region`，讓所有 `getStore()` 使用同一預設值。變更 region 視為資料遷移，不得只改環境變數。

Netlify Functions 原先偏好使用 Singapore（`sin`），但 Netlify 目前官方文件將自訂 Functions region 列為 Pro／Enterprise 功能，與本專案 Legacy Free 前提不相容。V1 在 Legacy Free 下沿用該站點可用的 Functions 預設 region，不把 `sin` 視為必要條件，也不為此升級方案；若日後方案已支援，再經確認後調整。Functions region 與 Blobs region 是兩個獨立設定；site-wide Blob store 使用預設 `us-east-2`。

---

## 10. Repository Layer

Page 與 API Function 不可直接大量呼叫 `getStore()`。

建立：

```text
netlify/lib/repositories/
```

例如：

```text
profileRepository.ts
authRepository.ts
healthRecordRepository.ts
dailyHealthRepository.ts
scoreRepository.ts
insightRepository.ts
timelineRepository.ts
syncRepository.ts
```

API 使用：

```ts
await dailyHealthRepository.getRange(userId, start, end)
```

而不是：

```ts
getStore(...).list(...)
```

散落在各 Function。

這樣未來更換儲存方案時不需要重寫整個網站。

---

# 11. Health Sync

建立：

```text
POST /.netlify/functions/health-sync
```

V1 不提供使用者可見的「立即同步」按鈕。首次連線後由系統啟動首次回填；後續以排程自動同步及必要的失敗重試為主。同步入口僅供受保護的內部流程使用，不公開為任意使用者可呼叫的操作。Dashboard 顯示最後更新時間與同步狀態。

首次同步須匯入 Google Health API 對已授權資料類型可取得的全部歷史資料，不設定固定回溯年限。以分批、分頁、可續傳的背景回填處理；記錄各資料類型的進度與失敗狀態。初次回填未完成時，Dashboard 應標示同步中及目前資料範圍，不得把尚未匯入的日期當作沒有資料。回填完成後再依增量同步規則維持更新。

流程：

```text
驗證 session
 ↓
取得加密 Refresh Token
 ↓
解密
 ↓
Refresh Google Access Token
 ↓
Google Health API
 ↓
取得新資料
 ↓
Normalize
 ↓
寫入 health-records
 ↓
更新 health-daily
 ↓
計算 Score
 ↓
產生 Insight
 ↓
更新 Sync State
```

同步必須：

- idempotent
- retry safe
- 支援 pagination
- 支援 partial failure
- 不建立 duplicate record
- 記錄 last successful sync
- 不在 log 輸出敏感資料

Google Health 上游資料為正式來源。來源紀錄被更正時，以穩定來源 ID 覆寫 normalized record；來源紀錄被刪除時，移除對應本地紀錄，而非繼續永久保存舊副本。之後重算所有受影響日期／週的 daily aggregates、scores、insights 與 timeline。優先使用 Google Health webhook 的 `UPSERT`／`DELETE` 通知定位變更範圍，兩次每日排程同步另做補漏 reconciliation；webhook 必須驗證簽章、具備冪等處理，且只將工作排入受保護的背景流程。若通知遺失或 API 對特定資料類型不提供足夠刪除資訊，依官方能力採用有界回看與週期性核對策略，並在 `docs/google-health-api.md` 記錄限制。

---

# 12. Scheduled Functions

建立：

```text
daily-health-analysis
weekly-health-summary
```

V1 每天於台灣時間 `02:00` 與 `14:00` 執行自動同步與分析。`Asia/Taipei` 固定為 UTC+8，對應 Netlify UTC cron `0 6,18 * * *`（UTC `18:00` 對應隔日台灣時間 `02:00`，UTC `06:00` 對應同日 `14:00`）。兩次執行須可安全重跑並更新已聚合資料。每週摘要仍另行排程。

每週統計以台灣時間週一 `00:00` 至下週一 `00:00` 的半開區間計算，畫面標示為週一至週日。每週摘要於週一台灣時間 `03:00` 產生上一完整週，對應 Netlify UTC cron `0 19 * * 0`；資料晚到或補同步時可重算受影響的週摘要。

## daily-health-analysis

每天：

```text
同步必要資料
 ↓
產生前一天 daily aggregate
 ↓
更新 rolling baseline
 ↓
計算 scores
 ↓
產生 insights
 ↓
產生 timeline events
```

## weekly-health-summary

每週計算：

```text
平均步數
總運動時間
體重趨勢
Health Score 趨勢
WoW change
```

不要在 Scheduled Function 每次重新掃描全部歷史 raw records。

---

# 13. Dashboard

首頁包含：

```text
Health Score
Activity
Body
```

Today：

```text
Steps
Calories
```

首頁主要 Health Score 顯示最近一個已完成的 `Asia/Taipei` 日曆日，正常情況為昨天，並清楚標示分數日期。今天尚未結束的資料只顯示於 Today 即時指標區，不混入完整日 Health Score。若昨天資料尚未完成同步或未達計分門檻，依序尋找最近一個已完成且可計分的日期，並標示實際日期；找不到時隱藏分數。

This Week：

```text
Steps trend
Exercise trend
Weight trend
```

Insights：

```text
本週活動量高於 30 日平均
連續 N 天達成活動目標
```

---

# 14. 頁面

建立：

```text
/dashboard
/activity
/body
/workouts
/insights
/timeline
/settings
```

Mobile 使用 Bottom Navigation：

```text
Home
Activity
Body
More
```

Desktop 使用 Sidebar。

手機與電腦皆為 V1 主要使用情境，兩者須同等完成與驗收；不可將其中一種視為僅供相容的次要版面。手機需支援觸控操作與安全區域，桌面需有效利用較寬畫面呈現趨勢與比較資訊，兩者的資料內容與狀態必須一致。

Activity、Body、Workouts 等資料頁的導覽入口依「已完成同步且至少有一筆可用資料」動態顯示；Insights 與 Timeline 也只有在至少產生一筆可顯示內容後才出現入口。確認沒有資料或內容時隱藏入口。同步或分析尚未完成時不得過早判定無資料，應顯示處理狀態。Dashboard 的無資料區塊亦不顯示。若使用者以舊書籤或直接網址開啟已隱藏頁面，仍須通過登入驗證，並顯示安全的無資料狀態及返回 Dashboard 的操作，不回傳敏感偵錯資訊。

---

# 15. Activity Page

顯示：

```text
Today Steps
Distance
Active Minutes
Exercise Minutes
Calories
```

趨勢以月份為單位查詢和切換；每次讀取一個月，避免單一 Functions request 一次讀取 90 天或 1 年原始 records 而超過 Netlify 30 秒限制。日摘要完整後，API 直接讀取 daily documents；尚未摘要化的日期才回查原始 records。

早期範圍選項（逐月瀏覽取代一次讀取整段範圍）：

```text
7D
30D
90D
1Y
```

統計：

```text
Daily Steps
Weekly Average
Monthly Average
Goal Completion Rate
Active Days
```

---

# 16. Sleep Page

V1 不建立 Sleep Page，也不顯示其導覽入口。未來有實際睡眠資料來源後，才另行定義頁面、跨午夜歸日規則、同步粒度與分數規則。

---

# 17. Heart Page

V1 不建立 Heart Page，也不顯示其導覽入口。未來增加心率量測裝置並確認 Google Health API 有實際資料後，才另行定義頁面、同步粒度與分數規則。

---

# 18. Body Page

顯示：

```text
Weight
BMI
Body Fat
Lean Mass
```

圖表：

```text
7D
30D
90D
1Y
```

體重圖同時呈現：

```text
Raw Weight
7 Day Moving Average
```

不要過度解讀單日體重。

---

# 19. Workouts

Workouts 頁面確認保留於 V1。頁面只顯示 Google Health API 實際取得的 exercise／workout 紀錄；沒有紀錄、未授權或來源不支援時，分別顯示對應空狀態，不建立示範運動或將缺資料計為零。

顯示：

```text
This Week

Workout Count
Total Minutes
Calories
```

Workout type：

```text
Running
Strength Training
Walking
Cycling
Other
```

單筆顯示：

```text
Type
Start Time
Duration
Calories
```

---

# 20. Health Score

所有 Score：

```text
0 - 100
```

但不得描述為醫療健康程度。

定義：

> 相對於個人 baseline、個人目標與一般健康行為指標的趨勢分數。

## Activity Score

建議 V1：

```text
Steps                  35%
Exercise Minutes       30%
Active Minutes         20%
Activity Consistency   15%
```

使用：

```text
Personal Goal + 30 Day Baseline
```

而不是單純以 10,000 步判斷。

---

## Sleep Score

V1 不計算 Sleep Score。未來有實際睡眠資料來源後再另行設計。

---

## Recovery Score

V1 不計算 Recovery Score，因目前沒有心率、靜息心率或 HRV 量測來源。未來取得相關裝置與資料後再另行設計，不以其他指標單獨推測 Recovery。

---

## Body Score

以趨勢為主，不鼓勵單純以 BMI 做總體健康判斷。

可考慮：

```text
Weight trend
Body fat trend
Lean mass preservation
Goal progress
```

資料不足時降低 completeness。

---

## Overall Score

V1：

```text
Activity    30%
Body        15%
```

Sleep 與 Recovery 不納入 V1。原始 Activity 30%、Body 15% 依 2:1 比例正規化：內部計算使用 Activity 2/3、Body 1/3，介面可顯示為 67%／33%。

Health Score 確認保留為 V1 核心功能，但正式分數只能使用 Google Health API 實際取得的指標。Overall Score 只有在 Activity 與 Body 兩個維度都可計分，且整體 Data Completeness 大於或等於 50% 時才顯示；任一條件不符時，首頁不顯示 Overall Score 數值，其他有實際資料的指標與圖表仍正常顯示。不得以 0 分、單一維度放大或推測數值代替缺資料。演算法規格須進一步明定各維度的最低資料量、Data Completeness 計算方式與邊界案例，並以測試驗證。

V1 採保守的健身趨勢判讀門檻：Activity 使用最近 30 天資料，至少 7 個日曆日有步數、活動時間或運動時間，且可計分元件權重完整度至少 50%；Body 使用最近 90 天資料，至少 3 個不同日期有體重或體脂量測，且可計分元件權重完整度至少 50%。任一條件不足時該維度標示為不可計分，不顯示其分數。Overall 仍須兩個維度皆可計分且整體完整度至少 50%。

必須同時顯示：

```text
Overall Score: 78
Data Completeness: 82%
```

---

# 21. Algorithm Version

所有 derived score 保存：

```text
algorithmVersion
```

例如：

```text
health-score-v1
```

未來修改演算法後可以：

```text
health-score-v2
```

並重新計算歷史資料。

---

# 22. Insight Engine

V1 不使用 AI。

Insights 與 Timeline 確認保留為 V1 頁面與核心功能。兩者只能依實際同步且足以支持結論的資料產生內容；資料不足時不產生事件或洞察，不以模板補出看似真實的敘述。

先做 deterministic rules。

例如：

```ts
if (steps7d > steps30d * 1.1) {
  // 最近一週步數高於個人 30 日平均
}
```

Insight：

```ts
interface HealthInsight {
  id: string
  type: 'activity' | 'body'
  severity: 'info' | 'positive' | 'attention'
  title: string
  description: string
  metric?: string
  baseline?: number
  currentValue?: number
  createdAt: string
}
```

步數趨勢洞察需同時有至少 14 個基準期步數日，以及最近 7 天至少 4 個有步數日；比較基準期排除最近 7 天。資料不足時不產生該洞察。連續活動或運動紀錄遇到缺資料日即中斷，不把缺資料當作未達標以外的推測值。

避免使用：

```text
danger
disease
unhealthy
```

除非未來有真正醫療規則與適當產品定位。

---

# 23. Health Timeline

自動產生 milestone：

```text
Weight milestone
7-day activity streak
30-day activity record
Exercise streak
```

例如：

```text
Sep 21
🔥 連續 14 天達成活動目標

Sep 18
⚖️ 7 日平均體重創近 90 日新低

Sep 15
🏃 本月運動時間突破 500 分鐘
```

V1 只產生可由現有資料驗證的活動連續日、連續運動日與體重趨勢里程碑。連續日需每天都有對應指標資料；體重里程碑需最近 7 次量測及此前至少 7 次量測可供比較。未實作月運動總量里程碑前，不顯示該範例事件。

---

# 24. Manual Entry

V1 不提供手動新增、編輯或刪除健康資料。體重、體脂等指標以 Google Health API 實際可取得的紀錄為準；腰圍、血壓與備註若無可讀資料，不在 V1 顯示為已有資料或要求使用者補填。未來若新增手動輸入，須將 `manual` provider 與 Google Health 來源分開，並重新定義 normalized record 與編輯流程。

---

# 25. 正式資料限定

V1 網站只顯示已授權 Google Health API 取得的正式資料，不提供 Demo Mode、示範資料切換或預先產生的假健康資料。開發與自動化測試可使用固定 fixture／mock，但不得寫入 production Blob stores、出現在正式 UI 或隨正式部署提供切換入口。

---

# 26. PWA

Web App 支援：

```text
Install App
Offline shell
Cached static assets
Responsive layout
```

V1 保留可安裝與離線檢視功能。離線時可以顯示最近一次已快取 Dashboard，但不可把舊資料假裝成即時資料。離線健康資料的存取仍須遵守登入與 Google Health 連線狀態；登出或取消連線時清除或封鎖本機敏感快取，不得讓離線頁面繞過前述資料隱藏規則。Refresh Token、Access Token 與加密金鑰不得進入 PWA 快取。

顯示：

```text
Last updated: ...
```

---

# 27. Netlify 設定

正式網址與 Netlify site 名稱於部署階段決定。OAuth redirect URI、網站 origin、CORS／CSRF 檢查及 PWA manifest 不得硬編碼尚未確認的網域；以環境變數集中設定，並在 README 說明本機、Deploy Preview 與正式環境的配置方式。

專案以使用者現有的 Netlify Legacy Free plan 為部署與維運前提，不得依賴付費方案限定功能或額外付費服務。Legacy plan 的適用額度以該帳號 Netlify 後台 `Usage & billing` 顯示為準，不套用新版 credit-based Free 的 300 credits 規則。不得擅自遷移方案或升級付費方案，也不以升級作為正常運作條件。

成本控制：

- 每日僅執行既定兩次排程；將各資料類型以分頁／小批次處理，避免空轉與重複全量掃描。
- 首次全歷史回填分批執行，可跨多次排程續傳；不得為追求一次完成而持續占用 Function compute。
- 每次每日排程的例行同步最多查詢最近約一天；歷史回填另查一個完整日區間。每個區間初始會呼叫 6 個資料類型查詢（Activity 拆為 3 類，另加體重、體脂與運動），分頁的後續頁另計；不可把全歷史放進同一次 API request。
- Google Health API 的配額同時依專案每日、專案每分鐘與使用者每分鐘計算；收到 `429` 時不立即重送，保存歷史游標與重試時間，下一次排程再按退避策略重試。人工 30 日回填約需 180 個初始資料類型查詢，分頁另計；避免併發啟動多次回填。
- 歷史回填每次最多處理 1 日，成功即將游標往前移 1 日；遇到資料則重設空日計數，連續 90 個空日後停止回填，避免在來源已無更早資料時永久消耗配額。手動同步進行中時暫停排程回填。
- 排程歷史回填最多到目前日期往前 2 年。每日摘要須標記是否由同步確認；已確認同步的日期只推進回填游標，不再次呼叫 Google Health API。Dashboard 為圖表建立的摘要不可視為來源同步完成。
- Dashboard 讀取預先聚合資料，避免每張卡片分別觸發 Function 或大量 Blob reads。
- 使用 Deploy Preview 驗證變更，合併多項修改後才做 production deploy，避免不必要的 production deployment credits。
- README 說明如何查看用量；接近 50%／75% 用量通知時優先降低排程工作量或暫停歷史回填，保留登入與目前資料檢視能力。
- 不加入 AI inference、額外資料庫或其他會消耗不必要額度的功能。

Google Health API 官方文件目前列出預設每使用者每分鐘 300 個 requests；配額可能依專案調整，部署時以 Google Cloud Console 實際顯示值為準，並參考 [Quotas and Rate Limits](https://developers.google.com/health/rate-limits)。

高頻健康資料採視覺化所需的最低合理粒度，不下載或保存每秒原始樣本：

- Steps、distance、active minutes、calories：完整歷史以每日 rollup 保存。
- Weight、body fat、height：保存實際量測 sample。
- Exercise／workout：保存 session 摘要。
- 必須記錄資料的 `resolution`、查詢方式與來源，避免將聚合值誤當成原始量測。

「匯入全部歷史」指涵蓋 API 可取得的完整日期範圍，不代表下載所有高頻原始點。若官方 endpoint 對資料類型有更合適或更嚴格的粒度要求，以實作時的官方文件為準。

建立：

```text
netlify.toml
```

設定：

```text
build command
publish directory
functions directory
SPA redirect
scheduled functions
```

Vue Router SPA fallback：

```text
/* /index.html 200
```

確保重新整理：

```text
/activity
/body
```

不會 404。

---

# 28. Environment Variables

`.env.example` 至少包含：

```text
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REDIRECT_URI=

OWNER_GOOGLE_EMAIL=

HEALTH_TOKEN_ENCRYPTION_KEY=

```

如 Netlify runtime 自動提供 Blob 連線資訊，依官方 SDK/runtime 方式使用，不要自行把敏感 token 暴露到前端。

Frontend 環境變數不得包含：

```text
GOOGLE_CLIENT_SECRET
Refresh Token
HEALTH_TOKEN_ENCRYPTION_KEY
```

---

# 29. 安全

健康資料視為敏感資料。

必須：

- HTTPS
- Authenticated Functions
- OAuth state validation
- Server-side input validation
- Zod validation
- Rate limiting / abuse protection
- No sensitive logs
- Refresh token application-level encryption
- Cross-user isolation
- Minimal OAuth scopes

Browser 不得直接指定：

```text
blobKey
userId
```

來取得任意健康資料。

`userId` 必須由已驗證 session 在 Function server-side 推導。

禁止建立：

```text
GET /blob?key=...
```

這類 generic blob proxy。

---

# 30. Netlify Blobs 查詢策略

因為沒有 SQL：

Dashboard 不得：

```text
list all health-records
→ load thousands of blobs
→ aggregate on every request
```

正確：

```text
Google Health Sync
      ↓
Raw / normalized records
      ↓
Daily Aggregate
      ↓
health-daily
      ↓
Dashboard
```

7D：

讀最近 7 個 daily documents。

30D：

讀最近 30 個。

90D：

依 prefix list 對應月份，再切出需要日期。

1Y：

可在後續建立 monthly aggregate：

```text
health-monthly
users/{userId}/monthly/{yyyy}/{yyyy-mm}.json
```

若效能測試證明 1Y daily reads 過多，優先增加 monthly aggregate，而不是引入 SQL database。

---

# 31. API Response

所有 Functions 使用一致格式：

成功：

```json
{
  "success": true,
  "data": {}
}
```

失敗：

```json
{
  "success": false,
  "error": {
    "code": "HEALTH_SYNC_FAILED",
    "message": "..."
  }
}
```

不要把：

```text
Google access token
refresh token
stack trace
Blob internal key
```

直接回傳給 browser。

---

# 32. Loading / Empty / Error State

所有頁面必須支援：

```text
Loading
No Data
No Permission
Not Supported
Sync Error
Offline
```

例如體脂沒有資料：

```text
體脂

目前沒有可用資料。

目前連線的健康資料來源沒有提供體脂，
或尚未同步到這項數據。
```

不可顯示：

```text
體脂 = 0
```

---

# 33. Tests

## Unit Tests

至少：

```text
BMI
Moving Average
Trend Calculation
Activity Score
Overall Score
Data Completeness
Insight Rules
Blob Key Builder
Date / Timezone Aggregation
```

## Blob Tests

測試：

```text
stable key generation
prefix listing
idempotent overwrite
strong consistency read
unauthorized cross-user access
missing blob
corrupted JSON
```

## API Tests

```text
OAuth callback
health-sync
health-summary
health-trends
health-score
```

## Edge Cases

```text
missing weight
duplicate Google record
partial sync
expired access token
invalid refresh token
timezone boundary
zero steps
no workout
Google API unavailable
Netlify Blob write failure
```

---

# 34. README

README 必須包含：

```text
專案介紹
Architecture
Tech Stack
Google Cloud Setup
Google Health API Setup
OAuth Setup
Netlify Setup
Netlify Blobs Design
Environment Variables
Local Development
Deployment
Health Score Algorithm
Security
Testing
Known Limitations
```

另一位工程師只看 README 就應該能把專案重新部署。

---

# 35. 開發階段

## Phase 1 — Foundation

完成：

```text
Monorepo
Vue 3
Vite
TypeScript
Tailwind
Vue Router
Pinia
Netlify
Netlify Functions
Netlify Blobs repository layer
基本 Auth / Session
```

完成後：

```bash
npm test
npm run build
```

---

## Phase 2 — Dashboard

```text
Dashboard
Activity
Body
Workouts
Charts
Responsive UI
```

---

## Phase 3 — Analytics

完成：

```text
Daily Aggregation
Moving Average
Baseline
Activity Score
Body Score
Overall Score
Data Completeness
Insight Engine
Timeline
```

---

## Phase 4 — Google Health API

完成：

```text
Google Cloud setup documentation
OAuth
GoogleHealthProvider
Scopes
Initial Sync
Incremental Sync
Token refresh
Netlify Blobs persistence
```

API endpoint / field 必須依官方文件，不得自行猜測。

---

## Phase 5 — Automation

完成：

```text
Scheduled Functions
Daily analysis
Weekly summary
Retry strategy
Sync state
```

---

## Phase 6 — Production

完成：

```text
PWA
Security hardening
Error handling
Tests
README
Deploy Preview
Production deployment
```

---

# 36. Definition of Done

V1 必須達成：

1. Vue Dashboard 可部署 Netlify。
2. 不依賴 Supabase / PostgreSQL。
3. Netlify Blobs 可完整保存所需資料。
4. Google OAuth 可以正常連線。
5. Google Health API 可以取得實際健康資料。
6. Refresh Token 安全保存。
7. Health Sync 支援 retry 與 idempotency。
8. Dashboard 可顯示同步後資料。
9. Activity / Body 可查看趨勢。
10. 支援 7D / 30D / 90D / 1Y。
11. Health Score 正常計算。
12. 顯示 Data Completeness。
13. 缺少 optional data 不會造成 crash。
14. Insight Engine 正常。
15. Timeline 正常。
16. Scheduled Functions 正常。
17. 正式 UI 只顯示實際同步資料，不提供 Demo Mode。
18. PWA 可安裝。
19. Desktop / Mobile UI 正常。
20. Cross-user Blob access 無法成立。
21. `npm test` 通過。
22. `npm run build` 通過。
23. README 足以讓另一位工程師從零部署。

---

# 37. Codex 實作原則

以下規則視為強制要求：

1. 不使用已淘汰的 Google Fit API。
2. Google Health API endpoint、scope、field 必須以官方文件為準，不得自行猜測。
3. 不加入 Supabase，V1 使用 Netlify Blobs。
4. 不把 Netlify Blobs 當 SQL database 使用。
5. Raw/normalized data 與 derived data 分離。
6. Dashboard 優先讀 daily aggregates。
7. 所有同步必須 idempotent。
8. 所有 optional metric 必須允許 null。
9. Missing data 不等於 0。
10. OAuth Refresh Token 必須 server-only 且加密。
11. Browser 不得直接操作任意 Blob key。
12. `userId` 必須從 server-side authenticated session 取得。
13. Health Score 不是醫療診斷。
14. V1 不查詢或保存 Heart rate、Resting HR、HRV，也不推算 Recovery Score。
15. 所有 score 保留 `algorithmVersion`。
16. Fixture／mock 僅供開發與測試，不得進入 production stores 或正式 UI。
17. 每完成一個 Phase 執行測試與 build。
18. 不為了快速完成而跳過 error/empty/loading state。
19. 所有健康資料時間以 UTC 保存，daily aggregate 依 `Asia/Taipei` 分日。
20. 優先完成可靠資料流，再增加進階功能。

最終核心資料流：

```text
Google Health API
        ↓
GoogleHealthProvider
        ↓
Normalizer
        ↓
Netlify Functions
        ↓
Netlify Blobs
        ↓
Daily Aggregation
        ↓
Health Analytics Engine
        ↓
Vue Dashboard
```
