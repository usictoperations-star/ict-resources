import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";

type TablePaginationProps = {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  startIndex: number;
  endIndex: number;
  total: number;
};

export function TablePagination({ page, totalPages, onPageChange, startIndex, endIndex, total }: TablePaginationProps) {
  if (total === 0 || totalPages <= 1) return null;

  const pageNumbers: number[] = [];
  const windowStart = Math.max(1, page - 2);
  const windowEnd = Math.min(totalPages, windowStart + 4);
  for (let p = windowStart; p <= windowEnd; p++) pageNumbers.push(p);

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-4 border-t">
      <p className="text-sm text-muted-foreground">
        Showing {startIndex + 1}-{endIndex} of {total}
      </p>
      <Pagination className="mx-0 w-auto">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => { e.preventDefault(); if (page > 1) onPageChange(page - 1); }}
              className={page <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
          {pageNumbers.map((p) => (
            <PaginationItem key={p}>
              <PaginationLink
                href="#"
                isActive={p === page}
                onClick={(e) => { e.preventDefault(); onPageChange(p); }}
                className="cursor-pointer"
              >
                {p}
              </PaginationLink>
            </PaginationItem>
          ))}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => { e.preventDefault(); if (page < totalPages) onPageChange(page + 1); }}
              className={page >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
