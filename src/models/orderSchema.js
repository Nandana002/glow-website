import { v4 as uuidv4 } from 'uuid';
import mongoose,{Schema} from 'mongoose'

const orderIdSchema = new Schema({
    orderId:{
        type:String,
        default:()=>uuidv4(),
       
    },
    orderedItems:[{
        product:{
            type:Schema.Types.ObjectId,
            ref:"Product",
            
        },
        quantity:{
            type:Number,
            
        },
        price:{
            type:Number,
            default:0
        },
        shade:{
            type:String,
            required:true
        },
        name:{
            type:String,
            required:true
        },
        cancelReason: {
          type: String,
          trim: true
      },
      returnReason: {
          type: String,
          trim: true
      },
        returnStatus: {
            type: String,
            enum: ['Not Requested', 'Requested', 'Approved', 'Rejected'],
            default: 'Not Requested',
          },
          couponCode:[{
            type:String,
            required:false
          }],
          cancelStatus:{
            type:String,
            enum:['completed','canceled'],
            default:'completed'
          }
       
    }],
    totalPrice:{
        type:Number,
     
    },
    discount:{
        type:Number,
        default:0
    },
    finalAmount:{
        type:Number,
     
    },
    address: {
      type: Schema.Types.ObjectId,
      ref: "Address",
      required: true
  },

    invoiceDate:{
        type:Date,
    },
    return :{
      type:String,
      enum:['Not Requested','Requested','Approved','Rejected'],
      default:'Not Requested'
    },
    userId:{
        type:Schema.Types.ObjectId,
        ref:"User",
        required:true
    },
    paymentId: String,
    paymentRetryCount: { type: Number, default: 0 },
    paymentFailureReason: String,
    paymentMethod: {
        type: String,
        required: true,
        enum: ['COD', 'RAZORPAY', 'WALLET']
    },
    // paymentMethod:{
    //     type:String,
    //     required:true
    // },
    couponApplied: {
      type: Boolean,
      default: false
  },
  address: {
    type: Schema.Types.ObjectId,
    ref: "Address",
    required: true
},
    status:{
        type:String,
       required:true,
       enum:['Pending','Shipped','Delivered',"Completed","Returned","Canceled"]
    },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Failed', 'Success'],
      default: 'Pending'
    },
    createdOn: {
         type: Date,
          default: Date.now 
        }


},{timestamps:true})

export const Order = mongoose.model('Order',orderIdSchema)