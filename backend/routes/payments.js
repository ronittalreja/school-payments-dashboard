const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const OrderStatus = require('../models/OrderStatus');
const router = express.Router();
  router.post('/create-payment', 
  authenticateToken,
  [
    body('school_id').notEmpty().withMessage('School ID is required'),
    body('amount').isNumeric().withMessage('Amount must be a number'),
    body('student_info.name').notEmpty().withMessage('Student name is required'),
    body('student_info.id').notEmpty().withMessage('Student ID is required'),
    body('student_info.email').isEmail().withMessage('Valid email is required'),
    body('callback_url')
      .custom((value) => {
        try {
          const url = new URL(value);
          if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error('Invalid protocol');
          }
          return true;
        } catch (error) {
          throw new Error('Invalid URL format');
        }
      })
      .withMessage('Valid callback URL is required')
  ],
  async (req, res) => {
    try {
      console.log('=== CREATE PAYMENT REQUEST ===');
      console.log('Request body:', JSON.stringify(req.body, null, 2));
        const errors = validationResult(req);
      if (!errors.isEmpty()) {
        console.log('Validation errors:', errors.array());
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const {
        school_id,
        amount,
        student_info,
        callback_url,
        gateway_name = 'Edviron',
        trustee_id
      } = req.body;
        if (!process.env.PG_KEY) {
        console.error('PG_KEY not found in environment');
        return res.status(500).json({
          success: false,
          message: 'Payment gateway configuration missing'
        });
      }

      if (!process.env.API_KEY) {
        console.error('API_KEY not found in environment');
        return res.status(500).json({
          success: false,
          message: 'Payment API key configuration missing'
        });
      }
        const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substr(2, 9);
      const custom_order_id = `ORD_${timestamp}_${randomStr}`;

      console.log('Generated custom_order_id:', custom_order_id);
        const jwtPayload = {
        school_id,
        amount: amount.toString(),
        callback_url
      };

      console.log('JWT payload:', jwtPayload);
        const sign = jwt.sign(jwtPayload, process.env.PG_KEY, { algorithm: 'HS256' });
      console.log('Generated JWT sign:', sign);
        const requestBody = {
        school_id,
        amount: amount.toString(),
        callback_url,
        sign
      };

      console.log('Payment API request body:', requestBody);

      try {
          console.log('Making API call to:', 'https://dev-vanilla.edviron.com/erp/create-collect-request');
        console.log('Using API Key:', process.env.API_KEY?.substring(0, 20) + '...');
        
        const response = await axios.post(
          'https://dev-vanilla.edviron.com/erp/create-collect-request',
          requestBody,
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.API_KEY}`
            },
            timeout: 30000 // 30 second timeout
          }
        );

        console.log('Payment API response:', response.data);

        if (!response.data || !response.data.collect_request_id) {
          throw new Error('Invalid response from payment API - missing collect_request_id');
        }
          const orderData = {
          school_id,
          trustee_id: trustee_id || null,
          student_info,
          gateway_name,
          custom_order_id,
          amount: parseFloat(amount),
          callback_url,
          status: 'processing',
          collect_request_id: response.data.collect_request_id // Now we have the actual ID
        };

        console.log('Creating order with data:', orderData);

        const order = new Order(orderData);
        await order.save();

        console.log('Order saved successfully:', order._id);
          const orderStatus = new OrderStatus({
          collect_id: order.custom_order_id, // Use custom_order_id here, not _id
          collect_request_id: response.data.collect_request_id,
          order_amount: parseFloat(amount), // Store original order amount
          transaction_amount: 0, // Will be updated by webhook
          payment_mode: '',
          payment_details: '',
          bank_reference: '',
          payment_message: '',
          status: 'processing', // Changed from pending to processing since we have collect_request_id
          error_message: '',
          payment_time: new Date(),
          gateway: gateway_name
        });

        await orderStatus.save();
        console.log('OrderStatus saved successfully');
          res.status(200).json({
          success: true,
          message: 'Payment request created successfully',
          data: {
            collect_request_id: response.data.collect_request_id,
            payment_url: response.data.Collect_request_url,
            custom_order_id: order.custom_order_id,
            order_id: order._id,
            sign: response.data.sign,
            amount: parseFloat(amount),
            student_name: student_info.name // Include student name in response
          }
        });

      } catch (apiError) {
        console.error('Payment API Error:', apiError.message);
        console.error('API Error Response:', apiError.response?.data);
        console.error('API Error Status:', apiError.response?.status);

        let errorMessage = 'Failed to create payment request';
        let statusCode = 500;

        if (apiError.response) {
          errorMessage = apiError.response.data?.message || errorMessage;
          statusCode = apiError.response.status;
        } else if (apiError.code === 'ECONNABORTED') {
          errorMessage = 'Payment API timeout - please try again';
          statusCode = 504;
        }

        return res.status(statusCode).json({
          success: false,
          message: errorMessage,
          error: process.env.NODE_ENV === 'development' ? apiError.message : 'Payment service unavailable'
        });
      }

    } catch (error) {
      console.error('Payment creation error:', error);
        if (error.code === 11000) {
        const field = Object.keys(error.keyPattern || {})[0] || 'field';
        return res.status(400).json({
          success: false,
          message: `Duplicate ${field} - please try again with different details`,
          error: process.env.NODE_ENV === 'development' ? error.message : 'Duplicate entry'
        });
      }

      res.status(500).json({
        success: false,
        message: 'Internal server error during payment creation',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
      });
    }
  }
);
  router.get('/payments', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, school_id } = req.query;
      const filter = {};
    if (status) filter.status = status;
    if (school_id) filter.school_id = school_id;
      const pipeline = [
      {
        $match: filter
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
        $project: {
          order_id: '$_id',
          custom_order_id: 1,
          collect_request_id: 1,
          student_name: '$student_info.name',
          student_email: '$student_info.email',
          student_id: '$student_info.id',
          school_id: 1,
          amount: 1,
          transaction_amount: {
            $cond: {
              if: '$orderStatus.transaction_amount',
              then: '$orderStatus.transaction_amount',
              else: 0
            }
          },
          payment_mode: {
            $cond: {
              if: '$orderStatus.payment_mode',
              then: '$orderStatus.payment_mode',
              else: ''
            }
          },
          payment_time: {
            $cond: {
              if: '$orderStatus.payment_time',
              then: '$orderStatus.payment_time',
              else: '$createdAt'
            }
          },
          status: {
            $cond: {
              if: '$orderStatus.status',
              then: '$orderStatus.status',
              else: '$status'
            }
          },
          gateway: {
            $cond: {
              if: '$orderStatus.gateway',
              then: '$orderStatus.gateway',
              else: '$gateway_name'
            }
          },
          created_at: '$createdAt',
          updated_at: '$updatedAt'
        }
      },
      {
        $sort: { created_at: -1 }
      },
      {
        $skip: (parseInt(page) - 1) * parseInt(limit)
      },
      {
        $limit: parseInt(limit)
      }
    ];

    const paymentsWithDetails = await Order.aggregate(pipeline);
      const countPipeline = [
      { $match: filter },
      { $count: 'total' }
    ];
    const countResult = await Order.aggregate(countPipeline);
    const total = countResult.length > 0 ? countResult[0].total : 0;

    res.json({
      success: true,
      data: paymentsWithDetails,
      pagination: {
        current_page: parseInt(page),
        per_page: parseInt(limit),
        total_pages: Math.ceil(total / limit),
        total_records: total
      }
    });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payments',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
});
  router.get('/check-payment-status/:collect_request_id', authenticateToken, async (req, res) => {
  try {
    const { collect_request_id } = req.params;
    const { school_id } = req.query;

    console.log('=== CHECK PAYMENT STATUS ===');
    console.log('collect_request_id:', collect_request_id);
    console.log('school_id:', school_id);

    if (!school_id) {
      return res.status(400).json({
        success: false,
        message: 'School ID is required'
      });
    }

    if (!process.env.PG_KEY) {
      return res.status(500).json({
        success: false,
        message: 'Payment gateway configuration missing'
      });
    }
      const jwtPayload = {
      school_id,
      collect_request_id
    };

    console.log('Status check JWT payload:', jwtPayload);

    const sign = jwt.sign(jwtPayload, process.env.PG_KEY, { algorithm: 'HS256' });

    console.log('Making status check API call...');
      const response = await axios.get(
      `https://dev-vanilla.edviron.com/erp/collect-request/${collect_request_id}`,
      {
        params: {
          school_id,
          sign
        },
        headers: {
          'Authorization': `Bearer ${process.env.API_KEY}`
        },
        timeout: 15000
      }
    );

    console.log('Payment status API response:', response.data);

    res.json({
      success: true,
      data: response.data
    });

  } catch (error) {
    console.error('Payment status check error:', error);
    console.error('Status API Error Response:', error.response?.data);
    
    let errorMessage = 'Failed to check payment status';
    let statusCode = 500;

    if (error.response) {
      errorMessage = error.response.data?.message || errorMessage;
      statusCode = error.response.status;
    } else if (error.code === 'ECONNABORTED') {
      errorMessage = 'Payment API timeout - please try again';
      statusCode = 504;
    }

    res.status(statusCode).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : 'Payment service unavailable'
    });
  }
});

module.exports = router;