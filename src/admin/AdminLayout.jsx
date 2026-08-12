import { useState } from "react";
import { NavLink, useNavigate, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingBag,
  PackageSearch,
  LogOut,
  Menu,
  X,
  FolderTree,
  MessageSquare,
  KeyRound,
} from "lucide-react";
import { useAdminAuth } from "../context/AdminAuthContext";

const navItems = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/products", label: "Products", icon: PackageSearch },
  { to: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { to: "/admin/categories", label: "Categories", icon: FolderTree },
  { to: "/admin/messages", label: "Contact Messages", icon: MessageSquare },
  {
    to: "/admin/change-password",
    label: "Change Password",
    icon: KeyRound,
  },
];

export default function AdminLayout() {
  const { logout } = useAdminAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/admin/login");
  }

  const Sidebar = (
    <div className="flex flex-col h-full">
      <div className="px-6 py-6 border-b border-ivory/10">
        <span className="font-display text-xl text-ivory">The KAVSI</span>
        <p className="text-[10px] text-ivory/50 uppercase tracking-widest2 mt-1">
          Admin Panel
        </p>
      </div>
      <nav className="flex-1 px-3 py-6 space-y-1">
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            onClick={() => setOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2.5 text-sm rounded transition-colors ${
                isActive
                  ? "bg-wine text-ivory"
                  : "text-ivory/70 hover:bg-ivory/10 hover:text-ivory"
              }`
            }
          >
            <Icon size={16} /> {label}
          </NavLink>
        ))}
      </nav>
      <div className="px-3 py-6 border-t border-ivory/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 text-sm text-ivory/70 hover:text-ivory w-full"
        >
          <LogOut size={16} /> Log Out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ivory flex">
      {/* Desktop sidebar */}
      <aside className="hidden md:block w-64 bg-ink shrink-0">{Sidebar}</aside>

      {/* Mobile sidebar */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-ink/50"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-64 bg-ink">
            {Sidebar}
          </div>
        </div>
      )}

      <div className="flex-1 min-w-0">
        <header className="md:hidden flex items-center justify-between px-5 h-16 border-b border-ink/10 bg-ivory sticky top-0 z-30">
          <button onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
          <span className="font-display text-lg">The KAVSI Admin</span>
          <span className="w-5" />
        </header>
        <main className="p-5 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
