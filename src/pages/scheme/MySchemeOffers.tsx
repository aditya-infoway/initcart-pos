// MySchemeOffers.tsx
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { FaGift, FaEye } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import api from "../../api/api";

interface SchemeOffer {
  id: number;
  offer_name: string;
  start_date: string;
  end_date: string;
  availability: "all" | "selected";
  branch_names: string;
  amount: string | number;
  scheme_type: string;
  status: "active" | "inactive";
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => (
  <span
    className={`px-2 py-1 rounded-full text-xs font-semibold
      ${status === "active" ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-600"}`}
  >
    {status === "active" ? "Active" : "Inactive"}
  </span>
);

const MySchemeOffers: React.FC = () => {
  const navigate = useNavigate();
  const [schemes, setSchemes] = useState<SchemeOffer[]>([]);
  const [loading, setLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);

  const fetchSchemes = () => {
    setLoading(true);
    api
      .get("my-branch-schemes/")
      .then((res) => {
        let data: any[] = [];
        if (res.data?.data && Array.isArray(res.data.data)) {
          data = res.data.data;
        } else if (res.data?.results && Array.isArray(res.data.results)) {
          data = res.data.results;
        } else if (Array.isArray(res.data)) {
          data = res.data;
        }
        setSchemes(data);
      })
      .catch((err) => {
        console.error(err);
        toast.error("Failed to load scheme offers");
        setSchemes([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchSchemes();
  }, []);

  const handleViewReport = (schemeId: number) => {
    navigate(`/SchemeOfferRegister/${schemeId}/report`);
  };

  const totalPages = Math.ceil(schemes.length / pageSize);
  const paginatedSchemes = schemes.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-6">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-6">
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-2 rounded-lg shadow-md">
            <h1 className="text-white font-bold text-lg flex items-center gap-2">
              <FaGift /> SCHEME OFFERS FOR MY BRANCH
            </h1>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
                <tr>
                  <th className="px-4 py-3 text-left">Offer Name</th>
                  <th className="px-4 py-3 text-left">Period</th>
                  <th className="px-4 py-3 text-left">Availability</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Type</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={7} className="text-center py-8 text-gray-400 italic">
                      Loading...
                    </td>
                  </tr>
                )}
                {!loading && paginatedSchemes.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center py-10 text-gray-400">
                      <FaGift className="inline mr-2 text-2xl text-gray-300" />
                      <br />
                      No scheme offers found
                    </td>
                  </tr>
                )}
                {paginatedSchemes.map((scheme) => (
                  <tr
                    key={scheme.id}
                    className="border-b border-gray-100 hover:bg-gray-50 transition"
                  >
                    <td className="px-4 py-3 font-medium">{scheme.offer_name}</td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {scheme.start_date} → {scheme.end_date}
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {scheme.branch_names}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold">
                      ₹{Number(scheme.amount).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-center capitalize text-xs">
                      {scheme.scheme_type.replace("_", " ")}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={scheme.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-center gap-2">
                        <button
                          title="View Report"
                          onClick={() => handleViewReport(scheme.id)}
                          className="text-blue-600 hover:text-blue-800 p-1"
                        >
                          <FaEye />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex justify-between items-center px-4 py-3 border-t">
              <span className="text-sm text-gray-500">
                Showing {(currentPage - 1) * pageSize + 1} to{" "}
                {Math.min(currentPage * pageSize, schemes.length)} of {schemes.length}
              </span>
              <div className="flex gap-1">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Previous
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={`px-3 py-1 border rounded text-sm ${
                        currentPage === pageNum
                          ? "bg-blue-600 text-white border-blue-600"
                          : "hover:bg-gray-100"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                <button
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MySchemeOffers;