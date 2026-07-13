import React, { useState, useEffect, useRef } from "react";
import api from "../../api/api";
import { useAuthStore } from "../../store/authStore";
import { FaBalanceScale, FaBars, FaBook, FaChartLine, FaRegFileAlt, FaBookOpen, FaExchangeAlt, FaCheckCircle, FaShoppingCart } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";
import { toAbsoluteUrl } from "../../utils/reuseable";
import Sidebar from "./Sidebar";
import { TbReportMoney } from "react-icons/tb";
import {
  MdDashboard,
  MdOutlineInventory2,
  MdOutlineLogout,
} from "react-icons/md";
import { MdOutlineAttachMoney } from "react-icons/md";
import { FaUserTie } from "react-icons/fa";
import {
  AiOutlineShoppingCart,
  AiOutlineBarChart,
} from "react-icons/ai";
import { BsBank, BsCashCoin } from "react-icons/bs";
import { FiTrendingUp } from "react-icons/fi";

// ── Types ──────────────────────────────────────────────────
interface SubSubMenu {
  name: string;
  to: string;
}

interface SubMenu {
  name: string;
  to?: string;
  submenu?: SubSubMenu[];
}

interface MenuItem {
  title: string;
  icon: React.ReactNode;
  to?: string;
  submenu?: SubMenu[];
}

interface MenuCategory {
  category?: string;
  items: MenuItem[];
}

// ── Menu Items ─────────────────────────────────────────────
export const menuItems: MenuCategory[] = [
  {
    items: [
      {
        title: "Dashboard",
        icon: <MdDashboard size={20} />,
        to: "/",
        submenu: [],
      },
    ],
  },
  {
    items: [
      {
        title: "Master",
        icon: <FaUserTie size={20} />,
        submenu: [
          { name: "Account Creation", to: "/addAccounts" },
          { name: "Branch Master", to: "/branchMaster"},
          { name: "Add Items", to: "/AddItems" },
          { name: "Website Items", to: "/WebItems" },
          { name: "Item Barcodes", to: "/PendingBarcodes" },
          { name: "Orders", to: "/Orders" },
          { name: "Group", to: "/createGroup" },
          { name: "Item Import", to: "/ExcelImportExport" },
        ],
      },
    ],
  },
  {
    items: [
      {
        title: "Order Items",
        icon: <FaShoppingCart size={20} />,
        to: "/order-items",
        submenu: [],
      },
    ],
  },
  {
    items: [
      {
        title: "Stock Verification",
        icon: <FaCheckCircle size={20} />,
        to: "/stock-verification",
        submenu: [],
      },
    ],
  },
  {
    items: [
      {
        title: "Stock Return",
        icon: <FaCheckCircle size={20} />,
        to: "/stockReturn",
        submenu: [],
      },
    ],
  },
  {
    items: [
      {
        title: "Stock Return Verification",
        icon: <FaCheckCircle size={20} />,
        to: "/stockReturnverification",
        submenu: [],
      },
    ],
  },
  {
    items: [
      {
        title: "Stock Transfer",
        icon: <FaExchangeAlt size={20} />,
        to: "/stockTransfer",
        submenu: [],
      },
    ],
  },
    {
    items: [
      {
        title: "B2B Stock Transfer",
        icon: <FaExchangeAlt size={20} />,
        to: "/b2bstockTransfer",
        submenu: [],
      },
    ],
  },
  {
    items: [
      {
        title: "purchase",
        icon: <MdOutlineInventory2 size={20} />,
        submenu: [
          { name: "Purchase Entry", to: "/Addpurchaseitem" },
          { name: "Purchase Return", to: "/purchaseReturnList" },
          { name: "Create Order", to: "#" },
          { name: "Purchase Order Verify", to: "#" },
        ],
      },
    ],
  },
  {
    items: [
      {
        title: "sales",
        icon: <AiOutlineShoppingCart size={20} />,
        submenu: [
          { name: "Sales Entry & Report", to: "/Addsalesitem" },
          { name: "Sales Entry2", to: "/salesentry2" },
          { name: "Sales Return & Report", to: "/salesReturnList" },
        ],
      },
    ],
  },
  {
    items: [
      {
        title: "payment",
        icon: <MdOutlineAttachMoney size={20} />,
        submenu: [
          { name: "Bank Payment", to: "/Bank-payment" },
          { name: "Bank Receipt", to: "/Bank-receipt" },
          { name: "Cash Payment", to: "/Cash-Payment" },
          { name: "Cash Receipt", to: "/Cash-receipt" },
          { name: "Contra", to: "/Contra" },
          { name: "Journal Entries", to: "/JournalEntries" },
        ],
      }
    ],
  },
  {
    items: [
      {
        title: "Stock Report",
        icon: <MdOutlineInventory2 size={20} />,
        to: "/stock-report",
        submenu: [],
      },
    ],
  },
  {
    items: [
      {
        title: "Ledger Report",
        icon: <FaRegFileAlt size={20} />,
        to: "/ledger-report",
        submenu: [],
      },
    ],
  },
  {
    items: [
      {
        title: "Report",
        icon: <FaBookOpen size={20} />,
        submenu: [
          { name: "Outstanding", to: "/outStandingReport" },
          { name: "Sales Register", to: "/salesEntryRegister" },
          { name: "Purchase Register", to: "/purchaseRegister" },
          { name: "Sales Return Register", to: "/salesReturnRegister" },
          { name: "Purchase Return Register", to: "/purchaseReturnRegister" },
          { name: "Due Payment", to: "/duePaymentReport" },
          { name: "Debit note Register", to: "#" },
          { name: "Credit Note Register", to: "#" },
          { name: "Quick Recipte Register", to: "#" },
          { name: "Quick Payment Register", to: "#" },
        ],
      },
    ],
  },
  {
    items: [
      {
        title: "Day Book",
        icon: <FaBook size={20} />,
        to: "/dayBook",
        submenu: [],
      },
    ],
  },
  {
    items: [
      {
        title: "Sales Profit Report",
        icon: <FiTrendingUp size={20} />,
        to: "/salesProfitReport",
        submenu: [],
      },
    ],
  },
  {
    items: [
      {
        title: "Cash Book",
        icon: <BsCashCoin size={20} />,
        to: "/cashBook",
        submenu: [],
      },
    ],
  },
  {
    items: [
      {
        title: "Bank Book",
        icon: <BsBank size={20} />,
        to: "/bankBook",
        submenu: [],
      },
    ],
  },
  {
    items: [
      {
        title: "Balance Sheet",
        icon: <FaBalanceScale size={20} />,
        to: "#",
        submenu: [],
      },
    ],
  },
  {
    items: [
      {
        title: "P & L Report",
        icon: <FaChartLine size={20} />,
        to: "#",
        submenu: [],
      },
    ],
  },
  {
    items: [
      {
        title: "Tranding Account",
        icon: <AiOutlineBarChart size={20} />,
        to: "#",
        submenu: [],
      },
    ],
  },
  {
    items: [
      {
        title: "GST Report",
        icon: <TbReportMoney size={20} />,
        to: "#",
        submenu: [],
      },
    ],
  },
  {
    items: [
      {
        title: "Logout",
        icon: <MdOutlineLogout size={20} />,
        to: "/logout",
        submenu: [],
      },
    ],
  },
];

