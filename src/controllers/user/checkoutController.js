import { Cart } from '../../models/cartSchema.js';
import { Address } from '../../models/addressSchema.js';
import { Order } from '../../models/orderSchema.js';
import { Wallet } from '../../models/walletSchema.js';
import User from '../../models/userSchema.js';
import { Product } from "../../models/productSchema.js";
import { Coupon } from "../../models/couponSchema.js";
import { razorpay } from "../../db/razorpay.js";
import dotenv from 'dotenv';
import crypto from "crypto";
import mongoose from "mongoose";
import PDFDocument from 'pdfkit';
import fs from 'fs';
import { HttpStatus } from "../../statusCode.js";



dotenv.config();
const { ObjectId } = mongoose.Types;
//using to get checkout page
const getCheckoutPage = async (req, res) => {
    try {
        const userId = req.session.user;

        const user = await User.findById(userId);
        if (!user) {
            return res.redirect('/login');
        }

        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            select: 'productName shadeVariants quantity'
        });

        const coupon = await Coupon.find();
        console.log("Cart products:", cart);

        if (!cart || cart.items.length === 0) {
            return res.redirect('/cart');
        }

        let isStockSufficient = true;
        const stockCheckDetails = cart.items.map((item) => {

            let productStock = item.productId.quantity || 0;
            if (item.productId.shadeVariants && item.productId.shadeVariants.length > 0) {
                const variant = item.productId.shadeVariants.find(v => v.shade === item.shade);
                productStock = variant ? variant.quantity : 0;
            }

            const stockSufficient = item.quantity <= productStock;

            if (!stockSufficient) {
                isStockSufficient = false;
            }

            return {
                productName: item.productId.productName,
                shade: item.shade,
                quantityOrdered: item.quantity,
                stockAvailable: productStock,
                stockSufficient: stockSufficient
            };
        });

        console.log("Stock check details:", stockCheckDetails);

        if (!isStockSufficient) {
            console.log("Insufficient stock for one or more items in your cart.");
            return res.redirect('/cart?error=insufficient_stock');
        }
        console.log("Stock is sufficient for all items.");

        const subtotal = cart.items.reduce((total, item) => total + item.totalPrice, 0);

        const userAddress = await Address.findOne({ userId });
        const wallet = await Wallet.findOne({ userId });
        const balance = wallet ? wallet.balance : 0;

        return res.render('checkout', {
            cart,
            address: userAddress ? userAddress.address : [],
            user,
            subtotal,
            coupon,
            balance,
        });

    } catch (error) {
        console.error('Checkout page error:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).render('error', { message: 'Error loading checkout page' });
    }
};
//using to add arredd in checkout page
const addAddressCheckout = async (req, res) => {
    console.log("the add address hit here");
    try {
        const userId = req.session.user;
        const userData = await User.findOne({ _id: userId });
        const { addressType, name, city, landMark, state, pincode, phone, altPhone, } = req.body;
        if (!pincode) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: 'Pincode and email are required.' });
        }

        const userAddress = await Address.findOne({ userId: userData._id });
        if (!userAddress) {
            const newAddress = new Address({
                userId: userData._id,
                address: [{ addressType, name, city, landMark, state, pincode, phone, altPhone }]
            });
            await newAddress.save();
        } else {
            userAddress.address.push({ addressType, name, city, landMark, state, pincode, phone, altPhone });
            await userAddress.save();
        }
        res.json({ success: true, message: 'Address added successfully!' });
    } catch (error) {
        console.error("Error adding address:", error);
        return res.redirect("/pageNotFound");
    }
};
//using to edit the address in checkout page
const editAddressCheckout = async (req, res) => {
    try {
        const addressId = req.params.id;
        const data = req.body;
        const userId = req.session.user;

        const findAddress = await Address.findOne({
            userId,
            "address._id": addressId
        });

        if (!findAddress) {
            return res.status(HttpStatus.NOT_FOUND).json({
                success: false,
                message: "Address not found"
            });
        }

        await Address.updateOne(
            { "address._id": addressId },
            {
                $set: {
                    "address.$": {
                        _id: addressId,
                        name: data.name,
                        city: data.city,
                        landMark: data.landMark,
                        pincode: data.pincode,
                        state: data.state,
                        phone: data.phone,
                        altPhone: data.altPhone,
                    }
                }
            }
        );

        res.json({
            success: true,
            message: "Address updated successfully"
        });

    } catch (error) {
        console.error("Error in edit address:", error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Error updating address"
        });
    }
};

