from datetime import datetime

from pydantic import BaseModel, Field

# 本文件定义接口收发的 JSON 结构：路由先用它校验数据，再交给 models/services 处理。

class ItemCreate(BaseModel):
    code: str
    name: str
    item_type: str = Field(pattern="^(purchased|semi|finished)$")
    uom: str = "pcs"
    unit_cost: float = 0
    description: str = ""


class ItemOut(ItemCreate):
    id: int

    model_config = {"from_attributes": True}


class LineIn(BaseModel):
    item_id: int
    qty: float
    uom: str = "pcs"
    scrap_pct: float = 0
    explode: bool = True


class OperationIn(BaseModel):
    # 兼容原有 BOM API 的工序输入；低风险阶段不删除此结构。
    sequence: int = 1
    name: str
    hours: float = 0
    rate_per_hour: float = 0


class BOMCreate(BaseModel):
    item_id: int
    output_qty: float = 1
    notes: str = ""
    lines: list[LineIn] = []
    operations: list[OperationIn] = []


class BOMUpdate(BaseModel):
    output_qty: float | None = None
    notes: str | None = None
    lines: list[LineIn] | None = None
    operations: list[OperationIn] | None = None


class LineOut(BaseModel):
    id: int
    item_id: int
    item_code: str
    item_name: str
    item_type: str
    qty: float
    uom: str
    scrap_pct: float
    explode: bool
    required_qty: float
    unit_cost: float

    model_config = {"from_attributes": True}


class OperationOut(BaseModel):
    id: int
    sequence: int
    name: str
    hours: float
    rate_per_hour: float
    cost: float

    model_config = {"from_attributes": True}


class BOMSummary(BaseModel):
    id: int
    item_id: int
    item_code: str
    item_name: str
    output_qty: float
    version: int
    status: str
    notes: str
    created_at: datetime
    line_count: int
    material_cost: float
    operation_cost: float
    total_cost: float


class BOMDetail(BOMSummary):
    lines: list[LineOut]
    operations: list[OperationOut]


class TreeNode(BaseModel):
    item_id: int
    item_code: str
    item_name: str
    item_type: str
    qty: float
    uom: str
    scrap_pct: float
    exploded: bool
    bom_id: int | None = None
    bom_version: int | None = None
    unit_cost: float
    extended_cost: float
    children: list["TreeNode"] = []


class ExplodedRow(BaseModel):
    item_id: int
    item_code: str
    item_name: str
    item_type: str
    qty: float
    uom: str
    unit_cost: float
    extended_cost: float


class CostBreakdown(BaseModel):
    bom_id: int
    item_code: str
    output_qty: float
    material_cost: float
    operation_cost: float
    total_cost: float
    unit_cost: float
    exploded: list[ExplodedRow]
    operations: list[OperationOut]