// ── Main AppLayout ──────────────────────────────────────────
const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuthStore();
  const isSuperAdmin = user?.role === "superadmin";
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isIconOnly, setIsIconOnly] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string>("Dashboard");
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const [branchLogo, setBranchLogo] = useState<string | null>(null);
  const [branchName, setBranchName] = useState<string>("");

  // ✅ CORRECT FILTERING LOGIC
  const filteredMenuItems = React.useMemo(() => {
    if (!menuItems) return [];
    
    const isBranchOrVendor = user?.role === 'branch' || user?.role === 'vendor' || 
                             user?.role === 'branch_both' || user?.role === 'branch_customer' ||
                             user?.role === 'branch_agent' || user?.role === 'branch_single';
    
    if (isSuperAdmin) {
      // ✅ SUPER ADMIN:
      // Show: Stock Transfer, Stock Return Verification
      // Hide: Stock Verification, Order Items, Stock Return
      return menuItems
        .map(category => ({
          ...category,
          items: category.items.filter(item => 
            item.title !== "Stock Verification" && 
            item.title !== "Order Items" &&
            item.title !== "Stock Return"  &&
            item.title !== "B2B Stock Transfer"
          )
        }))
        .filter(category => category.items.length > 0);
    }
    
if (isBranchOrVendor) {
  return menuItems
    .map(category => ({
      ...category,
      items: category.items
        .map(item => {
          // ✅ If this is the "Master" menu item, filter its submenu
          if (item.title === "Master" && item.submenu) {
            return {
              ...item,
              submenu: item.submenu.filter(sub => sub.name !== "Branch Master")
            };
          }
          return item;
        })
        .filter(item => 
          item.title !== "Stock Transfer" && 
          item.title !== "Stock Return Verification"
        )
    }))
    .filter(category => category.items.length > 0);
}
    
    // ✅ OTHER ROLES:
    // Hide all stock-related menus
    return menuItems
      .map(category => ({
        ...category,
        items: category.items.filter(
          item => 
            item.title !== "Stock Transfer" && 
            item.title !== "Stock Verification" && 
            item.title !== "Stock Return" &&
            item.title !== "Stock Return Verification" &&
            item.title !== "Order Items"
        )
      }))
      .filter(category => category.items.length > 0);
  }, [isSuperAdmin, user?.role]);

  // ── Effects ──
  useEffect(() => {
    const fetchBranchData = async () => {
      try {
        const response = await api.get("/auth/me/");
        if (response.data.success && response.data.data) {
          const branchData = response.data.data;
          if (branchData.branch_logo_url) {
            const logoUrl = branchData.branch_logo_url.startsWith("http")
              ? branchData.branch_logo_url
              : `http://localhost:8000${branchData.branch_logo_url}`;
            setBranchLogo(logoUrl);
          }
          setBranchName(branchData.branch_name || "Branch");
        }
      } catch (error) {
        console.error("Failed to fetch branch data:", error);
      }
    };
    fetchBranchData();
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      setSidebarOpen(!mobile);
      setIsIconOnly(false);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    const path = location.pathname;
    for (const category of menuItems) {
      for (const item of category.items) {
        if (item.to && item.to === path) {
          setActiveMenu(item.title);
          return;
        }
        if (item.submenu && item.submenu.length > 0) {
          const matchedSub = item.submenu.find((s) => s.to === path);
          if (matchedSub) {
            setActiveMenu(matchedSub.name);
            return;
          }
        }
      }
    }
  }, [location.pathname]);

  const handleMenuClick = (title: string, path: string) => {
    setActiveMenu(title);
    navigate(path);
    if (isMobile) setSidebarOpen(false);
  };

  const toggleSidebar = () => setSidebarOpen((prev) => !prev);
  const toggleIconOnly = () => setIsIconOnly((prev) => !prev);

  return (
    <div className="flex flex-col lg:flex-row bg-gray-100 min-h-screen overflow-y-hidden">
      <Sidebar
        menuItems={filteredMenuItems}
        sidebarOpen={sidebarOpen}
        isIconOnly={isIconOnly}
        isMobile={isMobile}
        toggleSidebar={toggleSidebar}
        toggleIconOnly={toggleIconOnly}
        handleMenuClick={handleMenuClick}
        activeMenu={activeMenu}
      />

      <div
        className={`flex-1 flex flex-col min-h-screen overflow-y-hidden transition-all duration-300 
         ${isMobile && sidebarOpen ? "opacity-50" : ""}`}
      >
        {/* Header */}
        <div className="flex justify-between lg:justify-end items-center px-4 py-1 bg-white shadow">
          <button onClick={toggleSidebar} className="lg:hidden">
            <FaBars size={24} />
          </button>
          <div className="relative" ref={menuRef}>
            <div
              className="flex items-center gap-4 cursor-pointer"
              onClick={() => setOpen((prev) => !prev)}
            >
              {branchLogo ? (
                <img
                  src={branchLogo}
                  height={40}
                  width={40}
                  alt={branchName}
                  className="rounded-full hover:ring-gray-300 transition-all duration-200 object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = toAbsoluteUrl("media/icons/profile.jpg");
                  }}
                />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center text-gray-500">
                  {branchName.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            {open && (
              <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
                <button
                  onClick={() => { navigate("/profile"); setOpen(false); }}
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                >
                  Profile
                </button>
                <button
                  onClick={() => { navigate("/Setting"); setOpen(false); }}
                  className="block w-full text-left px-4 py-2 text-gray-700 hover:bg-gray-100 transition cursor-pointer"
                >
                  Setting
                </button>
                <button
                  onClick={() => navigate("/logout")}
                  className="block w-full text-left px-4 py-2 text-red-600 hover:bg-red-50 transition cursor-pointer"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Content */}
        <div className={`p-4 flex-1 ${isIconOnly ? "lg:ms-20" : "lg:ms-64"}`}>
          {children}
        </div>
      </div>
    </div>
  );
};

export default AppLayout;