import Product from '../models/Product.js'
import { asyncHandler } from '../middleware/errorMiddleware.js'
import slugify from '../utils/slugify.js'
import escapeRegex from '../utils/escapeRegex.js'

/* --------------------------- Public: list & read -------------------------- */

// GET /api/products
// Supports:
// search, category, subCategory, size, color, minPrice, maxPrice,
// discount, availability, rating, sorting, pagination.
export const getProducts = asyncHandler(async (req, res) => {
  const {
    search,
    category,
    subCategory,
    size,
    color,
    minPrice,
    maxPrice,
    minDiscount,
    minRating,
    availability,
    featured,
    newArrival,
    bestSeller,
    sort,
    page = 1,
    limit = 20,
  } = req.query

  const query = {
    isActive: true,
  }

  if (search) {
    query.$text = {
      $search: search,
    }
  }

  if (category) {
    query.category = category
  }

  // NEW: Subcategory filter
  if (subCategory) {
    query.subCategory = subCategory
  }

  if (size) {
    query.sizes = size
  }

  if (color) {
    query.colors = color
  }

  if (minPrice || maxPrice) {
    query.price = {}

    if (minPrice) {
      query.price.$gte = Number(minPrice)
    }

    if (maxPrice) {
      query.price.$lte = Number(maxPrice)
    }
  }

  if (minDiscount) {
    query.discount = {
      $gte: Number(minDiscount),
    }
  }

  if (minRating) {
    query.rating = {
      $gte: Number(minRating),
    }
  }

  if (featured === 'true') {
    query.isFeatured = true
  }

  if (newArrival === 'true') {
    query.isNewArrival = true
  }

  if (bestSeller === 'true') {
    query.isBestSeller = true
  }

  let sortSpec = {
    createdAt: -1,
  }

  if (sort === 'price_asc') {
    sortSpec = {
      price: 1,
    }
  }

  if (sort === 'price_desc') {
    sortSpec = {
      price: -1,
    }
  }

  if (sort === 'newest') {
    sortSpec = {
      createdAt: -1,
    }
  }

  if (sort === 'rating') {
    sortSpec = {
      rating: -1,
    }
  }

  if (sort === 'discount') {
    sortSpec = {
      discount: -1,
    }
  }

  if (
    sort === 'popular' ||
    sort === 'bestselling'
  ) {
    sortSpec = {
      reviewCount: -1,
      rating: -1,
    }
  }

  const pageNum = Math.max(
    1,
    Number(page) || 1
  )

  const limitNum = Math.min(
    100,
    Math.max(
      1,
      Number(limit) || 20
    )
  )

  const pipeline = [
    {
      $match: query,
    },

    {
      $addFields: {
        totalStock: {
          $sum: '$variants.stock',
        },

        variantCount: {
          $size: {
            $ifNull: [
              '$variants',
              [],
            ],
          },
        },
      },
    },
  ]

  if (availability === 'in') {
    pipeline.push({
      $match: {
        $or: [
          {
            totalStock: {
              $gt: 0,
            },
          },
          {
            variantCount: 0,
          },
        ],
      },
    })
  } else if (availability === 'out') {
    pipeline.push({
      $match: {
        totalStock: {
          $lte: 0,
        },
        variantCount: {
          $gt: 0,
        },
      },
    })
  }

  pipeline.push({
    $facet: {
      products: [
        {
          $sort: sortSpec,
        },
        {
          $skip:
            (pageNum - 1) *
            limitNum,
        },
        {
          $limit: limitNum,
        },
      ],

      totalCount: [
        {
          $count: 'count',
        },
      ],
    },
  })

  const [result] =
    await Product.aggregate(
      pipeline
    )

  const products =
    result?.products || []

  const total =
    result?.totalCount?.[0]
      ?.count || 0

  res.json({
    success: true,

    data: products,

    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(
        total / limitNum
      ),
    },
  })
})

// GET /api/products/:id
export const getProductById =
  asyncHandler(
    async (req, res) => {
      const { id } = req.params

      const query = id.match(
        /^[0-9a-fA-F]{24}$/
      )
        ? {
            _id: id,
          }
        : {
            slug: id,
          }

      const product =
        await Product.findOne({
          ...query,
          isActive: true,
        }).lean({
          virtuals: true,
        })

      if (!product) {
        return res.status(404).json({
          success: false,
          message:
            'Product not found',
        })
      }

      res.json({
        success: true,
        data: product,
      })
    }
  )

// GET /api/products/:id/variant-stock?size=&color=
export const getVariantStock =
  asyncHandler(
    async (req, res) => {
      const { id } = req.params
      const { size, color } =
        req.query

      const product =
        await Product.findById(
          id
        ).lean()

      if (!product) {
        return res.json({
          success: true,
          available: false,
          stock: 0,
        })
      }

      const variant = (
        product.variants || []
      ).find(
        (v) =>
          v.size === size &&
          v.color === color
      )

      const stock =
        variant?.stock ?? 0

      res.json({
        success: true,
        available: stock > 0,
        stock,
      })
    }
  )

/* -------------------------------- Admin CRUD ------------------------------- */

