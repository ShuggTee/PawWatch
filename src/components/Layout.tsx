import { useNavigate, useLocation } from "react-router-dom";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "./AuthContext";
import { getNotifications } from "../data/api";
import type { EmailNotification } from "../types";

export default function Layout({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState<EmailNotification[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setNotifOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Fetch notifications when user is logged in
  useEffect(() => {
    if (user) {
      getNotifications()
        .then(setNotifications)
        .catch(() => setNotifications([]));
    } else {
      setNotifications([]);
    }
  }, [user]);

  const ownerTabs = [
    { path: "/", label: "Home", icon: "🏠" },
    { path: "/sitters", label: "Sitters", icon: "🔍" },
    { path: "/bookings", label: "Bookings", icon: "📋" },
  ];

  const sitterTabs = [
    { path: "/", label: "Home", icon: "🏠" },
    { path: "/sitter-dashboard", label: "My Jobs", icon: "📋" },
  ];

  const tabs = !user ? ownerTabs : user.role === "owner" ? ownerTabs : sitterTabs;
  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  const handleLogout = () => {
    logout();
    setMenuOpen(false);
    navigate("/");
  };

  return (
    <div className="flex min-h-dvh flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-amber-200 bg-amber-50/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center justify-between px-4 py-3">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
          >
            <span className="text-2xl">🐾</span>
            <span className="text-xl font-bold text-amber-700">PawWatch</span>
          </button>

          {!user ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate("/signin")}
                className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-200"
              >
                Sign In
              </button>
              <button
                onClick={() => navigate("/signup")}
                className="rounded-full bg-amber-500 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-amber-600"
              >
                Sign Up
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              {/* Notification bell */}
              <div className="relative" ref={notifRef}>
                <button
                  onClick={() => setNotifOpen(!notifOpen)}
                  className="relative rounded-full p-1.5 text-lg transition-colors hover:bg-amber-200"
                  aria-label="Notifications"
                >
                  🔔
                  {notifications.length > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                      {notifications.length > 9 ? "9+" : notifications.length}
                    </span>
                  )}
                </button>

                {notifOpen && (
                  <div className="absolute right-0 top-full mt-1 w-72 rounded-xl border border-amber-200 bg-white shadow-lg max-h-80 overflow-y-auto">
                    <div className="border-b border-amber-100 px-4 py-2">
                      <p className="text-sm font-semibold text-gray-800">
                        Notifications
                      </p>
                    </div>
                    {notifications.length === 0 ? (
                      <p className="px-4 py-6 text-center text-sm text-gray-400">
                        No notifications yet
                      </p>
                    ) : (
                      notifications.slice(0, 10).map((n) => (
                        <div
                          key={n.id}
                          className="border-b border-amber-50 px-4 py-2.5 last:border-b-0"
                        >
                          <p className="text-xs font-semibold text-gray-700">
                            {n.subject}
                          </p>
                          <p className="mt-0.5 text-[10px] text-gray-400">
                            {new Date(n.sentAt).toLocaleString()}
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* User menu */}
              <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 transition-colors hover:bg-amber-200"
              >
                <span>{user.role === "owner" ? "👤" : "🐕"}</span>
                <span className="max-w-[100px] truncate">{user.name}</span>
                <span className="text-[10px] opacity-60">▼</span>
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-amber-200 bg-white py-1 shadow-lg">
                  <div className="border-b border-amber-100 px-4 py-2">
                    <p className="text-sm font-semibold text-gray-800 truncate">
                      {user.name}
                    </p>
                    <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <span className="inline-block rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                        {user.role === "owner" ? "Owner" : "Sitter"}
                      </span>
                      {user.isPremium && (
                        <span className="inline-block rounded-full bg-yellow-100 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-700">
                          ⭐ Premium
                        </span>
                      )}
                      {user.isVerified && (
                        <span className="inline-block rounded-full bg-blue-100 px-1.5 py-0.5 text-[10px] font-semibold text-blue-700">
                          ✅ Verified
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
            </div>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1">{children}</main>

      {/* Bottom navigation */}
      <nav className="bottom-nav">
        <div className="mx-auto flex max-w-lg items-center justify-around">
          {tabs.map((tab) => (
            <button
              key={tab.path}
              onClick={() => navigate(tab.path)}
              className={`flex flex-col items-center gap-0.5 px-4 py-2 text-xs transition-colors ${
                isActive(tab.path)
                  ? "text-amber-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="font-medium">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
