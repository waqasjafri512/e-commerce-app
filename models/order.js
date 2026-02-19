const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const orderSchema = new Schema({
  status: {
    type: String,
    enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled'],
    default: 'Pending'
  },
  trackingHistory: [
    {
      status: {
        type: String,
        enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled'],
        required: true
      },
      updatedAt: {
        type: Date,
        default: Date.now
      },
      note: String
    }
  ],
  paymentMethod: {
    type: String,
    default: 'Stripe'
  },
  coupon: {
    code: String,
    discountPercent: Number
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  products: [
    {
      product: { type: Object, required: true },
      quantity: { type: Number, required: true }
    }
  ],
  user: {
    email: {
      type: String,
      required: true
    },
    userId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: 'User'
    }
  }
});

module.exports = mongoose.model('Order', orderSchema);
