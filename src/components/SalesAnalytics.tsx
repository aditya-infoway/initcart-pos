import { useState, useEffect, type FC } from "react";
// import { toAbsoluteUrl } from "../utils/reuseable";
import { useNavigate } from "react-router-dom";
import { MdOutlinePendingActions} from "react-icons/md";
import { FaMoneyBillWave } from "react-icons/fa";
import api from "../api/api";

type Props = {
  className?: string;
};

export const tabs: { id: "month" | "week" | "day"; label: string }[] = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
];

// const recentSalesData = [
//   {
//     billNo: "BILL001",
//     name: "John Doe",
//     amount: "₹25,000",
//   },
//   {
//     billNo: "BILL002",
//     name: "Jane Smith",
//     amount: "₹15,000",
//   },
//   {
//     billNo: "BILL003",
//     name: "Robert Brown",
//     amount: "₹30,000",
//   },
//   {
//     billNo: "BILL004",
//     name: "Emily Davis",
//     amount: "₹10,000",
//   },
//   {
//     billNo: "BILL005",
//     name: "Michael Wilson",
//     amount: "₹20,000",
//   },
// ];

const websiteOrdersData = [
  {
    orderId: "ORD001",
    name: "Alice Johnson",
    amount: "₹35,000",
  },
  {
    orderId: "ORD002",
    name: "Bob Lee",
    amount: "₹18,000",
  },
  {
    orderId: "ORD003",
    name: "Clara Adams",
    amount: "₹22,000",
  },
  {
    orderId: "ORD004",
    name: "David Clark",
    amount: "₹12,000",
  },
  {
    orderId: "ORD005",
    name: "Sarah White",
    amount: "₹28,000",
  },
];


const RecentSales: FC<Props> = ({ className = "" }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("month");
  const [, setItems] = useState<any[]>([]);
  const [paginatedItems, setPaginatedItems] = useState<any[]>([]);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await api.get(`/sales-dashboard/?period=${activeTab}`, {
          headers: {
            Authorization: `Bearer ${sessionStorage.getItem("token")}`,
          },
        });

        const mappedItems = res.data.map((item: any) => ({
          id: item.id,
          bill_no: item.bill_no,
          customer_name: item.customer_name,
          grand_total: item.grand_total,
          
        }));

        setItems(mappedItems);
        setPaginatedItems(mappedItems.slice(0, 5));
      } catch (err) {
        console.error("Failed to fetch sales entries:", err);
        setItems([]);
        setPaginatedItems([]);
      }
    };

    fetchItems();
  }, [activeTab]); // 🔹 re-fetch when tab changes



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
            Recent Sales
          </h3>
        </div>
        {/* Tabs */}
        <div className="flex mt-4 md:mt-0 bg-gray-100 dark:bg-gray-800 rounded-full p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`cursor-pointer px-4 py-1.5 text-sm font-medium rounded-full transition-all duration-300 ${activeTab === tab.id
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
              <th className="py-3 font-medium">Bill No</th>
              <th className="py-3 font-medium">Customer Name</th>
              <th className="py-3 font-medium">Amount</th>
              <th className="py-3"></th>
            </tr>
          </thead>
          <tbody>
            {paginatedItems.map((items, i) => (
              <tr
                key={i}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all duration-200 group"
              >
                <td className="py-4 text-gray-700 dark:text-gray-300">
                  {items.bill_no}
                </td>
                <td className="py-4 text-gray-700 dark:text-gray-300">
                  {items.customer_name}
                </td>
                <td className="py-4 text-gray-700 dark:text-gray-300">
                  {items.grand_total}
                </td>
                <td className="py-4 text-right text-gray-400 group-hover:text-blue-500 transition"
                  onClick={() => navigate("/Addsalesitem")}
                >
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

const WebsiteOrders: FC<Props> = ({ className = "" }) => {
  return (
    <div
      className={`backdrop-blur-md bg-gradient-to-br from-white/90 to-gray-50/90 
      dark:from-gray-900/80 dark:to-gray-800/80 
      rounded-2xl shadow-lg border border-gray-100/60 dark:border-gray-700/60 
      p-6 transition-all duration-300 hover:shadow-xl ${className}`}
    >
      <div className="flex justify-between items-center border-b border-gray-100 dark:border-gray-700 pb-4">
        <div className="flex items-center">
          <MdOutlinePendingActions className="mr-2 text-indigo-600" size={24} />
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Website Orders
          </h3>
        </div>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          Based on recent orders
        </span>
      </div>

      <div className="mt-5 overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="text-gray-500 dark:text-gray-400 text-sm border-b border-gray-100 dark:border-gray-700">
              <th className="py-3 font-medium">Order ID</th>
              <th className="py-3 font-medium">Customer Name</th>
              <th className="py-3 font-medium">Amount</th>
              <th className="py-3"></th>
            </tr>
          </thead>
          <tbody>
            {websiteOrdersData.map((item, i) => (
              <tr
                key={i}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all duration-200 group"
              >
                <td className="py-4 text-gray-700 dark:text-gray-300">
                  {item.orderId}
                </td>
                <td className="py-4 font-semibold text-gray-900 dark:text-gray-100">
                  {item.name}
                </td>
                <td className="py-4 text-gray-700 dark:text-gray-300">
                  {item.amount}
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

export { RecentSales, WebsiteOrders };