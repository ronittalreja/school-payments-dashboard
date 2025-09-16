const mongoose = require('mongoose');

const webhookLogSchema = new mongoose.Schema({
  order_id: {
    type: String,
    required: true,
    index: true
  },
  status: {  // Changed from status_code to match your route
    type: Number,
    default: 0
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  processed: {
    type: Boolean,
    default: false,
    index: true
  },
  error_message: {
    type: String,
    default: ''
  },
  received_at: {
    type: Date,
    default: Date.now
  },
  processed_at: {
    type: Date,
    default: null
  }
}, {
  timestamps: true
});
  webhookLogSchema.index({ received_at: -1 });
webhookLogSchema.index({ processed: 1, received_at: -1 });

module.exports = mongoose.model('WebhookLog', webhookLogSchema);