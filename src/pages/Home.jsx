import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Star, Truck, ShieldCheck, RotateCcw } from "lucide-react";
import ProductCard from "../components/ProductCard";
import ProductCardSkeleton from "../components/ProductCardSkeleton";
import { fetchProducts } from "../services/api";
import { categories, testimonials } from "../services/mockData";

import kurtisImage from "../assets/categories/kurtis.jpeg";
import sareesImage from "../assets/categories/sarees.jpeg";
import dressesImage from "../assets/categories/dresses.jpeg";
import topsImage from "../assets/categories/tops.jpeg";
import coordSetsImage from "../assets/categories/coord-sets.jpeg";
import ethnicWearImage from "../assets/categories/Ethnic-Wear.jpeg";

import coverImage from "../assets/categories/coverimg.png";

export default function Home() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProducts()
      .then((data) => {
        setProducts(data);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Failed to load products:", error);
        setLoading(false);
      });
  }, []);

  const featured = products.filter((p) => p.isFeatured).slice(0, 4);

  const newArrivals = products.filter((p) => p.isNewArrival).slice(0, 4);

  const bestSellers = products.filter((p) => p.isBestSeller).slice(0, 4);

  const categoryImages = [
    kurtisImage,
    sareesImage,
    dressesImage,
    topsImage,
    coordSetsImage,
    ethnicWearImage,
  ];

  return (
    <div>
      {/* Hero / Cover Image */}
      <section
        className="relative min-h-[80vh] bg-cover bg-center bg-no-repeat text-ivory flex items-center"
        style={{ backgroundImage: `url(${coverImage})` }}
      >
        <div className="absolute inset-0 bg-black/45" />

        <div className="relative z-10 max-w-7xl mx-auto px-5 md:px-8 py-20 w-full">
          <p className="eyebrow text-champagne">Autumn Collection · 2026</p>

          <h1
            className="font-display text-[13vw] leading-[0.95] md:text-6xl mt-3 animate-fadeUp"
            style={{
              animationDelay: "0.1s",
              opacity: 0,
            }}
          >
            Draped in
            <br />
            quiet confidence
          </h1>

          <div
            className="ribbon-rule mt-6 animate-drape"
            style={{ animationDelay: "0.5s" }}
          />

          <p
            className="text-ivory/80 mt-6 max-w-sm animate-fadeUp"
            style={{
              animationDelay: "0.2s",
              opacity: 0,
            }}
          >
            Hand-finished silhouettes for women who dress with intention. From
            everyday kurtis to occasion-ready sarees — crafted, not
            mass-produced.
          </p>

          <div
            className="mt-8 flex gap-4 animate-fadeUp"
            style={{
              animationDelay: "0.3s",
              opacity: 0,
            }}
          >
            <Link to="/shop" className="btn-primary">
              Shop the Edit
              <ArrowRight size={16} />
            </Link>

            <Link to="/shop?new=true" className="btn-outline">
              New Arrivals
            </Link>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-b border-ink/10">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-6 grid grid-cols-3 gap-4 text-center">
          {[
            {
              icon: Truck,
              label: "Tracked Delivery",
            },
            {
              icon: ShieldCheck,
              label: "Quality Checked",
            },
            {
              icon: ShieldCheck,
              label: "Secure Payments",
            },
          ].map(({ icon: Icon, label }) => (
            <div
              key={label}
              className="flex flex-col items-center gap-1.5 text-xs md:text-sm text-stone"
            >
              <Icon size={18} className="text-wine" />
              {label}
            </div>
          ))}
        </div>
      </section>

      {/* Categories */}
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-16">
        <div className="section-label">
          <div className="ribbon-rule" />
          <p className="eyebrow">Shop by Category</p>
        </div>

        <h2 className="text-2xl md:text-3xl mb-8">Find your silhouette</h2>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {categories.map((cat, i) => (
            <Link
              key={cat}
              to={`/shop?category=${encodeURIComponent(cat)}`}
              className="group relative aspect-[4/3] overflow-hidden bg-white"
            >
              <img
                src={categoryImages[i]}
                alt={cat}
                className="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
              />

              <div className="absolute inset-0 bg-ink/20 group-hover:bg-ink/35 transition-colors" />

              <span className="absolute bottom-4 left-4 text-ivory font-display text-lg drop-shadow-md">
                {cat}
              </span>
            </Link>
          ))}
        </div>
      </section>

      {/* Featured */}
      <ProductRow
        title="Featured Pieces"
        eyebrow="Curated for You"
        loading={loading}
        products={featured}
      />

      {/* New Arrivals */}
      <ProductRow
        title="New Arrivals"
        eyebrow="Just Landed"
        loading={loading}
        products={newArrivals}
      />

      {/* Best Sellers */}
      <ProductRow
        title="Best Sellers"
        eyebrow="Loved by Customers"
        loading={loading}
        products={bestSellers}
      />

      {/* Promo banner
      <section className="bg-wine text-ivory">
        <div className="max-w-7xl mx-auto px-5 md:px-8 py-14 flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
          <div>
            <p className="eyebrow text-champagne">
              Limited Time
            </p>

            <h3 className="font-display text-2xl md:text-3xl mt-2">
              Flat 20% off on all Sarees
            </h3>
          </div>

          <Link
            to="/shop?category=Sarees"
            className="btn-outline border-ivory/40 text-ivory hover:border-champagne hover:text-champagne"
          >
            Shop Sarees
            <ArrowRight size={16} />
          </Link>
        </div>
      </section>
      */}

      {/* Testimonials
      <section className="max-w-7xl mx-auto px-5 md:px-8 py-16">
        <div className="section-label">
          <div className="ribbon-rule" />
          <p className="eyebrow">Customer Love</p>
        </div>

        <h2 className="text-2xl md:text-3xl mb-8">
          What they're saying
        </h2>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((t) => (
            <div
              key={t.name}
              className="bg-white border border-ink/10 p-6"
            >
              <div className="flex gap-0.5 text-champagne mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star
                    key={i}
                    size={14}
                    className={
                      i < Math.round(t.rating)
                        ? "fill-champagne"
                        : "text-blush"
                    }
                  />
                ))}
              </div>

              <p className="text-sm text-ink/80 leading-relaxed">
                &ldquo;{t.text}&rdquo;
              </p>

              <p className="text-xs text-stone mt-4 uppercase tracking-wide">
                {t.name}
              </p>
            </div>
          ))}
        </div>
      </section>
      */}
    </div>
  );
}

function ProductRow({ title, eyebrow, products, loading }) {
  if (!loading && products.length === 0) {
    return null;
  }

  return (
    <section className="max-w-7xl mx-auto px-5 md:px-8 py-16">
      <div className="section-label">
        <div className="ribbon-rule" />
        <p className="eyebrow">{eyebrow}</p>
      </div>

      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl md:text-3xl">{title}</h2>

        <Link to="/shop" className="text-sm flex items-center gap-1">
          View All
          <ArrowRight size={15} />
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))
          : products.map((p) => (
              <ProductCard key={p._id || p.id} product={p} />
            ))}
      </div>
    </section>
  );
}
