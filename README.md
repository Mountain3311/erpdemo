# Open BOM Demo

课程作业：自研多层 **Bill of Materials（物料清单）** 演示。代码原创，采用 [MIT](LICENSE) 许可，可放到个人 GitHub。

这不是 [ERPNext](https://frappe.io/erpnext/open-source-manufacturing-erp-software) 的分支，也没有复制 Frappe / ERPNext 源码。产品说明里的 BOM 概念（多层结构、展开、工序与成本估算）仅作公开功能参考。

## 演示范围

- 物料主数据：成品 / 半成品 / 采购件
- 多层 BOM：半成品可挂自己的已提交 BOM
- 用量、损耗%、是否展开
- 树形 Explorer 与叶子物料汇总（exploded）
- 物料成本 + 工序工时成本
- 提交后只读，通过「复制为新版本」修改结构

不含：工单、库存出入库、产能、外协。

启动后打开种子数据 **CM-100 手压便携咖啡机**，即可看到两层半成品展开。

## 技术栈

- 后端：Python 3.13、FastAPI、SQLAlchemy、SQLite
- 前端：React 19、Vite

## 本地运行

需要已安装 Python 3.11+ 与 Node.js 18+。

**终端 1 — API**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --app-dir .
```

若当前目录已是 `backend`，也可：

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
$env:PYTHONPATH = "."
uvicorn app.main:app --reload
```

API：<http://127.0.0.1:8000/docs>

**终端 2 — 界面**

```powershell
cd frontend
npm install
npm run dev
```

浏览器打开 <http://localhost:5173>。前端会把 `/api` 代理到后端。

SQLite 文件生成在仓库根目录 `data/bom_demo.db`。删掉该文件后重启后端会重新写入种子数据。

## 许可证

MIT。ERPNext 名称与标志属于 Frappe Technologies，本仓库不使用它们作为产品品牌。
