// Navbar.tsx
import React, { useState } from "react";
import { Home, History, Plus, Zap, Lock } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { twMerge } from "tailwind-merge";
import { useAuth } from "../contexts/AuthContext";
import PasswordModal from "./PasswordModal";

export type PageName = "dashboard" | "history" | "new" | "tune";

interface NavbarProps {
  activePage: PageName;
}

interface NavItemProps {
  name: PageName;
  label: string;
  requireAuth: boolean;
  icon: React.ReactElement;
}

const navItems: NavItemProps[] = [
  {
    name: "dashboard",
    label: "Dashboard",
    requireAuth: false,
    icon: <Home className="w-4 h-4" />,
  },
  {
    name: "tune",
    label: "Tuning",
    requireAuth: true,
    icon: <Zap className="w-4 h-4" />,
  },
  {
    name: "history",
    label: "History",
    requireAuth: true,
    icon: <History className="w-4 h-4" />,
  },
  {
    name: "new",
    label: "Add Kernels",
    requireAuth: true,
    icon: <Plus className="w-4 h-4" />,
  },
];

const Navbar: React.FC<NavbarProps> = ({ activePage }) => {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<PageName | null>(
    null
  );

  const handleNavClick = (e: React.MouseEvent, item: NavItemProps) => {
    if (item.requireAuth && !isAuthenticated) {
      e.preventDefault();
      setPendingNavigation(item.name);
      setShowPasswordModal(true);
    }
  };

  const handlePasswordSubmit = async (password: string) => {
    const success = await login(password);
    if (success && pendingNavigation) {
      navigate(`/${pendingNavigation}`);
      setPendingNavigation(null);
    } else if (!success) {
      throw new Error("Invalid password");
    }
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-40 bg-gray-50 border-b border-gray-200 backdrop-blur-sm">
        <div className="mx-auto px-12">
          <div className="flex justify-between items-center h-16">
            {/* Logo/Brand */}
            <div className="flex items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-white" />
                </div>
                <h1 className="text-xl font-bold text-gray-900">
                  Kernel Benchmark
                </h1>
              </div>
            </div>

            {/* Navigation Items */}
            <nav className="hidden md:flex items-center space-x-1">
              {navItems.map((item) => {
                const isLocked = item.requireAuth && !isAuthenticated;
                const isActive = activePage === item.name;

                return (
                  <Link
                    key={item.name}
                    to={`/${item.name}`}
                    onClick={(e) => handleNavClick(e, item)}
                    className={twMerge(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                      isActive
                        ? "bg-blue-100 text-blue-700 shadow-sm"
                        : isLocked
                          ? "text-gray-400 hover:text-gray-500"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                    )}
                  >
                    {isLocked ? <Lock className="w-4 h-4" /> : item.icon}
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Mobile menu button - placeholder for future mobile implementation */}
            <div className="md:hidden">
              <button className="p-2 rounded-lg text-gray-600 hover:text-gray-900 hover:bg-gray-100">
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <PasswordModal
        isOpen={showPasswordModal}
        onClose={() => {
          setShowPasswordModal(false);
          setPendingNavigation(null);
        }}
        onSubmit={handlePasswordSubmit}
      />
    </>
  );
};

export default Navbar;
