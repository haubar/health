# 分析資料流程

## 每日聚合

`aggregateDailyHealthRecords` 將 normalized health records 依 `Asia/Taipei` 民用日分組。原始 timestamp 仍以 UTC 保存；只有 daily summary 使用台灣日期。

- steps、distance、active minutes、calories 依日累加。
- distance 會將公尺轉成公里。
- exercise 使用 `startTime`／`endTime` 計算分鐘；沒有結束時間時才使用 numeric value。
- weight 與 body fat 保存該日排序後最後一筆量測。
- 沒有紀錄的指標保持 `null`，不轉換成 0。

## Baseline 與移動平均

移動平均使用 trailing window，窗口內只平均非 null 值。個人 baseline 預設取最近 30 個日 summary 的可用值；資料不足時回傳可用平均，不補造缺漏日期。

## Insights 與 Timeline

V1 使用 deterministic rules，不使用 AI。只有實際資料足以支持結論時才產生項目：

- 最近 7 日平均步數高於最近 30 日平均超過 10%。
- 連續至少 3 日達成步數目標時產生活動 insight。
- 連續第 7、14、21…日達成活動目標時產生 timeline milestone。

所有文字都描述資料趨勢，不使用疾病、危險或醫療判斷語句。

