import mongoose,{Schema} from "mongoose"

const cartSchema = new mongoose.Schema({
    userId: {
        type: Schema.Types.ObjectId,
        ref: "User",
        required: true
        
    },
    items: [{
        productId: {
            type: Schema.Types.ObjectId,
            ref: "Product",
            required: true
        },
        quantity: {
            type: Number,
            default: 1
        },
        price: {
            type: Number,
            required: true
        },
        totalPrice: {
            type: Number,
            required: true
        },
        shade:{
            type:String,

        },
       

        status: {
            type: String,
            default: "placed"
        }
    }]
});

export const Cart = mongoose.model('Cart',cartSchema)