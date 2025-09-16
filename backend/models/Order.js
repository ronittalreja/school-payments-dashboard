const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  school_id: {
    type: String,
    required: true
  },
  trustee_id: {
    type: String,
    required: false
  },
  student_info: {
    name: {
      type: String,
      required: true
    },
    id: {
      type: String,
      required: true
    },
    email: {
      type: String,
      required: true
    }
  },
  gateway_name: {
    type: String,
    required: true
  },
  custom_order_id: {
    type: String,
    unique: true,
    required: true
  },
  collect_request_id: {
    type: String,
    unique: true,
    sparse: true, // This allows null values while maintaining uniqueness
    required: false // Changed from true to false
  },
  amount: {
    type: Number,
    required: true
  },
  callback_url: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'success', 'failed', 'cancelled'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Add indexes for better performance
orderSchema.index({ school_id: 1 });
orderSchema.index({ custom_order_id: 1 });
orderSchema.index({ collect_request_id: 1 }, { sparse: true });
orderSchema.index({ status: 1 });

module.exports = mongoose.model('Order', orderSchema);