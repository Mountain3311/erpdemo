"""Open BOM Demo - read-only diagnostic for BOM Explosion + Cost Roll-up.

This script ONLY reads data. It never writes to the database.

It exists because the frontend/backend could not be executed in the
diagnostic environment, so we dump the real database state and replay the
exact same recursive algorithm as backend/app/services.py to see whether
Explosion / Cost Roll-up fail because of the DATA or because of the CODE.

Run it with the project's virtualenv python:

    cd backend
    .venv\\Scripts\\python.exe diagnose_bom.py

Optional: pass a BOM id or an item code to focus the report.

    .venv\\Scripts\\python.exe diagnose_bom.py CM-100
    .venv\\Scripts\\python.exe diagnose_bom.py 3
"""

from __future__ import annotations

import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB_PATH = ROOT / "data" / "bom_demo.db"

# ---------------------------------------------------------------------------
# 1. raw database dump
# ---------------------------------------------------------------------------


def connect() -> sqlite3.Connection:
    if not DB_PATH.exists():
        print(f"!! database not found: {DB_PATH}")
        raise SystemExit(2)
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def table_exists(conn: sqlite3.Connection, name: str) -> bool:
    row = conn.execute(
        "select 1 from sqlite_master where type='table' and name=?", (name,)
    ).fetchone()
    return row is not None


def columns(conn: sqlite3.Connection, table: str) -> list[str]:
    return [row[1] for row in conn.execute("PRAGMA table_info(%s)" % table)]


def dump_raw(conn: sqlite3.Connection) -> None:
    print("=" * 78)
    print("1. RAW DATABASE")
    print("=" * 78)
    print(f"db           : {DB_PATH}")
    print(f"size (bytes) : {DB_PATH.stat().st_size}")

    tables = [
        row[0]
        for row in conn.execute("select name from sqlite_master where type='table' order by name")
    ]
    print(f"tables       : {tables}")
    for table in ("items", "boms", "bom_lines", "bom_operations"):
        if table_exists(conn, table):
            count = conn.execute("select count(*) from %s" % table).fetchone()[0]
            print(f"  {table:<15} rows={count:<5} cols={columns(conn, table)}")
        else:
            print(f"  {table:<15} *** TABLE MISSING ***")

    if not table_exists(conn, "items"):
        return

    print("\n-- items --")
    for r in conn.execute(
        "select id, code, name, item_type, uom, unit_cost from items order by id"
    ):
        r = dict(r)
        print(
            f"  id={r['id']:<3} code={r['code']:<12} type={r['item_type']:<10} "
            f"uom={r['uom']:<5} unit_cost={r['unit_cost']:<8} name={r['name']}"
        )

    print("\n-- boms --  (bom_code shown in the UI is 'BOM-{id:03d}')")
    for r in conn.execute(
        "select id, name, item_id, output_qty, version, status, created_at "
        "from boms order by id"
    ):
        r = dict(r)
        item = conn.execute("select code from items where id=?", (r["item_id"],)).fetchone()
        code = item[0] if item else "<MISSING ITEM>"
        print(
            f"  BOM-{r['id']:03d} id={r['id']:<3} item_id={r['item_id']:<3} "
            f"item={code:<12} output_qty={r['output_qty']:<6} "
            f"version={r['version']:<3} status={r['status']:<10} name={r['name']}"
        )

    print("\n-- bom_lines --")
    for r in conn.execute(
        "select id, bom_id, item_id, qty, uom, scrap_pct, explode "
        "from bom_lines order by bom_id, id"
    ):
        r = dict(r)
        item = conn.execute(
            "select code, item_type, unit_cost from items where id=?", (r["item_id"],)
        ).fetchone()
        if item:
            child = "%s(%s,uc=%s)" % (item[0], item[1], item[2])
        else:
            child = "<MISSING ITEM>"
        print(
            f"  bom_id={r['bom_id']:<3} line={r['id']:<3} child={child:<42} "
            f"qty={r['qty']:<6} scrap={r['scrap_pct']:<5} explode={r['explode']}"
        )

    if table_exists(conn, "bom_operations"):
        print("\n-- bom_operations --")
        for r in conn.execute(
            "select bom_id, sequence, name, hours, rate_per_hour "
            "from bom_operations order by bom_id, sequence"
        ):
            r = dict(r)
            print(
                f"  bom_id={r['bom_id']:<3} seq={r['sequence']:<3} "
                f"hours={r['hours']:<6} rate={r['rate_per_hour']:<8} name={r['name']}"
            )


