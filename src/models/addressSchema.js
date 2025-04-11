

import mongoose,{Schema}from "mongoose"
const addressSchema = new Schema({
  userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
  },
  address: [{
    addressType: {
      type: String,
      required: true
  },
      name: {
          type: String,
          required: true
      },
      phone: {
          type: Number,
          required: true
      },
      altPhone: {
          type: Number,
          required: false 
      },
      city: {
          type: String,
          required: true
      },
      state: {
          type: String,
          required: true
      },
      pincode: {
          type: Number,
          required: true
      },
      landMark: {
          type: String,
          required: false,
      },
      addressType: {
          type: String,
          required: false ,
      },
      isDefault: {
          type: Boolean,
          default: false
      }
  }]
});

export const Address = mongoose.model("Address", addressSchema);