//using to applay coupon
const applyCoupon = async (req, res) => {
    try {
        const { couponCode, orderTotal } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(HttpStatus.UNAUTHORIZED).json({
                success: false,
                message: "Please login to apply coupon"
            });
        }

        const coupon = await Coupon.findOne({ code: couponCode });
        if (!coupon) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: "Invalid coupon code"
            });
        }

        if (coupon.userBy.includes(userId)) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: "You have already used this coupon"
            });
        }

        const currentDate = new Date();
        if (currentDate < coupon.createdAt || currentDate > coupon.endDate) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: "Coupon is expired or not yet active"
            });
        }

        if (orderTotal < coupon.minPurchase) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: `Minimum order amount of ₹${coupon.minPurchase} required`
            });
        }

        let discountAmount = 0;
        if (coupon.discountType === 'percentage') {
            discountAmount = (orderTotal * coupon.discountValue) / 100;
            if (coupon.maxDiscount) {
                discountAmount = Math.min(discountAmount, coupon.maxDiscount);
            }
        } else if (coupon.discountType === 'flat') {
            discountAmount = coupon.discountValue;
        }

        discountAmount = Math.min(discountAmount, orderTotal);
        const newTotal = orderTotal - discountAmount;

        // Store coupon details in session
        req.session.activeCoupon = coupon.code;
        req.session.couponDiscount = discountAmount;
        req.session.finalAmount = newTotal;
        await req.session.save();

        // Mark coupon as used by the user
        coupon.userBy.push(userId);
        await coupon.save();

        return res.status(HttpStatus.OK).json({
            success: true,
            message: "Coupon applied successfully",
            discountAmount,
            newTotal
        });
    } catch (error) {
        console.error("Error applying coupon:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Something went wrong while applying the coupon"
        });
    }
};
//using to removecopon in checkout page
const removeCoupon = async (req, res) => {
    try {
        const userId = req.session.user;

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(HttpStatus.BAD_REQUEST).json({ message: "Cart not found" });
        }


        req.session.coupon = null;
        req.session.finalAmount = cart.bill;
        req.session.discount = 0;


        await req.session.save();

        return res.status(HttpStatus.OK).json({
            success: true,
            originalPrice: cart.bill,
            message: "Coupon removed successfully, price reverted to original",
        });
    } catch (error) {
        console.error("Error removing coupon:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            message: "Error removing coupon",
            error: error.message,
        });
    }
};
//using to place order
const placeOrder = async (req, res) => {
    try {
        const userId = req.session.user;
        const {
            addressId,
            finalAmount,
            paymentMethod,
            paymentConfirmed,
            razorpay_payment_id,
            razorpay_order_id,
            razorpay_signature,
            orderId,
            failureReason,
        } = req.body;

        if (orderId) {
            const existingOrder = await Order.findById(orderId);
            if (!existingOrder) {
                return res.status(HttpStatus.NOT_FOUND).json({
                    success: false,
                    message: "Order not found"
                });
            }

            if (!paymentConfirmed && req.body.paymentStatus === 'Failed') {
                await Promise.all([
                    Order.findByIdAndUpdate(orderId, {
                        paymentStatus: "Failed",
                        status: "Pending",
                        paymentFailureReason: failureReason || "Payment failed"
                    }),
                    Cart.updateOne(
                        { userId },
                        { $set: { items: [], bill: 0 } }
                    ),
                    User.findByIdAndUpdate(
                        existingOrder.userId,
                        { $addToSet: { orderHistory: orderId } }
                    )
                ]);

                return res.json({
                    success: true,
                    message: "Order status updated to failed",
                    order: { _id: orderId }
                });
            }

            if (paymentConfirmed) {
                try {
                    const isValid = await verifyRazorpayPayment(
                        { razorpay_order_id, razorpay_payment_id },
                        razorpay_signature
                    );

                    if (!isValid) {
                        throw new Error("Payment signature verification failed");
                    }

                    await Promise.all([
                        Order.findByIdAndUpdate(orderId, {
                            paymentStatus: "Success",
                            status: "Pending",
                            paymentId: razorpay_payment_id
                        }),
                        Cart.updateOne(
                            { userId },
                            { $set: { items: [], bill: 0 } }
                        ),
                        User.findByIdAndUpdate(
                            existingOrder.userId,
                            { $addToSet: { orderHistory: orderId } }
                        ),
                        ...existingOrder.orderedItems.map(item =>
                            Product.updateOne(
                                { _id: item.product, "shadeVariants.shade": item.shade },
                                { $inc: { "shadeVariants.$.quantity": -item.quantity } }
                            )
                        )
                    ]);

                    req.session.activeCoupon = null;
                    req.session.couponDiscount = null;
                    req.session.finalAmount = null;
                    await req.session.save();

                    return res.json({
                        success: true,
                        message: "Payment successful",
                        order: { _id: orderId }
                    });
                } catch (error) {
                    console.error("Payment verification error:", error);
                    await Order.findByIdAndUpdate(orderId, {
                        paymentStatus: "Failed",
                        status: "Cancelled",
                        paymentFailureReason: error.message
                    });

                    return res.status(HttpStatus.BAD_REQUEST).json({
                        success: false,
                        message: error.message
                    });
                }
            }
        }

        const [addressDoc, cart] = await Promise.all([
            Address.findOne({ userId, 'address._id': addressId }),
            Cart.findOne({ userId }).populate('items.productId')
        ]);

        if (!addressDoc || !cart?.items.length) {                         
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: !addressDoc ? 'Invalid address' : 'Cart is empty'
            });
        }

        let isStockSufficient = true;
        const stockCheckDetails = cart.items.map((item) => {
            let productStock = item.productId.quantity || 0;
            if (item.productId.shadeVariants && item.productId.shadeVariants.length > 0) {
                const variant = item.productId.shadeVariants.find(v => v.shade === item.shade);
                productStock = variant ? variant.quantity : 0;
            }

            const stockSufficient = item.quantity <= productStock;

            if (!stockSufficient) {
                isStockSufficient = false;
            }

            return {
                productName: item.productId.productName,
                shade: item.shade,
                quantityOrdered: item.quantity,
                stockAvailable: productStock,
                stockSufficient: stockSufficient
            };
        });

        console.log("Stock check details before placing order:", stockCheckDetails);

        if (!isStockSufficient) {
            console.log("Insufficient stock for one or more items in your cart.");
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: "Insufficient stock for one or more items in your cart."
            });
        }
        console.log("Stock is sufficient for all items.");

        const selectedAddress = addressDoc.address.find(addr =>
            addr._id.toString() === addressId
        );

        const totalPrice = cart.items.reduce((total, item) => total + item.totalPrice, 0);
        const actualDiscount = req.session.activeCoupon ? (req.session.couponDiscount || 0) : 0;
        const calculatedFinalAmount = totalPrice - actualDiscount;

        if (Math.abs(finalAmount - calculatedFinalAmount) > 0.01) {
            console.warn(`Final amount mismatch: Request=${finalAmount}, Calculated=${calculatedFinalAmount}`);
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: "Invalid final amount"
            });
        }

        const coupon = req.session.activeCoupon
            ? await Coupon.findOne({ code: req.session.activeCoupon })
            : null;
        const couponMinPrice = coupon ? coupon.minPurchase || 0 : 0;

        const orderData = {
            userId,
            orderId: `ORD${Date.now()}`,
            orderedItems: cart.items.map(item => ({
                product: item.productId._id,
                quantity: item.quantity,
                price: item.price,
                shade: item.shade,
                name: item.productId.productName,
                discount: item.discount || 0,
                returnStatus: 'Not Requested',
                cancelStatus: 'completed',
                couponCode: req.session.activeCoupon || null
            })),
            totalPrice,
            discount: actualDiscount,
            finalAmount: calculatedFinalAmount,
            paymentMethod,
            address: selectedAddress,
            couponMinPrice,
            status: 'Pending',
            paymentStatus: paymentMethod === 'RAZORPAY' ? 'Pending' : 'Success',
            createdOn: new Date(),
            couponApplied: req.session.activeCoupon ? true : false
        };

        const order = await Order.create(orderData);

        const commonOperations = [
            User.findByIdAndUpdate(userId, {
                $push: { orderHistory: order._id }
            }),
            Cart.updateOne(
                { userId },
                { $set: { items: [], bill: 0 } }
            ),
            ...cart.items.map(item =>
                Product.updateOne(
                    { _id: item.productId._id, "shadeVariants.shade": item.shade },
                    { $inc: { "shadeVariants.$.quantity": -item.quantity } }
                )
            )
        ];

        if (paymentMethod === 'WALLET') {
            const userWallet = await Wallet.findOne({ userId });
            if (!userWallet) {
                await Order.findByIdAndDelete(order._id);
                return res.status(HttpStatus.NOT_FOUND).json({
                    success: false,
                    message: "Wallet not found for this user"
                });
            }

            if (userWallet.balance < finalAmount) {
                await Order.findByIdAndDelete(order._id);
                return res.status(HttpStatus.BAD_REQUEST).json({
                    success: false,
                    message: `Your wallet balance is insufficient. You currently have ₹${userWallet.balance}. Please choose a different payment method.`
                });
            }

            userWallet.balance -= finalAmount;
            userWallet.transactionHistory.push({
                transactionType: 'purchase',
                transactionAmount: finalAmount,
                transactionDate: new Date(),
                description: `Payment for order ${order.orderId}`
            });
            await userWallet.save();

            await Promise.all(commonOperations);

            req.session.activeCoupon = null;
            req.session.couponDiscount = null;
            req.session.finalAmount = null;
            await req.session.save();

            return res.status(HttpStatus.OK).json({
                success: true,
                order: { _id: order._id },
                redirectUrl: `/orderSuccess/${order._id}`
            });
        }

        if (paymentMethod === 'COD') {
            await Promise.all(commonOperations);

            req.session.activeCoupon = null;
            req.session.couponDiscount = null;
            req.session.finalAmount = null;
            await req.session.save();

            return res.status(HttpStatus.OK).json({
                success: true,
                order: { _id: order._id },
                redirectUrl: `/orderSuccess/${order._id}`
            });
        }

        if (paymentMethod === "RAZORPAY") {
            try {
                const razorpayOrder = await razorpay.orders.create({
                    amount: finalAmount * 100,
                    currency: "INR",
                    receipt: order._id.toString(),
                    payment_capture: 1
                });

                await Order.findByIdAndUpdate(order._id, {
                    razorpayOrderId: razorpayOrder.id
                });

                return res.json({
                    success: true,
                    order: {
                        _id: order._id,
                        razorpay_order_id: razorpayOrder.id,
                        razorpay_key_id: process.env.RAZORPAY_KEY_ID,
                        amount: finalAmount * 100,
                        currency: "INR",
                        status: "created"
                    }
                });
            } catch (error) {
                console.error("Razorpay order creation error:", error);
                await Order.findByIdAndDelete(order._id);
                return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                    success: false,
                    message: 'Error creating Razorpay order'
                });
            }
        }

    } catch (error) {
        console.error("Order creation error:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: error.message || 'Error creating order'
        });
    }
};