# ---------------------------------------------------------------------------
# 2. replay of backend/app/services.py (same algorithm, read-only)
# ---------------------------------------------------------------------------


class Db:
    """Minimal read-only stand-in for the SQLAlchemy session used by services.py."""

    def __init__(self, conn: sqlite3.Connection):
        self.conn = conn
        # sqlite3.Row is not a dict, so materialise every row first.
        self.items: dict[int, dict] = {
            row["id"]: row
            for row in (dict(r) for r in conn.execute("select * from items"))
        }
        self.boms: dict[int, dict] = {
            row["id"]: row
            for row in (dict(r) for r in conn.execute("select * from boms"))
        }
        self.lines_by_bom: dict[int, list[dict]] = {}
        for r in conn.execute("select * from bom_lines order by id"):
            row = dict(r)
            self.lines_by_bom.setdefault(row["bom_id"], []).append(row)
        self.ops_by_bom: dict[int, list[dict]] = {}
        if table_exists(conn, "bom_operations"):
            for r in conn.execute("select * from bom_operations order by sequence"):
                row = dict(r)
                self.ops_by_bom.setdefault(row["bom_id"], []).append(row)

    def item(self, item_id: int) -> dict:
        # mirrors line.item relationship; missing FK would be a data error
        return self.items.get(item_id) or {
            "id": item_id,
            "code": f"<MISSING ITEM {item_id}>",
            "name": "?",
            "item_type": "?",
            "uom": "?",
            "unit_cost": 0.0,
        }

    def lines(self, bom_id: int) -> list[dict]:
        return self.lines_by_bom.get(bom_id, [])

    def ops(self, bom_id: int) -> list[dict]:
        return self.ops_by_bom.get(bom_id, [])

    def latest_submitted_bom(self, item_id: int) -> dict | None:
        """services.latest_submitted_bom: status == submitted, highest version."""
        candidates = [
            b for b in self.boms.values()
            if b["item_id"] == item_id and b["status"] == "submitted"
        ]
        if not candidates:
            return None
        return sorted(candidates, key=lambda b: b["version"], reverse=True)[0]


def required_qty(line: dict) -> float:
    """services.required_qty"""
    return round(line["qty"] * (1 + (line["scrap_pct"] or 0) / 100.0), 6)


