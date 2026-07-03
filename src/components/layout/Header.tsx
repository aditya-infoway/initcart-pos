import React from "react";
import { FaBars, FaSignOutAlt } from "react-icons/fa";
import { IoMdPerson } from "react-icons/io";
import { motion, AnimatePresence } from "framer-motion";

interface HeaderProps {
  profileOpen: boolean;
  logout: () => void;
  setSidebarOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setProfileOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

const Header = ({
  profileOpen,
  logout,
  setSidebarOpen,
  setProfileOpen,
}: HeaderProps) => {
  return (
    <header className="flex justify-between items-center p-4 bg-white shadow-lg sticky top-0 z-20 border-b border-blue-100">
      <button
        className="lg:hidden p-2 rounded hover:bg-blue-50 transition-colors"
        onClick={() => setSidebarOpen(true)}
      >
        <FaBars size={22} color="#0165ff" />
      </button>

      <div className="text-xl font-bold text-[#0165ff] ms-[360px]">
        Dashboard
      </div>

      <div className="relative">
        <button
          onClick={() => setProfileOpen((prev) => !prev)}
          className="flex items-center gap-2 p-2 rounded hover:bg-blue-50 transition-colors"
        >
          <IoMdPerson size={22} color="#0165ff" />
        </button>

        <AnimatePresence>
          {profileOpen && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute right-0 mt-2 w-48 bg-white shadow-lg border border-blue-200 rounded-lg overflow-hidden"
            >
              <div className="px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer transition-colors border-b border-blue-100">
                My Profile
              </div>
              <div
                className="px-4 py-3 text-sm text-gray-700 hover:bg-blue-50 cursor-pointer flex items-center gap-2 transition-colors"
                onClick={logout}
              >
                <FaSignOutAlt className="text-[#0165ff]" size={16} /> Logout
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </header>
  );
};

export default Header;