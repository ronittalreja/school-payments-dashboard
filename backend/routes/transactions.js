const express = require('express');
const { query, param } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const Order = require('../models/Order');
const OrderStatus = require('../models/OrderStatus');

const router = express.Router();
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
      const orderMatchConditions = {};
    if (req.query.school_id) {
      orderMatchConditions.school_id = req.query.school_id;
    }
      const statusMatchConditions = {};
    if (req.query.status) {
      statusMatchConditions['orderStatus.status'] = req.query.status;
    }
      const pipeline = [
      {
        $match: orderMatchConditions
      },
      {
        $lookup: {
          from: 'orderstatuses',
          localField: 'custom_order_id',  // FIXED: Use custom_order_id instead of _id
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
        $match: statusMatchConditions
      },
      {
        $addFields: {
            effective_payment_time: {
            $cond: {
              if: '$orderStatus.payment_time',
              then: '$orderStatus.payment_time',
              else: '$createdAt'
            }
          },
          effective_status: {
            $cond: {
              if: '$orderStatus.status',
              then: '$orderStatus.status',
              else: 'pending'
            }
          }
        }
      },
      {
        $project: {
          order_id: '$custom_order_id',  // Use custom_order_id as order_id
          school_id: 1,
          gateway: '$gateway_name',
          order_amount: {
            $cond: {
              if: '$orderStatus.order_amount',
              then: '$orderStatus.order_amount',
              else: '$amount'  // Fallback to original order amount
            }
          },
          transaction_amount: {
            $cond: {
              if: '$orderStatus.transaction_amount',
              then: '$orderStatus.transaction_amount',
              else: 0
            }
          },
          status: '$effective_status',
          custom_order_id: 1,
          student_info: 1,
          payment_time: '$effective_payment_time',
          payment_mode: {
            $cond: {
              if: '$orderStatus.payment_mode',
              then: '$orderStatus.payment_mode',
              else: 'N/A'
            }
          },
          bank_reference: {
            $cond: {
              if: '$orderStatus.bank_reference',
              then: '$orderStatus.bank_reference',
              else: ''
            }
          },
          createdAt: 1,
          updatedAt: 1
        }
      },
      {
        $sort: { 
          [sort === 'payment_time' ? 'effective_payment_time' : sort]: order 
        }
      }
    ];
      const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Order.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;
      const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];
    const transactions = await Order.aggregate(dataPipeline);

    console.log(`Found ${transactions.length} transactions for page ${page}`);

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
      message: 'Failed to fetch transactions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});
  router.get('/school/:schoolId', authenticateToken, [
  param('schoolId').notEmpty().withMessage('Invalid school ID'),  // Changed from isMongoId as school_id might not be ObjectId
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
        $addFields: {
          effective_payment_time: {
            $cond: {
              if: '$orderStatus.payment_time',
              then: '$orderStatus.payment_time',
              else: '$createdAt'
            }
          }
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
          payment_time: '$effective_payment_time',
          payment_mode: {
            $cond: {
              if: '$orderStatus.payment_mode',
              then: '$orderStatus.payment_mode',
              else: 'N/A'
            }
          },
          bank_reference: {
            $cond: {
              if: '$orderStatus.bank_reference',
              then: '$orderStatus.bank_reference',
              else: ''
            }
          },
          createdAt: 1,
          updatedAt: 1
        }
      },
      {
        $sort: { effective_payment_time: -1 }
      }
    ];
      const countPipeline = [...pipeline, { $count: 'total' }];
    const countResult = await Order.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;
      const dataPipeline = [...pipeline, { $skip: skip }, { $limit: limit }];
    const transactions = await Order.aggregate(dataPipeline);

    console.log(`Found ${transactions.length} school transactions for ${schoolId}`);

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
      message: 'Failed to fetch school transactions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});
  router.get('/status/:customOrderId', authenticateToken, [
  param('customOrderId').notEmpty().withMessage('Custom order ID is required')
], async (req, res) => {
  try {
    const { customOrderId } = req.params;

    console.log(`Checking status for order: ${customOrderId}`);

    const order = await Order.findOne({ custom_order_id: customOrderId });
    if (!order) {
      console.log(`Order not found: ${customOrderId}`);
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
      const orderStatus = await OrderStatus.findOne({ collect_id: customOrderId });
    
    console.log('Found order:', !!order);
    console.log('Found orderStatus:', !!orderStatus);
      const responseData = {
      custom_order_id: order.custom_order_id,
      collect_id: order.custom_order_id,  // Use custom_order_id as collect_id
      school_id: order.school_id,
      student_info: order.student_info,
      gateway: order.gateway_name,
      order_amount: orderStatus ? orderStatus.order_amount : order.amount,
      transaction_amount: orderStatus ? orderStatus.transaction_amount : 0,
      status: orderStatus ? orderStatus.status : order.status,
      payment_mode: orderStatus ? orderStatus.payment_mode : 'N/A',
      payment_details: orderStatus ? orderStatus.payment_details : null,
      bank_reference: orderStatus ? orderStatus.bank_reference : '',
      payment_message: orderStatus ? orderStatus.payment_message : '',
      payment_time: orderStatus ? orderStatus.payment_time : order.createdAt,
      error_message: orderStatus ? orderStatus.error_message : '',
      created_at: order.createdAt,
      updated_at: order.updatedAt
    };

    res.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Check transaction status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check transaction status',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});

module.exports = router;