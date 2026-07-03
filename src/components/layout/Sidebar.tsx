import React, { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FaChevronDown, FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { useLocation, useNavigate } from "react-router-dom";

/* ---------------- Animation Variants ---------------- */
const submenuVariants = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: "auto", opacity: 1, transition: { staggerChildren: 0.05 } },
  exit: { height: 0, opacity: 0 },
};

const itemVariants = {
  hidden: { opacity: 0, x: -6 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.2 } },
};

/* ---------------- Types ---------------- */
interface SidebarProps {
  menuItems: any[];
  sidebarOpen: boolean;
  isIconOnly: boolean;
  isMobile: boolean;
  activeMenu: string;
  toggleSidebar: () => void;
  toggleIconOnly: () => void;
  handleMenuClick: (title: string, path: string) => void;
}

/* ---------------- Component ---------------- */
const Sidebar: React.FC<SidebarProps> = ({
  menuItems,
  sidebarOpen,
  isIconOnly,
  isMobile,
  
  toggleSidebar,
  toggleIconOnly,
  
}) => {
  const [openMenus, setOpenMenus] = useState<{ [key: string]: boolean }>({});
  const [isTablet, setIsTablet] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  /* -------- Detect Tablet -------- */
  useEffect(() => {
    const checkTablet = () => setIsTablet(window.innerWidth >= 768 && window.innerWidth < 1024);
    checkTablet();
    window.addEventListener("resize", checkTablet);
    return () => window.removeEventListener("resize", checkTablet);
  }, []);

  /* -------- Auto open based on route -------- */
  useEffect(() => {
    const open: { [key: string]: boolean } = {};
    menuItems.forEach((section: any, sIdx: number) => {
      section.items.forEach((item: any, iIdx: number) => {
        const itemKey = `${sIdx}-${iIdx}`;
        if (location.pathname === item.to) open[itemKey] = true;

        item.submenu?.forEach((sub: any, j: number) => {
          const subKey = `${itemKey}-${j}`;
          if (location.pathname.startsWith(sub.to)) {
            open[itemKey] = true;
            open[subKey] = true;
          }
          sub.submenu?.forEach((ss: any, k: number) => {
            const ssKey = `${subKey}-${k}`;
            if (location.pathname.startsWith(ss.to)) {
              open[itemKey] = true;
              open[subKey] = true;
              open[ssKey] = true;
            }
          });
        });
      });
    });
    setOpenMenus(open);
  }, [location.pathname, menuItems]);

  /* -------- Toggle accordion -------- */
  const toggleMenu = (key: string) => {
    setOpenMenus((prev) => {
      const level = key.split("-").length;
      const next: { [key: string]: boolean } = {};
      Object.keys(prev).forEach((k) => {
        if (k.split("-").length === level && k !== key) next[k] = false;
        else next[k] = prev[k];
      });
      next[key] = !prev[key];
      return next;
    });
  };

  /* -------- Render Menu Item -------- */
  const renderMenuItem = (item: any, itemKey: string, level: number) => {
    const isActive = location.pathname === item.to;

    return (
      <div key={itemKey} className="relative pl-4">
        {/* Curved connector for nested levels */}
        {level > 1 && (
          <svg
            className="absolute"
            style={{
              top: "50%",
              left: `${level * 4}px`,
              transform: "translateY(-50%)",
              overflow: "visible",
            }}
            width={12}
            height="100%"
          >
            <line
              x1={6}
              y1={0}
              x2={6}
              y2="100%"
              stroke="#06b6d4"
              strokeWidth={2}
              strokeLinecap="round"
            />
            <path
              d="M6,2 Q6,6 20,6"
              stroke="#06b6d4"
              strokeWidth={2}
              fill="transparent"
              strokeLinecap="round"
            />
          </svg>
        )}

        {/* Main button */}
        <button
          onClick={() => {
            if (item.submenu?.length) {
              toggleMenu(itemKey);
            } else {
              navigate(item.to);
              if (isMobile || isTablet) toggleSidebar(); // auto close
            }
          }}
          className={`flex items-center justify-between w-full py-2 px-3 rounded-lg transition-all
    ${isActive ? "bg-blue-700/70 border-l-4 border-cyan-400 shadow-lg" : "hover:bg-white/10"}`}
        >
          <div className="flex items-center gap-3">
            <span className="text-cyan-300">{item.icon}</span>
            {!isIconOnly && <span className="text-sm">{item.title || item.name}</span>}
          </div>

          {item.submenu?.length > 0 && !isIconOnly && (
            <FaChevronDown
              className={`transition-transform duration-300 ${openMenus[itemKey] ? "rotate-180" : ""}`}
            />
          )}
        </button>


        {/* Submenu */}
        <AnimatePresence initial={false}>
          {openMenus[itemKey] && item.submenu?.length > 0 && (
            <motion.div
              variants={submenuVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              className="ml-2 mt-2 relative"
            >
              {item.submenu.map((sub: any, j: number) => {
                const subKey = `${itemKey}-${j}`;
                return (
                  <motion.div key={subKey} variants={itemVariants}>
                    {renderMenuItem(sub, subKey, level + 1)}
                  </motion.div>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  /* ---------------- JSX ---------------- */
  return (
    <>
      <div
        className={`transition-all duration-300 bg-gradient-to-b from-indigo-950 via-indigo-900 to-blue-900 text-white
        ${sidebarOpen ? (isIconOnly ? "w-20" : "w-67") : "w-0"}
        fixed top-0 left-0 z-50 h-screen overflow-y-auto shadow-xl`}
      >
        {/* Header */}
        <div
          className={`flex items-center justify-between py-4 border-b border-white/10 ${isIconOnly ? "px-2 justify-center" : "px-4"
            }`}
        >
          {!isIconOnly && <h1 className="font-bold text-lg tracking-wide">POS</h1>}
          <button
            onClick={isMobile || isTablet ? toggleSidebar : toggleIconOnly}
            className="hover:text-cyan-300"
          >
            {sidebarOpen && !isIconOnly ? <FaChevronLeft /> : <FaChevronRight />}
          </button>
        </div>

        {/* Menu */}
        <div className="flex-1 overflow-y-auto mt-3 px-2 space-y-2 pb-5">
          {menuItems.map((section: any, sIdx: number) => (
            <div key={sIdx}>
              {!isIconOnly && section.category && (
                <h2 className="text-xs uppercase text-gray-400 px-3 mb-2">{section.category}</h2>
              )}
              {section.items.map((item: any, iIdx: number) =>
                renderMenuItem(item, `${sIdx}-${iIdx}`, 1)
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mobile/Tablet Overlay */}
      {/* {(isMobile || isTablet) && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={toggleSidebar}
        />
      )} */}
    </>
  );
};

export default Sidebar;
