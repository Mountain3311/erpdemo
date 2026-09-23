from fastapi import HTTPException
from sqlalchemy.orm import Session, joinedload

from .models import BOM, BOMLine, BOMOperation, Item

# 业务辅助函数集中在这里。路由调用这些函数完成校验、装配响应和旧版高级 BOM 计算。
# 低风险阶段不移除函数：tree/cost 等已发布 API 仍依赖它们，删除会破坏 API 稳定性。

def required_qty(line: BOMLine) -> float:
    return round(line.qty * (1 + (line.scrap_pct or 0) / 100.0), 6)


def latest_submitted_bom(db: Session, item_id: int) -> BOM | None:
    return (
        db.query(BOM)
        .filter(BOM.item_id == item_id, BOM.status == "submitted")
        .order_by(BOM.version.desc())
        .first()
    )


def load_bom(db: Session, bom_id: int) -> BOM:
    bom = (
        db.query(BOM)
        .options(
            joinedload(BOM.item),
            joinedload(BOM.lines).joinedload(BOMLine.item),
            joinedload(BOM.operations),
        )
        .filter(BOM.id == bom_id)
        .first()
    )
    if not bom:
        raise HTTPException(404, "BOM not found")
    return bom


def assert_draft(bom: BOM) -> None:
    if bom.status != "draft":
        raise HTTPException(400, "Submitted BOM is read-only. Create a new version to edit.")


def would_cycle(db: Session, parent_item_id: int, child_item_id: int, seen: set[int] | None = None) -> bool:
    if child_item_id == parent_item_id:
        return True
    seen = seen or set()
    if child_item_id in seen:
        return True
    seen.add(child_item_id)
    child_bom = latest_submitted_bom(db, child_item_id)
    if not child_bom:
        return False
    for line in child_bom.lines:
        if would_cycle(db, parent_item_id, line.item_id, seen.copy()):
            return True
    return False


def replace_lines(db: Session, bom: BOM, lines: list) -> None:
    # 用前端提交的新材料行整体替换旧材料行，并校验 Item、数量和循环引用。
    bom.lines.clear()
    db.flush()
    for row in lines:
        item = db.get(Item, row.item_id)
        if not item:
            raise HTTPException(400, f"Item {row.item_id} not found")
        if row.qty <= 0:
            raise HTTPException(400, "Line quantity must be > 0")
        if would_cycle(db, bom.item_id, row.item_id):
            raise HTTPException(400, f"Cycle detected: {item.code} cannot appear under {bom.item.code}")
        bom.lines.append(
            BOMLine(
                item_id=item.id,
                qty=row.qty,
                uom=row.uom or item.uom,
                scrap_pct=row.scrap_pct or 0,
                explode=row.explode,
            )
        )


def replace_operations(bom: BOM, operations: list) -> None:
    # 与 replace_lines 对应，整体替换工序行；仅为兼容原 API 保留。
    bom.operations.clear()
    for row in operations:
        if row.hours < 0 or row.rate_per_hour < 0:
            raise HTTPException(400, "Operation hours and rate must be >= 0")
        bom.operations.append(
            BOMOperation(
                sequence=row.sequence,
                name=row.name,
                hours=row.hours,
                rate_per_hour=row.rate_per_hour,
            )
        )


def operation_cost(op: BOMOperation, qty_factor: float = 1.0) -> float:
    return round(op.hours * op.rate_per_hour * qty_factor, 4)


def build_tree(db: Session, bom: BOM, qty_factor: float = 1.0, stack: set[int] | None = None) -> dict:
    stack = stack or set()
    if bom.id in stack:
        raise HTTPException(400, "Cycle detected while exploding BOM")
    stack = stack | {bom.id}

    children = []
    for line in bom.lines:
        need = required_qty(line) * qty_factor
        child_bom = latest_submitted_bom(db, line.item_id) if line.explode else None
        exploded = bool(child_bom)
        if child_bom:
            factor = need / (child_bom.output_qty or 1)
            node = build_tree(db, child_bom, factor, stack)
            node["qty"] = need
            node["scrap_pct"] = line.scrap_pct
            node["exploded"] = True
            children.append(node)
        else:
            ext = round(need * (line.item.unit_cost or 0), 4)
            children.append(
                {
                    "item_id": line.item.id,
                    "item_code": line.item.code,
                    "item_name": line.item.name,
                    "item_type": line.item.item_type,
                    "qty": need,
                    "uom": line.uom,
                    "scrap_pct": line.scrap_pct,
                    "exploded": exploded,
                    "bom_id": None,
                    "bom_version": None,
                    "unit_cost": line.item.unit_cost or 0,
                    "extended_cost": ext,
                    "children": [],
                }
            )

    op_cost = sum(operation_cost(op, qty_factor) for op in bom.operations)
    mat_cost = sum(child["extended_cost"] for child in children)
    total = round(mat_cost + op_cost, 4)
    output = (bom.output_qty or 1) * qty_factor
    unit = round(total / output, 4) if output else 0
    return {
        "item_id": bom.item.id,
        "item_code": bom.item.code,
        "item_name": bom.item.name,
        "item_type": bom.item.item_type,
        "qty": output,
        "uom": bom.item.uom,
        "scrap_pct": 0,
        "exploded": True,
        "bom_id": bom.id,
        "bom_version": bom.version,
        "unit_cost": unit,
        "extended_cost": total,
        "children": children,
    }


