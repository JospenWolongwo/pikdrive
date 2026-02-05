"use client";

import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext } from "@/components/ui";
import { useLocale } from "@/hooks";

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
}

export function PaginationComponent({
  currentPage,
  totalItems,
  itemsPerPage,
  onPageChange,
}: PaginationProps) {
  const { t } = useLocale();
  const totalPages = Math.ceil(totalItems / itemsPerPage);

  if (totalPages <= 1) return null;

  const from = Math.min(totalItems, (currentPage - 1) * itemsPerPage + 1);
  const to = Math.min(totalItems, currentPage * itemsPerPage);

  return (
    <div className="mt-6 sm:mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
      <div className="text-xs sm:text-sm text-muted-foreground text-center sm:text-left">
        {t("pages.driver.dashboard.pagination.showing")} {from}-{to} {t("pages.driver.dashboard.pagination.of")} {totalItems} {t("pages.driver.dashboard.pagination.rides")}
      </div>

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => {
                if (currentPage > 1) onPageChange(currentPage - 1);
              }}
              className={
                currentPage === 1 ? "pointer-events-none opacity-50" : ""
              }
            />
          </PaginationItem>

          {Array.from(
            {
              length: Math.min(totalPages, 5),
            },
            (_, i) => {
              // Show pages around the current page
              let pageNum;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else {
                // Calculate start page ensuring we always show 5 pages
                let startPage = Math.max(
                  1,
                  Math.min(currentPage - 2, totalPages - 4)
                );
                pageNum = startPage + i;
              }

              return (
                <PaginationItem key={pageNum}>
                  <PaginationLink
                    onClick={() => onPageChange(pageNum)}
                    isActive={currentPage === pageNum}
                  >
                    {pageNum}
                  </PaginationLink>
                </PaginationItem>
              );
            }
          )}

          <PaginationItem>
            <PaginationNext
              onClick={() => {
                if (currentPage < totalPages) {
                  onPageChange(currentPage + 1);
                }
              }}
              className={
                currentPage >= totalPages
                  ? "pointer-events-none opacity-50"
                  : ""
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  );
}
