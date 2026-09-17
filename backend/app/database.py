from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

# 本文件只负责数据库连接：其他模块通过 get_db() 获取一次请求对应的数据库会话。

def utcnow():
    return datetime.now(timezone.utc)

ROOT = Path(__file__).resolve().parents[2]
DB_PATH = ROOT / "data" / "bom_demo.db"
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def get_db():
    # FastAPI 在接口结束后自动执行 finally，确保 SQLite 连接被关闭。
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
