import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { SlidersHorizontal, X, ChevronDown } from "lucide-react";
import ProductCard from "../components/ProductCard";
import ProductCardSkeleton from "../components/ProductCardSkeleton";
import { fetchProducts, fetchCategories } from "../services/api";

const SIZES = ["XS", "S", "M", "L", "XL", "XXL", "Free Size"];

const COLORS = [
  "Ivory",
  "Wine",
  "Berry",
  "Champagne",
  "Rosewood",
  "Blush",
  "Sage",
  "Ink",
  "Mustard",
  "Emerald",
  "Dusty Blue",
];

export default function Shop() {
  const [searchParams, setSearchParams] = useSearchParams();

  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtersOpen, setFiltersOpen] = useState(false);

  // Full category objects including subcategories
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const data = await fetchCategories();

        const categoryList = Array.isArray(data)
          ? data
          : Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.categories)
              ? data.categories
              : [];

        setCategories(categoryList);
      } catch (error) {
        console.error("Failed to fetch categories:", error);

        setCategories([]);
      }
    }

    loadCategories();
  }, []);

  const filters = {
    search: searchParams.get("search") || "",

    category: searchParams.get("category") || "",

    subCategory: searchParams.get("subCategory") || "",

    size: searchParams.get("size") || "",

    color: searchParams.get("color") || "",

    minPrice: searchParams.get("minPrice") || "",

    maxPrice: searchParams.get("maxPrice") || "",

    sort: searchParams.get("sort") || "",
  };

  // Fetch products whenever filters change
  useEffect(() => {
    setLoading(true);

    fetchProducts(filters)
      .then((data) => {
        setProducts(Array.isArray(data) ? data : []);
      })
      .catch((error) => {
        console.error("Failed to fetch products:", error);

        setProducts([]);
      })
      .finally(() => {
        setLoading(false);
      });

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  function setFilter(key, value) {
    const next = new URLSearchParams(searchParams);

    if (value) {
      next.set(key, value);
    } else {
      next.delete(key);
    }

    setSearchParams(next);
  }

  function setCategory(category) {
    const next = new URLSearchParams(searchParams);

    if (category) {
      next.set("category", category);
    } else {
      next.delete("category");
    }

    // Selecting a different category must
    // remove the previous subcategory.
    next.delete("subCategory");

    setSearchParams(next);
  }

  function setSubCategory(subCategory) {
    const next = new URLSearchParams(searchParams);

    if (subCategory) {
      next.set("subCategory", subCategory);
    } else {
      next.delete("subCategory");
    }

    setSearchParams(next);
  }

  function clearFilters() {
    setSearchParams({});
  }

  const activeCount = Object.entries(filters).filter(
    ([key, value]) => value && key !== "search",
  ).length;

  const selectedCategory = categories.find(
    (category) => category.name === filters.category,
  );

  const subCategories = selectedCategory?.subCategories || [];

  return (
    <div className="max-w-7xl mx-auto px-5 md:px-8 py-10">
      {/* Page Header */}
      <div className="mb-8">
        <p className="eyebrow">The Collection</p>

        <h1 className="text-3xl mt-2">Shop All</h1>

        {filters.search && (
          <p className="text-sm text-stone mt-2">
            Showing results for &ldquo;{filters.search}&rdquo;
          </p>
        )}

        {filters.category && (
          <div className="flex items-center gap-2 flex-wrap mt-3">
            <span className="text-sm text-stone">Category:</span>

            <span className="text-sm font-medium">{filters.category}</span>

            {filters.subCategory && (
              <>
                <span className="text-stone">/</span>

                <span className="text-sm font-medium text-wine">
                  {filters.subCategory}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Mobile Filter + Sort */}
      <div className="flex items-center justify-between mb-6 md:hidden">
        <button
          onClick={() => setFiltersOpen(true)}
          className="btn-outline text-xs py-2 px-4"
        >
          <SlidersHorizontal size={14} />
          Filters
          {activeCount > 0 && ` (${activeCount})`}
        </button>

        <select
          value={filters.sort}
          onChange={(event) => setFilter("sort", event.target.value)}
          className="input-field text-xs w-auto py-2"
        >
          <option value="">Sort</option>

          <option value="newest">Newest</option>

          <option value="price_asc">Price: Low to High</option>

          <option value="price_desc">Price: High to Low</option>
        </select>
      </div>

      {/* Main Content */}
      <div className="grid md:grid-cols-[220px_1fr] gap-10">
        {/* Desktop Filter Sidebar */}
        <aside className="hidden md:block space-y-8">
          <FilterPanel
            filters={filters}
            setFilter={setFilter}
            setCategory={setCategory}
            setSubCategory={setSubCategory}
            clearFilters={clearFilters}
            activeCount={activeCount}
            categories={categories}
            selectedCategory={selectedCategory}
            subCategories={subCategories}
          />
        </aside>

        {/* Products */}
        <div>
          {/* Desktop Sort */}
          <div className="hidden md:flex justify-end mb-6">
            <select
              value={filters.sort}
              onChange={(event) => setFilter("sort", event.target.value)}
              className="input-field text-sm w-auto py-2"
            >
              <option value="">Sort by</option>

              <option value="newest">Newest</option>

              <option value="price_asc">Price: Low to High</option>

              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>

          {/* No Products */}
          {!loading && products.length === 0 ? (
            <div className="text-center py-24">
              <p className="text-stone">No products match your filters.</p>

              <button onClick={clearFilters} className="btn-ghost mt-3">
                Clear filters
              </button>
            </div>
          ) : (
            /* Product Grid */
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6">
              {loading
                ? Array.from({
                    length: 6,
                  }).map((_, index) => <ProductCardSkeleton key={index} />)
                : products.map((product) => (
                    <ProductCard key={product._id} product={product} />
                  ))}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      {filtersOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-ink/40"
            onClick={() => setFiltersOpen(false)}
          />

          {/* Drawer */}
          <div className="absolute right-0 top-0 h-full w-80 max-w-[85vw] bg-ivory p-6 overflow-y-auto">
            {/* Drawer Header */}
            <div className="flex items-center justify-between mb-6">
              <p className="font-display text-lg">Filters</p>

              <button
                onClick={() => setFiltersOpen(false)}
                aria-label="Close filters"
              >
                <X size={20} />
              </button>
            </div>

            {/* Filters */}
            <FilterPanel
              filters={filters}
              setFilter={setFilter}
              setCategory={setCategory}
              setSubCategory={setSubCategory}
              clearFilters={clearFilters}
              activeCount={activeCount}
              categories={categories}
              selectedCategory={selectedCategory}
              subCategories={subCategories}
            />

            {/* Apply Button */}
            <button
              onClick={() => setFiltersOpen(false)}
              className="btn-primary w-full mt-6"
            >
              Show Results
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================================================
   FILTER PANEL
   ========================================================= */

function FilterPanel({
  filters,
  setFilter,
  setCategory,
  setSubCategory,
  clearFilters,
  activeCount,
  categories,
  selectedCategory,
  subCategories,
}) {
  return (
    <>
      {/* Clear Filters */}
      {activeCount > 0 && (
        <button
          onClick={clearFilters}
          className="text-xs text-wine underline mb-2"
        >
          Clear all filters
        </button>
      )}

      {/* Category */}
      <FilterGroup title="Category">
        {categories.length === 0 ? (
          <p className="text-xs text-stone">No categories available</p>
        ) : (
          categories.map((category) => (
            <div key={category._id} className="w-full">
              <FilterChip
                active={filters.category === category.name}
                onClick={() =>
                  setCategory(
                    filters.category === category.name ? "" : category.name,
                  )
                }
              >
                {category.name}
              </FilterChip>
            </div>
          ))
        )}
      </FilterGroup>

      {/* SUB CATEGORY */}
      {filters.category && selectedCategory && subCategories.length > 0 && (
        <FilterGroup title="Sub Category">
          <div className="w-full space-y-2">
            {/* All Subcategories */}
            <FilterChip
              active={!filters.subCategory}
              onClick={() => setSubCategory("")}
            >
              All {selectedCategory.name}
            </FilterChip>

            {subCategories
              .filter((subCategory) => subCategory.isActive !== false)
              .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
              .map((subCategory) => (
                <div key={subCategory._id} className="flex items-center gap-2">
                  <ChevronDown size={12} className="text-stone -rotate-90" />

                  <FilterChip
                    active={filters.subCategory === subCategory.name}
                    onClick={() =>
                      setSubCategory(
                        filters.subCategory === subCategory.name
                          ? ""
                          : subCategory.name,
                      )
                    }
                  >
                    {subCategory.name}
                  </FilterChip>
                </div>
              ))}
          </div>
        </FilterGroup>
      )}

      {/* Size */}
      <FilterGroup title="Size">
        {SIZES.map((size) => (
          <FilterChip
            key={size}
            active={filters.size === size}
            onClick={() => setFilter("size", filters.size === size ? "" : size)}
          >
            {size}
          </FilterChip>
        ))}
      </FilterGroup>

      {/* Color */}
      <FilterGroup title="Color">
        {COLORS.map((color) => (
          <FilterChip
            key={color}
            active={filters.color === color}
            onClick={() =>
              setFilter("color", filters.color === color ? "" : color)
            }
          >
            {color}
          </FilterChip>
        ))}
      </FilterGroup>

      {/* Price Range */}
      <FilterGroup title="Price Range">
        <div className="flex items-center gap-2">
          <input
            type="number"
            placeholder="Min"
            value={filters.minPrice}
            onChange={(event) => setFilter("minPrice", event.target.value)}
            className="input-field text-xs py-2 w-full"
          />

          <span className="text-stone">–</span>

          <input
            type="number"
            placeholder="Max"
            value={filters.maxPrice}
            onChange={(event) => setFilter("maxPrice", event.target.value)}
            className="input-field text-xs py-2 w-full"
          />
        </div>
      </FilterGroup>
    </>
  );
}

/* =========================================================
   FILTER GROUP
   ========================================================= */

function FilterGroup({ title, children }) {
  return (
    <div className="border-b border-ink/10 pb-5 mb-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink mb-3">
        {title}
      </p>

      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

/* =========================================================
   FILTER CHIP
   ========================================================= */

function FilterChip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-xs px-3 py-1.5 border transition-colors ${
        active
          ? "bg-wine text-ivory border-wine"
          : "border-ink/15 text-ink/70 hover:border-wine hover:text-wine"
      }`}
    >
      {children}
    </button>
  );
}