def build_tree(db: Db, bom: dict, qty_factor: float = 1.0, stack=None, trace=None, depth=0):
    """services.build_tree - same structure, plus an optional trace list."""
    stack = stack or set()
    if bom["id"] in stack:
        raise RuntimeError("Cycle detected while exploding BOM")
    stack = stack | {bom["id"]}

    children = []
    for line in db.lines(bom["id"]):
        item = db.item(line["item_id"])
        need = required_qty(line) * qty_factor
        child_bom = db.latest_submitted_bom(line["item_id"]) if line["explode"] else None
        exploded = bool(child_bom)
        if child_bom:
            factor = need / (child_bom["output_qty"] or 1)
            if trace is not None:
                trace.append(
                    f"{'  ' * depth}EXPAND  {item['code']:<12} need={need:<8} "
                    f"-> BOM-{child_bom['id']:03d} (factor={round(factor, 6)})"
                )
            node = build_tree(db, child_bom, factor, stack, trace, depth + 1)
            node["qty"] = need
            node["scrap_pct"] = line["scrap_pct"]
            node["exploded"] = True
            children.append(node)
        else:
            ext = round(need * (item["unit_cost"] or 0), 4)
            reason = "no submitted BOM" if not line["explode"] else "no submitted BOM"
            if not line["explode"]:
                reason = "explode=False (treated as leaf)"
            if trace is not None:
                trace.append(
                    f"{'  ' * depth}LEAF    {item['code']:<12} need={need:<8} "
                    f"unit_cost={item['unit_cost']:<6} ext={ext:<8} [{reason}]"
                )
            children.append({
                "item_id": item["id"],
                "item_code": item["code"],
                "item_name": item["name"],
                "item_type": item["item_type"],
                "qty": need,
                "uom": line["uom"],
                "scrap_pct": line["scrap_pct"],
                "exploded": exploded,
                "bom_id": None,
                "bom_version": None,
                "unit_cost": item["unit_cost"] or 0,
                "extended_cost": ext,
                "children": [],
            })

    op_cost = sum(
        round(op["hours"] * op["rate_per_hour"] * qty_factor, 4) for op in db.ops(bom["id"])
    )
    mat_cost = sum(child["extended_cost"] for child in children)
    total = round(mat_cost + op_cost, 4)
    output = (bom["output_qty"] or 1) * qty_factor
    unit = round(total / output, 4) if output else 0
    return {
        "item_id": db.item(bom["item_id"])["id"],
        "item_code": db.item(bom["item_id"])["code"],
        "item_name": db.item(bom["item_id"])["name"],
        "item_type": db.item(bom["item_id"])["item_type"],
        "qty": output,
        "uom": db.item(bom["item_id"])["uom"],
        "scrap_pct": 0,
        "exploded": True,
        "bom_id": bom["id"],
        "bom_version": bom["version"],
        "unit_cost": unit,
        "extended_cost": total,
        "children": children,
    }


def flatten_purchased(node: dict, acc: dict[int, dict] | None = None) -> list[dict]:
    """services.flatten_purchased"""
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
        acc[item_id]["extended_cost"] = round(
            acc[item_id]["qty"] * acc[item_id]["unit_cost"], 4
        )
    else:
        for child in node["children"]:
            flatten_purchased(child, acc)
    return list(acc.values())


def collect_operations(db: Db, bom: dict, qty_factor: float = 1.0, acc=None, stack=None) -> list:
    """services.collect_operations"""
    acc = acc if acc is not None else []
    stack = stack or set()
    if bom["id"] in stack:
        return acc
    stack = stack | {bom["id"]}
    item = db.item(bom["item_id"])
    for op in db.ops(bom["id"]):
        acc.append({
            "name": f"{item['code']} / {op['name']}",
            "hours": round(op["hours"] * qty_factor, 4),
            "rate_per_hour": op["rate_per_hour"],
            "cost": round(op["hours"] * op["rate_per_hour"] * qty_factor, 4),
        })
    for line in db.lines(bom["id"]):
        if not line["explode"]:
            continue
        child = db.latest_submitted_bom(line["item_id"])
        if child:
            need = required_qty(line) * qty_factor
            collect_operations(db, child, need / (child["output_qty"] or 1), acc, stack)
    return acc


# ---------------------------------------------------------------------------
# 3. per-BOM explosion + roll-up report
# ---------------------------------------------------------------------------

# Expected values for BOM-003 (item CM-100), derived from seed.py + the current
# algorithm in services.py:
#
#   material_cost  = sum of extended_cost over EXPLODED LEAF items only  = 83.782
#   operation_cost = own operations (32 + 6 = 38) + child BOM operations
#                    (GROUP-ASM 16 + BODY-ASM 20 = 36)                  = 74.0
#   total_cost     = material_cost + operation_cost                     = 157.782
#
# HISTORY - this block previously asserted material_total=98.00,
# material_cost=119.782 and total_cost=193.782. Those figures were wrong:
# 119.782 came from summing the DIRECT CHILD nodes' extended_cost, which already
# contain the sub-assemblies' own material + operation, so adding it to
# operation_cost double counted material. The system definition is:
#     material_cost = sum(leaf extended_cost)   (never add intermediate levels)
#     total_cost    = material_cost + operation_cost
EXPECTED = {
    "material_cost": 83.782,
    "operation_cost": 74.0,
    "total_cost": 157.782,
    "rolled_up_operation": 36.0,
}


