import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, FileSpreadsheet, Users, Building2, Truck, CalendarDays, History, Shuffle } from "lucide-react";

const DATA_TYPES = [
  { value: "patients", label: "Patients", icon: Users, description: "Patient demographics, addresses, insurance" },
  { value: "facilities", label: "Facilities", icon: Building2, description: "Dialysis centers, hospitals, SNFs" },
  { value: "crews", label: "Crews & Employees", icon: Truck, description: "Crew members, certifications" },
  { value: "trip_history", label: "Trip History", icon: History, description: "Past trips (read-only, not billable)" },
  { value: "schedules", label: "Recurring Schedules", icon: CalendarDays, description: "MWF / TTS dialysis schedules" },
  { value: "mixed", label: "Mixed Sheet (auto-detect)", icon: Shuffle, description: "Let PodDispatch figure it out" },
];

interface ImportCenterProps {
  onFilesParsed: (data: { headers: string[]; rows: Record<string, string>[]; fileName: string; dataType: string; isHistorical: boolean }) => void;
}

export function ImportCenter({ onFilesParsed }: ImportCenterProps) {
  const [dragOver, setDragOver] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [isHistorical, setIsHistorical] = useState(false);
  const [parsing, setParsing] = useState(false);

  const handleFiles = useCallback(async (files: FileList) => {
    if (!selectedType) return;
    const file = files[0];
    if (!file) return;

    setParsing(true);
    try {
      const ExcelJS = await import("exceljs");
      const buffer = await file.arrayBuffer();
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(buffer);
      const worksheet = workbook.worksheets[0];
      if (!worksheet || worksheet.rowCount === 0) throw new Error("Empty workbook");
      
      const headers: string[] = [];
      const headerRow = worksheet.getRow(1);
      headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
        headers.push(String(cell.value ?? `Column${colNumber}`));
      });
      
      const jsonData: Record<string, string>[] = [];
      for (let r = 2; r <= worksheet.rowCount; r++) {
        const row = worksheet.getRow(r);
        const record: Record<string, string> = {};
        headers.forEach((h, i) => {
          const cell = row.getCell(i + 1);
          record[h] = cell.value != null ? String(cell.value) : "";
        });
        jsonData.push(record);
      }

      onFilesParsed({
        headers,
        rows: jsonData,
        fileName: file.name,
        dataType: selectedType,
        isHistorical: selectedType === "trip_history" ? true : isHistorical,
      });
    } catch {
      // Fallback: try as CSV text
      try {
        const text = await file.text();
        const lines = text.split("\n").filter(l => l.trim());
        const headers = lines[0].split(",").map(h => h.trim().replace(/^"|"$/g, ""));
        const rows = lines.slice(1).map(line => {
          const vals = line.split(",").map(v => v.trim().replace(/^"|"$/g, ""));
          const row: Record<string, string> = {};
          headers.forEach((h, i) => { row[h] = vals[i] || ""; });
          return row;
        });
        onFilesParsed({ headers, rows, fileName: file.name, dataType: selectedType, isHistorical });
      } catch {
        alert("Could not parse file. Please try CSV or Excel format.");
      }
    } finally {
      setParsing(false);
    }
  }, [selectedType, isHistorical, onFilesParsed]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground mb-1">What does your file contain?</h3>
        <p className="text-sm text-muted-foreground mb-4">Select the type of data you're importing, then upload your file.</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {DATA_TYPES.map(dt => (
            <button
              key={dt.value}
              onClick={() => setSelectedType(dt.value)}
              className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors ${
                selectedType === dt.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-border hover:border-primary/40 hover:bg-muted/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <dt.icon className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">{dt.label}</span>
              </div>
              <span className="text-xs text-muted-foreground">{dt.description}</span>
            </button>
          ))}
        </div>
      </div>

      {selectedType === "trip_history" && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="pt-4 pb-3">
            <p className="text-sm text-amber-800">
              📋 Historical trips will be imported as <strong>read-only</strong> records. They won't affect billing or dispatch.
            </p>
          </CardContent>
        </Card>
      )}

      {selectedType && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 transition-colors ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
          }`}
        >
          {parsing ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Reading your file…</p>
            </div>
          ) : (
            <>
              <Upload className="h-10 w-10 text-muted-foreground/50 mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">Drop your file here</p>
              <p className="text-xs text-muted-foreground mb-4">CSV, Excel (.xlsx), or Google Sheets export</p>
              <label>
                <input
                  type="file"
                  accept=".csv,.xlsx,.xls,.tsv"
                  className="sr-only"
                  onChange={e => e.target.files && handleFiles(e.target.files)}
                />
                <Button variant="outline" size="sm" asChild>
                  <span><FileSpreadsheet className="h-4 w-4 mr-2" />Browse Files</span>
                </Button>
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}