//using to verify razorpay payment
const verifyRazorpayPayment = async (orderData, signature) => {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
        throw new Error('Razorpay secret key is not configured');
    }
    try {
        const hmac = crypto.createHmac("sha256", secret.trim());
        const data = orderData.razorpay_order_id + "|" + orderData.razorpay_payment_id;
        hmac.update(data);
        const generated_signature = hmac.digest("hex");

        return generated_signature === signature;
    } catch (error) {
        console.error('Signature verification error:', error);
        throw error;
    }
};

//using to initial retry payment
const initiateRetryPayment = async (req, res) => {
    try {
        const { orderId, amount } = req.body;
        const userId = req.session.user;
        console.log('Request Body:', req.body);
        console.log('User ID:', userId);

        if (!orderId || !amount || isNaN(amount) || amount <= 0) {
            return res.status(400).json({ success: false, message: 'Missing or invalid orderId or amount' });
        }

        const order = await Order.findOne({ _id: orderId, userId })
            .populate('userId')
            .populate('address')
            .lean();
        console.log('Found Order:', order);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.paymentStatus === 'Success') {
            return res.status(400).json({ success: false, message: 'Payment already completed' });
        }

        if (order.paymentRetryCount >= 3) {
            return res.status(400).json({
                success: false,
                message: 'Maximum payment retry attempts exceeded',
            });
        }


        if (Math.round(amount * 100) !== Math.round(order.finalAmount * 100)) {
            return res.status(400).json({
                success: false,
                message: 'Amount does not match order final amount',
            });
        }

        const shortOrderId = orderId.slice(-8);
        const timestamp = Date.now().toString().slice(-8);
        const receipt = `r_${shortOrderId}_${timestamp}`;
        console.log('Receipt:', receipt);

        const options = {
            amount: Math.round(amount * 100),
            currency: 'INR',
            receipt: receipt,
            payment_capture: 1,
            notes: { order_id: orderId },
        };
        console.log('Razorpay Options:', options);

        const razorpayOrder = await razorpay.orders.create(options);
        console.log('Razorpay Order:', razorpayOrder);

        await Order.updateOne(
            { _id: orderId },
            {
                $inc: { paymentRetryCount: 1 },
                $set: {
                    status: 'Pending',
                    razorpay_order_id: razorpayOrder.id,
                },
            }
        );

        const customerDetails = {
            customerName: order.userId?.name || '',
            customerEmail: order.userId?.email || '',
        };

        return res.json({
            success: true,
            razorpayKeyId: process.env.RAZORPAY_KEY_ID,
            orderId: razorpayOrder.id,
            originalOrderId: orderId,
            ...customerDetails,
        });
    } catch (error) {
        console.error('Retry payment error:', error);
        return res.status(500).json({
            success: false,
            message: error.error?.description || error.message || 'Error initiating retry payment',
        });
    }
};
//using to verify retry payment
const verifyRetryPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !orderId) {
            return res.status(400).json({ success: false, message: 'Missing payment details' });
        }

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }


        const generatedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');

        if (generatedSignature !== razorpay_signature) {

            await Order.updateOne(
                { _id: orderId },
                { $set: { paymentFailureReason: 'Invalid payment signature' } }
            );
            return res.status(400).json({ success: false, message: 'Invalid payment signature' });
        }


        await Order.updateOne(
            { _id: orderId },
            {
                $set: {
                    paymentStatus: 'Success',
                    status: 'Confirmed',
                    paymentId: razorpay_payment_id,
                    razorpay_order_id: razorpay_order_id,
                },
            }
        );

        return res.json({ success: true, message: 'Payment verified successfully' });
    } catch (error) {
        console.error('Payment verification error:', error);

        await Order.updateOne(
            { _id: orderId },
            {
                $set: {
                    paymentStatus: 'Failed',
                    paymentFailureReason: error.message || 'Error verifying payment',
                },
            }
        );
        return res.status(500).json({
            success: false,
            message: 'Error verifying payment',
        });
    }
};

