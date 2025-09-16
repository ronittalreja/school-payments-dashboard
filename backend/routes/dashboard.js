// backend/src/routes/dashboard.js

const express = require('express');
const { query, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const Order = require('../models/Order');
const OrderStatus = require('../models/OrderStatus');
const PaymentTransaction = require('../models/PaymentTransaction');
const { logger } = require('../middleware/logger');

const router = express.Router();

// Get dashboard statistics
router.get('/stats', authenticateToken, [
  query('school_id').optional().isMongoId().withMessage('Invalid school ID'),
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

    // Build match conditions
    const matchConditions = {};
    if (schoolId) {
      matchConditions.school_id = schoolId;
    }
    if (dateFrom || dateTo) {
      matchConditions.createdAt = {};
      if (dateFrom) matchConditions.createdAt.$gte = dateFrom;
      if (dateTo) matchConditions.createdAt.$lte = dateTo;
    }

    // Get transaction statistics
    const stats = await Order.aggregate([
      {
        $lookup: {
          from: 'orderstatuses',
          localField: '_id',
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
        $match: matchConditions
      },
      {
        $group: {
          _id: '$orderStatus.status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$orderStatus.order_amount' },
          avgAmount: { $avg: '$orderStatus.order_amount' }
        }
      }
    ]);

    // Get payment method distribution
    const paymentMethods = await OrderStatus.aggregate([
      {
        $lookup: {
          from: 'orders',
          localField: 'collect_id',
          foreignField: '_id',
          as: 'order'
        }
      },
      {
        $unwind: '$order'
      },
      {
        $match: {
          ...matchConditions,
          status: 'success'
        }
      },
      {
        $group: {
          _id: '$payment_mode',
          count: { $sum: 1 },
          totalAmount: { $sum: '$transaction_amount' }
        }
      }
    ]);

    // Get monthly trends (last 12 months)
    const monthlyTrends = await Order.aggregate([
      {
        $lookup: {
          from: 'orderstatuses',
          localField: '_id',
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
        $match: {
          ...matchConditions,
          createdAt: {
            $gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) // Last 12 months
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' },
            status: '$orderStatus.status'
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$orderStatus.order_amount' }
        }
      },
      {
        $sort: { '_id.year': 1, '_id.month': 1 }
      }
    ]);

    // Process statistics
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

      switch (status) {
        case 'success':
          processedStats.successfulTransactions = count;
          processedStats.successfulAmount = amount;
          break;
        case 'pending':
          processedStats.pendingTransactions = count;
          break;
        case 'failed':
          processedStats.failedTransactions = count;
          break;
        case 'cancelled':
          processedStats.cancelledTransactions = count;
          break;
      }
    });

    // Calculate average amount
    if (processedStats.totalTransactions > 0) {
      processedStats.averageAmount = processedStats.totalAmount / processedStats.totalTransactions;
    }

    // Calculate success rate
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

// Get recent transactions for dashboard
router.get('/recent-transactions', authenticateToken, [
  query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50'),
  query('school_id').optional().isMongoId().withMessage('Invalid school ID')
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
        $lookup: {
          from: 'orderstatuses',
          localField: '_id',
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
        $match: matchConditions
      },
      {
        $project: {
          collect_id: '$_id',
          school_id: 1,
          gateway: '$gateway_name',
          order_amount: '$orderStatus.order_amount',
          transaction_amount: '$orderStatus.transaction_amount',
          status: '$orderStatus.status',
          custom_order_id: 1,
          student_info: 1,
          payment_time: '$orderStatus.payment_time',
          payment_mode: '$orderStatus.payment_mode',
          createdAt: 1
        }
      },
      {
        $sort: { createdAt: -1 }
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

// Get transaction summary by date range
router.get('/transaction-summary', authenticateToken, [
  query('date_from').optional().isISO8601().withMessage('Invalid date format for date_from'),
  query('date_to').optional().isISO8601().withMessage('Invalid date format for date_to'),
  query('school_id').optional().isMongoId().withMessage('Invalid school ID'),
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

    // Build match conditions
    const matchConditions = {
      createdAt: {
        $gte: dateFrom,
        $lte: dateTo
      }
    };

    if (schoolId) {
      matchConditions.school_id = schoolId;
    }

    // Define grouping based on group_by parameter
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
        $lookup: {
          from: 'orderstatuses',
          localField: '_id',
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
        $match: matchConditions
      },
      {
        $group: {
          _id: {
            ...grouping,
            status: '$orderStatus.status'
          },
          count: { $sum: 1 },
          totalAmount: { $sum: '$orderStatus.order_amount' },
          avgAmount: { $avg: '$orderStatus.order_amount' }
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

// Get top performing schools
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
          localField: '_id',
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
              $cond: [{ $eq: ['$orderStatus.status', 'success'] }, 1, 0]
            }
          },
          totalAmount: { $sum: '$orderStatus.order_amount' },
          successfulAmount: {
            $sum: {
              $cond: [
                { $eq: ['$orderStatus.status', 'success'] },
                '$orderStatus.order_amount',
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

// Get payment gateway performance
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
          localField: '_id',
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
              $cond: [{ $eq: ['$orderStatus.status', 'success'] }, 1, 0]
            }
          },
          failedTransactions: {
            $sum: {
              $cond: [{ $eq: ['$orderStatus.status', 'failed'] }, 1, 0]
            }
          },
          pendingTransactions: {
            $sum: {
              $cond: [{ $eq: ['$orderStatus.status', 'pending'] }, 1, 0]
            }
          },
          totalAmount: { $sum: '$orderStatus.order_amount' },
          successfulAmount: {
            $sum: {
              $cond: [
                { $eq: ['$orderStatus.status', 'success'] },
                '$orderStatus.order_amount',
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