
import React, { useState } from "react";
import { motion } from "framer-motion";
import { MdDelete, MdEdit } from "react-icons/md";
import { FaDownload, FaEye, FaCheckCircle, FaTimesCircle } from "react-icons/fa";

interface Column<T> {
  key: keyof T | string;
  label: string;
  render?: (item: T) => React.ReactNode;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onDownload?: (item: T) => void;
  onEdit?: (item: T) => void;
  onView?: (item: T) => void;
  onDelete?: (item: T) => void;
  onApprove?: (item: T) => void; // Added
  onReject?: (item: T) => void; // Added
  onAdd?: () => void;
  addButtonLabel?: string;
  title?: string;
    loading?: boolean;
  totalItems?: number;
  currentPage?: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}


const DataTable = <T extends { id: number | string }>({
  data,
  columns,
  onDownload,
  onView,
  onEdit,
  onDelete,
  onApprove,
  onReject,
  onAdd,
  addButtonLabel = "Add",
  title,
}: DataTableProps<T>) => {
  const [limit, setLimit] = useState<number>(10);
  const [offset, setOffset] = useState<number>(0);

  const totalPages = Math.ceil(data.length / limit);
  const paginatedData = data.slice(offset, offset + limit);

  const handlePageChange = (page: number) => {
    const newOffset = (page - 1) * limit;
    setOffset(newOffset);
  };

  return (
    <div className="bg-gradient-to-b from-gray-50 to-gray-100 p-6 rounded-2xl shadow-md">
      {/* Header */}
      <div className="flex justify-between flex-col lg:flex-row items-center mb-6">
        <div className="text-start w-full">
          {title && (
            <h2 className="text-xl font-semibold text-gray-700">{title}</h2>
          )}
        </div>
        <div className="text-end w-full mt-5">
          {onAdd && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.98 }}
              onClick={onAdd}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium px-5 py-2.5 rounded-xl shadow-md transition-all duration-200 cursor-pointer"
            >
              + {addButtonLabel}
            </motion.button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white/80 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-100 overflow-x-auto">
        <table className="text-sm text-gray-700 w-full">
          <thead>
            <tr className="bg-gradient-to-r from-gray-100 to-gray-50 border-b border-gray-200">
              <th className="px-6 py-4 text-left font-semibold text-gray-600">
                #
              </th>
              {(onEdit || onDelete || onView || onDownload || onApprove || onReject) && (
                <th className="px-6 py-4 text-center font-semibold text-gray-600">
                  Action
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key as string}
                  className="px-6 py-4 text-left font-semibold text-gray-600"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {paginatedData.map((item, index) => (
              <motion.tr
                key={item.id}
                whileHover={{ backgroundColor: "#f9fafb" }}
                transition={{ duration: 0.2 }}
                className="border-b border-gray-100"
              >
<td className="px-6 py-4 font-medium text-gray-800 border-r border-gray-100">
  {offset + index + 1}
</td>

                {(onEdit || onDelete || onView || onDownload || onApprove || onReject) && (
                  <td className="px-6 py-4 text-center flex justify-center gap-5">
                    {onView && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        onClick={() => onView(item)}
                        className="text-blue-600 hover:text-blue-800 transition-all cursor-pointer"
                        title="View"
                      >
                        <FaEye size={26} />
                      </motion.button>
                    )}
                    {onDownload && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        onClick={() => onDownload(item)}
                        className="text-green-600 hover:text-green-700 transition-all cursor-pointer"
                        title="Download"
                      >
                        <FaDownload size={26} />
                      </motion.button>
                    )}
                    {onEdit && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        onClick={() => onEdit(item)}
                        className="text-blue-600 hover:text-blue-800 transition-all cursor-pointer"
                        title="Edit"
                      >
                        <MdEdit size={26} />
                      </motion.button>
                    )}
                    {onDelete && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        onClick={() => onDelete(item)}
                        className="text-red-600 hover:text-red-800 transition-all cursor-pointer"
                        title="Delete"
                      >
                        <MdDelete size={26} />
                      </motion.button>
                    )}
                    {onApprove && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        onClick={() => onApprove(item)}
                        className="text-green-600 hover:text-green-700 transition-all cursor-pointer"
                        title="Approve"
                      >
                        <FaCheckCircle size={26} />
                      </motion.button>
                    )}
                    {onReject && (
                      <motion.button
                        whileHover={{ scale: 1.1 }}
                        onClick={() => onReject(item)}
                        className="text-red-600 hover:text-red-800 transition-all cursor-pointer"
                        title="Reject"
                      >
                        <FaTimesCircle size={26} />
                      </motion.button>
                    )}
                  </td>
                )}

                {columns.map((col) => (
<td
  key={col.key as string}
  className="px-6 py-4 border-r border-gray-100 last:border-r-0"
>
  {col.render ? col.render(item) : (item as any)[col.key]}
</td>
                ))}
              </motion.tr>
            ))}

            {data.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + (onEdit || onDelete || onView || onDownload || onApprove || onReject ? 2 : 1)}
                  className="text-center py-8 text-gray-500 italic"
                >
                  No data available.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row justify-between items-center mt-6 gap-4">
        <div className="flex items-center gap-5 text-sm text-gray-700">
          <div className="flex gap-2 items-center">
            <label htmlFor="limit" className="font-medium text-gray-600">
              Rows per page:
            </label>
            <select
              id="limit"
              value={limit}
              onChange={(e) => {
                const newLimit =
                  e.target.value === "All"
                    ? data.length
                    : parseInt(e.target.value);
                setLimit(newLimit);
                setOffset(0);
              }}
              className="border border-gray-300 rounded-lg px-2 py-1 bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
            >
              {[10, 25, 50].map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              <option value="All">All</option>
            </select>
          </div>
          <div className="text-sm text-gray-600">
            Showing{" "}
            <span className="font-semibold text-gray-800">
              {offset + 1} - {Math.min(offset + limit, data.length)}
            </span>{" "}
            of {data.length}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => handlePageChange(offset / limit)}
            disabled={offset === 0}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              offset === 0
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            Prev
          </button>

          {(() => {
            const currentPage = offset / limit + 1;
            const maxVisible = 3;
            const pages: (number | string)[] = [];
            const startPage = Math.max(1, currentPage - 1);
            const endPage = Math.min(totalPages, startPage + maxVisible - 1);

            if (startPage > 1) pages.push(1, "...");
            for (let i = startPage; i <= endPage; i++) pages.push(i);
            if (endPage < totalPages) pages.push("...", totalPages);

            return pages.map((p, i) =>
              typeof p === "number" ? (
                <button
                  key={i}
                  onClick={() => handlePageChange(p)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
                    offset / limit + 1 === p
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
            );
          })()}

          <button
            onClick={() => handlePageChange(offset / limit + 2)}
            disabled={offset + limit >= data.length}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
              offset + limit >= data.length
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : "bg-blue-600 text-white hover:bg-blue-700"
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default DataTable;
