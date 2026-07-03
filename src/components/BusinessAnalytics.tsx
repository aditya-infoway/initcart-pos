import { type FC, type JSX } from "react";
import { useEffect, useState } from "react";
import api from "../api/api";
import { MdOutlinePendingActions, MdOutlineCancel } from "react-icons/md";
import { FaBoxOpen, FaShoppingBag, FaMoneyBillWave } from "react-icons/fa";
import { /*AiOutlineUser*/ AiOutlineDollar } from "react-icons/ai";
import { TbTruckReturn } from "react-icons/tb";

interface StatsItem {
  label: string;
  count: number;
  icon: JSX.Element;
  bgColor?: string;
}

interface DashboardSummary {
  total_sales: number;
  total_purchase: number;
  total_salesreturn: number;
  total_purchasereturn: number;
  total_receipt: number;
  total_payment: number;
  total_items?: number;
  total_website_orders?: number;
  purchase_return?: number;
  sales_return?: number;
  branch_name?: string;
  total_today_payment?: number;
  total_today_receipt?: number,
  total_orders?: number,
}

const BusinessAnalytics: FC = () => {
  const [summary, setSummary] = useState<DashboardSummary>({
    total_sales: 0,
    total_purchase: 0,
    total_salesreturn: 0,
    total_purchasereturn: 0,
    total_receipt: 0,
    total_payment: 0,
    total_items: 0,
    total_website_orders: 0,
    purchase_return: 0,
    sales_return: 0,
    branch_name: "",
    total_orders: 0,
    total_today_payment: 0,
    total_today_receipt: 0,

  });
  const businessStats: StatsItem[] = [
    {
      label: "Total Sales",
      count: summary.total_sales,
      icon: <FaMoneyBillWave size={24} />,
      bgColor: "from-green-500 to-emerald-500",
    },
    {
      label: "Total Purchase",
      count: summary.total_purchase,
      icon: <FaShoppingBag size={24} />,
      bgColor: "from-blue-500 to-indigo-500",
    },
    {
      label: "Purchase Return",
      count: summary.total_purchasereturn || 0,
      icon: <TbTruckReturn size={24} />,
      bgColor: "from-red-400 to-pink-500",
    },
    {
      label: "Sales Return",
      count: summary.total_salesreturn || 0,
      icon: <MdOutlineCancel size={24} />,
      bgColor: "from-orange-400 to-red-500",
    },
    {
      label: "Payment",
      count: summary.total_today_payment || 0,
      icon: <AiOutlineDollar size={24} />,
      bgColor: "from-purple-500 to-pink-500",
    },
    {
      label: "Receipts",
      count: summary.total_today_receipt || 0,
      icon: <AiOutlineDollar size={24} />,
      bgColor: "from-teal-400 to-cyan-500",
    },
    {
      label: "Total Items",
      count: summary.total_items || 0,
      icon: <FaBoxOpen size={24} />,
      bgColor: "from-yellow-400 to-amber-500",
    },
    {
      label: "Total Website Orders",
      count: summary.total_website_orders || 0,
      icon: <MdOutlinePendingActions size={24} />,
      bgColor: "from-indigo-500 to-blue-500",
    },
  ];


  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await api.get("dashboard-summary/", {
          headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` },
        });
        setSummary(res.data);
      } catch (err) {
        console.error(err);
      }
    };

    fetchSummary();
  }, []);

  return (
    <div className="space-y-8">
      {/* Header */}
      <h2 className="flex items-center text-gray-900 font-semibold text-xl tracking-wide">
        <FaBoxOpen className="mr-2 text-indigo-600" /> <p>Welcome {summary.branch_name}</p>
      </h2>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
        {businessStats.map((stat) => (
          <div
            key={stat.label}
            className="relative bg-white rounded-2xl shadow-md border border-gray-100 hover:shadow-lg transition-shadow duration-300 p-5 flex items-center justify-between"
          >
            <div>
              <p className="text-gray-500 font-medium">{stat.label}</p>
              <p className="text-gray-900 text-2xl font-extrabold mt-1">
                {stat.count}
              </p>
            </div>
            <div
              className={`p-3 rounded-xl bg-gradient-to-br ${stat.bgColor} text-white shadow-sm`}
            >
              {stat.icon}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default BusinessAnalytics;