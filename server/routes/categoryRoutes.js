import express from 'express'

import {
  getCategories,
  getAdminCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
} from '../controllers/categoryController.js'

import protect from '../middleware/authMiddleware.js'

/* =========================================================
   PUBLIC CATEGORY ROUTES
   ========================================================= */

const router = express.Router()

// GET /api/categories
router.get(
  '/categories',
  getCategories
)

export default router

/* =========================================================
   ADMIN CATEGORY ROUTES
   ========================================================= */

export const adminCategoryRouter =
  express.Router()

// All admin category routes require
// admin authentication.
adminCategoryRouter.use(protect)

/* --------------------------- Categories --------------------------- */

// GET /api/admin/categories
adminCategoryRouter.get(
  '/',
  getAdminCategories
)

// POST /api/admin/categories
adminCategoryRouter.post(
  '/',
  createCategory
)

// PUT /api/admin/categories/:id
adminCategoryRouter.put(
  '/:id',
  updateCategory
)

// DELETE /api/admin/categories/:id
adminCategoryRouter.delete(
  '/:id',
  deleteCategory
)

/* ------------------------- Sub Categories ------------------------ */

// POST /api/admin/categories/:id/subcategories
adminCategoryRouter.post(
  '/:id/subcategories',
  createSubCategory
)

// PUT /api/admin/categories/:categoryId/subcategories/:subCategoryId
adminCategoryRouter.put(
  '/:categoryId/subcategories/:subCategoryId',
  updateSubCategory
)

// DELETE /api/admin/categories/:categoryId/subcategories/:subCategoryId
adminCategoryRouter.delete(
  '/:categoryId/subcategories/:subCategoryId',
  deleteSubCategory
)