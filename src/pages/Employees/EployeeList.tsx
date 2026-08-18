// src/pages/employees/EmployeeList.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/api";
import { toast } from "react-toastify";
import { FaEdit, FaKey, FaSearch, FaTrash } from "react-icons/fa";

interface Employee {
  id: number; full_name: string; mobile: string; email: string;
  city: string; department: string; status: string;
}

const departmentLabel: Record<string, string> = {
  purchase: "Purchase Department", sales: "Sales Department", accounting: "Accounting Department",
};

const EmployeeList = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  // ✅ ADD: search state — name, mobile, email teeno se search hoga
  const [search, setSearch] = useState("");

  const fetchEmployees = async () => {
    setLoading(true);
    try {
      const res = await api.get("employees/");
      setEmployees(res.data.data || []);
    } catch {
      toast.error("Failed to load employees");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchEmployees(); }, []);

  // ✅ CHANGE: ab search name, mobile, email ke saath department aur city me bhi match karega
  //    department ke liye raw value ("purchase") aur uska label ("Purchase Department") dono check honge
  const filteredEmployees = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return employees;
    return employees.filter((emp) => {
      const deptLabel = (departmentLabel[emp.department] || "").toLowerCase();
      return (
        (emp.full_name || "").toLowerCase().includes(term) ||
        (emp.mobile || "").toLowerCase().includes(term) ||
        (emp.email || "").toLowerCase().includes(term) ||
        (emp.department || "").toLowerCase().includes(term) ||
        deptLabel.includes(term) ||
        (emp.city || "").toLowerCase().includes(term)
      );
    });
  }, [employees, search]);

  const handleDelete = async (id: number) => {
    if (!window.confirm("Delete this employee? Login access revoke ho jayega.")) return;
    try {
      await api.delete(`employees/${id}/`);
      toast.success("Employee deleted");
      fetchEmployees();
    } catch {
      toast.error("Failed to delete employee");
    }
  };

  if (loading) return <div className="p-6 flex justify-center items-center min-h-[300px]"><div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div></div>;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center mb-5">
        <h1 className="text-2xl font-bold text-gray-800">Employees</h1>
        <button onClick={() => navigate("/Employees")} className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow">
          + Add Employee
        </button>
      </div>

      {/* ✅ ADD: Search bar — name, mobile, email se search */}
      <div className="mb-4 relative max-w-sm">
        <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
              {/* <th className="p-3 border border-gray-300 text-left">Status</th> */}
              <th className="p-3 border border-gray-300 text-center">Action</th>
            </tr>
          </thead>
          <tbody>
            {filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center p-8 text-gray-500 border border-gray-300">
                  {employees.length === 0 ? "No employees found" : "No employees match your search"}
                </td>
              </tr>
            ) : filteredEmployees.map((emp, i) => (
              <tr key={emp.id} className="hover:bg-gray-50">
                <td className="p-3 border border-gray-300">{i + 1}</td>
                <td className="p-3 border border-gray-300 font-medium">{emp.full_name}</td>
                <td className="p-3 border border-gray-300">{emp.mobile}</td>
                <td className="p-3 border border-gray-300">{emp.email}</td>
                <td className="p-3 border border-gray-300">{departmentLabel[emp.department] || emp.department}</td>
                <td className="p-3 border border-gray-300">{emp.city || "-"}</td>
                {/* <td className="p-3 border border-gray-300">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${emp.status === "active" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>{emp.status}</span>
                </td> */}
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
    </div>
  );
};

export default EmployeeList;