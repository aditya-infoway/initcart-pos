// MySchemeReportPage.tsx
import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FaArrowLeft, FaBuilding, FaPhone, FaUsers,
  FaChevronDown, FaChevronUp, FaGift, FaPrint
} from "react-icons/fa";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../api/api";

interface CustomerRow {
  customer_id: number;
  customer_name: string;
  customer_phone?: string;
  total_sales: number;
}

interface BranchReport {
  branch_id: number;
  branch_name: string;
  customers: CustomerRow[];
}

interface MonthReport {
  year: number;
  month: number;
  label: string;
  period_start: string;
  period_end: string;
  branches: BranchReport[];
}

interface SchemeReport {
  scheme_id: number;
  offer_name: string;
  amount: number;
  scheme_type: string;
  status: string;
  start_date: string;
  end_date: string;
  months: MonthReport[];
}

const MySchemeReportPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  
  const [report, setReport] = useState<SchemeReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  useEffect(() => {
    if (id) {
      fetchReport();
    }
  }, [id]);

  const fetchReport = async () => {
    setLoading(true);
    try {
      const res = await api.get(`scheme-offers/${id}/report/`);
      setReport(res.data);
      const firstWithData = res.data.months?.find((m: any) => m.branches?.length > 0);
      if (firstWithData) {
        setOpenMonths({ [`${firstWithData.year}-${firstWithData.month}`]: true });
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load report");
      navigate("/SchemeOfferRegister");
    } finally {
      setLoading(false);
    }
  };

  const toggleMonth = (key: string) => {
    setOpenMonths(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getStatusBadge = (status: string) => (
    <span className={`px-2 py-1 rounded-full text-xs font-semibold
      ${status === "active" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}>
      {status === "active" ? "Active" : "Inactive"}
    </span>
  );

  // Get all customers for pagination
  const allCustomers = report?.months?.flatMap(m => 
    m.branches?.flatMap(b => b.customers || []) || []
  ) || [];

  const totalCustomers = allCustomers.length;
  const totalPages = Math.ceil(totalCustomers / pageSize);
  const paginatedCustomers = allCustomers.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-500">Loading report...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center text-gray-500">Report not found</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <button
            onClick={() => navigate("/SchemeOfferRegister")}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm"
          >
            <FaArrowLeft /> Back to Offers
          </button>
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-2 rounded-lg shadow-md">
            <h1 className="text-white font-bold text-lg flex items-center gap-2">
              <FaUsers /> {report.offer_name} — My Branch Report
            </h1>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">Scheme Name</p>
            <p className="font-semibold text-sm truncate">{report.offer_name}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">Threshold</p>
            <p className="font-bold text-blue-600">₹{report.amount.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">Period</p>
            <p className="text-sm font-medium">{report.start_date} → {report.end_date}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4">
            <p className="text-xs text-gray-500">Status</p>
            {getStatusBadge(report.status)}
          </div>
        </div>

        {/* Total Customers */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <p className="text-sm text-gray-600">
            Total Customers Qualified: <span className="font-bold text-green-600">{totalCustomers}</span>
          </p>
        </div>

        {/* Month-wise Report */}
        <div className="space-y-4">
          {report.months?.map((m: MonthReport) => {
            const key = `${m.year}-${m.month}`;
            const isOpen = !!openMonths[key];
            const monthCustomers = m.branches?.reduce((s, b) => s + b.customers.length, 0) || 0;

            return (
              <div key={key} className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
                <button
                  type="button"
                  onClick={() => toggleMonth(key)}
                  className="w-full flex justify-between items-center px-6 py-4 bg-gray-50 hover:bg-gray-100 transition"
                >
                  <span className="font-semibold text-gray-800 text-lg">{m.label}</span>
                  <span className="flex items-center gap-3 text-sm text-gray-500">
                    {monthCustomers > 0
                      ? `${monthCustomers} customer${monthCustomers > 1 ? "s" : ""} qualified`
                      : "No customers qualified"}
                    {isOpen ? <FaChevronUp /> : <FaChevronDown />}
                  </span>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="p-6 space-y-6">
                        {m.branches?.length === 0 && (
                          <p className="text-sm text-gray-400 italic text-center py-4">
                            No customer crossed the threshold this month.
                          </p>
                        )}
                        {m.branches?.map((branch: BranchReport) => (
                          <div key={branch.branch_id} className="border rounded-lg overflow-hidden">
                            <div className="bg-blue-100 px-4 py-2 text-sm font-semibold text-blue-800 flex items-center gap-2">
                              <FaBuilding /> {branch.branch_name} ({branch.customers.length} customers)
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 text-gray-600">
                                  <tr>
                                    <th className="px-4 py-2 text-left">#</th>
                                    <th className="px-4 py-2 text-left">Customer</th>
                                    <th className="px-4 py-2 text-left">Phone</th>
                                    <th className="px-4 py-2 text-right">Total Sales</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {branch.customers?.map((c: CustomerRow, idx: number) => (
                                    <tr key={c.customer_id} className="border-t hover:bg-gray-50">
                                      <td className="px-4 py-2 text-gray-400">{idx + 1}</td>
                                      <td className="px-4 py-2 font-medium">{c.customer_name}</td>
                                      <td className="px-4 py-2 text-gray-600 flex items-center gap-1">
                                        <FaPhone className="text-gray-400 text-xs" />
                                        {c.customer_phone || "-"}
                                      </td>
                                      <td className="px-4 py-2 text-right font-semibold text-green-700">
                                        ₹{c.total_sales.toFixed(2)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default MySchemeReportPage;