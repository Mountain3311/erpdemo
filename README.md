# BOM 教学 Demo

这是一个本科课程用的 BOM（Bill of Materials，物料清单）演示项目。它使用 React、FastAPI、SQLAlchemy 和 SQLite，重点展示最基础、最容易说明的业务链路：

```text
Item（产品 / 原材料）
        ↓
       BOM
        ↓
   BOM Item（材料清单行）
```

它不是商业 ERP 系统，也不是 ERPNext/Frappe 的分支或再分发。当前界面采用表格优先的 Desk 风格，适合课堂演示和理解前后端数据流。

## 项目结构

```text
frontend/              React + Vite 前端
  src/App.jsx          页面结构、表单和数据展示
  src/api.js           对 FastAPI 接口的请求封装
  src/styles.css       Desk 风格的原生 CSS

backend/app/           FastAPI 后端
  main.py              程序入口、路由注册
  database.py          SQLite 连接和数据库会话
  models.py            SQLAlchemy 数据表模型
  schemas.py           API 的请求和响应数据格式
  routers_items.py     Item 接口
  routers_boms.py      BOM 接口
  services.py          BOM 校验、序列化和兼容性业务逻辑
  seed.py              首次启动时的示例数据

data/bom_demo.db       SQLite 数据库文件
```

## 数据如何流动

1. 用户在 React 页面输入 Item 或 BOM 数据。
2. `src/api.js` 用 `fetch` 请求 `/api/items` 或 `/api/boms`。
3. Vite 将 `/api` 代理到 FastAPI（默认 `http://127.0.0.1:8000`）。
4. FastAPI 路由用 Pydantic 校验 JSON 数据。
5. SQLAlchemy 将 `Item`、`BOM`、`BOMLine` 对象保存到 SQLite。
6. 后端再把查询结果以 JSON 返回给 React 表格和详情页。

## 当前教学界面功能

- 工作台：显示 Item 总数、产品数量和 BOM 数量。
- Item 管理：查看并创建产品、原材料和为兼容旧数据保留的半成品。
- BOM 管理：查看、新建草稿、查看详情、维护材料清单。
- BOM 详情：清晰显示产品和材料行（材料、数量、单位）。

当前数据库与后端仍兼容早期版本的多层 BOM、版本、工序和成本接口；教学界面已隐藏这些高级入口，避免干扰基础课程演示。后续如要彻底删除这些能力，应同步迁移 SQLite 数据库和 API，而不应直接删字段。

## 本地运行

需要 Python 3.11+ 和 Node.js 18+。

**终端 1：启动后端**

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn app.main:app --reload --app-dir .
```

接口文档：<http://127.0.0.1:8000/docs>

**终端 2：启动前端**

```powershell
cd frontend
npm install
npm run dev
```

浏览器打开 <http://localhost:5173>。

## SQLite 数据库

数据库位于 `data/bom_demo.db`。程序首次启动时，若 `items` 表为空，会写入示例数据；已有数据不会被覆盖。

若希望回到初始示例，请先手动备份或删除该数据库文件，再重新启动后端。SQLite 文件不会提交到 Git。

## 许可证

MIT。
