const express = require('express');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { authenticateToken } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const Order = require('../models/Order');
const OrderStatus = require('../models/OrderStatus');
const router = express.Router();

// Create payment route - FIXED VERSION
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
      
      // Check validation errors
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

      // Validate environment variables
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

      // Generate unique custom order ID
      const timestamp = Date.now();
      const randomStr = Math.random().toString(36).substr(2, 9);
      const custom_order_id = `ORD_${timestamp}_${randomStr}`;

      console.log('Generated custom_order_id:', custom_order_id);

      // Create JWT payload for signing
      const jwtPayload = {
        school_id,
        amount: amount.toString(),
        callback_url
      };

      console.log('JWT payload:', jwtPayload);

      // Sign JWT using PG key
      const sign = jwt.sign(jwtPayload, process.env.PG_KEY, { algorithm: 'HS256' });
      console.log('Generated JWT sign:', sign);

      // Prepare request body for payment API
      const requestBody = {
        school_id,
        amount: amount.toString(),
        callback_url,
        sign
      };

      console.log('Payment API request body:', requestBody);

      try {
        // Make API call to create collect request FIRST
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

        // NOW create order with the collect_request_id we got from API
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

        // Create initial order status - FIXED: Use custom_order_id as collect_id
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

        // Send success response
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
      
      // If it's a MongoDB duplicate key error
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

// Get payment list with proper data - NEW ROUTE
router.get('/payments', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status, school_id } = req.query;
    
    // Build filter
    const filter = {};
    if (status) filter.status = status;
    if (school_id) filter.school_id = school_id;

    // Get orders with pagination
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get corresponding order statuses
    const orderStatuses = await OrderStatus.find({
      collect_id: { $in: orders.map(o => o.custom_order_id) }
    });

    // Create a map for quick lookup
    const statusMap = {};
    orderStatuses.forEach(status => {
      statusMap[status.collect_id] = status;
    });

    // Combine the data
    const paymentsWithDetails = orders.map(order => {
      const orderStatus = statusMap[order.custom_order_id] || {};
      
      return {
        order_id: order._id,
        custom_order_id: order.custom_order_id,
        collect_request_id: order.collect_request_id,
        student_name: order.student_info.name,
        student_email: order.student_info.email,
        student_id: order.student_info.id,
        school_id: order.school_id,
        amount: order.amount,
        transaction_amount: orderStatus.transaction_amount || 0,
        payment_mode: orderStatus.payment_mode || '',
        payment_time: orderStatus.payment_time || order.createdAt,
        status: orderStatus.status || order.status,
        gateway: orderStatus.gateway || order.gateway_name,
        created_at: order.createdAt,
        updated_at: order.updatedAt
      };
    });

    // Get total count
    const total = await Order.countDocuments(filter);

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

// Check payment status using external API
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

    // Create JWT for status check
    const jwtPayload = {
      school_id,
      collect_request_id
    };

    console.log('Status check JWT payload:', jwtPayload);

    const sign = jwt.sign(jwtPayload, process.env.PG_KEY, { algorithm: 'HS256' });

    console.log('Making status check API call...');

    // Make API call to check status
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