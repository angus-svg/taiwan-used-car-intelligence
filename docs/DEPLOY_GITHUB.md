# Deploy to GitHub

目前專案已是完整 Git repository-ready 結構。

## 1. 在 GitHub 建立空 repository

建議名稱：

```text
taiwan-used-car-intelligence
```

公開 repo 可搭配 GitHub Pages 免費方案。

建立時不要勾選自動建立 README / .gitignore / LICENSE，因為專案內已存在。

## 2. 推送

```bash
git remote add origin https://github.com/<YOUR_LOGIN>/taiwan-used-car-intelligence.git
git push -u origin main
```

## 3. 開啟 GitHub Pages

Repository → Settings → Pages → Build and deployment → Source → `GitHub Actions`

下一次 push 或手動執行 workflow 後，`.github/workflows/pages.yml` 會自動部署。

## 4. 驗證

首頁右上角應顯示：

- `即時：Carbook 車書公開 API`：表示即時 API 正常。
- `示範模式：外部 API 未連線`：表示 fallback 啟動。

## 5. 後續不要直接把大型平台網站資料鏡像進 repo

Repository 建議只保存：
- 開放授權資料
- 自有資料
- 衍生統計
- 必要快取（需符合來源授權）

正式刊登資料來源應另行處理 feed / API / 合作或合法輸入。
