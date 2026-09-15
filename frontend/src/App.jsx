import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

const TYPE_LABEL = {
  purchased: "采购件",
  semi: "半成品",
  finished: "成品",
};

function money(n) {
  return `¥${Number(n || 0).toFixed(2)}`;
}

function qty(n) {
  const v = Number(n || 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
}

export default function App() {
  const [page, setPage] = useState("boms");
  return (
    <div className="app">
      <aside className="sidebar">
        <div className="brand">
          <small>Course assignment</small>
          <h1>Open BOM</h1>
        </div>
        <nav className="nav">
          <button className={page === "boms" ? "active" : ""} onClick={() => setPage("boms")}>
            物料清单 BOM
          </button>
          <button className={page === "items" ? "active" : ""} onClick={() => setPage("items")}>
            物料主数据
          </button>
          <button className={page === "about" ? "active" : ""} onClick={() => setPage("about")}>
            关于本作业
          </button>
        </nav>
      </aside>
      <main className="main">
        {page === "boms" && <BomPage />}
        {page === "items" && <ItemPage />}
        {page === "about" && <AboutPage />}
      </main>
    </div>
  );
}

function AboutPage() {
  return (
    <section className="about">
      <div className="topbar">
        <div>
          <h2>关于本作业</h2>
          <p>这是一份课程作业演示：自研多层 BOM，不是 ERPNext 的分支或再分发。</p>
        </div>
      </div>
      <div className="card panel">
        <p>
          演示范围包括物料主数据、多层 BOM、损耗后的需求量、树形展开、叶子物料汇总，以及物料成本 + 工序工时成本。不含工单、库存事务、产能或外协。
        </p>
        <p>
          功能对标公开的制造业 BOM 实践，参考过{" "}
          <a href="https://frappe.io/erpnext/open-source-manufacturing-erp-software" target="_blank" rel="noreferrer">
            ERPNext Manufacturing
          </a>{" "}
          的产品说明。代码全部原创，采用 MIT 许可。未复制 ERPNext / Frappe 源码，也不使用其商标作为产品名。
        </p>
      </div>
    </section>
  );
}

function ItemPage() {
  const [items, setItems] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    code: "",
    name: "",
    item_type: "purchased",
    uom: "pcs",
    unit_cost: 0,
    description: "",
  });

  async function refresh() {
    setItems(await api.items());
  }

  useEffect(() => {
    refresh().catch((e) => setError(e.message));
  }, []);

  async function onCreate(e) {
    e.preventDefault();
    setError("");
    try {
      await api.createItem({ ...form, unit_cost: Number(form.unit_cost) });
      setForm({ code: "", name: "", item_type: "purchased", uom: "pcs", unit_cost: 0, description: "" });
      await refresh();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h2>物料主数据</h2>
          <p>成品和半成品可以挂 BOM；采购件提供单价，供成本汇总使用。</p>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="grid">
        <form className="card panel" onSubmit={onCreate}>
          <h3>新增物料</h3>
          <div className="form-grid" style={{ marginTop: "0.8rem" }}>
            <label>
              编码
              <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
            </label>
            <label>
              名称
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
            </label>
            <label>
              类型
              <select value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })}>
                <option value="purchased">采购件</option>
                <option value="semi">半成品</option>
                <option value="finished">成品</option>
              </select>
            </label>
            <label>
              单位
              <input value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} />
            </label>
            <label>
              单价
              <input
                type="number"
                step="0.01"
                value={form.unit_cost}
                onChange={(e) => setForm({ ...form, unit_cost: e.target.value })}
              />
            </label>
          </div>
          <label>
            说明
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </label>
          <div className="row" style={{ marginTop: "0.8rem" }}>
            <button className="btn" type="submit">
              保存物料
            </button>
          </div>
        </form>
        <div className="card">
          <h3>已有物料</h3>
          <div className="panel" style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>编码</th>
                  <th>名称</th>
                  <th>类型</th>
                  <th>单价</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td className="mono">{item.code}</td>
                    <td>{item.name}</td>
                    <td>
                      <span className={`badge ${item.item_type}`}>{TYPE_LABEL[item.item_type]}</span>
                    </td>
                    <td className="mono">{money(item.unit_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function BomPage() {
  const [boms, setBoms] = useState([]);
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [tree, setTree] = useState(null);
  const [exploded, setExploded] = useState([]);
  const [cost, setCost] = useState(null);
  const [tab, setTab] = useState("lines");
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);
  const [newItemId, setNewItemId] = useState("");

  async function refreshList() {
    const [bomRows, itemRows] = await Promise.all([api.boms(), api.items()]);
    setBoms(bomRows);
    setItems(itemRows);
    return bomRows;
  }

  async function openBom(id) {
    const [d, t, e, c] = await Promise.all([api.bom(id), api.tree(id), api.exploded(id), api.cost(id)]);
    setSelectedId(id);
    setDetail(d);
    setTree(t);
    setExploded(e);
    setCost(c);
  }

  useEffect(() => {
    refreshList()
      .then((rows) => {
        const first = rows.find((b) => b.item_code === "CM-100") || rows[0];
        if (first) return openBom(first.id);
      })
      .catch((e) => setError(e.message));
  }, []);

  const makeable = useMemo(
    () => items.filter((i) => i.item_type !== "purchased"),
    [items]
  );

  async function wrap(fn) {
    setError("");
    try {
      await fn();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h2>多层物料清单</h2>
          <p>打开种子数据里的 CM-100，可看到半成品展开成采购件，并汇总物料与工序成本。</p>
        </div>
        <div className="row">
          <select value={newItemId} onChange={(e) => setNewItemId(e.target.value)}>
            <option value="">选择成品 / 半成品</option>
            {makeable.map((item) => (
              <option key={item.id} value={item.id}>
                {item.code} {item.name}
              </option>
            ))}
          </select>
          <button
            className="btn"
            disabled={!newItemId || creating}
            onClick={() =>
              wrap(async () => {
                setCreating(true);
                try {
                  const created = await api.createBom({
                    item_id: Number(newItemId),
                    output_qty: 1,
                    notes: "",
                    lines: [],
                    operations: [],
                  });
                  await refreshList();
                  await openBom(created.id);
                  setTab("lines");
                } finally {
                  setCreating(false);
                }
              })
            }
          >
            新建草稿
          </button>
        </div>
      </div>
      {error && <p className="error">{error}</p>}
      <div className="grid">
        <div className="card">
          <h3>BOM 列表</h3>
          <div className="list">
            {boms.map((bom) => (
              <button
                key={bom.id}
                className={bom.id === selectedId ? "active" : ""}
                onClick={() => wrap(() => openBom(bom.id))}
              >
                <div>
                  <span className="mono">{bom.item_code}</span> · v{bom.version}{" "}
                  <span className={`badge ${bom.status}`}>{bom.status === "submitted" ? "已提交" : "草稿"}</span>
                </div>
                <div className="meta">
                  {bom.item_name} · {money(bom.total_cost)}
                </div>
              </button>
            ))}
          </div>
        </div>
        {detail && (
          <BomDetail
            detail={detail}
            items={items}
            tab={tab}
            setTab={setTab}
            tree={tree}
            exploded={exploded}
            cost={cost}
            onSave={(payload) =>
              wrap(async () => {
                await api.updateBom(detail.id, payload);
                await refreshList();
                await openBom(detail.id);
              })
            }
            onSubmit={() =>
              wrap(async () => {
                await api.submitBom(detail.id);
                await refreshList();
                await openBom(detail.id);
              })
            }
            onVersion={() =>
              wrap(async () => {
                const next = await api.newVersion(detail.id);
                await refreshList();
                await openBom(next.id);
                setTab("lines");
              })
            }
          />
        )}
      </div>
    </>
  );
}

function BomDetail({ detail, items, tab, setTab, tree, exploded, cost, onSave, onSubmit, onVersion }) {
  const readOnly = detail.status !== "draft";
  const [outputQty, setOutputQty] = useState(detail.output_qty);
  const [notes, setNotes] = useState(detail.notes);
  const [lines, setLines] = useState(detail.lines);
  const [operations, setOperations] = useState(detail.operations);

  useEffect(() => {
    setOutputQty(detail.output_qty);
    setNotes(detail.notes);
    setLines(detail.lines);
    setOperations(detail.operations);
  }, [detail]);

  function addLine() {
    const first = items[0];
    if (!first) return;
    setLines([
      ...lines,
      { item_id: first.id, qty: 1, uom: first.uom, scrap_pct: 0, explode: true },
    ]);
  }

  function addOp() {
    setOperations([
      ...operations,
      { sequence: operations.length + 1, name: "", hours: 0.1, rate_per_hour: 80 },
    ]);
  }

  return (
    <div className="card">
      <div className="panel">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <h3>
              {detail.item_name}{" "}
              <span className="mono">
                {detail.item_code} / v{detail.version}
              </span>
            </h3>
            <div className="meta" style={{ marginTop: "0.35rem" }}>
              <span className={`badge ${detail.status}`}>{readOnly ? "已提交 · 只读" : "草稿 · 可编辑"}</span>
            </div>
          </div>
          <div className="row">
            {readOnly ? (
              <button className="btn secondary" onClick={onVersion}>
                复制为新版本
              </button>
            ) : (
              <>
                <button
                  className="btn secondary"
                  onClick={() =>
                    onSave({
                      output_qty: Number(outputQty),
                      notes,
                      lines: lines.map((line) => ({
                        item_id: Number(line.item_id),
                        qty: Number(line.qty),
                        uom: line.uom,
                        scrap_pct: Number(line.scrap_pct || 0),
                        explode: Boolean(line.explode),
                      })),
                      operations: operations.map((op, i) => ({
                        sequence: Number(op.sequence || i + 1),
                        name: op.name,
                        hours: Number(op.hours),
                        rate_per_hour: Number(op.rate_per_hour),
                      })),
                    })
                  }
                >
                  保存草稿
                </button>
                <button className="btn" onClick={onSubmit}>
                  提交
                </button>
              </>
            )}
          </div>
        </div>
        <div className="stats">
          <div className="stat">
            <span>物料成本</span>
            <strong>{money(detail.material_cost)}</strong>
          </div>
          <div className="stat">
            <span>工序成本</span>
            <strong>{money(detail.operation_cost)}</strong>
          </div>
          <div className="stat">
            <span>单位成本</span>
            <strong>{money(detail.total_cost / (detail.output_qty || 1))}</strong>
          </div>
        </div>
        <div className="form-grid">
          <label>
            产出数量
            <input
              type="number"
              step="0.01"
              disabled={readOnly}
              value={outputQty}
              onChange={(e) => setOutputQty(e.target.value)}
            />
          </label>
          <label>
            备注
            <input disabled={readOnly} value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>
        </div>
      </div>
      <div className="tabs">
        {[
          ["lines", "物料行"],
          ["ops", "工序"],
          ["tree", "多层展开"],
          ["cost", "成本"],
        ].map(([id, label]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="panel">
        {tab === "lines" && (
          <>
            <table>
              <thead>
                <tr>
                  <th>物料</th>
                  <th>用量</th>
                  <th>损耗 %</th>
                  <th>展开</th>
                  <th>需求量</th>
                  {!readOnly && <th />}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={index}>
                    <td>
                      {readOnly ? (
                        <span>
                          <span className="mono">{line.item_code}</span> {line.item_name}
                        </span>
                      ) : (
                        <select
                          value={line.item_id}
                          onChange={(e) => {
                            const next = [...lines];
                            next[index] = { ...next[index], item_id: Number(e.target.value) };
                            setLines(next);
                          }}
                        >
                          {items.map((item) => (
                            <option key={item.id} value={item.id}>
                              {item.code} {item.name}
                            </option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        disabled={readOnly}
                        value={line.qty}
                        onChange={(e) => {
                          const next = [...lines];
                          next[index] = { ...next[index], qty: e.target.value };
                          setLines(next);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        disabled={readOnly}
                        value={line.scrap_pct}
                        onChange={(e) => {
                          const next = [...lines];
                          next[index] = { ...next[index], scrap_pct: e.target.value };
                          setLines(next);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="checkbox"
                        disabled={readOnly}
                        checked={Boolean(line.explode)}
                        onChange={(e) => {
                          const next = [...lines];
                          next[index] = { ...next[index], explode: e.target.checked };
                          setLines(next);
                        }}
                      />
                    </td>
                    <td className="mono">{qty(line.required_qty ?? line.qty * (1 + (line.scrap_pct || 0) / 100))}</td>
                    {!readOnly && (
                      <td>
                        <button
                          className="btn ghost"
                          type="button"
                          onClick={() => setLines(lines.filter((_, i) => i !== index))}
                        >
                          删除
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!readOnly && (
              <button className="btn secondary" style={{ marginTop: "0.8rem" }} onClick={addLine}>
                添加物料行
              </button>
            )}
          </>
        )}
        {tab === "ops" && (
          <>
            <table>
              <thead>
                <tr>
                  <th>顺序</th>
                  <th>工序</th>
                  <th>工时 h</th>
                  <th>费率 / h</th>
                  <th>成本</th>
                  {!readOnly && <th />}
                </tr>
              </thead>
              <tbody>
                {operations.map((op, index) => (
                  <tr key={index}>
                    <td>
                      <input
                        type="number"
                        disabled={readOnly}
                        value={op.sequence}
                        onChange={(e) => {
                          const next = [...operations];
                          next[index] = { ...next[index], sequence: e.target.value };
                          setOperations(next);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        disabled={readOnly}
                        value={op.name}
                        onChange={(e) => {
                          const next = [...operations];
                          next[index] = { ...next[index], name: e.target.value };
                          setOperations(next);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        disabled={readOnly}
                        value={op.hours}
                        onChange={(e) => {
                          const next = [...operations];
                          next[index] = { ...next[index], hours: e.target.value };
                          setOperations(next);
                        }}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        disabled={readOnly}
                        value={op.rate_per_hour}
                        onChange={(e) => {
                          const next = [...operations];
                          next[index] = { ...next[index], rate_per_hour: e.target.value };
                          setOperations(next);
                        }}
                      />
                    </td>
                    <td className="mono">{money((op.hours || 0) * (op.rate_per_hour || 0))}</td>
                    {!readOnly && (
                      <td>
                        <button
                          className="btn ghost"
                          type="button"
                          onClick={() => setOperations(operations.filter((_, i) => i !== index))}
                        >
                          删除
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
            {!readOnly && (
              <button className="btn secondary" style={{ marginTop: "0.8rem" }} onClick={addOp}>
                添加工序
              </button>
            )}
          </>
        )}
        {tab === "tree" && tree && <Tree node={tree} depth={0} />}
        {tab === "cost" && cost && (
          <>
            <div className="stats">
              <div className="stat">
                <span>展开物料</span>
                <strong>{money(cost.material_cost)}</strong>
              </div>
              <div className="stat">
                <span>全部工序</span>
                <strong>{money(cost.operation_cost)}</strong>
              </div>
              <div className="stat">
                <span>合计 / 件</span>
                <strong>{money(cost.unit_cost)}</strong>
              </div>
            </div>
            <h3 className="section-title">叶子物料汇总</h3>
            <table>
              <thead>
                <tr>
                  <th>物料</th>
                  <th>数量</th>
                  <th>单价</th>
                  <th>金额</th>
                </tr>
              </thead>
              <tbody>
                {exploded.map((row) => (
                  <tr key={row.item_id}>
                    <td>
                      <span className="mono">{row.item_code}</span> {row.item_name}
                    </td>
                    <td className="mono">
                      {qty(row.qty)} {row.uom}
                    </td>
                    <td className="mono">{money(row.unit_cost)}</td>
                    <td className="mono">{money(row.extended_cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <h3 className="section-title" style={{ marginTop: "1rem" }}>
              工序（含半成品）
            </h3>
            <table>
              <thead>
                <tr>
                  <th>工序</th>
                  <th>工时</th>
                  <th>费率</th>
                  <th>成本</th>
                </tr>
              </thead>
              <tbody>
                {cost.operations.map((op, i) => (
                  <tr key={i}>
                    <td>{op.name}</td>
                    <td className="mono">{qty(op.hours)}</td>
                    <td className="mono">{money(op.rate_per_hour)}</td>
                    <td className="mono">{money(op.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </div>
  );
}

function Tree({ node, depth }) {
  return (
    <div className="tree">
      <div className="tree-row" style={{ paddingLeft: `${depth * 18}px` }}>
        <div className="name">
          <span className="mono">{node.item_code}</span>
          <span>{node.item_name}</span>
          {node.bom_version ? <span className="badge submitted">BOM v{node.bom_version}</span> : null}
        </div>
        <div className="mono">
          {qty(node.qty)} {node.uom}
        </div>
        <div className="mono">{money(node.extended_cost)}</div>
      </div>
      {(node.children || []).map((child, i) => (
        <Tree key={`${child.item_id}-${i}`} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}
