import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

const TYPE_LABEL = { purchased: "原材料", semi: "半成品", finished: "产品" };

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("zh-CN") : "—";
}

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [items, setItems] = useState([]);
  const [boms, setBoms] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setLoading(true);
    setError("");
    try {
      const [itemRows, bomRows] = await Promise.all([api.items(), api.boms()]);
      setItems(itemRows);
      setBoms(bomRows);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, []);
  const title = { dashboard: "工作台", items: "Item 管理", boms: "BOM 管理" }[page];

  return <div className="desk">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">B</span><div><strong>BOM 教学 Demo</strong><small>Manufacturing</small></div></div>
      <p className="nav-group">制造</p>
      <nav>
        <button className={page === "dashboard" ? "active" : ""} onClick={() => setPage("dashboard")}>工作台</button>
        <button className={page === "items" ? "active" : ""} onClick={() => setPage("items")}>Item 管理</button>
        <button className={page === "boms" ? "active" : ""} onClick={() => setPage("boms")}>BOM 管理</button>
      </nav>
      <div className="sidebar-note">课程演示版<br />仅展示物料与 BOM 核心流程</div>
    </aside>
    <main>
      <header className="topbar"><div><p className="breadcrumb">制造 / {title}</p><h1>{title}</h1></div><button className="button secondary" onClick={refresh} disabled={loading}>{loading ? "正在刷新…" : "刷新数据"}</button></header>
      {error && <div className="alert">无法读取数据：{error}</div>}
      {page === "dashboard" && <Dashboard items={items} boms={boms} loading={loading} setPage={setPage} />}
      {page === "items" && <ItemsPage items={items} refresh={refresh} />}
      {page === "boms" && <BomsPage items={items} boms={boms} refresh={refresh} />}
    </main>
  </div>;
}

function Dashboard({ items, boms, loading, setPage }) {
  const productCount = items.filter((item) => item.item_type === "finished").length;
  return <section className="page-content">
    <p className="page-intro">从 Item 开始，创建 BOM，再为 BOM 添加材料。这里展示的是一层 BOM 的基础教学流程。</p>
    <div className="metric-grid"><Metric label="Item 总数" value={items.length} /><Metric label="产品数量" value={productCount} /><Metric label="BOM 数量" value={boms.length} /></div>
    <div className="panel quick-start"><div><h2>建议演示顺序</h2><p>先建立产品与原材料，再创建一张 BOM，最后在详情中维护材料清单。</p></div><div className="button-row"><button className="button secondary" onClick={() => setPage("items")}>管理 Item</button><button className="button" onClick={() => setPage("boms")}>管理 BOM</button></div></div>
    <section className="panel table-panel"><div className="panel-heading"><h2>最近 BOM</h2><span>{loading ? "加载中" : `${boms.length} 条记录`}</span></div><BomTable boms={boms.slice(0, 5)} /></section>
  </section>;
}
function Metric({ label, value }) { return <div className="metric"><span>{label}</span><strong>{value}</strong></div>; }

function ItemsPage({ items, refresh }) {
  const [form, setForm] = useState({ code: "", name: "", item_type: "purchased", uom: "pcs", unit_cost: "0", description: "" });
  const [message, setMessage] = useState(""); const [error, setError] = useState("");
  async function createItem(event) {
    event.preventDefault(); setError(""); setMessage("");
    try { await api.createItem({ ...form, unit_cost: Number(form.unit_cost) }); setForm({ code: "", name: "", item_type: "purchased", uom: "pcs", unit_cost: "0", description: "" }); setMessage("Item 已保存。"); await refresh(); } catch (err) { setError(err.message); }
  }
  return <section className="page-content">
    <div className="section-toolbar"><p>Item 是 BOM 中可被选择的产品或材料。当前稳定接口支持创建与查看。</p><span className="record-count">{items.length} 条记录</span></div>
    {message && <div className="notice">{message}</div>}{error && <div className="alert">保存失败：{error}</div>}
    <div className="two-column">
      <section className="panel form-panel"><div className="panel-heading"><h2>新建 Item</h2></div><form onSubmit={createItem}>
        <label>编码<input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></label><label>名称<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <div className="form-grid"><label>类型<select value={form.item_type} onChange={(e) => setForm({ ...form, item_type: e.target.value })}><option value="purchased">原材料</option><option value="finished">产品</option><option value="semi">半成品（兼容旧数据）</option></select></label><label>单位<input value={form.uom} onChange={(e) => setForm({ ...form, uom: e.target.value })} /></label></div>
        <label>单价<input type="number" min="0" step="0.01" value={form.unit_cost} onChange={(e) => setForm({ ...form, unit_cost: e.target.value })} /></label><label>说明（可选）<textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label><button className="button" type="submit">保存 Item</button>
      </form></section>
      <section className="panel table-panel"><div className="panel-heading"><h2>Item 列表</h2></div><div className="table-scroll"><ItemTable items={items} /></div></section>
    </div>
  </section>;
}
function ItemTable({ items }) { return <table><thead><tr><th>编码</th><th>名称</th><th>类型</th><th>单位</th><th>单价</th></tr></thead><tbody>{items.map((item) => <tr key={item.id}><td className="code">{item.code}</td><td>{item.name}</td><td><span className="tag">{TYPE_LABEL[item.item_type] || item.item_type}</span></td><td>{item.uom}</td><td>{Number(item.unit_cost || 0).toFixed(2)}</td></tr>)}{!items.length && <EmptyRow colSpan={5} />}</tbody></table>; }

