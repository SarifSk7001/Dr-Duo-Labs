const BASE = import.meta.env.VITE_API_URL || "http://localhost:8000/api/v1";

export const session = {
  get token() { return localStorage.getItem("token"); },
  get user() { try { return JSON.parse(localStorage.getItem("user")); } catch { return null; } },
  save(data) { localStorage.setItem("token", data.access_token); localStorage.setItem("user", JSON.stringify(data.user)); },
  clear() { localStorage.removeItem("token"); localStorage.removeItem("user"); },
};

async function request(path, { method = "GET", body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && session.token) {
    session.clear();
    window.location.href = "/login";
  }
  if (res.status === 429) {
    const retryAfter = res.headers.get("Retry-After") || "60";
    let msg = `Too many requests — please wait ${retryAfter}s before trying again.`;
    try { const d = await res.json(); if (d.detail) msg = d.detail; } catch { /* keep */ }
    const err = new Error(msg);
    err.status = 429;
    throw err;
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const data = await res.json();
      detail = typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail);
    } catch { /* keep statusText */ }
    throw new Error(detail);
  }
  return res.status === 204 ? null : res.json();
}

export const api = {
  get: (p) => request(p),
  post: (p, body) => request(p, { method: "POST", body }),
  patch: (p, body) => request(p, { method: "PATCH", body }),
  del: (p) => request(p, { method: "DELETE" }),

  // Convenience wrappers
  versions: (expId) => request(`/experiments/${expId}/versions`),
  auditLog: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/experiments/audit-log/entries${q ? `?${q}` : ""}`);
  },

  // External literature
  searchExternal: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return request(`/search/external${q ? `?${q}` : ""}`);
  },
  getExternalSource: (id) => request(`/external/${id}`),
  trendingExternal: (limit = 5) => request(`/external/trending?limit=${limit}`),
  importExternal: (id) => request(`/external/${id}/import`, { method: "POST" }),

  // Evidence files
  listFiles: (expId) => request(`/experiments/${expId}/files`),
  deleteFile: (expId, fileId) => request(`/experiments/${expId}/files/${fileId}`, { method: "DELETE" }),
  previewCsv: (expId, fileId) => request(`/experiments/${expId}/files/${fileId}/preview`),
  uploadFile: (expId, formData) => {
    const token = session.token;
    return fetch(`${BASE}/experiments/${expId}/files`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    }).then(async (res) => {
      if (res.status === 429) {
        const retryAfter = res.headers.get("Retry-After") || "60";
        throw new Error(`Too many requests — please wait ${retryAfter}s.`);
      }
      if (!res.ok) {
        let detail = res.statusText;
        try { const d = await res.json(); if (d.detail) detail = d.detail; } catch { /* keep */ }
        throw new Error(detail);
      }
      return res.json();
    });
  },
};

// "key: value" lines <-> object helpers used by forms
export function parseKV(text) {
  const out = {};
  text.split("\n").forEach((line) => {
    const i = line.indexOf(":");
    if (i > 0) {
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).trim();
      if (k) out[k] = v === "" ? "" : isNaN(Number(v)) ? (v === "true" ? true : v === "false" ? false : v) : Number(v);
    }
  });
  return out;
}
export const kvToText = (obj = {}) => Object.entries(obj).map(([k, v]) => `${k}: ${v}`).join("\n");
