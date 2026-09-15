from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base, utcnow


class Item(Base):
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
    __tablename__ = "bom_operations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    bom_id: Mapped[int] = mapped_column(ForeignKey("boms.id"))
    sequence: Mapped[int] = mapped_column(Integer, default=1)
    name: Mapped[str] = mapped_column(String(200))
    hours: Mapped[float] = mapped_column(Float, default=0.0)
    rate_per_hour: Mapped[float] = mapped_column(Float, default=0.0)

    bom: Mapped[BOM] = relationship(back_populates="operations")
