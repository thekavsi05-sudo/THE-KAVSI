import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import { Plus, Pencil, Archive, ChevronLeft, ChevronRight } from "lucide-react";
import {
  fetchAdminProducts,
  deleteProduct,
  exportProductsCSV,
} from "../services/api";
import { getTotalStock, getStockStatus } from "../utils/variants";

const LIMIT = 20;

export default function AdminProducts() {
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState(null);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  // Bug 20: search runs on the backend (name/SKU), not by downloading every
  // product and filtering in React. Debounced so we don't fire a request per
  // keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  function load() {
    setLoading(true);
    fetchAdminProducts({ search, status, page, limit: LIMIT }).then((res) => {
      setProducts(res.data);
      setPagination(res.pagination);
      setLoading(false);
    });
  }

  useEffect(load, [search, status, page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Bug 15: this archives (isActive: false) rather than permanently deleting
  // -- historical orders still reference this product, so a hard delete
  // would break admin order detail views. Archived products can be
  // reactivated from the edit page.
  async function handleDelete(id) {
    await deleteProduct(id);
    toast.success("Product archived");
    setConfirmId(null);
    load();
  }

  async function handleExportCSV() {
    try {
      const products = await exportProductsCSV();

      if (!products || products.length === 0) {
        alert("No products available to export.");
        return;
      }

      const headers = ["Name", "Category", "Price", "Stock", "Status"];

      const rows = products.map((product) => [
        product.name || "",
        product.category?.name || product.category || "",
        product.price || 0,
        product.variants?.reduce(
          (total, variant) => total + Number(variant.stock || 0),
          0,
        ) || 0,
        product.isActive === false ? "Inactive" : "Active",
      ]);

      const csv = [headers, ...rows]
        .map((row) =>
          row
            .map((value) => `"${String(value).replace(/"/g, '""')}"`)
            .join(","),
        )
        .join("\n");

      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = "kavsi-products.csv";
      link.click();

      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to export products:", error);

      alert("Failed to export products.");
    }
  }

  function stockLabel(product) {
    const stock = getTotalStock(product);
    const status = getStockStatus(stock, product.lowStockThreshold);
    if (status === "out")
      return { text: "Out of Stock", cls: "text-wine bg-wine/10" };
    if (status === "low")
      return {
        text: `Low Stock (${stock})`,
        cls: "text-champagne bg-champagne/15",
      };
    return { text: `${stock} in stock`, cls: "text-ink/60 bg-ink/5" };
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-display">Products</h1>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExportCSV}
            className="btn-outline px-4 py-2 text-xs"
          >
            Export CSV
          </button>
        </div>
        <Link
          to="/admin/products/new"
          className="btn-primary py-2.5 px-5 text-xs"
        >
          <Plus size={14} /> Add Product
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <input
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name or SKU…"
          className="input-field text-xs py-2 max-w-xs"
        />
        <select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(1);
          }}
          className="input-field text-xs py-2 w-40"
        >
          <option value="">All statuses</option>
          <option value="active">Active only</option>
          <option value="inactive">Archived only</option>
        </select>
      </div>

      <div className="bg-white border border-ink/10 overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="border-b border-ink/10 text-left text-xs uppercase tracking-wide text-stone">
              <th className="px-5 py-3">Product</th>
              <th className="px-5 py-3">Category</th>
              <th className="px-5 py-3">Price</th>
              <th className="px-5 py-3">Stock</th>
              <th className="px-5 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-stone">
                  Loading…
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-stone">
                  No products found.
                </td>
              </tr>
            ) : (
              products.map((p) => {
                const badge = stockLabel(p);
                return (
                  <tr
                    key={p._id}
                    className={p.isActive === false ? "opacity-60" : ""}
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={p.images?.[0]}
                          alt=""
                          className="w-10 h-12 object-cover bg-blush/40"
                        />
                        <div>
                          <span className="font-medium block">
                            {p.name}{" "}
                            {p.isActive === false && (
                              <span className="text-[10px] uppercase tracking-wide text-wine ml-1">
                                Archived
                              </span>
                            )}
                          </span>
                          <span className="text-[11px] text-stone">
                            {p.variants?.length || 0} variant
                            {(p.variants?.length || 0) === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink/70">{p.category}</td>
                    <td className="px-5 py-3">
                      ₹{p.price.toLocaleString("en-IN")}
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded ${badge.cls}`}
                      >
                        {badge.text}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-3">
                        <Link
                          to={`/admin/products/${p._id}/edit`}
                          className="text-ink/60 hover:text-wine"
                          aria-label="Edit"
                        >
                          <Pencil size={16} />
                        </Link>
                        {p.isActive !== false && (
                          <button
                            onClick={() => setConfirmId(p._id)}
                            className="text-ink/60 hover:text-wine"
                            aria-label="Archive"
                          >
                            <Archive size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-xs text-stone">
          <span>
            Page {pagination.page} of {pagination.pages} — {pagination.total}{" "}
            product{pagination.total === 1 ? "" : "s"}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="btn-outline px-3 py-1.5 text-xs disabled:opacity-40"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              disabled={page >= pagination.pages}
              onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
              className="btn-outline px-3 py-1.5 text-xs disabled:opacity-40"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {confirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-5">
          <div className="bg-ivory p-6 max-w-sm w-full">
            <p className="font-medium mb-2">Archive this product?</p>
            <p className="text-sm text-stone mb-6">
              It will be hidden from the shop but kept for historical orders.
              You can reactivate it any time from the edit page.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmId(null)}
                className="btn-outline flex-1 py-2.5 text-xs"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmId)}
                className="btn-primary flex-1 py-2.5 text-xs"
              >
                Archive
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