function BomsPage({ items, boms, refresh }) {
  const [selectedId, setSelectedId] = useState(null); const [detail, setDetail] = useState(null); const [creating, setCreating] = useState(false); const [error, setError] = useState("");
  const makeable = useMemo(() => items.filter((item) => item.item_type !== "purchased"), [items]);
  async function openBom(id) { try { setError(""); setSelectedId(id); setDetail(await api.bom(id)); } catch (err) { setError(err.message); } }
  async function createBom() { if (!makeable[0]) return; try { setCreating(true); const created = await api.createBom({ item_id: makeable[0].id, output_qty: 1, notes: "", lines: [], operations: [] }); await refresh(); await openBom(created.id); } catch (err) { setError(err.message); } finally { setCreating(false); } }
  return <section className="page-content"><div className="section-toolbar"><p>BOM 定义一个产品由哪些材料组成。当前页面隐藏成本、版本与多层展开等高级功能。</p><button className="button" onClick={createBom} disabled={!makeable.length || creating}>{creating ? "正在创建…" : "新建 BOM"}</button></div>{error && <div className="alert">操作失败：{error}</div>}
    <div className="bom-layout"><section className="panel table-panel"><div className="panel-heading"><h2>BOM 列表</h2><span>{boms.length} 条记录</span></div><div className="table-scroll"><BomTable boms={boms} selectedId={selectedId} onSelect={openBom} /></div></section><section className="panel detail-panel">{detail ? <SimpleBomDetail detail={detail} items={items} refresh={refresh} reload={() => openBom(detail.id)} /> : <div className="empty-state"><h2>选择一张 BOM</h2><p>在左侧列表中打开 BOM，即可查看或编辑材料清单。</p></div>}</section></div>
  </section>;
}
function BomTable({ boms, selectedId, onSelect }) { return <table><thead><tr><th>BOM 编号</th><th>产品</th><th>创建时间</th><th>操作</th></tr></thead><tbody>{boms.map((bom) => <tr key={bom.id} className={bom.id === selectedId ? "selected" : ""}><td className="code">BOM-{bom.id}</td><td>{bom.item_name}</td><td>{formatDate(bom.created_at)}</td><td>{onSelect ? <button className="table-action" onClick={() => onSelect(bom.id)}>查看</button> : "—"}</td></tr>)}{!boms.length && <EmptyRow colSpan={4} />}</tbody></table>; }

function SimpleBomDetail({ detail, items, refresh, reload }) {
  const [lines, setLines] = useState(detail.lines); const [notes, setNotes] = useState(detail.notes || ""); const [message, setMessage] = useState(""); const [error, setError] = useState("");
  const readOnly = detail.status !== "draft"; const materials = items.filter((item) => item.item_type === "purchased");
  useEffect(() => { setLines(detail.lines); setNotes(detail.notes || ""); }, [detail]);
  function addLine() { if (materials[0]) setLines([...lines, { item_id: materials[0].id, qty: 1, uom: materials[0].uom, scrap_pct: 0, explode: false }]); }
  async function save() { try { setError(""); setMessage(""); await api.updateBom(detail.id, { notes, lines: lines.map((line) => ({ item_id: Number(line.item_id), qty: Number(line.qty), uom: line.uom, scrap_pct: 0, explode: false })) }); setMessage("BOM 材料清单已保存。"); await refresh(); await reload(); } catch (err) { setError(err.message); } }
  return <><div className="panel-heading detail-heading"><div><p className="eyebrow">BOM-{detail.id}</p><h2>{detail.item_name}</h2><span className="tag">{readOnly ? "已提交（只读）" : "草稿"}</span></div>{!readOnly && <button className="button" onClick={save}>保存</button>}</div><p className="detail-description">产品：<strong>{detail.item_name}</strong>。材料清单中的每一行都引用一个原材料 Item。</p>{message && <div className="notice">{message}</div>}{error && <div className="alert">保存失败：{error}</div>}<label className="notes-field">备注<input disabled={readOnly} value={notes} onChange={(e) => setNotes(e.target.value)} /></label><h3>材料清单</h3><div className="table-scroll"><table><thead><tr><th>材料</th><th>数量</th><th>单位</th>{!readOnly && <th>操作</th>}</tr></thead><tbody>{lines.map((line, index) => <tr key={`${line.id || "new"}-${index}`}><td>{readOnly ? `${line.item_code} ${line.item_name}` : <select value={line.item_id} onChange={(e) => { const next = [...lines]; const item = items.find((row) => row.id === Number(e.target.value)); next[index] = { ...next[index], item_id: Number(e.target.value), uom: item?.uom || line.uom }; setLines(next); }}>{materials.map((item) => <option key={item.id} value={item.id}>{item.code} {item.name}</option>)}</select>}</td><td><input disabled={readOnly} type="number" min="0.001" step="0.001" value={line.qty} onChange={(e) => { const next = [...lines]; next[index] = { ...next[index], qty: e.target.value }; setLines(next); }} /></td><td>{line.uom}</td>{!readOnly && <td><button className="table-action danger" onClick={() => setLines(lines.filter((_, i) => i !== index))}>移除</button></td>}</tr>)}{!lines.length && <EmptyRow colSpan={readOnly ? 3 : 4} text="尚未添加材料" />}</tbody></table></div>{!readOnly && <button className="button secondary add-line" onClick={addLine} disabled={!materials.length}>添加材料</button>}</>;
}
function EmptyRow({ colSpan, text = "暂无数据" }) { return <tr><td className="empty-cell" colSpan={colSpan}>{text}</td></tr>; }
