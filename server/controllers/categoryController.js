import Category from '../models/Category.js'
import Product from '../models/Product.js'
import { asyncHandler } from '../middleware/errorMiddleware.js'
import slugify from '../utils/slugify.js'

/* =========================================================
   PUBLIC CATEGORIES
   ========================================================= */

// GET /api/categories
// Returns active categories and only active subcategories
export const getCategories = asyncHandler(
  async (req, res) => {
    const categories =
      await Category.find({
        isActive: true,
      }).sort({
        sortOrder: 1,
        name: 1,
      })

    const cleanedCategories =
      categories.map((category) => {
        const obj =
          category.toObject()

        obj.subCategories = (
          obj.subCategories || []
        )
          .filter(
            (subCategory) =>
              subCategory.isActive !==
              false
          )
          .sort(
            (a, b) =>
              (a.sortOrder || 0) -
              (b.sortOrder || 0)
          )

        return obj
      })

    res.json({
      success: true,
      data: cleanedCategories,
    })
  }
)

/* =========================================================
   ADMIN CATEGORIES
   ========================================================= */

// GET /api/admin/categories
// Returns all categories including inactive categories
// and all subcategories.
export const getAdminCategories =
  asyncHandler(
    async (req, res) => {
      const categories =
        await Category.find({}).sort({
          sortOrder: 1,
          name: 1,
        })

      res.json({
        success: true,
        data: categories,
      })
    }
  )

/* =========================================================
   CREATE CATEGORY
   ========================================================= */

// POST /api/admin/categories
export const createCategory =
  asyncHandler(
    async (req, res) => {
      const {
        name,
        image,
        description,
        sortOrder,
      } = req.body

      if (!name?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            'Category name is required',
        })
      }

      const category =
        await Category.create({
          name: name.trim(),
          slug: slugify(name),
          image:
            image || '',
          description:
            description || '',
          sortOrder:
            Number(sortOrder) || 0,
          subCategories: [],
        })

      res.status(201).json({
        success: true,
        data: category,
      })
    }
  )

/* =========================================================
   UPDATE CATEGORY
   ========================================================= */

// PUT /api/admin/categories/:id
export const updateCategory =
  asyncHandler(
    async (req, res) => {
      const category =
        await Category.findById(
          req.params.id
        )

      if (!category) {
        return res.status(404).json({
          success: false,
          message:
            'Category not found',
        })
      }

      const {
        name,
        image,
        description,
        isActive,
        sortOrder,
      } = req.body

      if (name !== undefined) {
        const oldName =
          category.name

        category.name =
          name.trim()

        category.slug =
          slugify(name)

        // Keep existing products connected
        // when the category name changes.
        if (
          oldName !==
          category.name
        ) {
          await Product.updateMany(
            {
              category:
                oldName,
            },
            {
              $set: {
                category:
                  category.name,
              },
            }
          )
        }
      }

      if (
        image !== undefined
      ) {
        category.image =
          image
      }

      if (
        description !==
        undefined
      ) {
        category.description =
          description
      }

      if (
        isActive !==
        undefined
      ) {
        category.isActive =
          !!isActive
      }

      if (
        sortOrder !==
        undefined
      ) {
        category.sortOrder =
          Number(sortOrder) || 0
      }

      await category.save()

      res.json({
        success: true,
        data: category,
      })
    }
  )

/* =========================================================
   ADD SUBCATEGORY
   ========================================================= */

// POST /api/admin/categories/:id/subcategories
export const createSubCategory =
  asyncHandler(
    async (req, res) => {
      const category =
        await Category.findById(
          req.params.id
        )

      if (!category) {
        return res.status(404).json({
          success: false,
          message:
            'Category not found',
        })
      }

      const {
        name,
        image,
        description,
        sortOrder,
      } = req.body

      if (!name?.trim()) {
        return res.status(400).json({
          success: false,
          message:
            'Subcategory name is required',
        })
      }

      const cleanName =
        name.trim()

      // Prevent duplicate subcategories
      // inside the same category.
      const duplicate =
        category.subCategories.find(
          (subCategory) =>
            subCategory.name.toLowerCase() ===
            cleanName.toLowerCase()
        )

      if (duplicate) {
        return res.status(409).json({
          success: false,
          message:
            'This subcategory already exists in this category',
        })
      }

      category.subCategories.push({
        name: cleanName,

        slug: slugify(
          cleanName
        ),

        image:
          image || '',

        description:
          description || '',

        sortOrder:
          Number(sortOrder) || 0,

        isActive: true,
      })

      await category.save()

      const created =
        category.subCategories[
          category.subCategories.length -
            1
        ]

      res.status(201).json({
        success: true,
        message:
          'Subcategory created successfully',
        data: created,
      })
    }
  )

