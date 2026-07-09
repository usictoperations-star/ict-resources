import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export type ExportColumn = {
  key: string;
  label: string;
  format?: (value: unknown) => string;
};

function cellValue(row: Record<string, unknown>, col: ExportColumn): string {
  const raw = row[col.key];
  if (col.format) return col.format(raw);
  if (raw === null || raw === undefined) return "";
  if (typeof raw === "boolean") return raw ? "Yes" : "No";
  return String(raw);
}

function toMatrix(rows: Record<string, unknown>[], cols: ExportColumn[]): string[][] {
  const headers = cols.map(c => c.label);
  const body = rows.map(row => cols.map(col => cellValue(row, col)));
  return [headers, ...body];
}

// ── CSV ──────────────────────────────────────────────────────────────────────
export function exportCSV(
  rows: Record<string, unknown>[],
  cols: ExportColumn[],
  filename: string,
) {
  const matrix = toMatrix(rows, cols);
  const csv = matrix
    .map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  triggerDownload(blob, `${filename}.csv`);
}

// ── Excel ─────────────────────────────────────────────────────────────────────
export function exportExcel(
  rows: Record<string, unknown>[],
  cols: ExportColumn[],
  filename: string,
  title: string,
) {
  const matrix = toMatrix(rows, cols);
  const ws = XLSX.utils.aoa_to_sheet(matrix);

  // Bold the header row
  const headerRange = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let c = headerRange.s.c; c <= headerRange.e.c; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = { font: { bold: true } };
  }

  // Auto column widths
  ws["!cols"] = cols.map((_, ci) => ({
    wch: Math.min(
      40,
      Math.max(
        cols[ci].label.length + 2,
        ...rows.map(r => cellValue(r, cols[ci]).length),
      ),
    ),
  }));

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, title.slice(0, 31));
  XLSX.writeFile(wb, `${filename}.xlsx`);
}

// ── Google Sheets (CSV download with hint) ────────────────────────────────────
export function exportGoogleSheets(
  rows: Record<string, unknown>[],
  cols: ExportColumn[],
  filename: string,
) {
  exportCSV(rows, cols, filename);
}

// ── PDF ───────────────────────────────────────────────────────────────────────
export function exportPDF(
  rows: Record<string, unknown>[],
  cols: ExportColumn[],
  filename: string,
  title: string,
) {
  const doc = new jsPDF({ orientation: cols.length > 6 ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();

  // Header bar
  doc.setFillColor(15, 45, 92);
  doc.rect(0, 0, pageW, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("MK Digital Operations Center", 10, 8);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(title, 10, 14);

  // Date
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(8);
  const now = new Date().toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" });
  doc.text(`Generated: ${now}`, pageW - 10, 14, { align: "right" });

  // Table
  const headers = cols.map(c => c.label);
  const body = rows.map(row => cols.map(col => cellValue(row, col)));

  autoTable(doc, {
    head: [headers],
    body,
    startY: 22,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: 2, overflow: "linebreak" },
    headStyles: { fillColor: [15, 45, 92], textColor: 255, fontStyle: "bold", fontSize: 8 },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: Object.fromEntries(cols.map((_, i) => [i, { cellWidth: "auto" }])),
    margin: { left: 10, right: 10 },
    didDrawPage: (data) => {
      const pg = doc.getCurrentPageInfo().pageNumber;
      const total = (doc as any).internal.getNumberOfPages?.() ?? "?";
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Page ${pg}  ·  ${rows.length} records`,
        pageW / 2,
        doc.internal.pageSize.getHeight() - 5,
        { align: "center" },
      );
    },
  });

  doc.save(`${filename}.pdf`);
}

// ── helper ────────────────────────────────────────────────────────────────────
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
