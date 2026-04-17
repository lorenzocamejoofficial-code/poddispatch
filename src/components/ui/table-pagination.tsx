import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

interface TablePaginationProps {
  page: number;                 // 1-indexed
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

/**
 * Lightweight pagination footer for any table.
 * Keeps render cost low by ensuring only `pageSize` rows are mounted at once.
 */
export function TablePagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100, 200],
  className = "",
}: TablePaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = totalItems === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, totalItems);

  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 border-t bg-muted/20 ${className}`}>
      <div className="text-xs text-muted-foreground">
        {totalItems === 0 ? "No items" : <>Showing <span className="font-medium text-foreground">{start.toLocaleString()}–{end.toLocaleString()}</span> of <span className="font-medium text-foreground">{totalItems.toLocaleString()}</span></>}
      </div>
      <div className="flex items-center gap-3">
        {onPageSizeChange && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span>Rows</span>
            <Select value={String(pageSize)} onValueChange={(v) => onPageSizeChange(Number(v))}>
              <SelectTrigger className="h-7 w-[70px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {pageSizeOptions.map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safePage <= 1} onClick={() => onPageChange(1)} aria-label="First page">
            <ChevronsLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safePage <= 1} onClick={() => onPageChange(safePage - 1)} aria-label="Previous page">
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <span className="text-xs text-muted-foreground px-1.5 min-w-[80px] text-center">
            Page <span className="font-medium text-foreground">{safePage}</span> of {totalPages}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safePage >= totalPages} onClick={() => onPageChange(safePage + 1)} aria-label="Next page">
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" disabled={safePage >= totalPages} onClick={() => onPageChange(totalPages)} aria-label="Last page">
            <ChevronsRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
