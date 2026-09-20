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
  const [selectedBomId, setSelectedBomId] = useState(null);
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
  const title = { dashboard: "工作台", items: "Item 管理", boms: "BOM 管理", "bom-detail": "BOM 详情", "bom-new": "新建 BOM" }[page];
  const openBomDetail = (id) => {
    setSelectedBomId(id);
    setPage("bom-detail");
  };

  return <div className="desk">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark">B</span><div><strong>BOM 教学 Demo</strong><small>Manufacturing</small></div></div>
      <p className="nav-group">制造</p>
      <nav>
        <button className={page === "dashboard" ? "active" : ""} onClick={() => setPage("dashboard")}>工作台</button>
        <button className={page === "items" ? "active" : ""} onClick={() => setPage("items")}>Item 管理</button>
        <button className={page === "boms" || page === "bom-detail" || page === "bom-new" ? "active" : ""} onClick={() => setPage("boms")}>BOM 管理</button>
      </nav>
      <div className="sidebar-note">课程演示版<br />仅展示物料与 BOM 核心流程</div>
    </aside>
    <main>
      <header className="topbar"><div><p className="breadcrumb">制造 / {title}</p><h1>{title}</h1></div><button className="button secondary" onClick={refresh} disabled={loading}>{loading ? "正在刷新…" : "刷新数据"}</button></header>
      {error && <div className="alert">无法读取数据：{error}</div>}
      {page === "dashboard" && <Dashboard items={items} boms={boms} loading={loading} setPage={setPage} openBomDetail={openBomDetail} />}
      {page === "items" && <ItemsPage items={items} refresh={refresh} />}
      {page === "boms" && <BomsPage boms={boms} openBomDetail={openBomDetail} onNew={() => setPage("bom-new")} />}
      {page === "bom-detail" && <BomDetailPage bomId={selectedBomId} onBack={() => setPage("boms")} />}
      {page === "bom-new" && <NewBomPage items={items} refresh={refresh} onCancel={() => setPage("boms")} onSaved={() => setPage("boms")} />}
    </main>
  </div>;
}

