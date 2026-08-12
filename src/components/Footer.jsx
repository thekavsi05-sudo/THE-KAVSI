import { Link } from "react-router-dom";
import { Instagram, Facebook, Mail, Phone } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-ink text-ivory mt-24">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-16 grid grid-cols-2 md:grid-cols-4 gap-10">
        <div className="col-span-2 md:col-span-1">
          <span className="font-display text-2xl">The KAVSI</span>
          <p className="text-sm text-ivory/60 mt-4 leading-relaxed">
            Considered women&apos;s clothing, made to be worn — not just bought.
          </p>
          <div className="flex gap-4 mt-5">
            <a
              href="https://www.instagram.com/thekavsi?igsh=MTV1ZXJwMmttM29udg=="
              aria-label="Instagram"
              className="text-ivory/70 hover:text-champagne transition-colors"
            >
              <Instagram size={18} />
            </a>
            <a
              href="#"
              aria-label="Facebook"
              className="text-ivory/70 hover:text-champagne transition-colors"
            >
              <Facebook size={18} />
            </a>
          </div>
        </div>

        <div>
          <p className="eyebrow text-champagne">Shop</p>
          <ul className="mt-4 space-y-2 text-sm text-ivory/70">
            <li>
              <Link to="/shop" className="hover:text-ivory">
                New Arrivals
              </Link>
            </li>
            <li>
              <Link to="/shop" className="hover:text-ivory">
                Best Sellers
              </Link>
            </li>
            <li>
              <Link to="/shop" className="hover:text-ivory">
                All Products
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="eyebrow text-champagne">Company</p>
          <ul className="mt-4 space-y-2 text-sm text-ivory/70">
            <li>
              <Link to="/about" className="hover:text-ivory">
                About Us
              </Link>
            </li>
            <li>
              <Link to="/faq" className="hover:text-ivory">
                FAQ
              </Link>
            </li>
            <li>
              <Link to="/contact" className="hover:text-ivory">
                Contact
              </Link>
            </li>
            <li>
              <Link to="/track-order" className="hover:text-ivory">
                Track Order
              </Link>
            </li>
          </ul>
        </div>

        <div>
          <p className="eyebrow text-champagne">Get in Touch</p>
          <ul className="mt-4 space-y-2 text-sm text-ivory/70">
            <li className="flex items-center gap-2">
              <Phone size={14} /> +91 94907 77920
            </li>
            <li className="flex items-center gap-2">
              <Mail size={14} /> thekavsi05@gmail.com
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ivory/10 py-5 text-center text-xs text-ivory/50">
        © {new Date().getFullYear()} The KAVSI. All rights reserved.
      </div>
    </footer>
  );
}
