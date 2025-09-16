// backend/src/models/PaymentTransaction.js

const mongoose = require('mongoose');

const paymentTransactionSchema = new mongoose.Schema({
  // Unique identifier from payment gateway
  collect_request_id: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true
  },

  // School information
  school_id: {
    type: String,
    required: true,
    index: true,
    trim: true
  },

  // Payment amount
  amount: {
    type: Number,
    required: true,
    min: 0
  },

  // Payment status
  status: {
    type: String,
    required: true,
    enum: ['pending', 'success', 'failed', 'cancelled', 'expired'],
    default: 'pending',
    index: true
  },

  // Payment URLs
  payment_url: {
    type: String,
    required: true,
    trim: true
  },

  callback_url: {
    type: String,
    required: true,
    trim: true
  },

  // Payment method (populated after payment completion)
  payment_method: {
    type: String,
    trim: true,
    enum: ['upi', 'netbanking', 'card', 'wallet', null],
    default: null
  },

  // Transaction ID from payment gateway (populated after payment)
  transaction_id: {
    type: String,
    trim: true,
    index: true,
    sparse: true // Allows multiple null values
  },

  // Timestamps
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },

  updated_at: {
    type: Date,
    default: Date.now
  },

  completed_at: {
    type: Date,
    index: true,
    sparse: true
  },

  last_checked: {
    type: Date,
    index: true
  },

  // Expiry information
  expires_at: {
    type: Date,
    index: true
  },

  // Additional payment details
  payment_details: {
    payment_methods: mongoose.Schema.Types.Mixed,
    gateway_response: mongoose.Schema.Types.Mixed
  },

  // Error information
  error_message: {
    type: String,
    trim: true
  },

  error_code: {
    type: String,
    trim: true
  },

  // Webhook data
  webhook_data: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  // API responses storage
  api_response: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },

  // Metadata for additional information
  metadata: {
    sign: String,
    original_payload: mongoose.Schema.Types.Mixed,
    retry_count: {
      type: Number,
      default: 0
    },
    user_agent: String,
    ip_address: String,
    source: {
      type: String,
      enum: ['web', 'mobile', 'api'],
      default: 'web'
    }
  },

  // Student information (if applicable)
  student_info: {
    name: {
      type: String,
      trim: true
    },
    id: {
      type: String,
      trim: true
    },
    email: {
      type: String,
      trim: true,
      lowercase: true
    },
    phone: {
      type: String,
      trim: true
    },
    class: {
      type: String,
      trim: true
    },
    section: {
      type: String,
      trim: true
    }
  },

  // Fee information (if applicable)
  fee_info: {
    category: {
      type: String,
      trim: true,
      enum: ['tuition', 'transport', 'library', 'laboratory', 'examination', 'other']
    },
    description: {
      type: String,
      trim: true
    },
    due_date: Date,
    late_fee: {
      type: Number,
      default: 0
    }
  }
}, {
  timestamps: true,
  collection: 'payment_transactions'
});

// Indexes for performance
paymentTransactionSchema.index({ collect_request_id: 1 });
paymentTransactionSchema.index({ school_id: 1, status: 1 });
paymentTransactionSchema.index({ created_at: -1 });
paymentTransactionSchema.index({ status: 1, created_at: -1 });
paymentTransactionSchema.index({ transaction_id: 1 }, { sparse: true });

// Compound indexes
paymentTransactionSchema.index({ school_id: 1, created_at: -1 });
paymentTransactionSchema.index({ status: 1, school_id: 1, created_at: -1 });

// Virtual fields
paymentTransactionSchema.virtual('is_expired').get(function() {
  return this.expires_at && new Date() > this.expires_at;
});

paymentTransactionSchema.virtual('duration').get(function() {
  if (this.completed_at && this.created_at) {
    return Math.floor((this.completed_at - this.created_at) / 1000); // in seconds
  }
  return null;
});

// Update updated_at on save
paymentTransactionSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Set expiry time for new payments (24 hours)
paymentTransactionSchema.pre('save', function(next) {
  if (this.isNew && !this.expires_at) {
    this.expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  }
  next();
});

// Instance methods
paymentTransactionSchema.methods.markAsCompleted = function(transactionId, paymentMethod) {
  this.status = 'success';
  this.completed_at = new Date();
  this.transaction_id = transactionId;
  this.payment_method = paymentMethod;
  return this.save();
};

paymentTransactionSchema.methods.markAsFailed = function(errorMessage, errorCode = null) {
  this.status = 'failed';
  this.error_message = errorMessage;
  if (errorCode) {
    this.error_code = errorCode;
  }
  return this.save();
};

paymentTransactionSchema.methods.incrementRetryCount = function() {
  if (!this.metadata) {
    this.metadata = {};
  }
  this.metadata.retry_count = (this.metadata.retry_count || 0) + 1;
  return this.save();
};

// Static methods
paymentTransactionSchema.statics.findByCollectId = function(collectRequestId) {
  return this.findOne({ collect_request_id: collectRequestId });
};

paymentTransactionSchema.statics.findBySchool = function(schoolId, options = {}) {
  const { page = 1, limit = 10, status } = options;
  const query = { school_id: schoolId };
  
  if (status) {
    query.status = status;
  }

  return this.find(query)
    .sort({ created_at: -1 })
    .skip((page - 1) * limit)
    .limit(limit);
};

paymentTransactionSchema.statics.getStats = function(schoolId, dateFrom, dateTo) {
  const matchQuery = { school_id: schoolId };
  
  if (dateFrom || dateTo) {
    matchQuery.created_at = {};
    if (dateFrom) matchQuery.created_at.$gte = new Date(dateFrom);
    if (dateTo) matchQuery.created_at.$lte = new Date(dateTo);
  }

  return this.aggregate([
    { $match: matchQuery },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        total_amount: { $sum: '$amount' }
      }
    }
  ]);
};

paymentTransactionSchema.statics.findExpiredPayments = function() {
  return this.find({
    status: 'pending',
    expires_at: { $lt: new Date() }
  });
};

// Export model
module.exports = mongoose.model('PaymentTransaction', paymentTransactionSchema);