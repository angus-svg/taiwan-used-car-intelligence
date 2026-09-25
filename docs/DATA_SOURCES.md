# Data Sources & Provenance

## 1. Carbook 車書公開 API

用途：
- 車款索引
- 各年式行情
- 即時估價基準
- 1 / 3 / 5 年殘值基準

端點：
- `https://carbook.tw/api/v1/models.json`
- `https://carbook.tw/api/v1/estimate`

注意：
- 為外部估值／行情基準，不是本平台觀察到的成交價。
- UI 必須標註資料來源。
- API 結果不可標成「實際成交價保證」。

## 2. 環境部：汽車新車審驗資料

Dataset ID: 28182

可用欄位：
- 廠商名稱
- 引擎族
- 合格證號
- 核准日期
- 車型分類
- 車型名稱
- 製造／進口地區

用途：Vehicle Master / Alias / 車型名稱驗證。

授權：政府資料開放授權條款第 1 版。

## 3. 經濟部能源署：車輛油耗指南

Dataset ID: 11163

用途：
- 油耗比較
- Ownership Cost Engine
- 動力系統資料補充

授權：政府資料開放授權條款第 1 版。

## 4. 自有資料（未來）

平台應逐步累積：
- market_snapshots
- price_observations
- user_reported_transaction_price
- dealer_feed
- trim_normalization
- equipment_normalization

不得把外部模型輸出混成「自有觀察資料」。
