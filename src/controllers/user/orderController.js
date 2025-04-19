import { Order } from "../../models/orderSchema.js"
import User from '../../models/userSchema.js';
import { Wallet } from "../../models/walletSchema.js";
import { Product } from "../../models/productSchema.js";
import PDFDocument from "pdfkit-table";
import { HttpStatus } from "../../statusCode.js";
import { Address } from "../../models/addressSchema.js";

//using to showing orders
const orders = async (req, res) => {
    try {
        const user = req.session.user
        let page = parseInt(req.query.page) || 1
        let limit = 10
        const orders = await Order.find({ userId: user })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('orderedItems.product')
            .sort({ createdAt: -1 });
        let count = await Order.find({ userId: user }).countDocuments()
        let totalpages = Math.ceil(count / limit)
        return res.render('orders', { orders, page, totalpages, user });
    } catch (error) {
        console.log("The error is" + error)
    }
}
//using to render view order page
const viewOrder = async (req, res) => {
    try {
        const user = req.session.user;
        const { orderid } = req.params;

        const order = await Order.findOne({ _id: orderid })
            .populate('orderedItems.product');

        if (order && order.address) {
            const userData = await User.findOne({ _id: user });
            const addressDoc = await Address.findOne(
                { userId: user, "address._id": order.address }
            );

            for (let item of order.orderedItems) {
                const product = item.product;
                if (product && product.reviews) {
                    const hasReviewed = product.reviews.some(
                        (review) => review.user.toString() === user.toString()
                    );
                    item.hasReviewed = hasReviewed;
                } else {
                    item.hasReviewed = false;
                }

                if (item.cancelStatus === 'canceled' || item.returnStatus === 'Approved') {
                    item.effectivePrice = 0;
                } else {
                    item.effectivePrice = item.price * item.quantity;
                }
            }

            if (addressDoc) {
                const selectedAddress = addressDoc.address.find(
                    addr => addr._id.toString() === order.address.toString()
                );
                order.selectedAddress = selectedAddress;
            }

            order.couponAmount = order.discount || 0;

            return res.render('viewOrders', { user: userData, order });
        } else {
            const userData = await User.findOne({ _id: user });
            return res.render('viewOrders', { user: userData, order });
        }
    } catch (error) {
        console.log(error);
        res.status(500).send("Server Error");
    }
};
//using to cancel order
const cancelOrder = async (req, res) => {
    try {
        const { orderId, productId, cancelReason } = req.body;
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: "Order not found" });
        }

        const itemToCancel = order.orderedItems.find(item => item._id.toString() === productId);
        if (!itemToCancel) {
            return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: "Product not found in this order" });
        }
        if (itemToCancel.cancelStatus === 'canceled') {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "Item already canceled" });
        }

        // Update product stock
        const product = await Product.findById(itemToCancel.product);
        if (product) {
            const shadeVariant = product.shadeVariants.find(v => v.shade === itemToCancel.shade);
            if (shadeVariant) {
                shadeVariant.quantity += itemToCancel.quantity;
            } else {
                product.quantity += itemToCancel.quantity;
            }
            await product.save();
        }

        // Mark item as canceled
        itemToCancel.cancelStatus = 'canceled';
        itemToCancel.cancelReason = cancelReason;

        // Calculate refund amount for this item
        const originalItemPrice = itemToCancel.price * itemToCancel.quantity;
        const itemDiscountShare = order.discount ? (order.discount / order.orderedItems.length) : 0;
        const refundAmount = Math.max(0, originalItemPrice - itemDiscountShare);

        // Check if all items are now canceled or returned
        const allItemsCanceledOrReturned = order.orderedItems.every(item => 
            item.cancelStatus === 'canceled' || 
            item.returnStatus === 'Approved' || 
            item.returnStatus === 'Requested' ||
            item._id.toString() === productId // Include the current item being canceled
        );

        if (allItemsCanceledOrReturned) {
            // If all items are canceled/returned, set final amount to 0
            order.finalAmount = 0;
            order.discount = 0;
        } else {
            // Recalculate for remaining active items
            const activeItems = order.orderedItems.filter(item => 
                item.cancelStatus !== 'canceled' && 
                item.returnStatus !== 'Approved' && 
                item.returnStatus !== 'Requested'
            );
            
            const subtotal = activeItems.reduce((total, item) => {
                return total + (item.price * item.quantity);
            }, 0);
            
            // Adjust discount proportionally or set to 0 if no active items
            order.discount = activeItems.length > 0 ? 
                (order.discount * activeItems.length) / order.orderedItems.length : 0;
            
            order.finalAmount = Math.max(0, subtotal - order.discount);
        }

        // Handle refund to wallet if payment was already made
        if (order.paymentMethod !== 'COD' && order.paymentStatus === 'Success') {
            const wallet = await Wallet.findOne({ userId: order.userId });

            if (wallet) {
                wallet.balance += refundAmount;
                wallet.transactionHistory.push({
                    transactionType: 'refund',
                    transactionAmount: refundAmount,
                    description: `Refund for canceled product in order ${order.orderId}`
                });
                await wallet.save();
            } else {
                const newWallet = new Wallet({
                    userId: order.userId,
                    balance: refundAmount,
                    transactionHistory: [{
                        transactionType: 'refund',
                        transactionAmount: refundAmount,
                        description: `Refund for canceled product in order ${order.orderId}`
                    }]
                });
                await newWallet.save();
            }
        }

        await order.save();
        return res.status(HttpStatus.OK).json({ 
            success: true, 
            message: "Product canceled successfully",
            newTotal: order.finalAmount
        });
    } catch (error) {
        console.error("Error in cancelOrder:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
    }
};

