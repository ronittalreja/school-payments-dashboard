const express = require('express');
const WebhookLog = require('../models/WebhookLog');
const OrderStatus = require('../models/OrderStatus');
const Order = require('../models/Order');

const router = express.Router();
  router.post('/', async (req, res) => {
  let webhookLog;
  
  try {
    const { status, order_info } = req.body;
      webhookLog = new WebhookLog({
      order_id: order_info?.order_id || 'unknown',
      payload: req.body,
      status: status || 0
    });
    
    await webhookLog.save();
    console.log(`📝 Webhook logged for order: ${order_info?.order_id}`);
      if (!order_info || !order_info.order_id) {
      throw new Error('Missing order_info or order_id in webhook payload');
    }
      const order = await Order.findOne({ custom_order_id: order_info.order_id });
    if (!order) {
      console.warn(`Order not found: ${order_info.order_id}`);
        webhookLog.error_message = 'Order not found in orders collection';
      webhookLog.processed = true;
      webhookLog.processed_at = new Date();
      await webhookLog.save();
      
      return res.status(200).json({
        success: false,
        message: 'Order not found in orders collection'
      });
    }
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
        orderStatus = await OrderStatus.findOneAndUpdate(
        { collect_id: order.custom_order_id },
        updateData,
        { new: true }
      );
    } else {
        orderStatus = await OrderStatus.create(updateData);
    }
      await Order.findOneAndUpdate(
      { custom_order_id: order_info.order_id },
      { 
        status: order_info.status === 'SUCCESS' ? 'success' : 
                order_info.status === 'FAILED' ? 'failed' : 'processing'
      }
    );
      webhookLog.processed = true;
    webhookLog.processed_at = new Date();
    await webhookLog.save();

    console.log(`✅ Webhook processed successfully: ${order_info.order_id}`);
      res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      orderStatus
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
      if (webhookLog) {
      try {
        webhookLog.error_message = error.message;
        webhookLog.processed = false;
        await webhookLog.save();
      } catch (logUpdateError) {
        console.error('Failed to update webhook log with error:', logUpdateError);
      }
    } else {
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
      res.status(200).json({
      success: false,
      message: 'Webhook received but failed internally',
      error: error.message
    });
  }
});

module.exports = router;