def flatten_purchased(node: dict, acc: dict[int, dict] | None = None) -> list[dict]:
    acc = acc if acc is not None else {}
    if not node.get("children"):
        item_id = node["item_id"]
        if item_id not in acc:
            acc[item_id] = {
                "item_id": item_id,
                "item_code": node["item_code"],
                "item_name": node["item_name"],
                "item_type": node["item_type"],
                "qty": 0.0,
                "uom": node["uom"],
                "unit_cost": node["unit_cost"],
                "extended_cost": 0.0,
            }
        acc[item_id]["qty"] = round(acc[item_id]["qty"] + node["qty"], 6)
        acc[item_id]["extended_cost"] = round(acc[item_id]["qty"] * acc[item_id]["unit_cost"], 4)
    else:
        for child in node["children"]:
            flatten_purchased(child, acc)
    return list(acc.values())


def collect_operations(db: Session, bom: BOM, qty_factor: float = 1.0, acc: list | None = None, stack: set[int] | None = None) -> list:
    acc = acc if acc is not None else []
    stack = stack or set()
    if bom.id in stack:
        return acc
    stack = stack | {bom.id}
    for op in bom.operations:
        acc.append(
            {
                "id": op.id,
                "sequence": op.sequence,
                "name": f"{bom.item.code} / {op.name}",
                "hours": round(op.hours * qty_factor, 4),
                "rate_per_hour": op.rate_per_hour,
                "cost": operation_cost(op, qty_factor),
            }
        )
    for line in bom.lines:
        if not line.explode:
            continue
        child = latest_submitted_bom(db, line.item_id)
        if child:
            need = required_qty(line) * qty_factor
            collect_operations(db, child, need / (child.output_qty or 1), acc, stack)
    return acc


def serialize_line(line: BOMLine) -> dict:
    need = required_qty(line)
    return {
        "id": line.id,
        "item_id": line.item_id,
        "item_code": line.item.code,
        "item_name": line.item.name,
        "item_type": line.item.item_type,
        "qty": line.qty,
        "uom": line.uom,
        "scrap_pct": line.scrap_pct,
        "explode": line.explode,
        "required_qty": need,
        "unit_cost": line.item.unit_cost or 0,
    }


def serialize_op(op: BOMOperation) -> dict:
    return {
        "id": op.id,
        "sequence": op.sequence,
        "name": op.name,
        "hours": op.hours,
        "rate_per_hour": op.rate_per_hour,
        "cost": operation_cost(op),
    }


def bom_costs(db: Session, bom: BOM) -> tuple[float, float, float]:
    tree = build_tree(db, bom, 1.0)
    exploded = flatten_purchased(tree)
    material = round(sum(r["extended_cost"] for r in exploded), 4)
    ops = collect_operations(db, bom, 1.0)
    operation = round(sum(o["cost"] for o in ops), 4)
    return material, operation, round(material + operation, 4)


def serialize_summary(db: Session, bom: BOM) -> dict:
    # 将 ORM BOM 对象转换成接口需要的摘要字典。
    material, operation, total = bom_costs(db, bom)
    return {
        "id": bom.id,
        "bom_code": f"BOM-{bom.id:03d}",
        "name": bom.name or "未命名BOM",
        "item_id": bom.item_id,
        "item_code": bom.item.code,
        "item_name": bom.item.name,
        "output_qty": bom.output_qty,
        "quantity": bom.output_qty,
        "version": bom.version,
        "status": bom.status,
        "notes": bom.notes,
        "created_at": bom.created_at,
        "line_count": len(bom.lines),
        "material_cost": material,
        "operation_cost": operation,
        "total_cost": total,
    }
