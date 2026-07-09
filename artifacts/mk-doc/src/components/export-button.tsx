import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileText, Sheet, Globe, FileType2, Loader2, Check } from "lucide-react";
import { exportCSV, exportExcel, exportGoogleSheets, exportPDF, type ExportColumn } from "@/lib/export";

interface ExportButtonProps {
  data: Record<string, unknown>[];
  columns: ExportColumn[];
  filename: string;
  title: string;
  disabled?: boolean;
}

type Format = "csv" | "excel" | "sheets" | "pdf";

const OPTIONS: { id: Format; label: string; sub: string; icon: React.ReactNode }[] = [
  { id: "csv",    label: "CSV",           sub: "Download as .csv",             icon: <FileText className="h-4 w-4 text-emerald-600" /> },
  { id: "excel",  label: "Excel",         sub: "Download as .xlsx",            icon: <Sheet className="h-4 w-4 text-green-700" /> },
  { id: "sheets", label: "Google Sheets", sub: "Download CSV to import",       icon: <Globe className="h-4 w-4 text-blue-500" /> },
  { id: "pdf",    label: "PDF",           sub: "Download formatted report",    icon: <FileType2 className="h-4 w-4 text-red-500" /> },
];

export function ExportButton({ data, columns, filename, title, disabled }: ExportButtonProps) {
  const [active, setActive] = useState<Format | null>(null);
  const [done, setDone] = useState<Format | null>(null);

  async function handleExport(fmt: Format) {
    if (!data.length || active) return;
    setActive(fmt);
    try {
      await new Promise(r => setTimeout(r, 30)); // let UI update
      const rows = data as Record<string, unknown>[];
      if (fmt === "csv")    exportCSV(rows, columns, filename);
      if (fmt === "excel")  exportExcel(rows, columns, filename, title);
      if (fmt === "sheets") exportGoogleSheets(rows, columns, filename);
      if (fmt === "pdf")    exportPDF(rows, columns, filename, title);
      setDone(fmt);
      setTimeout(() => setDone(null), 2500);
    } finally {
      setActive(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" disabled={disabled || !data.length} className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal pb-1">
          Export {data.length} record{data.length !== 1 ? "s" : ""}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {OPTIONS.map(opt => (
          <DropdownMenuItem
            key={opt.id}
            className="cursor-pointer gap-3 py-2"
            onClick={() => handleExport(opt.id)}
            disabled={!!active}
          >
            <span className="flex-shrink-0">
              {active === opt.id ? (
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : done === opt.id ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                opt.icon
              )}
            </span>
            <span className="flex flex-col min-w-0">
              <span className="text-sm font-medium">{opt.label}</span>
              <span className="text-xs text-muted-foreground">{opt.sub}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
