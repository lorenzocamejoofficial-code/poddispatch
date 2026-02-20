import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, AlertTriangle, XCircle, ArrowRight } from "lucide-react";

interface ImportResultProps {
  fileName: string;
  totalRows: number;
  importedRows: number;
  warnings: { message: string; count: number }[];
  duplicates: { name: string; existing: string }[];
  onFixLater: () => void;
  onViewDuplicates: () => void;
}

export function ImportResult({ fileName, totalRows, importedRows, warnings, duplicates, onFixLater }: ImportResultProps) {
  const hasWarnings = warnings.length > 0;
  const hasDuplicates = duplicates.length > 0;
  const allGood = !hasWarnings && !hasDuplicates;

  return (
    <div className="space-y-6">
      {/* Success Banner */}
      <Card className={allGood ? "border-green-200 bg-green-50/50" : "border-amber-200 bg-amber-50/50"}>
        <CardContent className="pt-6 pb-4">
          <div className="flex items-start gap-4">
            {allGood ? (
              <CheckCircle2 className="h-8 w-8 text-green-500 shrink-0" />
            ) : (
              <AlertTriangle className="h-8 w-8 text-amber-500 shrink-0" />
            )}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-foreground">
                {allGood ? "Import Complete!" : "Import Successful — With Warnings"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                <strong>{importedRows}</strong> of {totalRows} rows imported from <strong>{fileName}</strong>
              </p>
            </div>
            <Badge variant={allGood ? "default" : "secondary"} className="shrink-0">
              {allGood ? "Clean" : `${warnings.length + duplicates.length} warnings`}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {hasWarnings && (
        <Card>
          <CardContent className="pt-4">
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              Data Warnings
            </h4>
            <div className="space-y-2">
              {warnings.map((w, i) => (
                <div key={i} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                  <span className="text-sm">{w.message}</span>
                  <Badge variant="outline" className="text-xs">{w.count} records</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Duplicates */}
      {hasDuplicates && (
        <Card>
          <CardContent className="pt-4">
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <XCircle className="h-4 w-4 text-orange-500" />
              Possible Duplicates Detected ({duplicates.length})
            </h4>
            <div className="space-y-2">
              {duplicates.slice(0, 5).map((d, i) => (
                <div key={i} className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2">
                  <span className="text-sm">"{d.name}" may match existing "{d.existing}"</span>
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm" className="text-xs h-7">Merge</Button>
                    <Button variant="ghost" size="sm" className="text-xs h-7">Keep Both</Button>
                  </div>
                </div>
              ))}
              {duplicates.length > 5 && (
                <p className="text-xs text-muted-foreground">+{duplicates.length - 5} more</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex gap-3 justify-end">
        <Button variant="outline" onClick={onFixLater}>
          {hasWarnings || hasDuplicates ? "Fix Later" : "Done"}
        </Button>
        <Button onClick={onFixLater}>
          Continue to Dispatch <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
