import mongoose,{Schema} from "mongoose"

const couponSchema = new Schema({
    code: {
      type: String,
      required: true,
      unique: true,
      trim: true, 
    },
    discountType: {
      type: String,
      enum: ['percentage', 'flat'], 
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    maxDiscount: {
      type: Number, 
      default: null,
      
    },
    minPurchase: {
      type: Number, 
      default: 0,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    userBy:[{
      type: Schema.Types.ObjectId,
      ref: 'User',
    }]
  }, {
    timestamps: true, 
  });
  
export const Coupon = mongoose.model('Coupon',couponSchema)