const returnOrder = async (req, res) => {
    try {
        const { productId } = req.body;
        const order = await Order.findOne({ 'orderedItems._id': productId });

        if (!order) {
            return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: "Order not found" });
        }

        const orderedIndex = order.orderedItems.findIndex(item => item._id.toString() === productId);
        if (orderedIndex === -1) {
            return res.status(HttpStatus.NOT_FOUND).json({ success: false, message: "Item not found" });
        }

        const returnItem = order.orderedItems[orderedIndex];
        if (returnItem.returnStatus !== 'Not Requested' || returnItem.cancelStatus === 'canceled') {
            return res.status(HttpStatus.BAD_REQUEST).json({ success: false, message: "Return already requested or item canceled" });
        }

        // Update product stock
        const product = await Product.findById(returnItem.product);
        if (product) {
            const shadeVariant = product.shadeVariants.find(v => v.shade === returnItem.shade);
            if (shadeVariant) {
                shadeVariant.quantity += returnItem.quantity;
            } else {
                product.quantity += returnItem.quantity;
            }
            await product.save();
        }

        // Mark item for return
        returnItem.returnStatus = 'Requested';

        // Calculate refund amount for this item
        const originalItemPrice = returnItem.price * returnItem.quantity;
        const itemDiscountShare = order.discount ? (order.discount / order.orderedItems.length) : 0;
        const refundAmount = Math.max(0, originalItemPrice - itemDiscountShare);

        // Check if all items are now canceled or returned
        const allItemsCanceledOrReturned = order.orderedItems.every(item => 
            item.cancelStatus === 'canceled' || 
            item.returnStatus === 'Approved' || 
            item.returnStatus === 'Requested'
        );

        if (allItemsCanceledOrReturned) {
            // If all items are canceled/returned, set final amount to 0
            order.finalAmount = 0;
            order.discount = 0;
        } else {
            // Recalculate for remaining active items
            const activeItems = order.orderedItems.filter(item => 
                item.cancelStatus !== 'canceled' && 
                item.returnStatus !== 'Approved' && 
                item.returnStatus !== 'Requested'
            );
            
            const subtotal = activeItems.reduce((total, item) => {
                return total + (item.price * item.quantity);
            }, 0);
            
            // Adjust discount proportionally or set to 0 if no active items
            order.discount = activeItems.length > 0 ? 
                (order.discount * activeItems.length) / order.orderedItems.length : 0;
            
            order.finalAmount = Math.max(0, subtotal - order.discount);
        }

        // Handle refund to wallet
        const wallet = await Wallet.findOne({ userId: order.userId });
        if (wallet) {
            wallet.balance += refundAmount;
            wallet.transactionHistory.push({
                transactionType: 'refund',
                transactionAmount: refundAmount,
                description: `Refund for returned product in order ${order.orderId}`
            });
            await wallet.save();
        } else {
            const newWallet = new Wallet({
                userId: order.userId,
                balance: refundAmount,
                transactionHistory: [{
                    transactionType: 'refund',
                    transactionAmount: refundAmount,
                    description: `Refund for returned product in order ${order.orderId}`
                }]
            });
            await newWallet.save();
        }

        await order.save();
        return res.status(HttpStatus.OK).json({ 
            success: true, 
            message: "Return request submitted successfully and amount added to wallet",
            newTotal: order.finalAmount
        });
    } catch (error) {
        console.error("Error in returnOrder:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
    }
};
//using to update order
const updateOrderStatus = async (req, res) => {
    try {
        const { orderId, status } = req.body;

        const order = await Order.findOne({ _id: orderId });
        if (!order) {
            return res.status(HttpStatus.NOT_FOUND).json({ message: "Order not found" });
        }

        order.paymentStatus = status;
        await order.save();

        res.json({ message: "Order status updated successfully" });
    } catch (error) {
        console.error("Error updating order status:", error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "Failed to update order status" });
    }
};




export {
    orders,
    viewOrder,
    returnOrder,
    cancelOrder,
    updateOrderStatus,
}