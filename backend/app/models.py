from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base, utcnow

# 本文件定义 SQLite 表和表之间的关系；SQLAlchemy 会据此把 Python 对象保存为数据行。

class Item(Base):
    # 物料主数据。现阶段保留旧字段，避免影响已存在的 SQLite 数据库和 API。
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    item_type: Mapped[str] = mapped_column(String(32))  # purchased | semi | finished
    uom: Mapped[str] = mapped_column(String(16), default="pcs")
    unit_cost: Mapped[float] = mapped_column(Float, default=0.0)
    description: Mapped[str] = mapped_column(Text, default="")

    boms: Mapped[list["BOM"]] = relationship(back_populates="item")


class BOM(Base):
    # 一张 BOM 属于一个产品 Item，并包含多条材料行和（旧版保留的）工序行。
    __tablename__ = "boms"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"))
    output_qty: Mapped[float] = mapped_column(Float, default=1.0)
    version: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(16), default="draft")  # draft | submitted
    notes: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    item: Mapped[Item] = relationship(back_populates="boms")
    lines: Mapped[list["BOMLine"]] = relationship(
        back_populates="bom", cascade="all, delete-orphan", order_by="BOMLine.id"
    )
    operations: Mapped[list["BOMOperation"]] = relationship(
        back_populates="bom", cascade="all, delete-orphan", order_by="BOMOperation.sequence"
    )


class BOMLine(Base):
    # BOM 的一条材料记录，通过 item_id 指向被使用的 Item。
    __tablename__ = "bom_lines"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bom_id: Mapped[int] = mapped_column(ForeignKey("boms.id"))
    item_id: Mapped[int] = mapped_column(ForeignKey("items.id"))
    qty: Mapped[float] = mapped_column(Float)
    uom: Mapped[str] = mapped_column(String(16), default="pcs")
    scrap_pct: Mapped[float] = mapped_column(Float, default=0.0)
    explode: Mapped[bool] = mapped_column(Boolean, default=True)

    bom: Mapped[BOM] = relationship(back_populates="lines")
    item: Mapped[Item] = relationship()


class BOMOperation(Base):
    # 旧版工序表；前端教学界面暂不展示，保留以保证旧数据库与 API 兼容。
    __tablename__ = "bom_operations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bom_id: Mapped[int] = mapped_column(ForeignKey("boms.id"))
    sequence: Mapped[int] = mapped_column(Integer, default=1)
    name: Mapped[str] = mapped_column(String(200))
    hours: Mapped[float] = mapped_column(Float, default=0.0)
    rate_per_hour: Mapped[float] = mapped_column(Float, default=0.0)

    bom: Mapped[BOM] = relationship(back_populates="operations")
