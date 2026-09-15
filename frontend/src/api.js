const headers = { "Content-Type": "application/json" };

async function request(path, options = {}) {
  const res = await fetch(path, { headers, ...options });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { detail: text };
  }
  if (!res.ok) {
    const detail = data?.detail;
    const message = Array.isArray(detail) ? detail.map((d) => d.msg).join("; ") : detail || res.statusText;
    throw new Error(message);
  }
  return data;
}

export const api = {
  items: () => request("/api/items"),
  createItem: (body) => request("/api/items", { method: "POST", body: JSON.stringify(body) }),
  boms: () => request("/api/boms"),
  bom: (id) => request(`/api/boms/${id}`),
  createBom: (body) => request("/api/boms", { method: "POST", body: JSON.stringify(body) }),
  updateBom: (id, body) => request(`/api/boms/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  submitBom: (id) => request(`/api/boms/${id}/submit`, { method: "POST" }),
  newVersion: (id) => request(`/api/boms/${id}/new-version`, { method: "POST" }),
  tree: (id) => request(`/api/boms/${id}/tree`),
  exploded: (id) => request(`/api/boms/${id}/exploded`),
  cost: (id) => request(`/api/boms/${id}/cost`),
};
