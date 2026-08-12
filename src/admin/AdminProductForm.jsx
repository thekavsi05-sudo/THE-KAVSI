import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import { UploadCloud, X, AlertTriangle } from "lucide-react";
import {
  fetchAdminProductById,
  fetchAdminCategories,
  createProduct,
  updateProduct,
  uploadProductImages,
} from "../services/api";
import { LOW_STOCK_THRESHOLD } from "../services/mockData";
import { buildVariantGrid, getStockStatus } from "../utils/variants";

const emptyForm = {
  name: "",
  description: "",
  category: "",
  subCategory: "",
  price: "",
  discount: "",
  sizes: [],
  colors: [],
  variants: [],
  images: [],
  lowStockThreshold: LOW_STOCK_THRESHOLD,
};

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL", "Free Size"];

export default function AdminProductForm() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [form, setForm] = useState(emptyForm);
  const [colorInput, setColorInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [categories, setCategories] = useState([]);

  useEffect(() => {
    async function loadCategories() {
      try {
        const cats = await fetchAdminCategories();

        const categoryList = Array.isArray(cats)
          ? cats
          : Array.isArray(cats?.data)
            ? cats.data
            : Array.isArray(cats?.categories)
              ? cats.categories
              : [];

        setCategories(categoryList);

        setForm((f) => {
          if (isEdit || f.category) {
            return f;
          }

          return {
            ...f,
            category: categoryList[0]?.name || "",
            subCategory: "",
          };
        });
      } catch (error) {
        console.error("Failed to load categories:", error);
        toast.error("Failed to load categories");
      }
    }

    loadCategories();
  }, [isEdit]);

  useEffect(() => {
    if (isEdit) {
      fetchAdminProductById(id)
        .then((p) => {
          if (p) {
            setForm({
              ...emptyForm,
              ...p,
              subCategory: p.subCategory || "",
            });
          }
        })
        .catch((error) => {
          console.error("Failed to load product:", error);
          toast.error("Failed to load product");
        });
    }
  }, [id, isEdit]);

  function update(field, val) {
    setForm((f) => ({
      ...f,
      [field]: val,
    }));
  }

  function handleCategoryChange(categoryName) {
    setForm((f) => ({
      ...f,
      category: categoryName,
      subCategory: "",
    }));
  }

  const selectedCategory = categories.find(
    (category) => category.name === form.category,
  );

  const subCategories = selectedCategory?.subCategories || [];

  function toggleSize(size) {
    setForm((f) => {
      const sizes = f.sizes.includes(size)
        ? f.sizes.filter((s) => s !== size)
        : [...f.sizes, size];

      return {
        ...f,
        sizes,
        variants: buildVariantGrid(sizes, f.colors, f.variants),
      };
    });
  }

  function addColor() {
    const c = colorInput.trim();

    if (!c || form.colors.includes(c)) return;

    setForm((f) => {
      const colors = [...f.colors, c];

      return {
        ...f,
        colors,
        variants: buildVariantGrid(f.sizes, colors, f.variants),
      };
    });

    setColorInput("");
  }

  function removeColor(c) {
    setForm((f) => {
      const colors = f.colors.filter((x) => x !== c);

      return {
        ...f,
        colors,
        variants: buildVariantGrid(f.sizes, colors, f.variants),
      };
    });
  }

  function updateVariantStock(size, color, stock) {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v) =>
        v.size === size && v.color === color
          ? {
              ...v,
              stock: Math.max(0, Number(stock) || 0),
            }
          : v,
      ),
    }));
  }

  const totalStock = form.variants.reduce(
    (sum, v) => sum + (Number(v.stock) || 0),
    0,
  );

  async function handleImageSelect(e) {
    const files = Array.from(e.target.files || []);

    if (files.length === 0) return;

    setUploading(true);

    try {
      const uploaded = await uploadProductImages(files);

      setForm((f) => ({
        ...f,
        images: [...f.images, ...uploaded.map((u) => u.url)],
      }));

      toast.success(
        `${uploaded.length} image${uploaded.length > 1 ? "s" : ""} uploaded`,
      );
    } catch (error) {
      console.error("IMAGE UPLOAD ERROR:", error);

      const message =
        error?.response?.data?.message ||
        error?.message ||
        "Image upload failed";

      toast.error(message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  function removeImage(idx) {
    setForm((f) => ({
      ...f,
      images: f.images.filter((_, i) => i !== idx),
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();

    if (!form.name || !form.price || form.images.length === 0) {
      toast.error("Please fill in name, price, and at least one image");
      return;
    }

    if (!form.category) {
      toast.error("Please select a category");
      return;
    }

    if (subCategories.length > 0 && !form.subCategory) {
      toast.error("Please select a subcategory");
      return;
    }

    if (form.sizes.length === 0 || form.colors.length === 0) {
      toast.error("Add at least one size and one color to build variants");
      return;
    }

    setSaving(true);

    try {
      const payload = {
        ...form,

        category: form.category,

        subCategory: form.subCategory || "",

        price: Number(form.price),

        discount: Number(form.discount) || 0,

        lowStockThreshold:
          Number(form.lowStockThreshold) || LOW_STOCK_THRESHOLD,
      };

      if (isEdit) {
        await updateProduct(id, payload);

        toast.success("Product updated");
      } else {
        await createProduct(payload);

        toast.success("Product added");
      }

      navigate("/admin/products");
    } catch (error) {
      console.error("PRODUCT SAVE ERROR:", error);

      toast.error(error?.response?.data?.message || "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-display mb-6">
        {isEdit ? "Edit Product" : "Add Product"}
      </h1>

      <form
        onSubmit={handleSubmit}
        className="bg-white border border-ink/10 p-6 space-y-5"
      >
        {/* PRODUCT NAME */}
        <label className="block text-xs">
          <span className="font-medium text-ink/80">Product Name</span>

          <input
            required
            value={form.name}
            onChange={(e) => update("name", e.target.value)}
            className="input-field mt-1.5"
          />
        </label>

        {/* DESCRIPTION */}
        <label className="block text-xs">
          <span className="font-medium text-ink/80">Description</span>

          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => update("description", e.target.value)}
            className="input-field mt-1.5"
          />
        </label>

        {/* CATEGORY + SUBCATEGORY + PRICE */}
        <div className="grid sm:grid-cols-3 gap-4">
          {/* CATEGORY */}
          <label className="block text-xs">
            <span className="font-medium text-ink/80">Category</span>

            <select
              value={form.category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="input-field mt-1.5"
            >
              <option value="">Select Category</option>

              {!categories.some((c) => c.name === form.category) &&
                form.category && (
                  <option value={form.category}>
                    {form.category} (inactive category)
                  </option>
                )}

              {categories.map((c) => (
                <option key={c._id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>

          {/* SUBCATEGORY */}
          <label className="block text-xs">
            <span className="font-medium text-ink/80">Sub Category</span>

            <select
              value={form.subCategory}
              onChange={(e) => update("subCategory", e.target.value)}
              disabled={!form.category || subCategories.length === 0}
              className="input-field mt-1.5 disabled:opacity-50"
            >
              <option value="">
                {subCategories.length === 0
                  ? "No Sub Categories"
                  : "Select Sub Category"}
              </option>

              {subCategories
                .filter((subCategory) => subCategory.isActive !== false)
                .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                .map((subCategory) => (
                  <option key={subCategory._id} value={subCategory.name}>
                    {subCategory.name}
                  </option>
                ))}
            </select>
          </label>

          {/* PRICE */}
          <label className="block text-xs">
            <span className="font-medium text-ink/80">Price (₹)</span>

            <input
              required
              type="number"
              min="0"
              value={form.price}
              onChange={(e) => update("price", e.target.value)}
              className="input-field mt-1.5"
            />
          </label>

          {/* DISCOUNT */}
          <label className="block text-xs">
            <span className="font-medium text-ink/80">Discount (%)</span>

            <input
              type="number"
              min="0"
              max="90"
              value={form.discount}
              onChange={(e) => update("discount", e.target.value)}
              className="input-field mt-1.5"
            />
          </label>
        </div>

        {/* ACTIVE */}
        {isEdit && (
          <label className="flex items-center gap-2 text-xs w-fit">
            <input
              type="checkbox"
              checked={form.isActive !== false}
              onChange={(e) => update("isActive", e.target.checked)}
            />

            <span className="font-medium text-ink/80">
              Active{" "}
              {form.isActive === false && (
                <span className="text-wine">
                  (currently archived — hidden from shop)
                </span>
              )}
            </span>
          </label>
        )}

        {/* LOW STOCK */}
        <label className="block text-xs w-48">
          <span className="font-medium text-ink/80">Low Stock Threshold</span>

          <input
            type="number"
            min="0"
            value={form.lowStockThreshold}
            onChange={(e) => update("lowStockThreshold", e.target.value)}
            className="input-field mt-1.5"
          />

          <span className="text-[11px] text-stone mt-1 block">
            Variants at or below this show "Low Stock"
          </span>
        </label>

        {/* SIZES */}
        <div>
          <p className="text-xs font-medium text-ink/80 mb-2">Sizes</p>

          <div className="flex flex-wrap gap-2">
            {SIZE_OPTIONS.map((s) => (
              <button
                type="button"
                key={s}
                onClick={() => toggleSize(s)}
                className={`px-3 py-1.5 text-xs border ${
                  form.sizes.includes(s)
                    ? "bg-ink text-ivory border-ink"
                    : "border-ink/20"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* COLORS */}
        <div>
          <p className="text-xs font-medium text-ink/80 mb-2">Colors</p>

          <div className="flex gap-2 mb-2">
            <input
              value={colorInput}
              onChange={(e) => setColorInput(e.target.value)}
              onKeyDown={(e) =>
                e.key === "Enter" && (e.preventDefault(), addColor())
              }
              placeholder="e.g. Wine"
              className="input-field text-xs py-2"
            />

            <button
              type="button"
              onClick={addColor}
              className="btn-outline text-xs px-4"
            >
              Add
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {form.colors.map((c) => (
              <span
                key={c}
                className="flex items-center gap-1 bg-blush/50 text-xs px-2 py-1"
              >
                {c}

                <button
                  type="button"
                  onClick={() => removeColor(c)}
                  aria-label={`Remove ${c}`}
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* VARIANT STOCK */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-ink/80">
              Variant Stock (size × color)
            </p>

            <span className="text-[11px] text-stone">
              Total: {totalStock} unit
              {totalStock === 1 ? "" : "s"}
            </span>
          </div>

          {form.sizes.length === 0 || form.colors.length === 0 ? (
            <p className="text-xs text-stone border border-dashed border-ink/15 px-4 py-6 text-center">
              Select at least one size and one color above to set stock per
              combination.
            </p>
          ) : (
            <div className="overflow-x-auto border border-ink/10">
              <table className="w-full text-xs min-w-[420px]">
                <thead>
                  <tr className="bg-blush/30">
                    <th className="px-3 py-2 text-left font-medium text-ink/70">
                      Color \ Size
                    </th>

                    {form.sizes.map((s) => (
                      <th
                        key={s}
                        className="px-3 py-2 text-center font-medium text-ink/70"
                      >
                        {s}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-ink/10">
                  {form.colors.map((c) => (
                    <tr key={c}>
                      <td className="px-3 py-2 font-medium text-ink/80">{c}</td>

                      {form.sizes.map((s) => {
                        const v = form.variants.find(
                          (x) => x.size === s && x.color === c,
                        );

                        const stock = v?.stock ?? 0;

                        const status = getStockStatus(
                          stock,
                          form.lowStockThreshold,
                        );

                        return (
                          <td key={s} className="px-2 py-2 text-center">
                            <input
                              type="number"
                              min="0"
                              value={stock}
                              onChange={(e) =>
                                updateVariantStock(s, c, e.target.value)
                              }
                              className={`w-16 text-center border px-2 py-1.5 focus:border-wine focus:outline-none ${
                                status === "out"
                                  ? "border-wine/40 bg-wine/5"
                                  : status === "low"
                                    ? "border-champagne bg-champagne/10"
                                    : "border-ink/15"
                              }`}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalStock === 0 &&
            form.sizes.length > 0 &&
            form.colors.length > 0 && (
              <p className="text-[11px] text-wine flex items-center gap-1.5 mt-2">
                <AlertTriangle size={12} />
                Every variant is at 0 stock — this product will show as Out of
                Stock.
              </p>
            )}
        </div>

        {/* IMAGES */}
        <div>
          <p className="text-xs font-medium text-ink/80 mb-2">
            Images (uploads to Cloudinary)
          </p>

          <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-ink/20 py-8 cursor-pointer hover:border-wine transition-colors">
            <UploadCloud size={22} className="text-stone" />

            <span className="text-xs text-stone">
              {uploading ? "Uploading…" : "Click to upload images"}
            </span>

            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleImageSelect}
              disabled={uploading}
            />
          </label>

          {form.images.length > 0 && (
            <div className="flex flex-wrap gap-3 mt-3">
              {form.images.map((img, i) => (
                <div key={i} className="relative w-16 h-20">
                  <img
                    src={img}
                    alt=""
                    className="w-full h-full object-cover"
                  />

                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    className="absolute -top-1.5 -right-1.5 bg-ink text-ivory rounded-full w-5 h-5 flex items-center justify-center"
                    aria-label="Remove image"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* BUTTONS */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => navigate("/admin/products")}
            className="btn-outline flex-1 py-3"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={saving || uploading}
            className="btn-primary flex-1 py-3"
          >
            {saving ? "Saving…" : isEdit ? "Save Changes" : "Add Product"}
          </button>
        </div>
      </form>
    </div>
  );
}
