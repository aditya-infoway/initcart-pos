// src/pages/employees/EmployeeList.tsx
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/api";
import { toast } from "react-toastify";
import { FaEdit, FaKey, FaSearch, FaTrash } from "react-icons/fa";
import Pagination from "../../components/common/pagination";

interface Employee {
  id: number; full_name: string; mobile: string; email: string;
  city: string; department: string; status: string;
}

interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

const departmentLabel: Record<string, string> = {
  purchase: "Purchase Department", sales: "Sales Department", accounting: "Accounting Department",
};

const EmployeeList = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // ✅ Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  // ✅ Search debounce (400ms)
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // ✅ Fetch employees with server-side pagination
  const fetchEmployees = async (page = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      if (debouncedSearch) params.set("search", debouncedSearch);

      const res = await api.get<PaginatedResponse<Employee>>(`employees/?${params.toString()}`);

      // ✅ Paginated response
      if (res.data && !Array.isArray(res.data) && (res.data as any).results) {
        const payload = res.data as any;
        setEmployees(payload.results || []);
        setTotalItems(payload.count || 0);
        setTotalPages(Math.max(1, Math.ceil((payload.count || 0) / pageSize)));
        setCurrentPage(page);
      }
      // ⚠️ Legacy fallback (agar backend purana ho — `{success, data}` format)
      else if (res.data && (res.data as any).data && Array.isArray((res.data as any).data)) {
        const all = (res.data as any).data as Employee[];
        setTotalItems(all.length);
        setTotalPages(Math.max(1, Math.ceil(all.length / pageSize)));
        setCurrentPage(page);
        const start = (page - 1) * pageSize;
        setEmployees(all.slice(start, start + pageSize));
      }
      // ⚠️ Array fallback
      else if (Array.isArray(res.data)) {
        const all = res.data as Employee[];
        setTotalItems(all.length);
        setTotalPages(Math.max(1, Math.ceil(all.length / pageSize)));
        setCurrentPage(page);
        const start = (page - 1) * pageSize;
        setEmployees(all.slice(start, start + pageSize));
      } else {
        setEmployees([]);
        setTotalItems(0);
        setTotalPages(1);
      }
    } catch {
      toast.error("Failed to load employees");
      setEmployees([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees(currentPage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, pageSize, debouncedSearch]);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this employee? Login access revoke ho jayega.")) return;
    try {
      await api.delete(`employees/${id}/`);
      toast.success("Employee deleted");
      // ✅ Last item on page → go to previous page
      if (employees.length === 1 && currentPage > 1) {
        setCurrentPage(currentPage - 1);
      } else {
        fetchEmployees(currentPage);
      }
    } catch {
      toast.error("Failed to delete employee");
    }
  };

  const handlePageChange = (p: number) => {
    if (p >= 1 && p <= totalPages) {
      setCurrentPage(p);
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setCurrentPage(1);
  };

  if (loading && employees.length === 0) return (
    <div className="p-6 flex justify-center items-center min-h-[300px]">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
    </div>
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold text-gray-800">Employees</h1>
        <button onClick={() => navigate("/Employees")} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow">
          + Add Employee
        </button>
      </div>

      {/* ✅ Search bar */}
      <div className="mb-4 relative max-w-sm">
        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, mobile, email, department or city..."
          className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="bg-blue-600 text-white">
            <tr>
              <th className="p-3 border border-gray-300 text-left">#</th>
              <th className="p-3 border border-gray-300 text-left">Full Name</th>
              <th className="p-3 border border-gray-300 text-left">Mobile</th>
              <th className="p-3 border border-gray-300 text-left">Login Email</th>
              <th className="p-3 border border-gray-300 text-left">Department</th>
              <th className="p-3 border border-gray-300 text-left">City</th>
              <th className="p-3 border border-gray-300 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className="text-center p-8 text-gray-500 border border-gray-300">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </td>
              </tr>
            ) : employees.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center p-8 text-gray-500 border border-gray-300">
                  {debouncedSearch ? "No employees match your search" : "No employees found"}
                </td>
              </tr>
            ) : employees.map((emp, i) => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="p-3 border border-gray-300">{(currentPage - 1) * pageSize + i + 1}</td>
                <td className="p-3 border border-gray-300 font-medium">{emp.full_name}</td>
                <td className="p-3 border border-gray-300">{emp.mobile}</td>
                <td className="p-3 border border-gray-300">{emp.email}</td>
                <td className="p-3 border border-gray-300">{departmentLabel[emp.department] || emp.department}</td>
                <td className="p-3 border border-gray-300">{emp.city || "-"}</td>
                <td className="p-3 border border-gray-300">
                  <div className="flex justify-center gap-2">
                    <button title="Set Access" onClick={() => navigate(`/employees/${emp.id}/permissions`)} className="bg-green-100 p-2 rounded-full text-green-600 hover:bg-green-200"><FaKey /></button>
                    <button title="Edit" onClick={() => navigate(`/employees/edit/${emp.id}`)} className="bg-blue-100 p-2 rounded-full text-blue-600 hover:bg-blue-200"><FaEdit /></button>
                    <button title="Delete" onClick={() => handleDelete(emp.id)} className="bg-red-100 p-2 rounded-full text-red-600 hover:bg-red-200"><FaTrash /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ✅ Reusable Pagination */}
      {totalItems > 0 && (
        <div className="flex flex-col sm:flex-row justify-between items-center mt-4 gap-3">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-700">
              Showing{" "}
              <span className="font-medium">
                {(currentPage - 1) * pageSize + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium">
                {Math.min(currentPage * pageSize, totalItems)}
              </span>{" "}
              of <span className="font-medium">{totalItems}</span> employees
            </span>
            <select
              value={pageSize}
              onChange={handlePageSizeChange}
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value={10}>10 per page</option>
              <option value={15}>15 per page</option>
              <option value={25}>25 per page</option>
              <option value={50}>50 per page</option>
              <option value={100}>100 per page</option>
            </select>
          </div>

          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
};

export default EmployeeList;