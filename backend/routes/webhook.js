const express = require('express');
const WebhookLog = require('../models/WebhookLog');
const OrderStatus = require('../models/OrderStatus');
const Order = require('../models/Order');

const router = express.Router();

// POST /api/webhook
router.post('/', async (req, res) => {
  let webhookLog;
  
  try {
    const { status, order_info } = req.body;

    // 1️⃣ Log the webhook attempt first
    webhookLog = new WebhookLog({
      order_id: order_info?.order_id || 'unknown',
      payload: req.body,
      status: status || 0
    });
    
    await webhookLog.save();
    console.log(`📝 Webhook logged for order: ${order_info?.order_id}`);

    // 2️⃣ Validate required data
    if (!order_info || !order_info.order_id) {
      throw new Error('Missing order_info or order_id in webhook payload');
    }

    // 3️⃣ Find the order by custom_order_id
    const order = await Order.findOne({ custom_order_id: order_info.order_id });
    if (!order) {
      console.warn(`Order not found: ${order_info.order_id}`);
      
      // Update webhook log
      webhookLog.error_message = 'Order not found in orders collection';
      webhookLog.processed = true;
      webhookLog.processed_at = new Date();
      await webhookLog.save();
      
      return res.status(200).json({
        success: false,
        message: 'Order not found in orders collection'
      });
    }

    // 4️⃣ Check if OrderStatus already exists - FIXED: Use order._id instead of order_info.order_id
    let orderStatus = await OrderStatus.findOne({ collect_id: order.custom_order_id });
    
    const updateData = {
      collect_id: order.custom_order_id, // Use the custom_order_id from the found order
      collect_request_id: order.collect_request_id, // Use from order record
      transaction_amount: parseFloat(order_info.transaction_amount) || 0,
      order_amount: order.amount, // Add the original order amount
      payment_mode: order_info.payment_mode || '',
      payment_details: order_info.payemnt_details || order_info.payment_details || null,
      bank_reference: order_info.bank_reference || '',
      payment_message: order_info.Payment_message || order_info.payment_message || '',
      status: order_info.status || 'pending',
      error_message: order_info.error_message || '',
      payment_time: order_info.payment_time ? new Date(order_info.payment_time) : new Date(),
      gateway: order_info.gateway || 'Edviron'
    };

    if (orderStatus) {
      // Update existing record
      orderStatus = await OrderStatus.findOneAndUpdate(
        { collect_id: order.custom_order_id },
        updateData,
        { new: true }
      );
    } else {
      // Create new record
      orderStatus = await OrderStatus.create(updateData);
    }

    // 5️⃣ Update the main Order status as well
    await Order.findOneAndUpdate(
      { custom_order_id: order_info.order_id },
      { 
        status: order_info.status === 'SUCCESS' ? 'success' : 
                order_info.status === 'FAILED' ? 'failed' : 'processing'
      }
    );

    // 6️⃣ Mark webhook as processed
    webhookLog.processed = true;
    webhookLog.processed_at = new Date();
    await webhookLog.save();

    console.log(`✅ Webhook processed successfully: ${order_info.order_id}`);

    // 7️⃣ Respond 200 to acknowledge webhook
    res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      orderStatus
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);

    // Update existing webhook log with error
    if (webhookLog) {
      try {
        webhookLog.error_message = error.message;
        webhookLog.processed = false;
        await webhookLog.save();
      } catch (logUpdateError) {
        console.error('Failed to update webhook log with error:', logUpdateError);
      }
    } else {
      // Create new webhook log if initial creation failed
      try {
        await new WebhookLog({
          order_id: req.body?.order_info?.order_id || 'unknown',
          payload: req.body,
          status: req.body?.status || 500,
          error_message: error.message,
          processed: false
        }).save();
      } catch (logError) {
        console.error('Failed to log webhook error:', logError);
      }
    }

    // Always acknowledge webhook (gateway expects 200)
    res.status(200).json({
      success: false,
      message: 'Webhook received but failed internally',
      error: error.message
    });
  }
});

module.exports = router;