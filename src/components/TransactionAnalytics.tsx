import { useState, type FC } from "react";
import { FaMoneyBillWave } from "react-icons/fa";

type Props = {
  className?: string;
};

// Define the type for tabs
type TabId = "month" | "week" | "day";

export const tabs: { id: TabId; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
];

const transactionData = [
  {
    billNo: "BILL001",
    partyName: "John Doe",
    type: "Sale",
    totalAmount: "₹25,000",
    transactionId: "TXN001",
    status: "Completed",
    statusColor: "green",
  },
  {
    billNo: "ORD001",
    partyName: "Alice Johnson",
    type: "Order",
    totalAmount: "₹35,000",
    transactionId: "TXN002",
    status: "Pending",
    statusColor: "yellow",
  },
  {
    billNo: "BILL002",
    partyName: "Jane Smith",
    type: "Sale",
    totalAmount: "₹15,000",
    transactionId: "TXN003",
    status: "Completed",
    statusColor: "green",
  },
  {
    billNo: "ORD002",
    partyName: "Bob Lee",
    type: "Order",
    totalAmount: "₹18,000",
    transactionId: "TXN004",
    status: "In Progress",
    statusColor: "blue",
  },
  {
    billNo: "BILL003",
    partyName: "Robert Brown",
    type: "Sale",
    totalAmount: "₹30,000",
    transactionId: "TXN005",
    status: "Canceled",
    statusColor: "red",
  },
];

const TransactionAnalytics: FC<Props> = ({ className = "" }) => {
  const [activeTab, setActiveTab] = useState<TabId>("month");

  return (
    <div
      className={`backdrop-blur-md bg-gradient-to-br from-white/90 to-gray-50/90 
      dark:from-gray-900/80 dark:to-gray-800/80 
      rounded-2xl shadow-lg border border-gray-100/60 dark:border-gray-700/60 
      p-6 transition-all duration-300 hover:shadow-xl ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 dark:border-gray-700 pb-5">
        <div className="flex items-center">
          <FaMoneyBillWave className="mr-2 text-indigo-600" size={24} />
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Transaction Analytics
          </h3>
        </div>
        {/* Tabs */}
        <div className="flex mt-4 md:mt-0 bg-gray-100 dark:bg-gray-800 rounded-full p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`cursor-pointer px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300 ${
                activeTab === tab.id
                  ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="mt-6 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400 text-sm border-b border-gray-100 dark:border-gray-700">
              <th className="py-3 font-medium">Bill/Order No</th>
              <th className="py-3 font-medium">Party Name</th>
              <th className="py-3 font-medium">Type</th>
              <th className="py-3 font-medium">Total Amount</th>
              <th className="py-3 font-medium">Transaction ID</th>
              <th className="py-3 font-medium">Status</th>
              <th className="py-3"></th>
            </tr>
          </thead>
          <tbody>
            {transactionData.map((item, i) => (
              <tr
                key={i}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all duration-200 group"
              >
                <td className="py-4 text-gray-700 dark:text-gray-300">
                  {item.billNo}
                </td>
                <td className="py-4 font-semibold text-gray-900 dark:text-gray-100">
                  {item.partyName}
                </td>
                <td className="py-4 text-gray-700 dark:text-gray-300">
                  {item.type}
                </td>
                <td className="py-4 text-gray-700 dark:text-gray-300">
                  {item.totalAmount}
                </td>
                <td className="py-4 text-gray-700 dark:text-gray-300">
                  {item.transactionId}
                </td>
                <td className="py-4">
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      item.statusColor === "green"
                        ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                        : item.statusColor === "yellow"
                        ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300"
                        : item.statusColor === "blue"
                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                        : "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                    }`}
                  >
                    {item.status}
                  </span>
                </td>
                <td className="py-4 text-right text-gray-400 group-hover:text-blue-500 transition">
                  →
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export { TransactionAnalytics };