def report_bom(db: Db, bom: dict) -> dict | None:
    """Print one BOM's explosion + roll-up report. Returns the computed metrics."""
    item = db.item(bom["item_id"])
    print("\n" + "-" * 78)
    print(
        f"BOM-{bom['id']:03d}  item={item['code']} ({item['item_type']})  "
        f"status={bom['status']}  version={bom['version']}  output_qty={bom['output_qty']}"
    )
    print("-" * 78)

    trace: list[str] = []
    try:
        tree = build_tree(db, bom, 1.0, trace=trace)
    except RuntimeError as exc:
        print(f"  !! EXPLOSION FAILED: {exc}")
        return None

    print("  explosion trace:")
    for line in trace:
        print(f"    {line}")

    exploded = flatten_purchased(tree)
    exploded.sort(key=lambda r: r["item_code"])
    # services.bom_costs() defines material cost as the sum over the EXPLODED
    # leaf items only - intermediate sub-assembly costs must NOT be added again,
    # otherwise material cost is double counted.
    material_cost = round(sum(r["extended_cost"] for r in exploded), 4)
    ops = collect_operations(db, bom, 1.0)
    operation_cost = round(sum(o["cost"] for o in ops), 4)
    total_cost = round(material_cost + operation_cost, 4)
    output = bom["output_qty"] or 1
    unit_cost = round(total_cost / output, 4)

    # Operations belonging to a different product are the ones rolled up from
    # child BOMs (collect_operations prefixes the name with the owning item code).
    own_prefix = item["code"] + " / "
    child_op_cost = round(
        sum(o["cost"] for o in ops if not o["name"].startswith(own_prefix)), 4
    )

    print(f"\n  {'material code':<14}{'type':<11}{'qty':>10}{'unit_cost':>12}{'amount':>12}")
    for r in exploded:
        print(
            f"  {r['item_code']:<14}{r['item_type']:<11}{r['qty']:>10}"
            f"{r['unit_cost']:>12}{r['extended_cost']:>12}"
        )
    if not exploded:
        print("  (no exploded rows - EXPLOSION PRODUCED NOTHING)")

    print(f"\n  operations expanded ({len(ops)} rows):")
    for o in ops:
        print(f"    {o['name']:<45} hours={o['hours']:<8} cost={o['cost']}")

    print("\n  RESULT:")
    print(f"    Material Cost (exploded leaves)  : {material_cost}")
    print(f"    Operation Cost                   : {operation_cost}")
    print(f"    Total Cost                       : {total_cost}")
    print(f"    Unit Cost                        : {unit_cost}")
    print(f"    Rolled-up Operation (child BOMs) : {child_op_cost}")
    print(f"    Own Operation                    : {round(operation_cost - child_op_cost, 4)}")

    return {
        "material_cost": material_cost,
        "operation_cost": operation_cost,
        "total_cost": total_cost,
        "unit_cost": unit_cost,
        "rolled_up_operation": child_op_cost,
        "exploded_rows": len(exploded),
    }


def check(label: str, actual, expected) -> bool:
    ok = abs(float(actual) - float(expected)) < 1e-6
    print(f"    [{'PASS' if ok else 'FAIL'}] {label:<22} actual={actual:<12.4f} expected={expected}")
    return ok


