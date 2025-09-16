const mongoose = require('mongoose');

const orderStatusSchema = new mongoose.Schema({
  collect_id: {
    type: String,
    required: true,
    index: true
  },
  collect_request_id: {
    type: String,
    default: null,
    sparse: true,  // This allows multiple null values
    index: true
  },
  order_amount: { // Add original order amount
    type: Number,
    default: 0
  },
  transaction_amount: {
    type: Number,
    default: 0
  },
  payment_mode: {
    type: String,
    default: ''
  },
  payment_details: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  bank_reference: {
    type: String,
    default: ''
  },
  payment_message: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    required: true,
    default: 'pending',
    enum: ['pending', 'processing', 'SUCCESS', 'FAILED', 'success', 'failed']
  },
  error_message: {
    type: String,
    default: ''
  },
  payment_time: {
    type: Date,
    default: Date.now
  },
  gateway: {
    type: String,
    default: 'Edviron'
  }
}, {
  timestamps: true
});
  orderStatusSchema.index({ collect_id: 1 }, { unique: true });
orderStatusSchema.index({ collect_request_id: 1 }, { sparse: true });
orderStatusSchema.index({ status: 1 });

module.exports = mongoose.model('OrderStatus', orderStatusSchema);