import { useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Search, ShoppingBag, Menu, X } from "lucide-react";
import { useCart } from "../context/CartContext";
import logo from "../assets/categories/logo.jpeg";

const links = [
  { to: "/", label: "Home" },
  { to: "/shop", label: "Shop" },
  { to: "/about", label: "About" },
  { to: "/contact", label: "Contact" },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { totalItems } = useCart();

  return (
    <header className="sticky top-0 z-40 bg-ivory border-b border-ink/10">
      <div className="max-w-7xl mx-auto px-5 md:px-8">
        <div className="flex items-center justify-between h-20">
          <button
            className="md:hidden p-2 -ml-2"
            onClick={() => setOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={22} />
          </button>

          <Link to="/" className="flex items-center gap-3">
            <img
              src={logo}
              alt="The KAVSI"
              className="h-12 w-12 md:h-14 md:w-14 rounded-full object-cover"
            />

            <div className="flex flex-col leading-none">
              <span className="font-display text-2xl md:text-3xl tracking-wide">
                The KAVSI
              </span>

              <span className="hidden md:block text-[10px] tracking-widest2 uppercase text-stone mt-1">
                Women&apos;s Fashion
              </span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-9">
            {links.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                className={({ isActive }) =>
                  `text-sm tracking-wide uppercase font-medium transition-colors ${
                    isActive ? "text-wine" : "text-ink/70 hover:text-wine"
                  }`
                }
              >
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-1 md:gap-3">
            <form
              className="hidden md:flex items-center border border-ink/15 px-3 py-2 w-52 focus-within:border-wine transition-colors"
              onSubmit={(e) => {
                e.preventDefault();
                window.location.href = `/shop?search=${encodeURIComponent(query)}`;
              }}
            >
              <Search size={16} className="text-stone shrink-0" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="ml-2 text-sm bg-transparent outline-none w-full placeholder:text-stone"
              />
            </form>
            <Link to="/cart" className="relative p-2" aria-label="View bag">
              <ShoppingBag size={22} />
              {totalItems > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-wine text-ivory text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {totalItems}
                </span>
              )}
            </Link>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 top-0 h-full w-72 bg-ivory shadow-fold p-6 animate-fadeUp">
            <div className="flex items-center justify-between mb-8">
              <span className="font-display text-xl">The KAVSI</span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="p-1"
              >
                <X size={22} />
              </button>
            </div>
            <form
              className="flex items-center border border-ink/15 px-3 py-2 mb-6"
              onSubmit={(e) => {
                e.preventDefault();
                setOpen(false);
                window.location.href = `/shop?search=${encodeURIComponent(query)}`;
              }}
            >
              <Search size={16} className="text-stone" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="ml-2 text-sm bg-transparent outline-none w-full"
              />
            </form>
            <nav className="flex flex-col gap-5">
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.to === "/"}
                  onClick={() => setOpen(false)}
                  className="text-base tracking-wide uppercase font-medium text-ink/80"
                >
                  {l.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
