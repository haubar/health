# 第二階段 — 儀表板

日期：2026-09-21  
狀態：已完成，等待擁有者確認

## 本階段範圍

- 建立 Dashboard、Activity、Body、Workouts 的共用視覺化元件與頁面骨架。
- 加入 7D／30D／90D／1Y 範圍選擇器與正式資料契約。
- 支援 loading、empty、offline、error 與 ready 狀態。
- 使用正式資料介面預留圖表，不在正式 UI 注入 fixture 或示範健康紀錄。
- 延續手機與桌面同等重要、深色介面、缺資料隱藏入口的規則。

## 本階段不處理

- Google Health API endpoint、OAuth health scope 與真實同步（第四階段）。
- 分數、baseline、insight 與 timeline 演算法（第三階段）。
- PWA 快取與離線資料保存（第六階段）。

## 驗證與交接

已完成：

- `npm audit --audit-level=moderate`：0 vulnerabilities。
- `npm test`：3 個測試檔、9 項測試通過。
- `npm run build`：shared、Vue 與 Functions typecheck 通過，Vite production build 通過。
- ECharts 由 6.0.0 升級至 6.1.0，修正已知 XSS advisory。
- ECharts 改為 dynamic import；空資料頁面不下載圖表 runtime。

本階段已建立 commit，等待擁有者確認後才進入第三階段。
