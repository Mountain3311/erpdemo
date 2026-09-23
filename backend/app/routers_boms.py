from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from .database import get_db
from .models import BOM, BOMLine, BOMOperation,Item
from .schemas import BOMCreate, BOMUpdate
from .services import (
    assert_draft,
    bom_costs,
    build_tree,
    collect_operations,
    flatten_purchased,
    load_bom,
    replace_lines,
    replace_operations,
    serialize_line,
    serialize_op,
    serialize_summary,
)

# BOM 路由：负责 BOM 的 HTTP 接口；复杂计算仍集中在 services.py，避免路由承担业务细节。
router = APIRouter(prefix="/api/boms", tags=["boms"])


def _detail(db: Session, bom: BOM) -> dict:
    # 统一组合 BOM 主信息、材料行和工序行，供创建、查询、更新接口复用。
    data = serialize_summary(db, bom)
    data["lines"] = [serialize_line(line) for line in bom.lines]
    data["operations"] = [serialize_op(op) for op in bom.operations]
    return data


@router.get("")
def list_boms(db: Session = Depends(get_db)):
    boms = (
        db.query(BOM)
        .options(joinedload(BOM.item), joinedload(BOM.lines), joinedload(BOM.operations))
        .order_by(BOM.item_id, BOM.version.desc())
        .all()
    )
    return [serialize_summary(db, bom) for bom in boms]


@router.post("")
def create_bom(payload: BOMCreate, db: Session = Depends(get_db)):
    item = db.get(Item, payload.item_id)
    if not item:
        raise HTTPException(400, "Item not found")
    if item.item_type == "purchased":
        raise HTTPException(400, "Purchased items do not have a BOM")
    latest = (
        db.query(BOM)
        .filter(BOM.item_id == item.id)
        .order_by(BOM.version.desc())
        .first()
    )
    version = (latest.version + 1) if latest else 1
    bom = BOM(
        name=payload.name,
        item_id=item.id,
        output_qty=payload.quantity or 1,
        version=version,
        status="draft",
        notes=payload.notes or "",
    )
    db.add(bom)
    db.flush()
    replace_lines(db, bom, payload.lines)
    replace_operations(bom, payload.operations)
    db.commit()
    return _detail(db, load_bom(db, bom.id))


@router.get("/{bom_id}")
def get_bom(bom_id: int, db: Session = Depends(get_db)):
    return _detail(db, load_bom(db, bom_id))


@router.put("/{bom_id}")
def update_bom(bom_id: int, payload: BOMUpdate, db: Session = Depends(get_db)):
    bom = load_bom(db, bom_id)
    assert_draft(bom)
    if payload.output_qty is not None:
        if payload.output_qty <= 0:
            raise HTTPException(400, "Output quantity must be > 0")
        bom.output_qty = payload.output_qty
    if payload.notes is not None:
        bom.notes = payload.notes
    if payload.lines is not None:
        replace_lines(db, bom, payload.lines)
    if payload.operations is not None:
        replace_operations(bom, payload.operations)
    db.commit()
    return _detail(db, load_bom(db, bom_id))


@router.post("/{bom_id}/submit")
def submit_bom(bom_id: int, db: Session = Depends(get_db)):
    bom = load_bom(db, bom_id)
    assert_draft(bom)
    if not bom.lines:
        raise HTTPException(400, "Add at least one material line before submitting")
    bom.status = "submitted"
    db.commit()
    return _detail(db, load_bom(db, bom_id))


@router.post("/{bom_id}/new-version")
def new_version(bom_id: int, db: Session = Depends(get_db)):
    source = load_bom(db, bom_id)
    latest = (
        db.query(BOM)
        .filter(BOM.item_id == source.item_id)
        .order_by(BOM.version.desc())
        .first()
    )
    clone = BOM(
        name=source.name,
        item_id=source.item_id,
        output_qty=source.output_qty,
        version=(latest.version + 1) if latest else 1,
        status="draft",
        notes=source.notes,
    )
    db.add(clone)
    db.flush()
    for line in source.lines:
        db.add(
            BOMLine(
                bom_id=clone.id,
                item_id=line.item_id,
                qty=line.qty,
                uom=line.uom,
                scrap_pct=line.scrap_pct,
                explode=line.explode,
            )
        )
    for op in source.operations:
        db.add(
            BOMOperation(
                bom_id=clone.id,
                sequence=op.sequence,
                name=op.name,
                hours=op.hours,
                rate_per_hour=op.rate_per_hour,
            )
        )
    db.commit()
    return _detail(db, load_bom(db, clone.id))


@router.get("/{bom_id}/tree")
def bom_tree(bom_id: int, db: Session = Depends(get_db)):
    bom = load_bom(db, bom_id)
    return build_tree(db, bom, 1.0)


@router.get("/{bom_id}/exploded")
def bom_exploded(bom_id: int, db: Session = Depends(get_db)):
    bom = load_bom(db, bom_id)
    tree = build_tree(db, bom, 1.0)
    rows = flatten_purchased(tree)
    rows.sort(key=lambda r: r["item_code"])
    return rows


@router.get("/{bom_id}/cost")
def bom_cost(bom_id: int, db: Session = Depends(get_db)):
    bom = load_bom(db, bom_id)
    tree = build_tree(db, bom, 1.0)
    exploded = flatten_purchased(tree)
    material, operation, total = bom_costs(db, bom)
    return {
        "bom_id": bom.id,
        "item_code": bom.item.code,
        "output_qty": bom.output_qty,
        "material_cost": material,
        "operation_cost": operation,
        "total_cost": total,
        "unit_cost": round(total / (bom.output_qty or 1), 4),
        "exploded": exploded,
        "operations": collect_operations(db, bom, 1.0),
    }
