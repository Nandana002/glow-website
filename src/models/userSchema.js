import mongoose, { Schema } from "mongoose";

const userSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
    },
    password: {
      type: String,
      required: false,
      minlength: 6,
    },
    phone: {
      type: String,
      required: false,
      trim: true,
      unique: true,
      sparse: true,
      default: null,
    },
    profileImage: {
      type: String,
      default: "/images/9e1dc3a5060542728485_3July3.avif", // Default image path
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    cart: [
      {
        type: Schema.Types.ObjectId,
        ref: "Cart",
      },
    ],
    wallet: {
      type: Number,
      default: 0,
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
    },
    isBlocked: {
      type: Boolean,
      default: false,
    },
    referralCode: {
      type: String,
      unique: true,
    },
    referralCount: {
      type: Number,
      default: 0,
    },
    referralRewards: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);


export default mongoose.models.User || mongoose.model("User", userSchema);
