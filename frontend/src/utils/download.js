// Client-side export helpers (no backend changes needed).

// Cells that start with = + - @ can be run as formulas by Excel; prefix them so
// untrusted text (e.g. paper titles from external providers) stays plain text.
function cell(v) {
  if (v === null || v === undefined) return "";
  let s = typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return `"${s.replace(/"/g, '""')}"`;
}

export function toCSV(rows, columns) {
  const head = columns.map((c) => cell(c.label)).join(",");
  const body = rows.map((r) => columns.map((c) => cell(c.get(r))).join(","));
  return [head, ...body].join("\r\n");
}

export function downloadFile(filename, content, mime) {
  // BOM lets Excel open UTF-8 CSV correctly.
  const prefix = mime.startsWith("text/csv") ? "\uFEFF" : "";
  const blob = new Blob([prefix + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const stamp = () => new Date().toISOString().slice(0, 10);
