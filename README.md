# CarValue TW — Taiwan Used Car Price Intelligence MVP

一個 **Price Intelligence-first** 的台灣中古車決策原型。

不是另一個刊登網站。核心問題是：

> 這個預算能換到什麼？這台現在這個價格合理嗎？多花／少花這筆錢實際換到什麼？

## V0.2 與既有 V0.1 功能

V0.2 在保留三入口的基礎上，加入 Year × Mileage Matrix、含里程情境／升級價差的 Budget Frontier，以及帶 confidence／sample size 的 Comparable Engine。所有數字區分 Observed／Derived／Unknown；里程調整為未校準情境，配對樣本數未知。詳見 [V0.2 模型假設與資料缺口](docs/V0.2_MODEL_NOTES.md)。

離線驗證：`node scripts/check.mjs`、`node scripts/test-engine.mjs`、`node --test scripts/test-v02.mjs`（或 `npm test`，不需 npm install）。

- 三個入口
  - 我有預算，幫我找車
  - 我已經知道要什麼車
  - 幫我看這台值不值
- Budget Frontier：預算 → 車款／年式邊界
- Year Trade-off：同款不同年式價格曲線
- Price Intelligence：刊登價 vs 外部估值基準
- Residual Value：串接 1／3／5 年殘值基準
- Data Provenance：即時外部資料與本機示範資料分開標示
- GitHub Pages-ready，無 npm、無伺服器、無資料庫即可運作

## 資料來源

### Carbook 車書公開 API

- `https://carbook.tw/api/v1/models.json`
- `https://carbook.tw/api/v1/estimate`

官方文件：<https://carbook.tw/api/>

Carbook 表示公開 API 免費、免金鑰，引用需註明來源。此專案在頁尾保留來源標示。

### 政府開放資料（後續 ingestion）

- 汽車新車審驗資料：政府資料開放授權條款第 1 版
- 車輛油耗指南：政府資料開放授權條款第 1 版

詳見 `docs/DATA_SOURCES.md`。

## 本機執行

因瀏覽器模組與 fetch 需要 HTTP server，不要直接雙擊 `index.html`。

```bash
python3 -m http.server 4173
```

然後開啟：

```text
http://localhost:4173
```

也可用任意靜態網站 server。

## GitHub Pages

Repository 內已包含 `.github/workflows/pages.yml`。

1. 建立 GitHub repository。
2. 將本專案推到 `main`。
3. Repository → Settings → Pages → Source 選 `GitHub Actions`。
4. workflow 會部署整個靜態網站。

## 資料安全原則

- `Observed`：使用者提交的刊登數值（未查證）或可追溯的外部觀測；不等同成交紀錄。
- `External Derived`：Carbook 等外部模型的估值。
- `Our Derived`：本平台自己計算的比較與 trade-off。
- `Unknown`：沒有資料就保持未知，不推定「沒有事故／沒有問題」。

目前 fallback 資料只用於 API 無法連線時展示 UI，**不是即時市場報價**。

## 下一階段

1. 導入政府車型／油耗 open data。
2. 以有授權的年式／里程逐車資料校準 Mileage Matrix；補足配對樣本數。
3. 加入 Trim / Equipment Normalizer。
4. 建立自己的 Market Snapshot。
5. 加入真實刊登資料來源與合法 feed。
6. 資料量上升後再導入 DuckDB-Wasm / Parquet。

## License

程式碼：MIT。外部資料各自依來源授權與使用條款。
