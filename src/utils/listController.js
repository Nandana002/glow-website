
import { Product } from "../../models/productSchema.js";
const addToList = async (list, productId, quantity, price, userId) => {
    const quantityNum = Number(quantity);
    if (quantityNum <= 0) {
        throw new Error("Quantity must be greater than 0.");
    }

    const product = await Product.findById(productId);
    if (!product) {
        throw new Error("Product not found.");
    }

    if (product.quantity <= 0) {
        throw new Error("Product is out of stock.");
    }

    const existingProductIndex = list.items.findIndex(item => 
        item.productId.toString() === productId
    );

    let newQuantity;
    if (existingProductIndex !== -1) {
        newQuantity = list.items[existingProductIndex].quantity + quantityNum;
        if (newQuantity > Math.min(10, product.quantity)) {
            throw new Error(`You can add a maximum of ${Math.min(10, product.quantity)} items. You already have ${list.items[existingProductIndex].quantity} in your list.`);
        }
        list.items[existingProductIndex].quantity = newQuantity;
    } else {
        if (quantityNum > Math.min(10, product.quantity)) {
            throw new Error(`You can add a maximum of ${Math.min(10, product.quantity)} items.`);
        }
        list.items.push({
            productId,
            name: product.productName,
            quantity: quantityNum,
            price,
            maxStock: product.quantity
        });
    }

    list.totalPrice = list.items.reduce((total, item) => 
        total + item.price * item.quantity, 0
    );
    
    await list.save();
    return list;
};

export {
    addToList
};