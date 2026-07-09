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
  const landscape = cols.length > 6;
  const doc = new jsPDF({ orientation: landscape ? "landscape" : "portrait", unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const marginH = 10;
  const availableW = pageW - marginH * 2;

  // Header bar
  doc.setFillColor(15, 45, 92);
  doc.rect(0, 0, pageW, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text("MK Digital Operations Center", marginH, 8);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(title, marginH, 14);

  // Date
  doc.setTextColor(180, 180, 180);
  doc.setFontSize(8);
  const now = new Date().toLocaleString("en-MY", { dateStyle: "medium", timeStyle: "short" });
  doc.text(`Generated: ${now}`, pageW - marginH, 14, { align: "right" });

  // Compute proportional column widths so headers always fit
  // Weight = max(header chars, median content chars), minimum = header length
  const CHAR_MM = 1.8; // approximate mm per character at font size 7.5
  const colWeights = cols.map((col) => {
    const headerChars = col.label.length;
    const contentSample = rows.slice(0, 50).map(r => cellValue(r, col).length);
    const maxContent = contentSample.length ? Math.max(...contentSample) : 0;
    // At least wide enough for the header, weight toward longer content
    return Math.max(headerChars, Math.min(maxContent, headerChars * 2.5));
  });
  const totalWeight = colWeights.reduce((s, w) => s + w, 0);
  // Ensure each column is at minimum wide enough to show its header unclipped
  const minWidths = cols.map(col => col.label.length * CHAR_MM + 4);
  const rawWidths = colWeights.map(w => (w / totalWeight) * availableW);
  // Scale up any column that's below its minimum, then scale the rest down
  const colWidths = rawWidths.map((w, i) => Math.max(w, minWidths[i]));
  const totalRaw = colWidths.reduce((s, w) => s + w, 0);
  const scale = totalRaw > availableW ? availableW / totalRaw : 1;
  const finalWidths = colWidths.map(w => w * scale);

  // Table
  const headers = cols.map(c => c.label);
  const body = rows.map(row => cols.map(col => cellValue(row, col)));

  autoTable(doc, {
    head: [headers],
    body,
    startY: 22,
    theme: "grid",
    styles: { fontSize: 7.5, cellPadding: { top: 2, bottom: 2, left: 2, right: 2 }, overflow: "linebreak", halign: "left" },
    headStyles: { fillColor: [15, 45, 92], textColor: 255, fontStyle: "bold", fontSize: 7.5, halign: "left", overflow: "linebreak" },
    alternateRowStyles: { fillColor: [245, 247, 250] },
    columnStyles: Object.fromEntries(finalWidths.map((w, i) => [i, { cellWidth: parseFloat(w.toFixed(2)) }])),
    margin: { left: marginH, right: marginH },
    tableWidth: availableW,
    didDrawPage: () => {
      const pg = doc.getCurrentPageInfo().pageNumber;
      doc.setFontSize(7);
      doc.setTextColor(150);
      doc.text(
        `Page ${pg}  ·  ${rows.length} record${rows.length !== 1 ? "s" : ""}`,
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
