const express = require('express');
const { query, param } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const Order = require('../models/Order');
const OrderStatus = require('../models/OrderStatus');

const router = express.Router();

// Get all transactions with pagination and filters
router.get('/', authenticateToken, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sort').optional().isIn(['payment_time', 'status', 'transaction_amount', 'order_amount']).withMessage('Invalid sort field'),
  query('order').optional().isIn(['asc', 'desc']).withMessage('Order must be asc or desc'),
  query('status').optional().isIn(['pending', 'success', 'failed', 'cancelled']).withMessage('Invalid status'),
  query('school_id').optional().isMongoId().withMessage('Invalid school ID')
], async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const sort = req.query.sort || 'createdAt';
    const order = req.query.order === 'asc' ? 1 : -1;

    // Build match conditions
    const matchConditions = {};
    if (req.query.status) {
      matchConditions['orderStatus.status'] = req.query.status;
    }
    if (req.query.school_id) {
      matchConditions.school_id = req.query.school_id;
    }

    // Aggregation pipeline
    const pipeline = [
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
          bank_reference: '$orderStatus.bank_reference',
          createdAt: 1
        }
      },
      {
        $sort: { [sort]: order }
      }
    ];

    // Get total count
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Order.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Get paginated data
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];
    const transactions = await Order.aggregate(dataPipeline);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions'
    });
  }
});

// Get transactions by school
router.get('/school/:schoolId', authenticateToken, [
  param('schoolId').isMongoId().withMessage('Invalid school ID'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const { schoolId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const pipeline = [
      {
        $match: { school_id: schoolId }
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
          bank_reference: '$orderStatus.bank_reference'
        }
      },
      {
        $sort: { createdAt: -1 }
      }
    ];

    // Get total count
    const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Order.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    // Get paginated data
    const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];
    const transactions = await Order.aggregate(dataPipeline);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Get school transactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch school transactions'
    });
  }
});

// Check transaction status
router.get('/status/:customOrderId', authenticateToken, [
  param('customOrderId').notEmpty().withMessage('Custom order ID is required')
], async (req, res) => {
  try {
    const { customOrderId } = req.params;

    const order = await Order.findOne({ custom_order_id: customOrderId });
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    const orderStatus = await OrderStatus.findOne({ collect_id: order._id });
    if (!orderStatus) {
      return res.status(404).json({
        success: false,
        message: 'Order status not found'
      });
    }

    res.json({
      success: true,
      data: {
        custom_order_id: order.custom_order_id,
        collect_id: order._id,
        school_id: order.school_id,
        student_info: order.student_info,
        gateway: order.gateway_name,
        order_amount: orderStatus.order_amount,
        transaction_amount: orderStatus.transaction_amount,
        status: orderStatus.status,
        payment_mode: orderStatus.payment_mode,
        payment_details: orderStatus.payment_details,
        bank_reference: orderStatus.bank_reference,
        payment_message: orderStatus.payment_message,
        payment_time: orderStatus.payment_time,
        error_message: orderStatus.error_message
      }
    });

  } catch (error) {
    console.error('Check transaction status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check transaction status'
    });
  }
});

module.exports = router;
