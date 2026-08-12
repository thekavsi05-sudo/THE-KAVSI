import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import toast from "react-hot-toast";

import {
  fetchAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
} from "../services/api";

function slugify(value) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const emptyCategory = {
  name: "",
  slug: "",
  description: "",
  image: "",
  isActive: true,
  sortOrder: 0,
};

const emptySubCategory = {
  name: "",
  slug: "",
  description: "",
  image: "",
  isActive: true,
  sortOrder: 0,
};

export default function Categories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const [showCategoryForm, setShowCategoryForm] = useState(false);

  const [showSubCategoryForm, setShowSubCategoryForm] = useState(false);

  const [editingCategory, setEditingCategory] = useState(null);

  const [editingSubCategory, setEditingSubCategory] = useState(null);

  const [selectedCategory, setSelectedCategory] = useState(null);

  const [categoryForm, setCategoryForm] = useState(emptyCategory);

  const [subCategoryForm, setSubCategoryForm] = useState(emptySubCategory);

  const [expandedCategories, setExpandedCategories] = useState({});

  async function loadCategories() {
    try {
      setLoading(true);

      const data = await fetchAdminCategories();

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
          ? data.data
          : Array.isArray(data?.categories)
            ? data.categories
            : [];

      setCategories(list);
    } catch (error) {
      console.error("Failed to load categories:", error);

      toast.error(
        error?.response?.data?.message || "Failed to load categories",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCategories();
  }, []);

  function toggleCategory(id) {
    setExpandedCategories((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  }

  function openCreateCategory() {
    setEditingCategory(null);
    setCategoryForm({
      ...emptyCategory,
    });
    setShowCategoryForm(true);
  }

  function openEditCategory(category) {
    setEditingCategory(category);

    setCategoryForm({
      name: category.name || "",
      slug: category.slug || "",
      description: category.description || "",
      image: category.image || "",
      isActive: category.isActive !== false,
      sortOrder: category.sortOrder || 0,
    });

    setShowCategoryForm(true);
  }

  function openAddSubCategory(category) {
    setSelectedCategory(category);
    setEditingSubCategory(null);

    setSubCategoryForm({
      ...emptySubCategory,
    });

    setShowSubCategoryForm(true);

    setExpandedCategories((prev) => ({
      ...prev,
      [category._id]: true,
    }));
  }

  function openEditSubCategory(category, subCategory) {
    setSelectedCategory(category);
    setEditingSubCategory(subCategory);

    setSubCategoryForm({
      name: subCategory.name || "",
      slug: subCategory.slug || "",
      description: subCategory.description || "",
      image: subCategory.image || "",
      isActive: subCategory.isActive !== false,
      sortOrder: subCategory.sortOrder || 0,
    });

    setShowSubCategoryForm(true);

    setExpandedCategories((prev) => ({
      ...prev,
      [category._id]: true,
    }));
  }

  function handleCategoryNameChange(value) {
    setCategoryForm((prev) => ({
      ...prev,
      name: value,
      slug: prev.slug || slugify(value),
    }));
  }

  function handleSubCategoryNameChange(value) {
    setSubCategoryForm((prev) => ({
      ...prev,
      name: value,
      slug: prev.slug || slugify(value),
    }));
  }

  async function handleCategorySubmit(event) {
    event.preventDefault();

    if (!categoryForm.name.trim()) {
      toast.error("Category name is required");
      return;
    }

    try {
      const payload = {
        name: categoryForm.name.trim(),
        slug: categoryForm.slug.trim() || slugify(categoryForm.name),
        description: categoryForm.description.trim(),
        image: categoryForm.image.trim(),
        isActive: categoryForm.isActive,
        sortOrder: Number(categoryForm.sortOrder) || 0,
      };

      if (editingCategory) {
        await updateCategory(editingCategory._id, payload);

        toast.success("Category updated successfully");
      } else {
        await createCategory(payload);

        toast.success("Category created successfully");
      }

      setShowCategoryForm(false);
      setEditingCategory(null);
      setCategoryForm({
        ...emptyCategory,
      });

      await loadCategories();
    } catch (error) {
      console.error("Category save failed:", error);

      toast.error(error?.response?.data?.message || "Failed to save category");
    }
  }

  async function handleSubCategorySubmit(event) {
    event.preventDefault();

    if (!selectedCategory) {
      toast.error("Please select a category");
      return;
    }

    if (!subCategoryForm.name.trim()) {
      toast.error("Subcategory name is required");
      return;
    }

    try {
      const payload = {
        name: subCategoryForm.name.trim(),

        slug: subCategoryForm.slug.trim() || slugify(subCategoryForm.name),

        description: subCategoryForm.description.trim(),

        image: subCategoryForm.image.trim(),

        isActive: subCategoryForm.isActive,

        sortOrder: Number(subCategoryForm.sortOrder) || 0,
      };

      if (editingSubCategory) {
        await updateSubCategory(
          selectedCategory._id,
          editingSubCategory._id,
          payload,
        );

        toast.success("Subcategory updated successfully");
      } else {
        await createSubCategory(selectedCategory._id, payload);

        toast.success("Subcategory added successfully");
      }

      setShowSubCategoryForm(false);
      setSelectedCategory(null);
      setEditingSubCategory(null);
      setSubCategoryForm({
        ...emptySubCategory,
      });

      await loadCategories();
    } catch (error) {
      console.error("Subcategory save failed:", error);

      toast.error(
        error?.response?.data?.message || "Failed to save subcategory",
      );
    }
  }

  async function handleDeleteCategory(category) {
    const confirmed = window.confirm(
      `Delete "${category.name}"? This cannot be undone.`,
    );

    if (!confirmed) return;

    try {
      await deleteCategory(category._id);

      toast.success("Category deleted successfully");

      await loadCategories();
    } catch (error) {
      console.error("Category deletion failed:", error);

      toast.error(
        error?.response?.data?.message || "Failed to delete category",
      );
    }
  }

  async function handleDeleteSubCategory(category, subCategory) {
    const confirmed = window.confirm(`Delete "${subCategory.name}"?`);

    if (!confirmed) return;

    try {
      await deleteSubCategory(category._id, subCategory._id);

      toast.success("Subcategory deleted successfully");

      await loadCategories();
    } catch (error) {
      console.error("Subcategory deletion failed:", error);

      toast.error(
        error?.response?.data?.message || "Failed to delete subcategory",
      );
    }
  }

  function closeForms() {
    setShowCategoryForm(false);
    setShowSubCategoryForm(false);
    setEditingCategory(null);
    setEditingSubCategory(null);
    setSelectedCategory(null);

    setCategoryForm({
      ...emptyCategory,
    });

    setSubCategoryForm({
      ...emptySubCategory,
    });
  }

  return (
    <div className="space-y-8">
      {/* HEADER */}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-ink">Categories</h1>

          <p className="text-sm text-ink/60 mt-1">
            Manage categories and subcategories.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateCategory}
          className="btn-primary inline-flex items-center justify-center gap-2"
        >
          <Plus size={17} />
          Add Category
        </button>
      </div>

      {/* CATEGORY FORM */}

      {showCategoryForm && (
        <div className="bg-white border border-ink/10 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="font-display text-xl">
              {editingCategory ? "Edit Category" : "Add Category"}
            </h2>

            <button
              type="button"
              onClick={closeForms}
              className="text-sm text-ink/50 hover:text-ink"
            >
              Cancel
            </button>
          </div>

          <form
            onSubmit={handleCategorySubmit}
            className="grid md:grid-cols-2 gap-5"
          >
            <Field
              label="Category Name"
              value={categoryForm.name}
              onChange={handleCategoryNameChange}
              required
            />

            <Field
              label="Slug"
              value={categoryForm.slug}
              onChange={(value) =>
                setCategoryForm((prev) => ({
                  ...prev,
                  slug: value,
                }))
              }
            />

            <Field
              label="Image URL"
              value={categoryForm.image}
              onChange={(value) =>
                setCategoryForm((prev) => ({
                  ...prev,
                  image: value,
                }))
              }
            />

            <Field
              label="Sort Order"
              type="number"
              value={categoryForm.sortOrder}
              onChange={(value) =>
                setCategoryForm((prev) => ({
                  ...prev,
                  sortOrder: value,
                }))
              }
            />

            <div className="md:col-span-2">
              <label className="block text-xs font-medium">Description</label>

              <textarea
                value={categoryForm.description}
                onChange={(event) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                rows={4}
                className="input-field mt-1.5 resize-none"
              />
            </div>

            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={categoryForm.isActive}
                onChange={(event) =>
                  setCategoryForm((prev) => ({
                    ...prev,
                    isActive: event.target.checked,
                  }))
                }
              />
              Active Category
            </label>

            <div className="md:col-span-2">
              <button type="submit" className="btn-primary">
                {editingCategory ? "Update Category" : "Create Category"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* SUBCATEGORY FORM */}

      {showSubCategoryForm && selectedCategory && (
        <div className="bg-white border border-wine/30 p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-xl">
                {editingSubCategory ? "Edit Subcategory" : "Add Subcategory"}
              </h2>

              <p className="text-sm text-ink/50 mt-1">
                Parent Category: <strong>{selectedCategory.name}</strong>
              </p>
            </div>

            <button
              type="button"
              onClick={closeForms}
              className="text-sm text-ink/50 hover:text-ink"
            >
              Cancel
            </button>
          </div>

          <form
            onSubmit={handleSubCategorySubmit}
            className="grid md:grid-cols-2 gap-5"
          >
            <Field
              label="Subcategory Name"
              value={subCategoryForm.name}
              onChange={handleSubCategoryNameChange}
              required
            />

            <Field
              label="Slug"
              value={subCategoryForm.slug}
              onChange={(value) =>
                setSubCategoryForm((prev) => ({
                  ...prev,
                  slug: value,
                }))
              }
            />

            <Field
              label="Image URL"
              value={subCategoryForm.image}
              onChange={(value) =>
                setSubCategoryForm((prev) => ({
                  ...prev,
                  image: value,
                }))
              }
            />

            <Field
              label="Sort Order"
              type="number"
              value={subCategoryForm.sortOrder}
              onChange={(value) =>
                setSubCategoryForm((prev) => ({
                  ...prev,
                  sortOrder: value,
                }))
              }
            />

            <div className="md:col-span-2">
              <label className="block text-xs font-medium">Description</label>

              <textarea
                value={subCategoryForm.description}
                onChange={(event) =>
                  setSubCategoryForm((prev) => ({
                    ...prev,
                    description: event.target.value,
                  }))
                }
                rows={4}
                className="input-field mt-1.5 resize-none"
              />
            </div>

            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                checked={subCategoryForm.isActive}
                onChange={(event) =>
                  setSubCategoryForm((prev) => ({
                    ...prev,
                    isActive: event.target.checked,
                  }))
                }
              />
              Active Subcategory
            </label>

            <div className="md:col-span-2">
              <button type="submit" className="btn-primary">
                {editingSubCategory ? "Update Subcategory" : "Add Subcategory"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* CATEGORY LIST */}

      <div className="bg-white border border-ink/10">
        <div className="px-5 py-4 border-b border-ink/10">
          <h2 className="font-medium">All Categories</h2>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-ink/50">
            Loading categories...
          </div>
        ) : categories.length === 0 ? (
          <div className="p-10 text-center text-sm text-ink/50">
            No categories found.
          </div>
        ) : (
          <div className="divide-y divide-ink/10">
            {categories.map((category) => {
              const subCategories = category.subCategories || [];

              const expanded = expandedCategories[category._id];

              return (
                <div key={category._id}>
                  {/* CATEGORY ROW */}

                  <div className="px-5 py-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      {subCategories.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => toggleCategory(category._id)}
                          className="mt-1"
                        >
                          {expanded ? (
                            <ChevronDown size={18} />
                          ) : (
                            <ChevronRight size={18} />
                          )}
                        </button>
                      ) : (
                        <div className="w-[18px]" />
                      )}

                      <div className="min-w-0">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="font-medium">{category.name}</h3>

                          <span
                            className={`text-xs px-2 py-1 ${
                              category.isActive !== false
                                ? "bg-green-50 text-green-700"
                                : "bg-red-50 text-red-700"
                            }`}
                          >
                            {category.isActive !== false
                              ? "Active"
                              : "Inactive"}
                          </span>
                        </div>

                        <p className="text-xs text-ink/40 mt-1">
                          /{category.slug}
                        </p>

                        {category.description && (
                          <p className="text-sm text-ink/60 mt-2">
                            {category.description}
                          </p>
                        )}

                        <p className="text-xs text-ink/40 mt-2">
                          {subCategories.length} subcategor
                          {subCategories.length === 1 ? "y" : "ies"}
                        </p>
                      </div>
                    </div>

                    {/* CATEGORY ACTIONS */}

                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => openAddSubCategory(category)}
                        className="border border-ink/15 px-3 py-2 text-xs inline-flex items-center gap-1.5 hover:bg-ink/5"
                      >
                        <Plus size={14} />
                        Subcategory
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditCategory(category)}
                        className="border border-ink/15 p-2 hover:bg-ink/5"
                        title="Edit Category"
                      >
                        <Pencil size={15} />
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(category)}
                        className="border border-red-200 text-red-600 p-2 hover:bg-red-50"
                        title="Delete Category"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {/* SUBCATEGORIES */}

                  {expanded && subCategories.length > 0 && (
                    <div className="bg-ink/[0.02] border-t border-ink/10">
                      {subCategories
                        .slice()
                        .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
                        .map((subCategory) => (
                          <div
                            key={subCategory._id}
                            className="px-5 py-4 pl-14 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-ink/5 last:border-b-0"
                          >
                            <div>
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-ink/30">└</span>

                                <h4 className="text-sm font-medium">
                                  {subCategory.name}
                                </h4>

                                <span
                                  className={`text-[10px] px-2 py-1 ${
                                    subCategory.isActive !== false
                                      ? "bg-green-50 text-green-700"
                                      : "bg-red-50 text-red-700"
                                  }`}
                                >
                                  {subCategory.isActive !== false
                                    ? "Active"
                                    : "Inactive"}
                                </span>
                              </div>

                              <p className="text-xs text-ink/40 ml-7 mt-1">
                                /{subCategory.slug}
                              </p>

                              {subCategory.description && (
                                <p className="text-xs text-ink/50 ml-7 mt-1">
                                  {subCategory.description}
                                </p>
                              )}
                            </div>

                            {/* SUBCATEGORY ACTIONS */}

                            <div className="flex items-center gap-2 self-start sm:self-auto">
                              <button
                                type="button"
                                onClick={() =>
                                  openEditSubCategory(category, subCategory)
                                }
                                className="border border-ink/15 p-2 hover:bg-ink/5"
                                title="Edit Subcategory"
                              >
                                <Pencil size={14} />
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  handleDeleteSubCategory(category, subCategory)
                                }
                                className="border border-red-200 text-red-600 p-2 hover:bg-red-50"
                                title="Delete Subcategory"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }) {
  return (
    <label className="block text-xs">
      <span className="font-medium text-ink/80">
        {label}

        {required && <span className="text-wine ml-1">*</span>}
      </span>

      <input
        type={type}
        value={value ?? ""}
        required={required}
        onChange={(event) => onChange(event.target.value)}
        className="input-field mt-1.5"
      />
    </label>
  );
}
