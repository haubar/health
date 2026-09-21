# Health Score 演算法

## 定位

Health Score 是相對於個人 baseline、個人目標與一般健康行為指標的趨勢分數，不是醫療診斷，也不代表整體健康程度。

所有分數範圍為 0–100，並保存 `algorithmVersion: health-score-v1`。缺少資料不會以 0 代替；可用元件會在同一維度內重新正規化權重。

## Activity Score

| 元件 | 權重 | 計算 |
|---|---:|---|
| Steps | 35% | 每日步數／每日步數目標，最高 100 |
| Exercise Minutes | 30% | 每日運動分鐘／每週目標除以 7，最高 100 |
| Active Minutes | 20% | 每日活動分鐘／最近 30 日個人平均 |
| Activity Consistency | 15% | 達成步數目標的可用日數／步數可用日數 |

Activity 維度至少要有 50% 的元件權重可計算才標記為可計分。可用元件的分數會重新正規化，不會把缺少的元件當成零分。

## Body Score

| 元件 | 權重 | 計算 |
|---|---:|---|
| Weight Trend | 50% | 前後半段可用體重平均的穩定度 |
| Body Fat Trend | 30% | 前後半段可用體脂平均的穩定度 |
| Goal Progress | 20% | 使用者明確設定體重目標後才計算 |

趨勢元件至少需要兩個可用樣本。未設定體重目標時，Goal Progress 不會顯示或計分。Body 維度同樣要求至少 50% 可計算權重。

## Overall Score

V1 內部權重為：

- Activity：2/3
- Body：1/3

只有在 Activity 與 Body 都可計分，且加權後 Data Completeness 至少 50% 時，才顯示 Overall 數值。否則保留各頁的實際圖表與指標，但隱藏 Overall 分數。

## Data Completeness

每個維度的 completeness 是可計算元件權重除以全部元件權重。Overall completeness 是 Activity 與 Body 依 2:1 加權後的結果，介面顯示百分比。