function Dashboard({ items, boms, loading, setPage, openBomDetail }) {
  const productCount = items.filter((item) => item.item_type === "finished").length;
  return <section className="page-content">
    <p className="page-intro">从 Item 开始，创建 BOM，再为 BOM 添加材料。这里展示的是一层 BOM 的基础教学流程。</p>
    <div className="metric-grid"><Metric label="Item 总数" value={items.length} /><Metric label="产品数量" value={productCount} /><Metric label="BOM 数量" value={boms.length} /></div>
    <div className="panel quick-start"><div><h2>建议演示顺序</h2><p>先建立产品与原材料，再创建一张 BOM，最后在详情中查看材料清单。</p></div><div className="button-row"><button className="button secondary" onClick={() => setPage("items")}>管理 Item</button><button className="button" onClick={() => setPage("boms")}>管理 BOM</button></div></div>
    <section className="panel table-panel"><div className="panel-heading"><h2>最近 BOM</h2><span>{loading ? "加载中" : `${boms.length} 条记录`}</span></div><BomTable boms={boms.slice(0, 5)} onOpen={openBomDetail} /></section>
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

function BomsPage({ boms, openBomDetail, onNew }) {
  return <section className="page-content"><div className="section-toolbar"><p>BOM 定义一个产品由哪些材料组成。点击任意 BOM 可查看完整基础信息和材料清单。</p><button className="button" onClick={onNew}>新建 BOM</button></div>
    <section className="panel table-panel"><div className="panel-heading"><h2>BOM 列表</h2><span>{boms.length} 条记录</span></div><div className="table-scroll"><BomTable boms={boms} onOpen={openBomDetail} /></div></section>
  </section>;
}
function BomTable({ boms, onOpen }) { return <table><thead><tr><th>BOM 编号</th><th>BOM 名称</th><th>产品</th><th>创建时间</th><th>操作</th></tr></thead><tbody>{boms.map((bom) => <tr key={bom.id} className={onOpen ? "clickable-row" : ""} onClick={() => onOpen?.(bom.id)}><td className="code">{bom.bom_code}</td><td>{bom.name}</td><td>{bom.item_name}</td><td>{formatDate(bom.created_at)}</td><td>{onOpen ? <button className="table-action" onClick={(event) => { event.stopPropagation(); onOpen(bom.id); }}>查看</button> : "—"}</td></tr>)}{!boms.length && <EmptyRow colSpan={5} />}</tbody></table>; }

function NewBomPage({ items, refresh, onCancel, onSaved }) {
  const makeable = useMemo(() => items.filter((item) => item.item_type !== "purchased"), [items]);
  const materials = useMemo(() => items.filter((item) => item.item_type === "purchased"||item.item_type === "finished" ||item.item_type === "semi"), [items]);
  const [form, setForm] = useState({ name: "", item_id: "", quantity: "1", lines: [] });
  const [saving, setSaving] = useState(false); const [error, setError] = useState("");
  useEffect(() => {
    if (!form.item_id && makeable[0]) setForm((current) => ({ ...current, item_id: String(makeable[0].id) }));
  }, [form.item_id, makeable]);
  function addLine() {
    if (!materials[0]) return;
    setForm((current) => ({ ...current, lines: [...current.lines, { item_id: String(materials[0].id), qty: "1", uom: materials[0].uom }] }));
  }
  function updateLine(index, key, value) {
    setForm((current) => {
      const lines = [...current.lines];
      const line = { ...lines[index], [key]: value };
      if (key === "item_id") line.uom = materials.find((item) => item.id === Number(value))?.uom || line.uom;
      lines[index] = line;
      return { ...current, lines };
    });
  }
  async function saveBom(event) {
    event.preventDefault(); setError("");
    if (!form.name.trim()) { setError("请输入 BOM 名称。"); return; }
    if (!form.item_id) { setError("请选择产品 Item。"); return; }
    if (Number(form.quantity) <= 0 || form.lines.some((line) => Number(line.qty) <= 0)) { setError("BOM 数量和材料数量必须大于 0。"); return; }
    try {
      setSaving(true);
      await api.createBom({ name: form.name.trim(), item_id: Number(form.item_id), quantity: Number(form.quantity), notes: "", lines: form.lines.map((line) => ({ item_id: Number(line.item_id), qty: Number(line.qty), uom: line.uom, scrap_pct: 0, explode: false })), operations: [] });
      await refresh();
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  return <section className="page-content bom-editor-page"><form onSubmit={saveBom}><section className="panel editor-card"><div className="panel-heading"><h2>基础信息</h2></div><div className="editor-body"><label>BOM 名称<input required maxLength="200" placeholder="例如：咖啡机主体装配 BOM" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><div className="form-grid"><label>产品 Item<select required value={form.item_id} onChange={(event) => setForm({ ...form, item_id: event.target.value })}><option value="">请选择产品</option>{makeable.map((item) => <option key={item.id} value={item.id}>{item.code} {item.name}</option>)}</select></label><label>BOM 数量<input required type="number" min="0.001" step="0.001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label></div></div></section>
    <section className="panel editor-card components-editor"><div className="panel-heading"><h2>Components（材料清单）</h2><button type="button" className="button secondary" onClick={addLine} disabled={!materials.length}>添加材料</button></div><div className="table-scroll"><table><thead><tr><th>序号</th><th>Item</th><th>数量</th><th>操作</th></tr></thead><tbody>{form.lines.map((line, index) => <tr key={index}><td>{String(index + 1).padStart(3, "0")}</td><td><select value={line.item_id} onChange={(event) => updateLine(index, "item_id", event.target.value)}>{materials.map((item) => <option key={item.id} value={item.id}>{item.code} {item.name}</option>)}</select></td><td><input required type="number" min="0.001" step="0.001" value={line.qty} onChange={(event) => updateLine(index, "qty", event.target.value)} /></td><td><button type="button" className="table-action danger" onClick={() => setForm({ ...form, lines: form.lines.filter((_, lineIndex) => lineIndex !== index) })}>移除</button></td></tr>)}{!form.lines.length && <EmptyRow colSpan={4} text="尚未添加材料" />}</tbody></table></div></section>
    {error && <div className="alert">保存失败：{error}</div>}<div className="form-actions"><button type="button" className="button secondary" onClick={onCancel}>取消</button><button className="button" type="submit" disabled={saving || !makeable.length}>{saving ? "正在保存…" : "保存 BOM"}</button></div></form></section>;
}

function BomDetailPage({ bomId, onBack }) {
  const [detail, setDetail] = useState(null); const [error, setError] = useState(""); const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!bomId) return;
    setLoading(true); setError("");
    api.bom(bomId).then(setDetail).catch((err) => setError(err.message)).finally(() => setLoading(false));
  }, [bomId]);
  return <section className="page-content bom-detail-page"><button className="button secondary back-button" onClick={onBack}>← 返回 BOM 列表</button>
    {loading && <section className="panel loading-panel">正在加载 BOM 详情…</section>}
    {error && <div className="alert">无法读取 BOM 详情：{error}</div>}
    {detail && <><section className="panel detail-card"><div className="detail-card-heading"><div><p className="eyebrow">BOM 详情</p><h2>{detail.name}</h2></div><span className="tag status-tag">{detail.status === "submitted" ? "已提交" : "草稿"}</span></div><h3>基础信息</h3><div className="info-grid"><InfoField label="BOM 编号" value={detail.bom_code} /><InfoField label="BOM 名称" value={detail.name} /><InfoField label="制造产品" value={detail.item_name} /><InfoField label="产品编号" value={detail.item_code || "—"} /><InfoField label="创建时间" value={formatDate(detail.created_at)} /><InfoField label="当前状态" value={detail.status === "submitted" ? "已提交" : "草稿"} /></div></section>
      <section className="panel components-card"><div className="panel-heading"><h2>Components（材料清单）</h2><span>{detail.lines.length} 条记录</span></div><div className="table-scroll"><table><thead><tr><th>序号</th><th>Item 编号</th><th>Item 名称</th><th>数量</th></tr></thead><tbody>{detail.lines.map((line, index) => <tr key={line.id}><td>{String(index + 1).padStart(3, "0")}</td><td className="code">{line.item_code}</td><td>{line.item_name}</td><td>{line.qty} {line.uom}</td></tr>)}{!detail.lines.length && <EmptyRow colSpan={4} text="尚未添加材料" />}</tbody></table></div></section></>}
  </section>;
}
function InfoField({ label, value }) { return <div className="info-field"><span>{label}</span><strong>{value}</strong></div>; }
function EmptyRow({ colSpan, text = "暂无数据" }) { return <tr><td className="empty-cell" colSpan={colSpan}>{text}</td></tr>; }
