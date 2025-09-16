  const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();
  async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/school', {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
}
  const orderStatusSchema = new mongoose.Schema({
  custom_order_id: {
    type: String,
    unique: true,
    sparse: true,
    default: () => uuidv4()
  },
  collect_request_id: {
    type: String,
    required: true,
    unique: true
  },
  school_id: {
    type: String,
    required: true
  },
  amount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
    default: 'PENDING'
  },
  payment_url: String,
  callback_url: String,
  created_at: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  payment_details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
});

const OrderStatus = mongoose.model('OrderStatus', orderStatusSchema);
  async function fixDuplicateKeyError() {
  try {
    console.log('🔧 Starting duplicate key error fix...\n');
      const nullDocs = await OrderStatus.find({ custom_order_id: null });
    console.log(`📊 Found ${nullDocs.length} documents with null custom_order_id`);

    if (nullDocs.length === 0) {
      console.log('✅ No null custom_order_id found. Database is clean.');
      return;
    }
      let updatedCount = 0;
    for (const doc of nullDocs) {
      try {
        const uniqueId = uuidv4();
        await OrderStatus.updateOne(
          { _id: doc._id },
          { custom_order_id: uniqueId }
        );
        updatedCount++;
        console.log(`✅ Updated document ${doc._id} with custom_order_id: ${uniqueId}`);
      } catch (error) {
        console.error(`❌ Failed to update document ${doc._id}:`, error.message);
      }
    }

    console.log(`\n🎉 Successfully updated ${updatedCount} out of ${nullDocs.length} documents`);
      const remainingNulls = await OrderStatus.find({ custom_order_id: null });
    console.log(`📊 Remaining documents with null custom_order_id: ${remainingNulls.length}`);

    if (remainingNulls.length === 0) {
      console.log('✅ Duplicate key error has been completely fixed!');
    }

  } catch (error) {
    console.error('❌ Error during fix process:', error);
    throw error;
  }
}
  async function recreateIndex() {
  try {
    console.log('🔧 Recreating custom_order_id index...');
      try {
      await OrderStatus.collection.dropIndex('custom_order_id_1');
      console.log('✅ Dropped existing custom_order_id index');
    } catch (error) {
      console.log('ℹ️  Index might not exist, continuing...');
    }
      await OrderStatus.collection.createIndex(
      { custom_order_id: 1 }, 
      { unique: true, sparse: true }
    );
    console.log('✅ Created new sparse index for custom_order_id');

  } catch (error) {
    console.error('❌ Error recreating index:', error);
    throw error;
  }
}
  async function main() {
  try {
    await connectDB();
    
    console.log('🚀 Starting database fix process...\n');
    
    await fixDuplicateKeyError();
    await recreateIndex();
    
    console.log('\n🎉 SUCCESS! Database is now clean and ready to use.');
    console.log('\n✅ Database fix process completed.');
    
  } catch (error) {
    console.error('\n❌ Database fix process failed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('📪 Database connection closed.');
    process.exit(0);
  }
}
  if (require.main === module) {
  main();
}

module.exports = {
  fixDuplicateKeyError,
  recreateIndex
};