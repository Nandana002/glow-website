import User from "../../models/userSchema.js";
import { Product } from "../../models/productSchema.js";
import { Cart } from "../../models/cartSchema.js";
import { HttpStatus } from "../../statusCode.js";

//using to geting latest product Data
const getLatestProductData = async (productId) => {
    try {
        const product = await Product.findById(productId);
        return product;
    } catch (error) {
        console.error(`Error fetching product ${productId}:`, error);
        return null;
    }
};
//load the cart page
const loadCart = async (req, res) => {
    try {
        const userId = req.session.user;

        const cart = await Cart.findOne({ userId: userId })
            .populate({
                path: 'items.productId',
                select: 'productName salePrice shadeVariants productImage isBlocked quantity'
            });

        if (!cart || cart.items.length === 0) {
            return res.render("cart", {
                user: await User.findById(userId),
                cart: []
            });
        }

        const filteredItems = cart.items.filter(item =>
            item.productId && !item.productId.isBlocked
        );

        console.log("Cart items with updated stock:", filteredItems.map(item => ({
            name: item.productId.productName,
            shade: item.shade,
            quantity: item.quantity,
            stock: item.shade ? item.productId.shadeVariants.find(v => v.shade === item.shade)?.quantity : item.productId.quantity
        })));

        return res.render("cart", {
            user: await User.findById(userId),
            cart: filteredItems
        });
    } catch (error) {
        console.log("Error loading cart:", error);
        return res.redirect("/pageNotFound");
    }
};
//using to proudct add to cart
const addToCart = async (req, res) => {
    try {
        const { productId, shade, quantity = 1 } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(HttpStatus.UNAUTHORIZED).json({ status: false, message: "Please login to add items to cart" });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(HttpStatus.NOT_FOUND).json({ status: false, message: "Product not found" });
        }

        if (product.isBlocked) {
            return res.status(HttpStatus.BAD_REQUEST).json({ status: false, message: "This product is currently unavailable" });
        }

        let availableStock = product.quantity;
        let shadeVariant = null;

        if (product.shadeVariants && product.shadeVariants.length > 0) {
            if (!shade) {
                return res.status(HttpStatus.BAD_REQUEST).json({ status: false, message: "Please select a shade" });
            }
            shadeVariant = product.shadeVariants.find(v => v.shade === shade);
            if (!shadeVariant) {
                return res.status(HttpStatus.BAD_REQUEST).json({ status: false, message: "Selected shade not found" });
            }
            availableStock = shadeVariant.quantity;
        }

        if (quantity > 5) {
            return res.status(HttpStatus.BAD_REQUEST).json({ status: false, message: "Maximum 5 items can be added" });
        }

        if (quantity > availableStock) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                status: false,
                message: `Only ${availableStock} items available in stock`
            });
        }

        const price = product.salePrice;
        if (isNaN(price) || isNaN(quantity)) {
            return res.status(HttpStatus.BAD_REQUEST).json({ status: false, message: "Invalid price or quantity" });
        }

        const totalPrice = price * quantity;

        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const itemIndex = cart.items.findIndex(item =>
            item.productId.toString() === productId &&
            item.shade === shade
        );

        if (itemIndex > -1) {
            const newQuantity = cart.items[itemIndex].quantity + quantity;
            if (newQuantity > availableStock) {
                return res.status(HttpStatus.BAD_REQUEST).json({
                    status: false,
                    message: `Only ${availableStock} items available`
                });
            }
            if (newQuantity > 5) {
                return res.status(400).json({
                    status: false,
                    message: "Cannot exceed 5 items in cart"
                });
            }
            cart.items[itemIndex].quantity = newQuantity;
            cart.items[itemIndex].totalPrice = newQuantity * price;
        } else {
            cart.items.push({ productId, shade, quantity, price, totalPrice });
        }

        // Update stock
        if (shadeVariant) {
            console.log(`Before update: Shade ${shade} quantity = ${shadeVariant.quantity}, Total quantity = ${product.quantity}`);
            shadeVariant.quantity -= quantity;
            product.quantity -= quantity;
            product.markModified("shadeVariants");
            console.log(`After update: Shade ${shade} quantity = ${shadeVariant.quantity}, Total quantity = ${product.quantity}`);
        } else {
            console.log(`Before update: Product quantity = ${product.quantity}`);
            product.quantity -= quantity;
            console.log(`After update: Product quantity = ${product.quantity}`);
        }

        const productSaveResult = await product.save();
        if (!productSaveResult) {
            throw new Error("Failed to save product stock update");
        }

        const cartSaveResult = await cart.save();
        if (!cartSaveResult) {
            throw new Error("Failed to save cart update");
        }

        // Verify the update persisted
        const updatedProduct = await Product.findById(productId);
        if (shadeVariant) {
            const updatedShade = updatedProduct.shadeVariants.find(v => v.shade === shade);
            console.log(`Persisted: Shade ${shade} quantity = ${updatedShade.quantity}, Total quantity = ${updatedProduct.quantity}`);
        } else {
            console.log(`Persisted: Product quantity = ${updatedProduct.quantity}`);
        }

        return res.status(HttpStatus.OK).json({
            status: true,
            message: "Product added to cart successfully",
            cartCount: cart.items.length
        });
    } catch (error) {
        console.error("Add to cart error:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: "Internal Server Error" });
    }
};
//using to check cart quantity
const checkCartQuantity = async (req, res) => {
    try {
        const { productId, shade } = req.body;
        const userId = req.session.user;

        if (!userId) {
            return res.status(HttpStatus.UNAUTHORIZED).json({ status: false, message: "Please login" });
        }

        const cart = await Cart.findOne({ userId });
        if (!cart) {
            return res.status(HttpStatus.OK).json({ status: true, currentQuantity: 0 });
        }

        const item = cart.items.find(item =>
            item.productId.toString() === productId.toString() &&
            item.shade === shade
        );

        return res.status(HttpStatus.OK).json({ status: true, currentQuantity: item ? item.quantity : 0 });
    } catch (error) {
        console.error("Check cart error:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: "Internal Server Error" });
    }
};

//using to update cart quantity
const updateCartQuantity = async (req, res) => {
    try {
        const { cartItemId } = req.params;
        const { quantity } = req.body;
        const cart = await Cart.findOne({ userId: req.session.user });
        const cartItem = cart.items.find(item => item._id.toString() === cartItemId);

        if (!cartItem) {
            return res.status(HttpStatus.NOT_FOUND).json({ status: false, message: "Item not found in cart" });
        }

        const product = await Product.findById(cartItem.productId);
        if (!product) {
            return res.status(HttpStatus.NOT_FOUND).json({ status: false, message: "Product not found" });
        }
        if (product.isBlocked) {
            cart.items = cart.items.filter(item => item._id.toString() !== cartItemId);
            await cart.save();
            return res.json({ status: false, removed: true, message: "Product unavailable, removed from cart" });
        }

        let availableStock = product.quantity;
        let shadeVariant = null;
        if (product.shadeVariants && product.shadeVariants.length > 0) {
            shadeVariant = product.shadeVariants.find(v => v.shade === cartItem.shade);
            if (shadeVariant) {
                availableStock = shadeVariant.quantity + cartItem.quantity;
            }
        }

        if (quantity > availableStock) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                status: false,
                message: `Only ${availableStock} items available in stock`
            });
        }
        if (quantity > 5) {
            return res.status(HttpStatus.BAD_REQUEST).json({ status: false, message: "Maximum quantity allowed is 5 items" });
        }

        const quantityDifference = quantity - cartItem.quantity;
        if (quantityDifference !== 0) {
            if (shadeVariant) {
                shadeVariant.quantity -= quantityDifference;
                product.markModified("shadeVariants");
            } else {
                product.quantity -= quantityDifference;
            }
            await product.save();
        }

        if (quantity <= 0) {
            cart.items = cart.items.filter(item => item._id.toString() !== cartItemId);
        } else {
            cartItem.quantity = quantity;
            cartItem.totalPrice = cartItem.price * quantity;
        }

        await cart.save();
        return res.json({ status: true, newTotal: cartItem.totalPrice || 0, removed: quantity <= 0 });
    } catch (error) {
        console.error(error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: "Error updating cart" });
    }
};
//removefrom cart
const removeFromCart = async (req, res) => {
    try {
        const { cartItemId } = req.params;
        const cart = await Cart.findOne({ userId: req.session.user });
        const cartItem = cart.items.find(item => item._id.toString() === cartItemId);

        if (!cartItem) {
            return res.status(HttpStatus.NOT_FOUND).json({ status: false, message: "Item not found in cart" });
        }

        const product = await Product.findById(cartItem.productId);
        if (product) {
            const shadeVariant = product.shadeVariants.find(v => v.shade === cartItem.shade);
            if (shadeVariant) {
                shadeVariant.quantity += cartItem.quantity;
            } else {
                product.quantity += cartItem.quantity;
            }
            await product.save();
        }

        cart.items = cart.items.filter(item => item._id.toString() !== cartItemId);
        await cart.save();
        return res.json({ status: true });
    } catch (error) {
        console.error(error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: "Error removing item from cart" });
    }
};

//using very cart stock
const verifyCartStock = async (userId) => {
    try {
        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart || cart.items.length === 0) {
            return { success: false, message: 'Cart is empty' };
        }

        const stockCheckDetails = cart.items.map(item => {
            const stockAvailable = item.productId.stock;
            const stockSufficient = stockAvailable >= item.quantity;

            return {
                productName: item.productId.name,
                shade: item.shade,
                quantityOrdered: item.quantity,
                stockAvailable,
                stockSufficient
            };
        });

        const allStockSufficient = stockCheckDetails.every(detail => detail.stockSufficient);

        return { success: allStockSufficient, stockCheckDetails };
    } catch (error) {
        console.error('Error verifying cart stock:', error);
        return { success: false, message: 'Internal Server Error' };
    }
};
export {
    getLatestProductData,
    loadCart,
    addToCart,
    updateCartQuantity,
    removeFromCart,
    verifyCartStock,
    checkCartQuantity,
}