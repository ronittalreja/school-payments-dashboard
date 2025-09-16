  
const jwt = require('jsonwebtoken');
const axios = require('axios');
const PaymentTransaction = require('../models/PaymentTransaction');

class PaymentService {
  constructor() {
    this.baseURL = 'https://dev-vanilla.edviron.com/erp';
    this.apiKey = process.env.API_KEY;
    this.pgKey = process.env.PG_KEY;
    this.schoolId = process.env.SCHOOL_ID;
  }
    generatePaymentSign(payload) {
    return jwt.sign(payload, this.pgKey, { algorithm: 'HS256' });
  }
    async createCollectRequest(paymentData) {
    try {
      const { amount, callback_url = process.env.FRONTEND_URL } = paymentData;
        const jwtPayload = {
        school_id: this.schoolId,
        amount: amount.toString(),
        callback_url
      };
        const sign = this.generatePaymentSign(jwtPayload);
        const requestPayload = {
        school_id: this.schoolId,
        amount: amount.toString(),
        callback_url,
        sign
      };

      console.log('Creating collect request with payload:', {
        ...requestPayload,
        sign: sign.substring(0, 50) + '...' // Log truncated sign for security
      });
        const response = await axios.post(
        `${this.baseURL}/create-collect-request`,
        requestPayload,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 30000 // 30 seconds timeout
        }
      );

      const result = response.data;
      console.log('Collect request created successfully:', {
        collect_request_id: result.collect_request_id,
        has_url: !!result.Collect_request_url
      });
        const paymentTransaction = new PaymentTransaction({
        collect_request_id: result.collect_request_id,
        school_id: this.schoolId,
        amount: parseFloat(amount),
        status: 'pending',
        payment_url: result.Collect_request_url,
        callback_url,
        created_at: new Date(),
        metadata: {
          sign: result.sign,
          original_payload: requestPayload
        }
      });

      await paymentTransaction.save();

      return {
        success: true,
        data: {
          collect_request_id: result.collect_request_id,
          payment_url: result.Collect_request_url,
          sign: result.sign,
          amount: parseFloat(amount)
        }
      };

    } catch (error) {
      console.error('Create collect request error:', error);
      
      if (error.response) {
        console.error('API Error Response:', {
          status: error.response.status,
          data: error.response.data,
          headers: error.response.headers
        });
        
        throw new Error(`Payment API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      
      if (error.request) {
        console.error('No response received:', error.request);
        throw new Error('Payment service is currently unavailable. Please try again later.');
      }
      
      throw new Error(`Payment request failed: ${error.message}`);
    }
  }
    async checkPaymentStatus(collectRequestId) {
    try {
        const jwtPayload = {
        school_id: this.schoolId,
        collect_request_id: collectRequestId
      };

      const sign = this.generatePaymentSign(jwtPayload);

      console.log('Checking payment status for:', collectRequestId);
        const response = await axios.get(
        `${this.baseURL}/collect-request/${collectRequestId}`,
        {
          params: {
            school_id: this.schoolId,
            sign
          },
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`
          },
          timeout: 30000
        }
      );

      const result = response.data;
      console.log('Payment status check result:', {
        collect_request_id: collectRequestId,
        status: result.status,
        amount: result.amount
      });
        await PaymentTransaction.findOneAndUpdate(
        { collect_request_id: collectRequestId },
        {
          status: result.status.toLowerCase(),
          payment_details: result.details,
          last_checked: new Date(),
          api_response: result
        },
        { new: true }
      );

      return {
        success: true,
        data: {
          collect_request_id: collectRequestId,
          status: result.status,
          amount: result.amount,
          details: result.details,
          jwt: result.jwt
        }
      };

    } catch (error) {
      console.error('Check payment status error:', error);
      
      if (error.response) {
        console.error('API Error Response:', {
          status: error.response.status,
          data: error.response.data
        });
        
        throw new Error(`Payment Status API Error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
      }
      
      if (error.request) {
        throw new Error('Payment service is currently unavailable. Please try again later.');
      }
      
      throw new Error(`Status check failed: ${error.message}`);
    }
  }
    async getPaymentTransaction(collectRequestId) {
    try {
      const transaction = await PaymentTransaction.findOne({ 
        collect_request_id: collectRequestId 
      });

      if (!transaction) {
        throw new Error('Payment transaction not found');
      }

      return {
        success: true,
        data: transaction
      };

    } catch (error) {
      console.error('Get payment transaction error:', error);
      throw error;
    }
  }
    async updatePaymentStatus(collectRequestId, statusData) {
    try {
      const updateData = {
        status: statusData.status.toLowerCase(),
        updated_at: new Date(),
        webhook_data: statusData
      };
        if (statusData.status.toLowerCase() === 'success') {
        updateData.completed_at = new Date();
        updateData.payment_method = statusData.payment_method;
        updateData.transaction_id = statusData.transaction_id;
      }

      const transaction = await PaymentTransaction.findOneAndUpdate(
        { collect_request_id: collectRequestId },
        updateData,
        { new: true }
      );

      if (!transaction) {
        throw new Error('Payment transaction not found for update');
      }

      console.log('Payment status updated:', {
        collect_request_id: collectRequestId,
        status: statusData.status
      });

      return {
        success: true,
        data: transaction
      };

    } catch (error) {
      console.error('Update payment status error:', error);
      throw error;
    }
  }
    async getPaymentTransactions(filters = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        status,
        school_id,
        sort = 'created_at',
        order = 'desc'
      } = filters;

      const query = {};
      
      if (status) query.status = status;
      if (school_id) query.school_id = school_id;

      const sortOrder = order === 'asc' ? 1 : -1;
      const skip = (page - 1) * limit;

      const transactions = await PaymentTransaction
        .find(query)
        .sort({ [sort]: sortOrder })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();

      const total = await PaymentTransaction.countDocuments(query);

      return {
        success: true,
        data: {
          transactions,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      };

    } catch (error) {
      console.error('Get payment transactions error:', error);
      throw error;
    }
  }
    validateWebhookSignature(payload, signature) {
    try {
        const expectedSignature = jwt.sign(payload, this.pgKey);
      return expectedSignature === signature;
    } catch (error) {
      console.error('Webhook signature validation error:', error);
      return false;
    }
  }
    async processWebhook(webhookPayload) {
    try {
      const {
        collect_request_id,
        status,
        amount,
        payment_method,
        transaction_id,
        error_message
      } = webhookPayload;

      if (!collect_request_id) {
        throw new Error('Missing collect_request_id in webhook payload');
      }
        const result = await this.updatePaymentStatus(collect_request_id, {
        status,
        amount,
        payment_method,
        transaction_id,
        error_message,
        timestamp: new Date()
      });
        console.log('Webhook processed successfully:', {
        collect_request_id,
        status,
        timestamp: new Date().toISOString()
      });

      return result;

    } catch (error) {
      console.error('Process webhook error:', error);
      throw error;
    }
  }
    async retryPayment(collectRequestId) {
    try {
      const transaction = await PaymentTransaction.findOne({
        collect_request_id: collectRequestId
      });

      if (!transaction) {
        throw new Error('Payment transaction not found');
      }

      if (transaction.status === 'success') {
        throw new Error('Cannot retry successful payment');
      }
        return await this.createCollectRequest({
        amount: transaction.amount,
        callback_url: transaction.callback_url
      });

    } catch (error) {
      console.error('Retry payment error:', error);
      throw error;
    }
  }
}

module.exports = new PaymentService();