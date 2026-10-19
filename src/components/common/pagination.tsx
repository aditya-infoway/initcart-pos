
//components/common/pagination.tsx
import React from "react";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    maxVisible?: number; // beech me kitne numbers (default 3)
}

const Pagination: React.FC<PaginationProps> = ({
    currentPage,
    totalPages,
    onPageChange,
    maxVisible = 3,
}) => {
    const pages: (number | string)[] = [];
    const startPage = Math.max(1, currentPage - 1);
    const endPage = Math.min(totalPages, startPage + maxVisible - 1);

    if (startPage > 1) pages.push(1, "...");
    for (let i = startPage; i <= endPage; i++) pages.push(i);
    if (endPage < totalPages) pages.push("...", totalPages);

    return (
        <div className="flex items-center gap-2">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    currentPage === 1
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
            >
                Prev
            </button>

            {pages.map((p, i) =>
                typeof p === "number" ? (
                    <button
                        key={i}
                        onClick={() => onPageChange(p)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                            currentPage === p
                                ? "bg-blue-600 text-white"
                                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                        }`}
                    >
                        {p}
                    </button>
                ) : (
                    <span key={i} className="px-2 text-gray-500">
                        {p}
                    </span>
                )
            )}

            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    currentPage === totalPages
                        ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
            >
                Next
            </button>
        </div>
    );
};

export default Pagination;