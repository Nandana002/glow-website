import mongoose,{Schema} from 'mongoose'
const productSchema = new Schema({
    productName:{
        type:String,
        required:true
    },
    description:{
        type:String,
        required:true
    },
    brand:{
        type:String,
        requires:true,
    },
    regularPrice:{
        type:Number,
        required:true
    },
    // prodectOffer:{
    //     type:Number,
    //     required:0
    // },

    salePrice:{
        type:Number,
        required:true
    },
    productImage:{
        type:[String],
        required:true
    },
    category:{
        type:Schema.Types.ObjectId,
        ref:"Category",
        required:true
    },
    productOffer: {
        type: Number,
        default: 0
    },
    quantity: {
        type: Number,
        required: true,
        default: 0, 
        min: 0,
    },
    status: {
        type: String,
        enum: ['Available', 'out of stock', 'Discontinued'],
        required: true,
        default: 'Available'
    },
    shadeVariants: [{
      shade: String,
      quantity: Number
    }],
    isBlocked:{
        type:Boolean,
        default:false
    },
    status:{
        type:String,
        enum:['Available','out of stock','Discountinued'],
        required:true,
        default:"Available"

    },
    

},{timestamps:true})

export const Product = mongoose.model('Product',productSchema)
