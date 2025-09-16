  
const express = require('express');
const { query, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const Order = require('../models/Order');
const OrderStatus = require('../models/OrderStatus');
const PaymentTransaction = require('../models/PaymentTransaction');
const { logger } = require('../middleware/logger');

const router = express.Router();
  router.get('/stats', authenticateToken, [
  query('school_id').optional().isString().withMessage('Invalid school ID'),
  query('date_from').optional().isISO8601().withMessage('Invalid date format for date_from'),
  query('date_to').optional().isISO8601().withMessage('Invalid date format for date_to')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const schoolId = req.query.school_id || process.env.SCHOOL_ID;
    const dateFrom = req.query.date_from ? new Date(req.query.date_from) : null;
    const dateTo = req.query.date_to ? new Date(req.query.date_to) : null;
      const orderMatchConditions = {};
    if (schoolId) {
      orderMatchConditions.school_id = schoolId;
    }
    if (dateFrom || dateTo) {
      orderMatchConditions.createdAt = {};
      if (dateFrom) orderMatchConditions.createdAt.$gte = dateFrom;
      if (dateTo) orderMatchConditions.createdAt.$lte = dateTo;
    }
      const stats = await Order.aggregate([
      {
        $match: orderMatchConditions
      },
      {
        $lookup: {
          from: 'orderstatuses',
          localField: 'custom_order_id',  // FIXED: Use custom_order_id
          foreignField: 'collect_id',
          as: 'orderStatus'
        }
      },
      {
        $unwind: {
          path: '$orderStatus',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: {
            $cond: {
              if: '$orderStatus.status',
              then: '$orderStatus.status',
              else: 'pending'
            }
          },
          count: { $sum: 1 },
          totalAmount: {
            $sum: {
              $cond: {
                if: '$orderStatus.order_amount',
                then: '$orderStatus.order_amount',
                else: '$amount'
              }
            }
          },
          avgAmount: {
            $avg: {
              $cond: {
                if: '$orderStatus.order_amount',
                then: '$orderStatus.order_amount',
                else: '$amount'
              }
            }
          }
        }
      }
    ]);
      const paymentMethods = await Order.aggregate([
      {
        $match: orderMatchConditions
      },
      {
        $lookup: {
          from: 'orderstatuses',
          localField: 'custom_order_id',  // FIXED: Use custom_order_id
          foreignField: 'collect_id',
          as: 'orderStatus'
        }
      },
      {
        $unwind: '$orderStatus'
      },
      {
        $match: {
          'orderStatus.status': { $in: ['success', 'SUCCESS'] }
        }
      },
      {
        $group: {
          _id: '$orderStatus.payment_mode',
          count: { $sum: 1 },
          totalAmount: { $sum: '$orderStatus.transaction_amount' }
        }
      }
    ]);
      const monthlyTrends = await Order.aggregate([
      {
        $match: {
          ...orderMatchConditions,
          createdAt: {
            $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last 12 months
          }
        }
      },
      {
        $lookup: {
          from: 'orderstatuses',
          localField: 'custom_order_id',  // FIXED: Use custom_order_id
          foreignField: 'collect_id',
          as: 'orderStatus'
        }
      },
      {
        $unwind: {
          path: '$orderStatus',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            status: {
              $cond: {
                if: '$orderStatus.status',
                then: '$orderStatus.status',
                else: 'pending'
              }
            }
          },
          count: { $sum: 1 },
          totalAmount: {
            $sum: {
              $cond: {
                if: '$orderStatus.order_amount',
                then: '$orderStatus.order_amount',
                else: '$amount'
              }
            }
          }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);
      const processedStats = {
      totalTransactions: 0,
      successfulTransactions: 0,
      pendingTransactions: 0,
      failedTransactions: 0,
      cancelledTransactions: 0,
      totalAmount: 0,
      successfulAmount: 0,
      averageAmount: 0
    };

    stats.forEach(stat => {
      const status = stat._id || 'pending';
      const count = stat.count || 0;
      const amount = stat.totalAmount || 0;

      processedStats.totalTransactions += count;
      processedStats.totalAmount += amount;

      switch (status.toLowerCase()) {
        case 'success':
          processedStats.successfulTransactions = count;
          processedStats.successfulAmount = amount;
          break;
        case 'pending':
        case 'processing':
          processedStats.pendingTransactions += count;
          break;
        case 'failed':
        case 'failure':
          processedStats.failedTransactions += count;
          break;
        case 'cancelled':
          processedStats.cancelledTransactions += count;
          break;
      }
    });
      if (processedStats.totalTransactions > 0) {
      processedStats.averageAmount = processedStats.totalAmount / processedStats.totalTransactions;
    }
      processedStats.successRate = processedStats.totalTransactions > 0 
      ? (processedStats.successfulTransactions / processedStats.totalTransactions * 100).toFixed(2)
      : 0;

    logger.info('Dashboard stats retrieved', {
      userId: req.user.id,
      schoolId,
      totalTransactions: processedStats.totalTransactions
    });

    res.json({
      success: true,
      data: {
        overview: processedStats,
        paymentMethods: paymentMethods.map(pm => ({
          method: pm._id || 'unknown',
          count: pm.count,
          totalAmount: pm.totalAmount
        })),
        monthlyTrends,
        filters: {
          schoolId,
          dateFrom,
          dateTo
        }
      }
    });

  } catch (error) {
    logger.error('Dashboard stats error', {
      error: error.message,
      userId: req.user?.id,
      query: req.query
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard statistics'
    });
  }
});
  router.get('/recent-transactions', authenticateToken, [
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('school_id').optional().isString().withMessage('Invalid school ID')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const limit = parseInt(req.query.limit) || 10;
    const schoolId = req.query.school_id || process.env.SCHOOL_ID;

    const matchConditions = {};
    if (schoolId) {
      matchConditions.school_id = schoolId;
    }
      const recentTransactions = await Order.aggregate([
      {
        $match: matchConditions
      },
      {
        $lookup: {
          from: 'orderstatuses',
          localField: 'custom_order_id',  // FIXED: Use custom_order_id
          foreignField: 'collect_id',
          as: 'orderStatus'
        }
      },
      {
        $unwind: {
          path: '$orderStatus',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          order_id: '$custom_order_id',
          school_id: 1,
          gateway: '$gateway_name',
          order_amount: {
            $cond: {
              if: '$orderStatus.order_amount',
              then: '$orderStatus.order_amount',
              else: '$amount'
            }
          },
          transaction_amount: {
            $cond: {
              if: '$orderStatus.transaction_amount',
              then: '$orderStatus.transaction_amount',
              else: 0
            }
          },
          status: {
            $cond: {
              if: '$orderStatus.status',
              then: '$orderStatus.status',
              else: 'pending'
            }
          },
          custom_order_id: 1,
          student_info: 1,
          payment_time: {
            $cond: {
              if: '$orderStatus.payment_time',
              then: '$orderStatus.payment_time',
              else: '$createdAt'
            }
          },
          payment_mode: {
            $cond: {
              if: '$orderStatus.payment_mode',
              then: '$orderStatus.payment_mode',
              else: 'N/A'
            }
          },
          createdAt: 1
        }
      },
      {
        $sort: { payment_time: -1 }
      },
      {
        $limit: limit
      }
    ]);

    res.json({
      success: true,
      data: {
        transactions: recentTransactions,
        count: recentTransactions.length
      }
    });

  } catch (error) {
    logger.error('Recent transactions error', {
      error: error.message,
      userId: req.user?.id,
      query: req.query
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent transactions'
    });
  }
});
  router.get('/transaction-summary', authenticateToken, [
  query('date_from').optional().isISO8601().withMessage('Invalid date format for date_from'),
  query('date_to').optional().isISO8601().withMessage('Invalid date format for date_to'),
  query('school_id').optional().isString().withMessage('Invalid school ID'),
  query('group_by').optional().isIn(['day', 'week', 'month']).withMessage('group_by must be day, week, or month')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const schoolId = req.query.school_id || process.env.SCHOOL_ID;
    const dateFrom = req.query.date_from ? new Date(req.query.date_from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = req.query.date_to ? new Date(req.query.date_to) : new Date();
    const groupBy = req.query.group_by || 'day';
      const matchConditions = {
      createdAt: {
        $gte: dateFrom,
        $lte: dateTo
      }
    };

    if (schoolId) {
      matchConditions.school_id = schoolId;
    }
      let grouping;
    switch (groupBy) {
      case 'week':
        grouping = {
          year: { $year: '$createdAt' },
          week: { $week: '$createdAt' }
        };
        break;
      case 'month':
        grouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' }
        };
        break;
      default: // day
        grouping = {
          year: { $year: '$createdAt' },
          month: { $month: '$createdAt' },
          day: { $dayOfMonth: '$createdAt' }
        };
    }
      const summary = await Order.aggregate([
      {
        $match: matchConditions
      },
      {
        $lookup: {
          from: 'orderstatuses',
          localField: 'custom_order_id',  // FIXED: Use custom_order_id
          foreignField: 'collect_id',
          as: 'orderStatus'
        }
      },
      {
        $unwind: {
          path: '$orderStatus',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: {
            ...grouping,
            status: {
              $cond: {
                if: '$orderStatus.status',
                then: '$orderStatus.status',
                else: 'pending'
              }
            }
          },
          count: { $sum: 1 },
          totalAmount: {
            $sum: {
              $cond: {
                if: '$orderStatus.order_amount',
                then: '$orderStatus.order_amount',
                else: '$amount'
              }
            }
          },
          avgAmount: {
            $avg: {
              $cond: {
                if: '$orderStatus.order_amount',
                then: '$orderStatus.order_amount',
                else: '$amount'
              }
            }
          }
        }
      },
      {
        $group: {
          _id: {
            year: '$_id.year',
            month: '$_id.month',
            day: '$_id.day',
            week: '$_id.week'
          },
          transactions: {
            $push: {
              status: '$_id.status',
              count: '$count',
              totalAmount: '$totalAmount',
              avgAmount: '$avgAmount'
            }
          },
          totalCount: { $sum: '$count' },
          totalAmount: { $sum: '$totalAmount' }
        }
      },
      {
        $sort: {
          '_id.year': 1,
          '_id.month': 1,
          '_id.day': 1,
          '_id.week': 1
        }
      }
    ]);

    res.json({
      success: true,
      data: {
        summary,
        filters: {
          schoolId,
          dateFrom,
          dateTo,
          groupBy
        }
      }
    });

  } catch (error) {
    logger.error('Transaction summary error', {
      error: error.message,
      userId: req.user?.id,
      query: req.query
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction summary'
    });
  }
});
  router.get('/top-schools', authenticateToken, [
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('sort_by').optional().isIn(['transactions', 'amount']).withMessage('sort_by must be transactions or amount')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const limit = parseInt(req.query.limit) || 10;
    const sortBy = req.query.sort_by || 'transactions';
      const topSchools = await Order.aggregate([
      {
        $lookup: {
          from: 'orderstatuses',
          localField: 'custom_order_id',  // FIXED: Use custom_order_id
          foreignField: 'collect_id',
          as: 'orderStatus'
        }
      },
      {
        $unwind: {
          path: '$orderStatus',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: '$school_id',
          totalTransactions: { $sum: 1 },
          successfulTransactions: {
            $sum: {
              $cond: [
                { $in: [{ $toLower: { $ifNull: ['$orderStatus.status', 'pending'] } }, ['success']] }, 
                1, 
                0
              ]
            }
          },
          totalAmount: {
            $sum: {
              $cond: {
                if: '$orderStatus.order_amount',
                then: '$orderStatus.order_amount',
                else: '$amount'
              }
            }
          },
          successfulAmount: {
            $sum: {
              $cond: [
                { $in: [{ $toLower: { $ifNull: ['$orderStatus.status', 'pending'] } }, ['success']] },
                { $ifNull: ['$orderStatus.order_amount', '$amount'] },
                0
              ]
            }
          }
        }
      },
      {
        $addFields: {
          successRate: {
            $cond: [
              { $gt: ['$totalTransactions', 0] },
              { $multiply: [{ $divide: ['$successfulTransactions', '$totalTransactions'] }, 100] },
              0
            ]
          }
        }
      },
      {
        $sort: sortBy === 'amount' ? { totalAmount: -1 } : { totalTransactions: -1 }
      },
      {
        $limit: limit
      }
    ]);

    res.json({
      success: true,
      data: {
        schools: topSchools,
        sortBy,
        limit
      }
    });

  } catch (error) {
    logger.error('Top schools error', {
      error: error.message,
      userId: req.user?.id,
      query: req.query
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch top schools data'
    });
  }
});
  router.get('/gateway-performance', authenticateToken, [
  query('date_from').optional().isISO8601().withMessage('Invalid date format for date_from'),
  query('date_to').optional().isISO8601().withMessage('Invalid date format for date_to')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const dateFrom = req.query.date_from ? new Date(req.query.date_from) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dateTo = req.query.date_to ? new Date(req.query.date_to) : new Date();

    const matchConditions = {
      createdAt: {
        $gte: dateFrom,
        $lte: dateTo
      }
    };
      const gatewayPerformance = await Order.aggregate([
      {
        $match: matchConditions
      },
      {
        $lookup: {
          from: 'orderstatuses',
          localField: 'custom_order_id',  // FIXED: Use custom_order_id
          foreignField: 'collect_id',
          as: 'orderStatus'
        }
      },
      {
        $unwind: {
          path: '$orderStatus',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $group: {
          _id: '$gateway_name',
          totalTransactions: { $sum: 1 },
          successfulTransactions: {
            $sum: {
              $cond: [
                { $in: [{ $toLower: { $ifNull: ['$orderStatus.status', 'pending'] } }, ['success']] }, 
                1, 
                0
              ]
            }
          },
          failedTransactions: {
            $sum: {
              $cond: [
                { $in: [{ $toLower: { $ifNull: ['$orderStatus.status', 'pending'] } }, ['failed', 'failure']] }, 
                1, 
                0
              ]
            }
          },
          pendingTransactions: {
            $sum: {
              $cond: [
                { $in: [{ $toLower: { $ifNull: ['$orderStatus.status', 'pending'] } }, ['pending', 'processing']] }, 
                1, 
                0
              ]
            }
          },
          totalAmount: {
            $sum: {
              $cond: {
                if: '$orderStatus.order_amount',
                then: '$orderStatus.order_amount',
                else: '$amount'
              }
            }
          },
          successfulAmount: {
            $sum: {
              $cond: [
                { $in: [{ $toLower: { $ifNull: ['$orderStatus.status', 'pending'] } }, ['success']] },
                { $ifNull: ['$orderStatus.order_amount', '$amount'] },
                0
              ]
            }
          },
          avgProcessingTime: {
            $avg: {
              $cond: [
                { $and: ['$orderStatus.payment_time', '$createdAt'] },
                { $subtract: ['$orderStatus.payment_time', '$createdAt'] },
                null
              ]
            }
          }
        }
      },
      {
        $addFields: {
          successRate: {
            $cond: [
              { $gt: ['$totalTransactions', 0] },
              { $multiply: [{ $divide: ['$successfulTransactions', '$totalTransactions'] }, 100] },
              0
            ]
          },
          failureRate: {
            $cond: [
              { $gt: ['$totalTransactions', 0] },
              { $multiply: [{ $divide: ['$failedTransactions', '$totalTransactions'] }, 100] },
              0
            ]
          }
        }
      },
      {
        $sort: { totalTransactions: -1 }
      }
    ]);

    res.json({
      success: true,
      data: {
        gateways: gatewayPerformance,
        filters: {
          dateFrom,
          dateTo
        }
      }
    });

  } catch (error) {
    logger.error('Gateway performance error', {
      error: error.message,
      userId: req.user?.id,
      query: req.query
    });

    res.status(500).json({
      success: false,
      message: 'Failed to fetch gateway performance data'
    });
  }
});

module.exports = router;