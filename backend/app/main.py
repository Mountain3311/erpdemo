from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import Base, SessionLocal, engine, ensure_bom_name_column
from .routers_boms import router as boms_router
from .routers_items import router as items_router
from .seed import seed_if_empty

# 程序入口：创建数据表、配置跨域、注册 Item/BOM 路由，并在首次启动时写入示例数据。
Base.metadata.create_all(bind=engine)
ensure_bom_name_column()

app = FastAPI(
    title="Open BOM Demo",
    description="Course demo: multi-level Bill of Materials. Original code, MIT licensed.",
    version="1.0.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(items_router)
app.include_router(boms_router)


@app.on_event("startup")
def startup():
    # 种子数据只在 items 表为空时写入，不会覆盖用户已有记录。
    db = SessionLocal()
    try:
        seed_if_empty(db)
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"ok": True, "name": "open-bom-demo"}