/* =========================================================
   UPDATE SUBCATEGORY
   ========================================================= */

// PUT /api/admin/categories/:categoryId/subcategories/:subCategoryId
export const updateSubCategory =
  asyncHandler(
    async (req, res) => {
      const category =
        await Category.findById(
          req.params.categoryId
        )

      if (!category) {
        return res.status(404).json({
          success: false,
          message:
            'Category not found',
        })
      }

      const subCategory =
        category.subCategories.id(
          req.params.subCategoryId
        )

      if (!subCategory) {
        return res.status(404).json({
          success: false,
          message:
            'Subcategory not found',
        })
      }

      const {
        name,
        image,
        description,
        isActive,
        sortOrder,
      } = req.body

      const oldName =
        subCategory.name

      if (name !== undefined) {
        const cleanName =
          name.trim()

        if (!cleanName) {
          return res.status(400).json({
            success: false,
            message:
              'Subcategory name is required',
          })
        }

        const duplicate =
          category.subCategories.find(
            (item) =>
              item._id.toString() !==
                subCategory._id.toString() &&
              item.name.toLowerCase() ===
                cleanName.toLowerCase()
          )

        if (duplicate) {
          return res.status(409).json({
            success: false,
            message:
              'This subcategory already exists in this category',
          })
        }

        subCategory.name =
          cleanName

        subCategory.slug =
          slugify(cleanName)
      }

      if (
        image !== undefined
      ) {
        subCategory.image =
          image
      }

      if (
        description !==
        undefined
      ) {
        subCategory.description =
          description
      }

      if (
        isActive !==
        undefined
      ) {
        subCategory.isActive =
          !!isActive
      }

      if (
        sortOrder !==
        undefined
      ) {
        subCategory.sortOrder =
          Number(sortOrder) || 0
      }

      await category.save()

      // If the subcategory name changes,
      // update products that use the old name.
      if (
        name !== undefined &&
        oldName !==
          subCategory.name
      ) {
        await Product.updateMany(
          {
            category:
              category.name,

            subCategory:
              oldName,
          },
          {
            $set: {
              subCategory:
                subCategory.name,
            },
          }
        )
      }

      res.json({
        success: true,
        message:
          'Subcategory updated successfully',
        data: subCategory,
      })
    }
  )

/* =========================================================
   DELETE SUBCATEGORY
   ========================================================= */

// DELETE /api/admin/categories/:categoryId/subcategories/:subCategoryId
export const deleteSubCategory =
  asyncHandler(
    async (req, res) => {
      const category =
        await Category.findById(
          req.params.categoryId
        )

      if (!category) {
        return res.status(404).json({
          success: false,
          message:
            'Category not found',
        })
      }

      const subCategory =
        category.subCategories.id(
          req.params.subCategoryId
        )

      if (!subCategory) {
        return res.status(404).json({
          success: false,
          message:
            'Subcategory not found',
        })
      }

      const subCategoryName =
        subCategory.name

      // Products cannot have an invalid
      // subcategory. Clear the field before
      // removing the subcategory.
      await Product.updateMany(
        {
          category:
            category.name,

          subCategory:
            subCategoryName,
        },
        {
          $set: {
            subCategory: '',
          },
        }
      )

      subCategory.deleteOne()

      await category.save()

      res.json({
        success: true,
        message:
          'Subcategory deleted successfully',
      })
    }
  )

/* =========================================================
   DELETE CATEGORY
   ========================================================= */

// DELETE /api/admin/categories/:id
export const deleteCategory =
  asyncHandler(
    async (req, res) => {
      const category =
        await Category.findById(
          req.params.id
        )

      if (!category) {
        return res.status(404).json({
          success: false,
          message:
            'Category not found',
        })
      }

      const oldCategoryName =
        category.name

      // Products cannot have an empty
      // category because Product.category
      // is required.
      await Product.updateMany(
        {
          category:
            oldCategoryName,
        },
        {
          $set: {
            category:
              'Uncategorized',
            subCategory:
              '',
          },
        }
      )

      await Category.findByIdAndDelete(
        req.params.id
      )

      res.json({
        success: true,
        message:
          'Category deleted successfully',
      })
    }
  )