//payment failed
const paymentFailed = async (req, res) => {
    try {
        const { orderId } = req.body;

        if (!orderId) {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "Invalid order ID" });
        }
        console.log("Received orderId in paymentFailed:", orderId);

        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: "Order not found" });
        }

        order.status = "Pending";
        order.paymentStatus = "Failed";
        order.paymentFailureReason = "User cancelled or payment failed";
        await order.save();

        return res.json({ success: true, message: "Order status updated to failed" });

    } catch (error) {
        console.error("Payment failure handling error:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Server error" });
    }
}
//using to update orderStatus
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status, reason } = req.body;
        console.log("Updating order status:", { orderId, status, reason });

        let order;
        if (mongoose.Types.ObjectId.isValid(orderId)) {
            order = await Order.findById(orderId);
        }
        if (!order) {
            order = await Order.findOne({ orderId });
        }

        if (!order) {
            console.error("Order not found:", orderId);
            return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: "Order not found" });
        }

        order.paymentStatus = status;
        if (status === "Failed") {
            order.paymentFailureReason = reason || "Failed";
            order.status = "Pending";
        }

        await order.save();

        console.log("Order status updated successfully");
        return res.json({
            success: true,
            message: "Order status updated successfully"
        });

    } catch (error) {
        console.error("Error updating order status:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Error updating order status"
        });
    }
};
//using to get order Scucess
const getOrderSuccess = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const userId = req.session.user;

        const order = await Order.findById(orderId)
            .populate({
                path: 'orderedItems.product',
                select: 'productName productImage'
            })
            .lean();
        if (!order) {
            return res.status(HttpStatus.NOT_FOUND).render('error', {
                message: 'Order not found',
                user: userId
            });
        }
        const userAddress = await Address.findOne({
            userId: userId,
            'address._id': order.address
        });
        const selectedAddress = userAddress ?
            userAddress.address.find(addr => addr._id.toString() === order.address.toString())
            : null;
        console.log('Found order:', order);

        const orderedItemsWithShade = order.orderedItems.map(item => ({
            ...item,
            shade: item.shade
        }));

        const formattedOrder = {
            orderId: order.orderId,
            createdOn: order.createdOn,
            finalAmount: order.finalAmount,
            totalPrice: order.totalPrice,
            discount: order.discount,
            couponApplied: order.actualDiscount,
            orderedItems: orderedItemsWithShade,
            address: selectedAddress,
            status: order.status,
            paymentMethod: order.paymentMethod,
            paymentStatus: order.paymentStatus
        };
        console.log('Formatted order for template:', JSON.stringify(formattedOrder, null, 2));
        return res.render('orderSuccess', {
            order: formattedOrder,
            user: await User.findById(userId)
        });
    } catch (error) {
        console.error('Error in order success:', error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).render('error', {
            message: 'Something went wrong',
        });
    }
};
//using to download Invoice
const downloadInvoice = async (req, res) => {
    try {
        const orderId = req.params.orderId;

        const order = await Order.findOne({ orderId })
            .populate({
                path: "orderedItems.product",
                select: "productName price"
            })
            .lean();

        if (!order) {
            return res.status(HttpStatus.NOT_FOUND).send("Order not found");
        }

        if (order.status === "Cancelled" || order.status === "Returned") {
            return res.status(HttpStatus.BAD_REQUEST).send(
                `Cannot generate invoice for ${order.status.toLowerCase()} order`
            );
        }

        const userAddress = await Address.findOne({ 'address._id': order.address });
        if (!userAddress) {
            return res.status(HttpStatus.NOT_FOUND).send("Address not found");
        }

        const selectedAddress = userAddress.address.find(
            addr => addr._id.toString() === order.address.toString()
        );
        if (!selectedAddress) {
            return res.status(HttpStatus.NOT_FOUND).send("Specific address not found");
        }

        const doc = new PDFDocument({
            margin: 50,
            size: 'A4',
            bufferPages: true
        });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename=invoice-${orderId}.pdf`);
        doc.pipe(res);

        doc.fontSize(24)
            .text('Glowgazey', 50, 50, { align: 'left' })
            .fontSize(10)
            .text('www.glowGazey.com', 50, 80, { align: 'left' })
            .text('glowgazey.com', 50, 95, { align: 'left' })
            .text('+1 (123) 436-7890', 50, 110, { align: 'left' });

        doc.fontSize(20)
            .text('INVOICE', 300, 50, { align: 'right', width: 250 })
            .fontSize(10)
            .text(`Invoice No: ${orderId}`, 300, 80, { align: 'right', width: 250 })
            .text(`Date: ${new Date(order.createdOn).toLocaleDateString()}`, 300, 95, { align: 'right', width: 250 })
            .text(`Order Date: ${new Date(order.createdOn).toLocaleDateString()}`, 300, 110, { align: 'right', width: 250 });

        doc.moveTo(50, 140)
            .lineTo(550, 140)
            .stroke();

        doc.fontSize(14)
            .text('Bill To:', 50, 170)
            .fontSize(10)
            .text(selectedAddress.name, 50, 190)
            .text(selectedAddress.landMark || 'N/A', 50, 205)
            .text(`${selectedAddress.city}, ${selectedAddress.state} - ${selectedAddress.pincode}`, 50, 220)
            .text(`Phone: ${selectedAddress.phone || 'N/A'}`, 50, 235);

        const tableTop = 300;
        const tableHeaders = {
            item: { x: 50, width: 250 },
            qty: { x: 300, width: 70 },
            price: { x: 370, width: 90 },
            amount: { x: 460, width: 90 }
        };

        doc.rect(50, tableTop - 10, 500, 25)
            .fill('#f6f6f6');

        doc.fillColor('black')
            .fontSize(10)
            .text('Item Description', tableHeaders.item.x, tableTop)
            .text('Qty', tableHeaders.qty.x, tableTop, { width: tableHeaders.qty.width, align: 'center' })
            .text('Unit Price', tableHeaders.price.x, tableTop, { width: tableHeaders.price.width, align: 'right' })
            .text('Amount', tableHeaders.amount.x, tableTop, { width: tableHeaders.amount.width, align: 'right' });

        let yPosition = tableTop + 30;
        let subtotal = 0;
        order.orderedItems.forEach((item) => {
            const isCanceled = item.cancelStatus === 'canceled';
            const isReturned = item.returnStatus === 'Requested' || item.returnStatus === 'Returned';
            const amount = isCanceled || isReturned ? 0 : item.quantity * item.price;

            if (!isCanceled && !isReturned) {
                subtotal += amount;
            }

            const itemName = `${item.product.productName}${isCanceled ? ' (Canceled)' : isReturned ? ' (Returned)' : ''}`;

            doc.text(itemName, tableHeaders.item.x, yPosition, { width: tableHeaders.item.width })
                .text(item.quantity.toString(), tableHeaders.qty.x, yPosition, { width: tableHeaders.qty.width, align: 'center' })
                .text(`₹${item.price.toFixed(2)}`, tableHeaders.price.x, yPosition, { width: tableHeaders.price.width, align: 'right' })
                .text(`₹${amount.toFixed(2)}`, tableHeaders.amount.x, yPosition, { width: tableHeaders.amount.width, align: 'right' });

            yPosition += 25;
        });

        doc.moveTo(50, yPosition)
            .lineTo(550, yPosition)
            .stroke();

        yPosition += 20;

        const summaryX = 370;
        const summaryWidth = 180;

        doc.fontSize(10)
            .text('Subtotal:', summaryX, yPosition, { width: 90, align: 'right' })
            .text(`₹${subtotal.toFixed(2)}`, summaryX + 90, yPosition, { width: 90, align: 'right' });

        yPosition += 20;
        const discount = order.discount || 0;
        const couponDisplay = order.couponApplied && order.couponCode ? `(${order.couponCode})` : '';
        doc.fontSize(10)
            .fillColor(discount > 0 ? '#ff0000' : 'black')
            .text(`Discount ${couponDisplay}:`, summaryX, yPosition, { width: 90, align: 'right' })
            .text(discount > 0 ? `-₹${discount.toFixed(2)}` : '₹0.00', summaryX + 90, yPosition, { width: 90, align: 'right' });

        const calculatedFinalTotal = subtotal - discount;

        if (Math.abs(calculatedFinalTotal - order.finalAmount) > 0.01) {
            console.warn(`Final amount mismatch for order ${orderId}: DB=${order.finalAmount}, Calculated=${calculatedFinalTotal}`);
        }

        yPosition += 25;
        doc.rect(summaryX - 10, yPosition - 5, summaryWidth, 25)
            .fill('#f6f6f6');

        doc.fillColor('black')
            .fontSize(12)
            .text('Total:', summaryX, yPosition, { width: 90, align: 'right' })
            .text(`₹${order.finalAmount.toFixed(2)}`, summaryX + 90, yPosition, { width: 90, align: 'right' });

        yPosition += 50;
        doc.fontSize(10)
            .text('Payment Information', 50, yPosition)
            .text(`Method: ${order.paymentMethod}`, 50, yPosition + 15)
            .text(`Status: ${order.paymentStatus || 'Pending'}`, 50, yPosition + 30)
            .text(`Order Status: ${order.status}`, 50, yPosition + 45);

        if (order.couponApplied) {
            yPosition += 30;
            doc.text(`Coupon: ${order.couponCode || 'Applied'}`, 50, yPosition);
        }

        doc.fontSize(10)
            .text('Thank you for your business!', 50, doc.page.height - 100, { align: 'center' });

        doc.fontSize(8)
            .text('Terms & Conditions:', 50, doc.page.height - 80)
            .text('1. All prices are in INR and include GST where applicable.', 50, doc.page.height - 70)
            .text('2. This is a computer-generated invoice and requires no signature.', 50, doc.page.height - 60);

        console.log(`Invoice generated for order ${orderId}: subtotal=${subtotal}, discount=${discount}, finalAmount=${order.finalAmount}, couponApplied=${order.couponApplied}, couponCode=${order.couponCode}`);

        doc.end();
    } catch (error) {
        console.error("Error generating invoice:", error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send("Error generating invoice");
    }
};
export {
    getCheckoutPage,
    addAddressCheckout,
    editAddressCheckout,
    paymentFailed,
    placeOrder,
    initiateRetryPayment,
    updateOrderStatus,
    verifyRetryPayment,
    getOrderSuccess,
    downloadInvoice,
    applyCoupon,
    removeCoupon,
}
