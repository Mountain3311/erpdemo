import { useEffect, useMemo, useState } from "react";
import { api } from "./api";

const TYPE_LABEL = { purchased: "原材料", semi: "半成品", finished: "产品" };

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString("zh-CN") : "—";
}

// 金额与用量格式化：成本接口返回的是 number，缺失时按 0 处理，避免出现 NaN。
function formatMoney(value) {
  return Number(value || 0).toFixed(2);
}

function formatQty(value) {
  const num = Number(value || 0);
  return Number.isInteger(num) ? String(num) : num.toFixed(3).replace(/0+$/, "").replace(/\.$/, "");
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
function BomTable({ boms, onOpen }) { return <table><thead><tr><th>BOM 编号</th><th>BOM 名称</th><th>产品</th><th>材料行</th><th className="num">总成本</th><th>创建时间</th><th>操作</th></tr></thead><tbody>{boms.map((bom) => <tr key={bom.id} className={onOpen ? "clickable-row" : ""} onClick={() => onOpen?.(bom.id)}><td className="code">{bom.bom_code}</td><td>{bom.name}</td><td>{bom.item_name}</td><td>{bom.line_count === 0 ? <span className="tag">空（未加材料）</span> : `${bom.line_count} 行`}</td><td className="num">{formatMoney(bom.total_cost)}</td><td>{formatDate(bom.created_at)}</td><td>{onOpen ? <button className="table-action" onClick={(event) => { event.stopPropagation(); onOpen(bom.id); }}>查看</button> : "—"}</td></tr>)}{!boms.length && <EmptyRow colSpan={7} />}</tbody></table>; }

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
    setForm((current) => ({ ...current, lines: [...current.lines, { item_id: String(materials[0].id), qty: "1", uom: materials[0].uom, explode: true }] }));
  }
  function updateLine(index, key, value) {
    setError("");
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
      await api.createBom({ name: form.name.trim(), item_id: Number(form.item_id), quantity: Number(form.quantity), notes: "", lines: form.lines.map((line) => ({ item_id: Number(line.item_id), qty: Number(line.qty), uom: line.uom, scrap_pct: 0, explode: line.explode !== false })), operations: [] });
      await refresh();
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }
  return <section className="page-content bom-editor-page"><form onSubmit={saveBom}><section className="panel editor-card"><div className="panel-heading"><h2>基础信息</h2></div><div className="editor-body"><label>BOM 名称<input required maxLength="200" placeholder="例如：咖啡机主体装配 BOM" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label><div className="form-grid"><label>产品 Item<select required value={form.item_id} onChange={(event) => setForm({ ...form, item_id: event.target.value })}><option value="">请选择产品</option>{makeable.map((item) => <option key={item.id} value={item.id}>{item.code} {item.name}</option>)}</select></label><label>BOM 数量<input required type="number" min="0.001" step="0.001" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label></div></div></section>
    <section className="panel editor-card components-editor"><div className="panel-heading"><h2>Components（材料清单）</h2><button type="button" className="button secondary" onClick={addLine} disabled={!materials.length}>添加材料</button></div><div className="table-scroll"><table><thead><tr><th>序号</th><th>Item</th><th>数量</th><th>展开子 BOM</th><th>操作</th></tr></thead><tbody>{form.lines.map((line, index) => <tr key={index}><td>{String(index + 1).padStart(3, "0")}</td><td><select value={line.item_id} onChange={(event) => updateLine(index, "item_id", event.target.value)}>{materials.map((item) => <option key={item.id} value={item.id}>{item.code} {item.name}</option>)}</select></td><td><input required type="number" min="0.001" step="0.001" value={line.qty} onChange={(event) => updateLine(index, "qty", event.target.value)} /></td><td><label className="explode-toggle"><input type="checkbox" checked={line.explode !== false} onChange={(event) => updateLine(index, "explode", event.target.checked)} /><span>展开</span></label></td><td><button type="button" className="table-action danger" onClick={() => setForm({ ...form, lines: form.lines.filter((_, lineIndex) => lineIndex !== index) })}>移除</button></td></tr>)}{!form.lines.length && <EmptyRow colSpan={5} text="尚未添加材料" />}</tbody></table></div><p className="panel-hint">勾选“展开”的材料行，若该 Item 已有<strong>已提交</strong>的 BOM，成本会继续向下递归汇总；未勾选则按该 Item 自身的单价计价。</p></section>
    {error && <div className="alert">保存失败：{error}</div>}<div className="form-actions"><button type="button" className="button secondary" onClick={onCancel}>取消</button><button className="button" type="submit" disabled={saving || !makeable.length}>{saving ? "正在保存…" : "保存 BOM"}</button></div></form></section>;
}