// GET /api/admin/products
export const getAdminProducts =
  asyncHandler(
    async (req, res) => {
      const {
        search,
        category,
        subCategory,
        status,
        stock,
        sort,
        page = 1,
        limit = 20,
      } = req.query

      const query = {}

      if (search) {
        const safeSearch =
          escapeRegex(
            String(search).trim()
          ).slice(0, 100)

        query.$or = [
          {
            name: new RegExp(
              safeSearch,
              'i'
            ),
          },
          {
            sku: new RegExp(
              safeSearch,
              'i'
            ),
          },
        ]
      }

      if (category) {
        query.category = category
      }

      // NEW: Admin subcategory filter
      if (subCategory) {
        query.subCategory =
          subCategory
      }

      if (status === 'active') {
        query.isActive = true
      }

      if (status === 'inactive') {
        query.isActive = false
      }

      const pageNum = Math.max(
        1,
        Number(page) || 1
      )

      const limitNum = Math.min(
        100,
        Math.max(
          1,
          Number(limit) || 20
        )
      )

      let sortSpec = {
        createdAt: -1,
      }

      if (sort === 'price_asc') {
        sortSpec = {
          price: 1,
        }
      }

      if (sort === 'price_desc') {
        sortSpec = {
          price: -1,
        }
      }

      if (sort === 'name_asc') {
        sortSpec = {
          name: 1,
        }
      }

      const pipeline = [
        {
          $match: query,
        },

        {
          $addFields: {
            totalStock: {
              $sum: '$variants.stock',
            },
          },
        },
      ]

      if (stock === 'low') {
        pipeline.push({
          $match: {
            $expr: {
              $and: [
                {
                  $gt: [
                    '$totalStock',
                    0,
                  ],
                },
                {
                  $lte: [
                    '$totalStock',
                    {
                      $ifNull: [
                        '$lowStockThreshold',
                        5,
                      ],
                    },
                  ],
                },
              ],
            },
          },
        })
      }

      if (stock === 'out') {
        pipeline.push({
          $match: {
            totalStock: {
              $lte: 0,
            },
          },
        })
      }

      pipeline.push({
        $facet: {
          products: [
            {
              $sort: sortSpec,
            },

            {
              $skip:
                (pageNum - 1) *
                limitNum,
            },

            {
              $limit: limitNum,
            },
          ],

          totalCount: [
            {
              $count: 'count',
            },
          ],
        },
      })

      const [result] =
        await Product.aggregate(
          pipeline
        )

      const products =
        result?.products || []

      const total =
        result?.totalCount?.[0]
          ?.count || 0

      res.json({
        success: true,

        data: products,

        pagination: {
          page: pageNum,
          limit: limitNum,
          total,
          pages: Math.ceil(
            total /
              limitNum
          ),
        },
      })
    }
  )

// GET /api/admin/products/:id
export const getAdminProductById =
  asyncHandler(
    async (req, res) => {
      const product =
        await Product.findById(
          req.params.id
        ).lean({
          virtuals: true,
        })

      if (!product) {
        return res.status(404).json({
          success: false,
          message:
            'Product not found',
        })
      }

      res.json({
        success: true,
        data: product,
      })
    }
  )

function normalizeVariants(
  sizes = [],
  colors = [],
  variants = []
) {
  const grid = []

  for (const size of sizes) {
    for (const color of colors) {
      const found =
        variants.find(
          (v) =>
            v.size === size &&
            v.color === color
        )

      grid.push({
        size,
        color,
        stock: Math.max(
          0,
          Number(
            found?.stock
          ) || 0
        ),
      })
    }
  }

  return grid
}

// POST /api/admin/products
export const createProduct =
  asyncHandler(
    async (req, res) => {
      const body = req.body

      const sizes =
        body.sizes || []

      const colors =
        body.colors || []

      const variants =
        normalizeVariants(
          sizes,
          colors,
          body.variants || []
        )

      const baseSlug =
        slugify(body.name)

      const slug =
        await Product.makeUniqueSlug(
          baseSlug ||
            `product-${Date.now()}`
        )

      const product =
        await Product.create({
          name: body.name,

          slug,

          description:
            body.description ||
            '',

          category:
            body.category,

          // NEW: Save subcategory
          subCategory:
            body.subCategory ||
            '',

          price: Number(
            body.price
          ),

          discount:
            Number(
              body.discount
            ) || 0,

          sizes,

          colors,

          variants,

          images:
            body.images || [],

          lowStockThreshold:
            Number(
              body.lowStockThreshold
            ) || 5,

          isFeatured:
            !!body.isFeatured,

          isNewArrival:
            body.isNewArrival !==
            undefined
              ? !!body.isNewArrival
              : true,

          isBestSeller:
            !!body.isBestSeller,
        })

      res.status(201).json({
        success: true,
        message:
          'Product created',
        data: product,
      })
    }
  )

