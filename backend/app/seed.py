from sqlalchemy.orm import Session

from .database import utcnow
from .models import BOM, BOMLine, BOMOperation, Item


def seed_if_empty(db: Session) -> None:
    if db.query(Item).count():
        return

    items = {
        "CM-100": Item(
            code="CM-100",
            name="Hand-press portable coffee maker",
            item_type="finished",
            uom="pcs",
            unit_cost=0,
            description="Demo finished good used to show a multi-level BOM.",
        ),
        "GROUP-ASM": Item(
            code="GROUP-ASM",
            name="Brew group assembly",
            item_type="semi",
            uom="pcs",
            unit_cost=0,
            description="Sub-assembly with its own submitted BOM.",
        ),
        "BODY-ASM": Item(
            code="BODY-ASM",
            name="Body assembly",
            item_type="semi",
            uom="pcs",
            unit_cost=0,
        ),
        "HEAD-01": Item(code="HEAD-01", name="Brew head", item_type="purchased", uom="pcs", unit_cost=28.0),
        "FILTER-01": Item(code="FILTER-01", name="Metal filter", item_type="purchased", uom="pcs", unit_cost=6.0),
        "SEAL-01": Item(code="SEAL-01", name="Silicone seal", item_type="purchased", uom="pcs", unit_cost=1.5),
        "BODY-AL": Item(code="BODY-AL", name="Aluminum cylinder", item_type="purchased", uom="pcs", unit_cost=22.0),
        "PISTON-01": Item(code="PISTON-01", name="Piston", item_type="purchased", uom="pcs", unit_cost=12.0),
        "HANDLE-01": Item(code="HANDLE-01", name="Handle", item_type="purchased", uom="pcs", unit_cost=8.0),
        "PKG-01": Item(code="PKG-01", name="Retail box", item_type="purchased", uom="pcs", unit_cost=3.0),
        "SCREW-M3": Item(code="SCREW-M3", name="M3 screw", item_type="purchased", uom="pcs", unit_cost=0.2),
    }
    db.add_all(items.values())
    db.flush()

    def make_bom(item_code, output_qty, notes, lines, operations, version=1, status="submitted"):
        bom = BOM(
            item_id=items[item_code].id,
            output_qty=output_qty,
            version=version,
            status=status,
            notes=notes,
            created_at=utcnow(),
        )
        db.add(bom)
        db.flush()
        for code, qty, scrap, explode in lines:
            db.add(
                BOMLine(
                    bom_id=bom.id,
                    item_id=items[code].id,
                    qty=qty,
                    uom=items[code].uom,
                    scrap_pct=scrap,
                    explode=explode,
                )
            )
        for seq, name, hours, rate in operations:
            db.add(
                BOMOperation(
                    bom_id=bom.id,
                    sequence=seq,
                    name=name,
                    hours=hours,
                    rate_per_hour=rate,
                )
            )
        return bom

    make_bom(
        "GROUP-ASM",
        1,
        "Sub-assembly BOM. Exploded into purchased parts on the finished good.",
        [
            ("HEAD-01", 1, 0, True),
            ("FILTER-01", 1, 0, True),
            ("SEAL-01", 2, 5, True),
        ],
        [(1, "Pre-assemble brew group", 0.2, 80)],
    )
    make_bom(
        "BODY-ASM",
        1,
        "Body sub-assembly.",
        [
            ("BODY-AL", 1, 0, True),
            ("PISTON-01", 1, 0, True),
            ("HANDLE-01", 1, 0, True),
            ("SCREW-M3", 4, 2, True),
        ],
        [(1, "Fit piston and handle", 0.25, 80)],
    )
    make_bom(
        "CM-100",
        1,
        "Top-level BOM for the course demo. Open Explorer to see both assemblies exploded.",
        [
            ("GROUP-ASM", 1, 0, True),
            ("BODY-ASM", 1, 0, True),
            ("PKG-01", 1, 0, True),
            ("SCREW-M3", 4, 2, True),
        ],
        [
            (1, "Final assembly", 0.4, 80),
            (2, "Quality check", 0.1, 60),
        ],
    )
    db.commit()
