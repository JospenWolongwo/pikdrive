import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui";

interface RidesPaginationProps {
  loading: boolean;
  ridesCount: number;
  pagination: {
    page: number;
    totalPages: number;
  };
  onPageChange: (page: number) => void;
}

export function RidesPagination({
  loading,
  ridesCount,
  pagination,
  onPageChange,
}: RidesPaginationProps) {
  if (loading || ridesCount === 0) {
    return null;
  }

  return (
    <Pagination className="mt-4">
      <PaginationContent>
        {pagination.page > 1 && (
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={(e) => {
                e.preventDefault();
                const newPage = Math.max(1, pagination.page - 1);
                onPageChange(newPage);
              }}
            />
          </PaginationItem>
        )}

        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
          let pageNumber: number;
          if (pagination.totalPages <= 5) {
            pageNumber = i + 1;
          } else if (pagination.page <= 3) {
            pageNumber = i + 1;
          } else if (pagination.page >= pagination.totalPages - 2) {
            pageNumber = pagination.totalPages - 4 + i;
          } else {
            pageNumber = pagination.page - 2 + i;
          }

          return (
            <PaginationItem key={pageNumber}>
              <PaginationLink
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  onPageChange(pageNumber);
                }}
                isActive={pagination.page === pageNumber}
              >
                {pageNumber}
              </PaginationLink>
            </PaginationItem>
          );
        })}

        {pagination.page < pagination.totalPages && (
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={(e) => {
                e.preventDefault();
                const newPage = Math.min(
                  pagination.totalPages,
                  pagination.page + 1
                );
                onPageChange(newPage);
              }}
            />
          </PaginationItem>
        )}
      </PaginationContent>
    </Pagination>
  );
}