// PUT /api/admin/products/:id
export const updateProduct =
  asyncHandler(
    async (req, res) => {
      const product =
        await Product.findById(
          req.params.id
        )

      if (!product) {
        return res.status(404).json({
          success: false,
          message:
            'Product not found',
        })
      }

      const body = req.body

      if (
        body.name &&
        body.name !== product.name
      ) {
        product.name =
          body.name

        product.slug =
          await Product.makeUniqueSlug(
            slugify(body.name)
          )
      }

      if (
        body.description !==
        undefined
      ) {
        product.description =
          body.description
      }

      if (
        body.category !==
        undefined
      ) {
        product.category =
          body.category
      }

      // NEW: Update subcategory
      if (
        body.subCategory !==
        undefined
      ) {
        product.subCategory =
          body.subCategory
      }

      if (
        body.price !==
        undefined
      ) {
        product.price =
          Number(body.price)
      }

      if (
        body.discount !==
        undefined
      ) {
        product.discount =
          Number(body.discount)
      }

      if (
        body.images !==
        undefined
      ) {
        product.images =
          body.images
      }

      if (
        body.lowStockThreshold !==
        undefined
      ) {
        product.lowStockThreshold =
          Number(
            body.lowStockThreshold
          )
      }

      if (
        body.isFeatured !==
        undefined
      ) {
        product.isFeatured =
          !!body.isFeatured
      }

      if (
        body.isNewArrival !==
        undefined
      ) {
        product.isNewArrival =
          !!body.isNewArrival
      }

      if (
        body.isBestSeller !==
        undefined
      ) {
        product.isBestSeller =
          !!body.isBestSeller
      }

      if (
        body.isActive !==
        undefined
      ) {
        product.isActive =
          !!body.isActive
      }

      const sizes =
        body.sizes !==
        undefined
          ? body.sizes
          : product.sizes

      const colors =
        body.colors !==
        undefined
          ? body.colors
          : product.colors

      if (
        body.sizes !==
          undefined ||
        body.colors !==
          undefined ||
        body.variants !==
          undefined
      ) {
        product.sizes =
          sizes

        product.colors =
          colors

        product.variants =
          normalizeVariants(
            sizes,
            colors,
            body.variants ||
              product.variants
          )
      }

      await product.save()

      res.json({
        success: true,
        message:
          'Product updated',
        data: product,
      })
    }
  )

// DELETE /api/admin/products/:id
export const deleteProduct =
  asyncHandler(
    async (req, res) => {
      const product =
        await Product.findById(
          req.params.id
        )

      if (!product) {
        return res.status(404).json({
          success: false,
          message:
            'Product not found',
        })
      }

      product.isActive = false

      await product.save()

      res.json({
        success: true,
        message:
          'Product archived',
        data: product,
      })
    }
  )

// PATCH /api/admin/products/bulk
export const bulkUpdateProducts =
  asyncHandler(
    async (req, res) => {
      const {
        ids,
        action,
        category,
        subCategory,
      } = req.body

      if (
        !Array.isArray(ids) ||
        ids.length === 0
      ) {
        return res.status(400).json({
          success: false,
          message:
            'No products selected',
        })
      }

      if (action === 'delete') {
        await Product.updateMany(
          {
            _id: {
              $in: ids,
            },
          },
          {
            $set: {
              isActive: false,
            },
          }
        )
      } else if (
        action === 'enable'
      ) {
        await Product.updateMany(
          {
            _id: {
              $in: ids,
            },
          },
          {
            isActive: true,
          }
        )
      } else if (
        action === 'disable'
      ) {
        await Product.updateMany(
          {
            _id: {
              $in: ids,
            },
          },
          {
            isActive: false,
          }
        )
      } else if (
        action === 'category' &&
        category
      ) {
        const update = {
          category,
        }

        if (
          subCategory !==
          undefined
        ) {
          update.subCategory =
            subCategory
        }

        await Product.updateMany(
          {
            _id: {
              $in: ids,
            },
          },
          update
        )
      } else {
        return res.status(400).json({
          success: false,
          message:
            'Unknown bulk action',
        })
      }

      res.json({
        success: true,
        message: `Bulk ${action} applied to ${ids.length} product(s)`,
      })
    }
  )

// GET /api/admin/products/export
export const exportProductsCsv =
  asyncHandler(
    async (req, res) => {
      const products =
        await Product.find(
          {}
        ).lean({
          virtuals: true,
        })

      const header = [
        'name',
        'category',
        'subCategory',
        'price',
        'discount',
        'totalStock',
        'isActive',
        'createdAt',
      ]

      const rows =
        products.map((p) =>
          [
            p.name,
            p.category,
            p.subCategory,
            p.price,
            p.discount,
            p.totalStock,
            p.isActive,
            p.createdAt
              ?.toISOString?.() ||
              '',
          ]
            .map(
              (v) =>
                `"${String(
                  v ?? ''
                ).replace(
                  /"/g,
                  '""'
                )}"`
            )
            .join(',')
        )

      const csv = [
        header.join(','),
        ...rows,
      ].join('\n')

      res.setHeader(
        'Content-Type',
        'text/csv'
      )

      res.setHeader(
        'Content-Disposition',
        'attachment; filename="kavsi-products.csv"'
      )

      res.send(csv)
    }
  )