function BomDetailPage({ bomId, onBack }) {
  const [detail, setDetail] = useState(null); const [cost, setCost] = useState(null);
  const [error, setError] = useState(""); const [submitError, setSubmitError] = useState("");
  const [loading, setLoading] = useState(true); const [submitting, setSubmitting] = useState(false);
  // 工序管理：opForm 为新增表单，editingOpId + opDraft 为行内编辑状态。
  const [opForm, setOpForm] = useState({ name: "", hours: "", rate_per_hour: "" });
  const [editingOpId, setEditingOpId] = useState(null);
  const [opDraft, setOpDraft] = useState({ name: "", hours: "", rate_per_hour: "" });
  const [opError, setOpError] = useState(""); const [opSaving, setOpSaving] = useState(false);

  // 详情与成本一次并发取回：成本由后端 /cost 接口递归 Roll-up 计算，前端不做任何计算。
  async function load() {
    if (!bomId) return;
    setLoading(true); setError("");
    try {
      const [bomData, costData] = await Promise.all([api.bom(bomId), api.cost(bomId)]);
      setDetail(bomData); setCost(costData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [bomId]);

  // 提交草稿：后端状态变为 submitted 后，上级 BOM 才会把本件递归展开，因此提交成功后必须重新取成本。
  async function submitBom() {
    setSubmitError(""); setSubmitting(true);
    try {
      await api.submitBom(bomId);
      await load();
    } catch (err) {
      setSubmitError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // 工序增删改：写完后统一 load() 重新取详情与成本，成本的组成始终以后端为准。
  function opPayload(source, sequence) {
    return { sequence, name: source.name.trim(), hours: Number(source.hours) || 0, rate_per_hour: Number(source.rate_per_hour) || 0 };
  }

  // 新增工序时接在当前最大序号之后；编辑时保留原序号，避免覆盖已有排序。
  function nextSequence() {
    return (detail?.operations || []).reduce((max, op) => Math.max(max, Number(op.sequence) || 0), 0) + 1;
  }

  async function addOperation(event) {
    event.preventDefault(); setOpError("");
    if (!opForm.name.trim()) { setOpError("请输入工序名称。"); return; }
    if (Number(opForm.hours) < 0 || Number(opForm.rate_per_hour) < 0) { setOpError("工时和费率不能为负数。"); return; }
    try {
      setOpSaving(true);
      await api.createOperation(bomId, opPayload(opForm, nextSequence()));
      setOpForm({ name: "", hours: "", rate_per_hour: "" });
      await load();
    } catch (err) {
      setOpError(err.message);
    } finally {
      setOpSaving(false);
    }
  }

  function startEditOperation(op) {
    setOpError("");
    setEditingOpId(op.id);
    setOpDraft({ name: op.name, hours: String(op.hours), rate_per_hour: String(op.rate_per_hour), sequence: op.sequence });
  }

  async function saveOperation(opId) {
    setOpError("");
    if (!opDraft.name.trim()) { setOpError("请输入工序名称。"); return; }
    try {
      setOpSaving(true);
      await api.updateOperation(bomId, opId, opPayload(opDraft, opDraft.sequence));
      setEditingOpId(null);
      await load();
    } catch (err) {
      setOpError(err.message);
    } finally {
      setOpSaving(false);
    }
  }

  async function removeOperation(opId) {
    setOpError("");
    try {
      setOpSaving(true);
      await api.deleteOperation(bomId, opId);
      if (editingOpId === opId) setEditingOpId(null);
      await load();
    } catch (err) {
      setOpError(err.message);
    } finally {
      setOpSaving(false);
    }
  }

  const isDraft = detail?.status !== "submitted";
  // 该 BOM 自身维护的工序（可增删改）；成本接口的 operations 是所有层级的汇总，两者不同。
  const ownOperations = detail?.operations || [];
  const exploded = cost?.exploded || [];
  // 展开后最末级物料的料费合计（等于后端 flatten_purchased 的结果）。
  const explodedTotal = exploded.reduce((sum, row) => sum + Number(row.extended_cost || 0), 0);
  const operations = cost?.operations || [];
  // cost 接口的 operations 已包含各级 BOM 的工序，工序名形如 "<item_code> / <工序名>"。
  // 本层工序 = 属于当前产品的那些；其余即为下级 BOM 被卷积进来的工序。
  const ownPrefix = detail ? `${detail.item_code} / ` : "";
  const ownOperationCost = operations
    .filter((op) => (op.name || "").startsWith(ownPrefix))
    .reduce((sum, op) => sum + Number(op.cost || 0), 0);
  const childOperationCost = operations
    .filter((op) => !(op.name || "").startsWith(ownPrefix))
    .reduce((sum, op) => sum + Number(op.cost || 0), 0);

  return <section className="page-content bom-detail-page"><button className="button secondary back-button" onClick={onBack}>← 返回 BOM 列表</button>
    {loading && <section className="panel loading-panel">正在加载 BOM 详情与成本…</section>}
    {error && <div className="alert">无法读取 BOM 详情：{error}</div>}
    {detail && <>
      <section className="panel detail-card"><div className="detail-card-heading"><div><p className="eyebrow">BOM 详情</p><h2>{detail.name}</h2></div><span className="tag status-tag">{isDraft ? "草稿" : "已提交"}</span></div><h3>基础信息</h3><div className="info-grid"><InfoField label="BOM 编号" value={detail.bom_code} /><InfoField label="BOM 名称" value={detail.name} /><InfoField label="制造产品" value={detail.item_name} /><InfoField label="产品编号" value={detail.item_code || "—"} /><InfoField label="创建时间" value={formatDate(detail.created_at)} /><InfoField label="当前状态" value={isDraft ? "草稿" : "已提交"} /></div>
        <div className="submit-bar">{isDraft ? <><p className="panel-hint">草稿可继续修改。提交后 BOM 将被冻结，并参与上级 BOM 的成本展开。</p><button className="button" onClick={submitBom} disabled={submitting}>{submitting ? "正在提交…" : "提交 BOM"}</button></> : <p className="panel-hint">本 BOM 已提交并冻结。上级 BOM 展开成本时会使用这张已提交的版本。</p>}</div>
        {submitError && <div className="alert">提交失败：{submitError}</div>}
      </section>
      {cost && <section className="panel cost-card"><div className="panel-heading"><h2>成本汇总（Cost Roll-up）</h2><span>材料成本 + 工序成本，全部来自后端 /cost</span></div><div className="info-grid cost-grid"><InfoField label="材料成本 Material Cost" value={formatMoney(cost.material_cost)} numeric /><InfoField label="工序成本 Operation Cost" value={formatMoney(cost.operation_cost)} numeric /><InfoField label="总成本 Total Cost" value={formatMoney(cost.total_cost)} numeric /><InfoField label="单位成本 Unit Cost" value={formatMoney(cost.unit_cost)} numeric /></div>
        <div className="cost-breakdown">
          <div><span>材料成本（展开后采购件合计）</span><strong className="num">{formatMoney(cost.material_cost)}</strong></div>
          <div><span>本层工序 Own Operation</span><strong className="num">{formatMoney(ownOperationCost)}</strong></div>
          <div><span>下级 BOM 工序 Child BOM Operation</span><strong className="num">{formatMoney(childOperationCost)}</strong></div>
          <div><span>工序成本合计 Operation Cost</span><strong className="num">{formatMoney(cost.operation_cost)}</strong></div>
          <div className="cost-breakdown-total"><span>总成本 Total Cost = 材料 + 工序</span><strong className="num">{formatMoney(cost.total_cost)}</strong></div>
        </div>
        <div className="table-scroll cost-ops-scroll"><table><thead><tr><th>序号</th><th>工序（含下级 BOM）</th><th className="num">工时 (h)</th><th className="num">小时费率</th><th className="num">工序成本</th></tr></thead><tbody>
          {operations.map((op, index) => <tr key={`${op.name}-${index}`}><td>{String(index + 1).padStart(3, "0")}</td><td>{op.name}</td><td className="num">{formatQty(op.hours)}</td><td className="num">{formatMoney(op.rate_per_hour)}</td><td className="num">{formatMoney(op.cost)}</td></tr>)}
          {!operations.length && <EmptyRow colSpan={5} text="暂无工序，工序成本为 0" />}
          {operations.length > 0 && <tr className="total-row"><td colSpan={4}>工序成本合计（含下级 BOM）</td><td className="num">{formatMoney(cost.operation_cost)}</td></tr>}
        </tbody></table></div>
        <p className="panel-hint">{isDraft ? "当前为草稿：下级半成品若不处于已提交状态，不会继续向下展开。请先提交下级 BOM。" : "材料成本只累加展开后的最终采购件，不含中间层装配件，避免重复计算；工序成本 = 本层工序 + 全部下级 BOM 工序。"}</p>
      </section>}
      {cost && <section className="panel cost-card"><div className="panel-heading"><h2>材料成本明细（BOM Explosion）</h2><span>{exploded.length} 条材料记录</span></div><div className="table-scroll"><table><thead><tr><th>序号</th><th>物料编码</th><th>物料名称</th><th>类型</th><th className="num">数量</th><th className="num">单位成本</th><th className="num">金额</th></tr></thead><tbody>{exploded.map((row, index) => <tr key={row.item_id}><td>{String(index + 1).padStart(3, "0")}</td><td className="code">{row.item_code}</td><td>{row.item_name}</td><td><span className="tag">{TYPE_LABEL[row.item_type] || row.item_type}</span></td><td className="num">{formatQty(row.qty)} {row.uom}</td><td className="num">{formatMoney(row.unit_cost)}</td><td className="num">{formatMoney(row.extended_cost)}</td></tr>)}{!exploded.length && <EmptyRow colSpan={7} text="暂无展开后的材料，请先为该 BOM 添加材料行" />}{exploded.length > 0 && <tr className="total-row"><td colSpan={6}>展开后材料合计（数量 × 单位成本）</td><td className="num">{formatMoney(explodedTotal)}</td></tr>}</tbody></table></div>
        <p className="panel-hint">展开表只列出最末级物料：生产件若有“已提交”的 BOM，会被继续展开为它下面的采购件，因此这里看到的是 BOM Explosion 后的净需求与料费。同一物料若在多条分支上出现，会按物料合并成一行。</p>
      </section>}
      <section className="panel operations-card"><div className="panel-heading"><h2>Operations（本 BOM 工序）</h2><span>{ownOperations.length} 条工序</span></div>
        <div className="table-scroll"><table><thead><tr><th>序号</th><th>工序名称</th><th className="num">工时 (h)</th><th className="num">小时费率</th><th className="num">工序成本</th><th>操作</th></tr></thead><tbody>
          {ownOperations.map((op, index) => editingOpId === op.id
            ? <tr key={op.id}><td>{String(index + 1).padStart(3, "0")}</td>
                <td><input value={opDraft.name} onChange={(e) => setOpDraft({ ...opDraft, name: e.target.value })} /></td>
                <td><input type="number" min="0" step="0.01" value={opDraft.hours} onChange={(e) => setOpDraft({ ...opDraft, hours: e.target.value })} /></td>
                <td><input type="number" min="0" step="0.01" value={opDraft.rate_per_hour} onChange={(e) => setOpDraft({ ...opDraft, rate_per_hour: e.target.value })} /></td>
                <td className="num">{formatMoney((Number(opDraft.hours) || 0) * (Number(opDraft.rate_per_hour) || 0))}</td>
                <td><button type="button" className="table-action" onClick={() => saveOperation(op.id)} disabled={opSaving}>保存</button><button type="button" className="table-action" onClick={() => setEditingOpId(null)}>取消</button></td></tr>
            : <tr key={op.id}><td>{String(index + 1).padStart(3, "0")}</td><td>{op.name}</td><td className="num">{formatQty(op.hours)}</td><td className="num">{formatMoney(op.rate_per_hour)}</td><td className="num">{formatMoney(op.cost)}</td>
                <td>{isDraft ? <><button type="button" className="table-action" onClick={() => startEditOperation(op)}>编辑</button><button type="button" className="table-action danger" onClick={() => removeOperation(op.id)} disabled={opSaving}>删除</button></> : "—"}</td></tr>)}
          {!ownOperations.length && <EmptyRow colSpan={6} text="该 BOM 尚未维护工序，工序成本为 0" />}
          {ownOperations.length > 0 && <tr className="total-row"><td colSpan={4}>本层工序成本合计</td><td className="num">{formatMoney(ownOperationCost)}</td><td /></tr>}
        </tbody></table></div>
        {isDraft && <form className="op-form" onSubmit={addOperation}>
          <label>工序名称<input required value={opForm.name} placeholder="例如：Final assembly" onChange={(e) => setOpForm({ ...opForm, name: e.target.value })} /></label>
          <label>工时 (h)<input required type="number" min="0" step="0.01" value={opForm.hours} onChange={(e) => setOpForm({ ...opForm, hours: e.target.value })} /></label>
          <label>小时费率<input required type="number" min="0" step="0.01" value={opForm.rate_per_hour} onChange={(e) => setOpForm({ ...opForm, rate_per_hour: e.target.value })} /></label>
          <div className="op-form-cost"><span>工序成本</span><strong>{formatMoney((Number(opForm.hours) || 0) * (Number(opForm.rate_per_hour) || 0))}</strong></div>
          <button className="button" type="submit" disabled={opSaving}>{opSaving ? "正在保存…" : "添加工序"}</button>
        </form>}
        {!isDraft && <p className="panel-hint">已提交的 BOM 已冻结，工序不可修改。需要调整请新建版本。</p>}
        {opError && <div className="alert">工序操作失败：{opError}</div>}
        <p className="panel-hint">本层工序成本 = 工时 × 小时费率。它会与所有下级 BOM 的工序成本一起汇入上方的「工序成本」，并参与总成本计算。</p>
      </section>
      <section className="panel components-card"><div className="panel-heading"><h2>Components（直接材料清单）</h2><span>{detail.lines.length} 条记录</span></div><div className="table-scroll"><table><thead><tr><th>序号</th><th>Item 编号</th><th>Item 名称</th><th className="num">单位用量</th><th className="num">含损耗需用量</th><th className="num">单位成本</th></tr></thead><tbody>{detail.lines.map((line, index) => <tr key={line.id}><td>{String(index + 1).padStart(3, "0")}</td><td className="code">{line.item_code}</td><td>{line.item_name}</td><td className="num">{formatQty(line.qty)} {line.uom}</td><td className="num">{formatQty(line.required_qty)} {line.uom}</td><td className="num">{formatMoney(line.unit_cost)}</td></tr>)}{!detail.lines.length && <EmptyRow colSpan={6} text="尚未添加材料" />}</tbody></table></div>
        <p className="panel-hint">这里是该 BOM 直接维护的一层子件；“含损耗需用量”已按该行的损耗率放大。其中勾选了“展开子 BOM”且已有已提交 BOM 的生产件，会在上面的成本明细中被继续展开。</p>
      </section>
    </>}
  </section>;
}
function InfoField({ label, value, numeric }) { return <div className="info-field"><span>{label}</span><strong className={numeric ? "num" : ""}>{value}</strong></div>; }
function EmptyRow({ colSpan, text = "暂无数据" }) { return <tr><td className="empty-cell" colSpan={colSpan}>{text}</td></tr>; }