def main() -> int:
    conn = connect()
    try:
        dump_raw(conn)
        db = Db(conn)

        print("\n" + "=" * 78)
        print("2. EXPLOSION + ROLL-UP REPLAY")
        print("=" * 78)

        if not db.boms:
            print("!! no BOM rows at all -> nothing can explode")
            return 1

        # environment sanity: are the app dependencies installed?
        print("\ndependency check:")
        for mod in ("fastapi", "sqlalchemy", "pydantic", "uvicorn"):
            try:
                __import__(mod)
                print(f"  {mod:<12} importable")
            except Exception as exc:  # noqa: BLE001
                print(f"  {mod:<12} NOT IMPORTABLE ({type(exc).__name__})")

        targets = sorted(db.boms.values(), key=lambda b: b["id"])
        results: dict[int, dict | None] = {}
        for bom in targets:
            results[bom["id"]] = report_bom(db, bom)

        print("\n" + "=" * 78)
        print("3. REGRESSION CHECKS (explosion + cost roll-up)")
        print("=" * 78)

        # --- Test A/B: sub-assembly BOMs must explode on their own ---
        all_ok = True
        sub_expect = {
            "GROUP-ASM": {"material_cost": 37.15, "operation_cost": 16.0, "total_cost": 53.15},
            "BODY-ASM": {"material_cost": 42.816, "operation_cost": 20.0, "total_cost": 62.816},
        }
        for bom in targets:
            code = db.item(bom["item_id"])["code"]
            if code in sub_expect and bom["status"] == "submitted":
                print(f"\n  Test B (sub-assembly) BOM-{bom['id']:03d} item={code} v{bom['version']}")
                metrics = results.get(bom["id"])
                if metrics is None:
                    print("    [FAIL] explosion raised")
                    all_ok = False
                    continue
                for key, want in sub_expect[code].items():
                    all_ok &= check(key, metrics[key], want)

        # --- Test C/D: the CM-100 tree ---
        cm100 = [
            b for b in db.boms.values()
            if db.item(b["item_id"])["code"] == "CM-100" and b["status"] == "submitted"
        ]
        print("\n  Test C/D (top-level) CM-100 submitted BOMs: "
              + (", ".join("BOM-%03d" % b["id"] for b in cm100) or "(none)"))
        if not cm100:
            print("    [FAIL] no submitted CM-100 BOM - top-level explosion cannot be tested")
            all_ok = False
        best = None
        if cm100:
            best = sorted(cm100, key=lambda b: b["version"], reverse=True)[0]
            metrics = results.get(best["id"])
            print(f"    using BOM-{best['id']:03d} (highest submitted version)")
            if metrics is None:
                print("    [FAIL] explosion raised")
                all_ok = False
            else:
                for key, want in EXPECTED.items():
                    all_ok &= check(key, metrics[key], want)
                print(f"    [{'PASS' if metrics['exploded_rows'] == 8 else 'FAIL'}] "
                      f"{'exploded_rows':<22} actual={metrics['exploded_rows']:<12} expected=8")
                all_ok &= metrics["exploded_rows"] == 8
                # The cost identity the system must satisfy:
                #     total_cost = material_cost + operation_cost
                lhs = round(metrics["material_cost"] + metrics["operation_cost"], 4)
                ok = abs(lhs - metrics["total_cost"]) < 1e-6
                print(f"    [{'PASS' if ok else 'FAIL'}] material_cost + operation_cost "
                      f"= {lhs} vs total_cost = {metrics['total_cost']}")
                all_ok &= ok
                # and operation_cost must be own + child BOM operations
                own = round(metrics["operation_cost"] - metrics["rolled_up_operation"], 4)
                print(f"    own operation = operation_cost - child = "
                      f"{metrics['operation_cost']} - {metrics['rolled_up_operation']} = {own}")

        print("\n" + "=" * 78)
        print("4. EMPTY DRAFT BOMs (cannot explode - they show an empty list in the UI)")
        print("=" * 78)
        # An empty DRAFT BOM for the same item does NOT affect explosion:
        # latest_submitted_bom() only considers status='submitted'.
        empty = [
            b for b in db.boms.values()
            if b["status"] != "submitted" and not db.lines(b["id"])
        ]
        if empty:
            for b in empty:
                print(
                    "  BOM-%03d  item=%-12s version=%d  status=%s  lines=0"
                    % (b["id"], db.item(b["item_id"])["code"], b["version"], b["status"])
                )
            print(
                "\n  NOTE: these are drafts. They do not participate in cost roll-up,\n"
                "        but opening one in the UI shows an empty explosion."
            )
        else:
            print("  (none)")

        print("\n" + "=" * 78)
        print("OVERALL: " + ("ALL CHECKS PASSED" if all_ok else "SOME CHECKS FAILED"))
        print("=" * 78)
        return 0 if all_ok else 1
    finally:
        conn.close()


if __name__ == "__main__":
    sys.exit(main())
