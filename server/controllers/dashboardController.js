import Product from '../models/Product.js';
import Order from '../models/Order.js';
import { asyncHandler } from '../middleware/errorMiddleware.js';

// GET /api/admin/dashboard — summary stats (spec 30)
export const getDashboardStats = asyncHandler(async (req, res) => {
  const [
    totalProducts,
    totalOrders,
    pendingOrders,
    deliveredOrders,
    revenueBreakdownAgg,
    lowStockAgg,
    outOfStockAgg,
  ] = await Promise.all([
    Product.countDocuments({}),
    Order.countDocuments({}),
    Order.countDocuments({ orderStatus: 'Pending' }),
    Order.countDocuments({ orderStatus: 'Delivered' }),
    // Bug 23: paid revenue, COD-pending, and refunded amounts are separate
    // buckets -- pending COD is not counted as realized revenue, cancelled
    // orders are excluded entirely, and refunds are tracked but subtracted
    // rather than silently included in "revenue".
    Order.aggregate([
      { $match: { orderStatus: { $ne: 'Cancelled' } } },
      {
        $group: {
          _id: null,
          grossSales: { $sum: '$totalAmount' },
          paidRevenue: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'Paid'] }, '$totalAmount', 0] } },
          codPending: {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$paymentMethod', 'COD'] }, { $eq: ['$paymentStatus', 'Pending'] }] }, '$totalAmount', 0],
            },
          },
          refunded: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'Refunded'] }, '$totalAmount', 0] } },
        },
      },
    ]),
    // Low-stock and out-of-stock counts computed in Mongo, not by pulling
    // every product document into Node and filtering in JS.
    Product.aggregate([
      { $unwind: '$variants' },
      { $match: { $expr: { $and: [{ $gt: ['$variants.stock', 0] }, { $lte: ['$variants.stock', { $ifNull: ['$lowStockThreshold', 5] }] }] } } },
      { $project: { _id: 0, productId: '$_id', productName: '$name', size: '$variants.size', color: '$variants.color', stock: '$variants.stock' } },
      { $limit: 200 },
    ]),
    Product.aggregate([
      { $addFields: { totalStock: { $sum: '$variants.stock' } } },
      { $match: { totalStock: { $lte: 0 } } },
      { $count: 'count' },
    ]),
  ]);

  const rev = revenueBreakdownAgg[0] || {};
  const revenue = {
    grossSales: rev.grossSales || 0,
    paidRevenue: rev.paidRevenue || 0,
    codPending: rev.codPending || 0,
    refunded: rev.refunded || 0,
    netRevenue: (rev.paidRevenue || 0) - (rev.refunded || 0),
  };
  const lowStockVariants = lowStockAgg;
  const outOfStockCount = outOfStockAgg[0]?.count || 0;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todaySalesAgg = await Order.aggregate([
    { $match: { createdAt: { $gte: todayStart }, orderStatus: { $ne: 'Cancelled' } } },
    { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
  ]);

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthSalesAgg = await Order.aggregate([
    { $match: { createdAt: { $gte: monthStart }, orderStatus: { $ne: 'Cancelled' } } },
    { $group: { _id: null, total: { $sum: '$totalAmount' }, count: { $sum: 1 } } },
  ]);

  const orderStatusBreakdown = await Order.aggregate([{ $group: { _id: '$orderStatus', count: { $sum: 1 } } }]);

  res.json({
    success: true,
    data: {
      totalProducts,
      totalOrders,
      pendingOrders,
      deliveredOrders,
      revenue,
      lowStockCount: lowStockVariants.length,
      lowStockVariants,
      outOfStockCount,
      todaySales: todaySalesAgg[0]?.total || 0,
      todayOrderCount: todaySalesAgg[0]?.count || 0,
      monthSales: monthSalesAgg[0]?.total || 0,
      monthOrderCount: monthSalesAgg[0]?.count || 0,
      orderStatusBreakdown,
    },
  });
});

// GET /api/admin/dashboard/best-sellers
export const getBestSellers = asyncHandler(async (req, res) => {
  const results = await Order.aggregate([
    { $match: { orderStatus: { $ne: 'Cancelled' } } },
    { $unwind: '$products' },
    { $group: { _id: '$products.productId', name: { $first: '$products.name' }, unitsSold: { $sum: '$products.quantity' }, revenue: { $sum: { $multiply: ['$products.price', '$products.quantity'] } } } },
    { $sort: { unitsSold: -1 } },
    { $limit: 10 },
  ]);
  res.json({ success: true, data: results });
});

// GET /api/admin/dashboard/sales?range=daily|weekly|monthly
// GET /api/admin/dashboard/sales?range=daily|weekly|monthly
export const getSalesChart = asyncHandler(async (req, res) => {
  const { range = 'daily', days = 30 } = req.query

  const since = new Date()
  since.setDate(
    since.getDate() - Number(days)
  )

  let groupId

  if (range === 'monthly') {
    groupId = {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' },
    }
  } else if (range === 'weekly') {
    groupId = {
      year: { $isoWeekYear: '$createdAt' },
      week: { $isoWeek: '$createdAt' },
    }
  } else {
    groupId = {
      year: { $year: '$createdAt' },
      month: { $month: '$createdAt' },
      day: { $dayOfMonth: '$createdAt' },
    }
  }

  const results = await Order.aggregate([
    {
      $match: {
        createdAt: { $gte: since },
        orderStatus: { $ne: 'Cancelled' },
      },
    },
    {
      $group: {
        _id: groupId,
        revenue: { $sum: '$totalAmount' },
        orders: { $sum: 1 },
      },
    },
    {
      $sort: {
        '_id.year': 1,
        '_id.month': 1,
        '_id.week': 1,
        '_id.day': 1,
      },
    },
  ])

  res.json({
    success: true,
    data: results,
  })
})