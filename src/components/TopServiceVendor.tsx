import { useState, type FC } from "react";
import { toAbsoluteUrl } from "../utils/reuseable";

type Props = {
  className?: string;
};

const tabs = [
  { id: "month", label: "Month" },
  { id: "week", label: "Week" },
  { id: "day", label: "Day" },
];

const sampleData = [
  {
    img: "media/icons/boy.png",
    name: "Brad Simmons",
    role: "Product Vendor",
    company: "Aditya Infoway",
    commission: "₹18000",

    revenue: "₹55000",
    status: "Approved",
    color: "green",
  },
  {
    img: "media/icons/boy.png",
    name: "Popular Authors",
    role: "Service Vendor",
    company: "Aditya Infoway",
    commission: "₹15000",

    revenue: "₹45000",
    status: "In Progress",
    color: "yellow",
  },
  {
    img: "media/icons/boy.png",
    name: "New Users",
    role: "Product Vendor",
    company: "Aditya Infoway",
    commission: "₹7000",

    revenue: "₹30000",
    status: "Success",
    color: "blue",
  },
  {
    img: "media/icons/boy.png",
    name: "Active Customers",
    role: "Product Vendor",
    company: "Aditya Infoway",
    revenue: "₹15000",
    commission: "₹4000",

    status: "Rejected",
    color: "red",
  },
  {
    img: "media/icons/boy.png",
    name: "Bestseller Theme",
    role: "Service Vendor",
    company: "Aditya Infoway",
    revenue: "₹10000",
    commission: "₹2000",
    status: "In Progress",
    color: "yellow",
  },
];

const TopServiceVendor: FC<Props> = ({ className = "" }) => {
  const [activeTab, setActiveTab] = useState("month");

  return (
    <div
      className={`backdrop-blur-md bg-gradient-to-br from-white/90 to-gray-50/90 
      dark:from-gray-900/80 dark:to-gray-800/80 
      rounded-2xl shadow-lg border border-gray-100/60 dark:border-gray-700/60 
      p-6 transition-all duration-300 hover:shadow-xl ${className}`}
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-100 dark:border-gray-700 pb-5">
        <div>
          <h3 className="text-2xl font-semibold text-gray-900 dark:text-gray-100">
            Top Service Vendors
          </h3>
          {/* <p className="text-sm text-gray-500 dark:text-gray-400">
            More than 400 new products
          </p> */}
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
              <th className="py-3"></th>
              <th className="py-3 font-medium">Name</th>
              <th className="py-3 font-medium">Company</th>
              <th className="py-3 font-medium">Total Revenue</th>
              <th className="py-3 font-medium">Commission Earned</th>
              <th className="py-3"></th>
            </tr>
          </thead>
          <tbody>
            {sampleData.map((item, i) => (
              <tr
                key={i}
                className="border-b border-gray-100 dark:border-gray-700 hover:bg-blue-50/50 dark:hover:bg-blue-900/20 transition-all duration-200 group"
              >
                <td className="py-4 pr-3 flex items-center justify-center">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-gray-50 dark:bg-gray-700">
                    <img
                      src={toAbsoluteUrl(item.img)}
                      alt={item.name}
                      className="h-10 w-10"
                    />
                  </div>
                </td>
                <td className="py-4">
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {item.name}
                  </div>
                  {/* <div className="text-sm text-gray-500 dark:text-gray-400">
                                        {item.role}
                                    </div> */}
                </td>
                <td className="py-4 text-gray-700 dark:text-gray-300">
                  {item.company}
                </td>
                <td className="py-4 text-gray-700 dark:text-gray-300">
                  {item.revenue}
                </td>
                <td className="py-4 text-gray-700 dark:text-gray-300">
                  {item.commission}
                </td>
                {/* <td className="py-4">
                                    <span
                                        className={`px-2.5 py-1 rounded-full text-xs font-semibold ${item.color === "green"
                                                ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300"
                                                : item.color === "red"
                                                    ? "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300"
                                                    : item.color === "blue"
                                                        ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300"
                                                        : "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300"
                                            }`}
                                    >
                                        {item.status}
                                    </span>
                                </td> */}
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

export { TopServiceVendor };
