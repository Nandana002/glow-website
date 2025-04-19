import User from "../../models/userSchema.js"
import { Order } from "../../models/orderSchema.js"
import { Product } from "../../models/productSchema.js"
import { HttpStatus } from "../../statusCode.js";
import { Messages } from "../../responseMessages.js";
//using order List
const orderList = async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const skip = (page - 1) * limit;


    const { status, paymentStatus, sortBy, sortOrder } = req.query;

    let filter = {};
    if (status) filter.status = status;
    if (paymentStatus) filter.paymentStatus = paymentStatus;



    try {
        const orders = await Order.find(filter)
            .populate('userId')
            .populate('orderedItems.product')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalOrders = await Order.countDocuments(filter);
        const totalPages = Math.ceil(totalOrders / limit);

        res.render('order', {
            orders,
            currentPage: page,
            totalPages,
            hasNextPage: page < totalPages,
            hasPrevPage: page > 1,
            status,
            paymentStatus,
            sortBy,
            sortOrder
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(Messages.INTERNAL_SERVER_ERROR);
    }
};
//using to show orderStatus
const orderStatus = async (req, res) => {
    try {
        const { status, orderId } = req.body
        const orders = await Order.find()
        const order = await Order.findOneAndUpdate({ orderId }, { status: status }, { new: true })
        if (order) {
            res.status(HttpStatus.OK).json({ message: "Order is updated successfully" })
        } else {
            res.status(HttpStatus.UNAUTHORIZED).json({ message: "order is not updated" })
        }
    } catch (error) {
        console.log("The error is" + error);
    }
}
//using show view order
const viewOrders = async (req, res) => {
    try {
        const { orderid } = req.params
        const order = await Order.findOne({ _id: orderid }).populate('orderedItems.product')
        return res.render('viewOrder', { order })
    } catch (error) {
        console.log(error)
    }
}
//using handle the reurn option 
const handleReturn = async (req, res) => {
    try {
        const userId = req.session.user;
        const { orderId, productId, action } = req.body;

        const order = await Order.findOne({ orderId });

        if (!order) {
            return res.status(HttpStatus.NOT_FOUND).json({ error: 'Order not found' });
        }

        const productItem = order.orderedItems.find(
            item => item._id.toString() === productId
        );

        if (!productItem) {
            return res.status(HttpStatus.NOT_FOUND).json({ error: 'Product not found in order' });
        }

        if (action === 'approve') {
            if (productItem.returnStatus === 'Approved') {
                return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Return already approved' });
            }
            productItem.returnStatus = 'Approved';

            const product = await Product.findById(productItem.product);
            if (product) {
                const shadeVariant = product.shadeVariants.find(v => v.shade === productItem.shade);
                if (shadeVariant) {
                    shadeVariant.quantity += productItem.quantity;
                    await product.save();
                }
            }
        } else if (action === 'reject') {
            productItem.returnStatus = 'Rejected';
        } else {
            return res.status(HttpStatus.BAD_REQUEST).json({ error: 'Invalid action provided' });
        }

        let totalPrice = 0;
        for (const orderItem of order.orderedItems) {
            if (orderItem.cancelStatus !== 'canceled' && orderItem.returnStatus !== 'Approved') {
                totalPrice += orderItem.price * orderItem.quantity;
            }
        }
        order.totalPrice = totalPrice;
        order.finalAmount = totalPrice; 

        const allItemsCancelled = order.orderedItems.every(
            item => item.cancelStatus === 'canceled' || item.returnStatus === 'Approved'
        );
        if (allItemsCancelled) {
            order.status = 'Canceled';
        }

        order.markModified('orderedItems');
        await order.save();

        return res.status(HttpStatus.OK).json({
            success: true,
            message: `Return ${action}d successfully`,
            order
        });
    } catch (error) {
        console.error("Error in handleReturn:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            error: 'Something went wrong',
            details: error.message
        });
    }
};
//using to orderCancelled

const orderCancelled = async (req, res) => {
    try {
        const { orderId, productId } = req.body;
        const order = await Order.findOne({ orderId });

        if (!order) {
            return res.status(HttpStatus.NOT_FOUND).json({ message: "Order not found" });
        }

        const itemIndex = order.orderedItems.findIndex(
            item => item._id.toString() === productId
        );

        if (itemIndex === -1) {
            return res.status(HttpStatus.NOT_FOUND).json({ message: "Item not found" });
        }

        const item = order.orderedItems[itemIndex];
        if (item.cancelStatus === 'canceled') {
            return res.status(HttpStatus.BAD_REQUEST).json({ message: "Item already canceled" });
        }

        item.cancelStatus = 'canceled';

        const product = await Product.findById(item.product);
        if (product) {
            const shadeVariant = product.shadeVariants.find(v => v.shade === item.shade);
            if (shadeVariant) {
                shadeVariant.quantity += item.quantity;
                await product.save();
            }
        }

        let totalPrice = 0;
        for (const orderItem of order.orderedItems) {
            if (orderItem.cancelStatus !== 'canceled' && orderItem.returnStatus !== 'Approved') {
                totalPrice += orderItem.price * orderItem.quantity;
            }
        }
        order.totalPrice = totalPrice;
        order.finalAmount = totalPrice; 

        const allItemsCancelled = order.orderedItems.every(
            item => item.cancelStatus === 'canceled' || item.returnStatus === 'Approved'
        );
        if (allItemsCancelled) {
            order.status = 'Canceled';
        }

        await order.save();

        return res.status(HttpStatus.OK).json({ message: "Item canceled successfully" });
    } catch (error) {
        console.error("Error in orderCancelled:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "Something went wrong" });
    }
};
export { orderList, orderStatus, handleReturn, orderCancelled, viewOrders }