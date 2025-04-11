import User from "../../models/userSchema.js";
import {Product} from "../../models/productSchema.js";
import {Wishlist} from "../../models/wishlistSchema.js";
import { HttpStatus } from "../../statusCode.js";

//using to load whishlist
const loadWishlist = async (req, res) => {
    try {
        const userId = req.session.user;
        
        const wishlist = await Wishlist.findOne({ userId })
            .populate({
                path: 'products.productId', 
                model: 'Product',
                select: 'productName productImage salePrice category shadeVariants',
                populate: {
                    path: 'category',  
                    model: 'Category'  
                } 
            });
        
        const user = await User.findById(userId);
        
        if (!wishlist || !wishlist.products) {
            console.log("Wishlist is empty or products field is missing");
            return res.render("wishlist", {
                user,
                wishlist: [],
                products: []
            });
        }
        
 
        const validProducts = wishlist.products.filter(item => item.productId !== null && item.productId !== undefined);
        
        return res.render("wishlist", {
            user,
            wishlist: validProducts,
            products: validProducts.map(item => item.productId)
        });
      
    } catch (error) {
        console.error("Error in loadWishlist:", error);
        return res.redirect("/pageNotFound");              
    }
};
//using to product add to the whishlist

const addToWishlist = async (req, res) => {
    try {
        const productId = req.body.productId;
        const userId = req.session.user;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(HttpStatus.NOT_FOUND).json({ 
                success: false, 
                message: 'Product not found' 
            });
        }

        let wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            wishlist = new Wishlist({ userId, products: [] });
        }

        if (wishlist.products.some(item => item.productId.toString() === productId)) {
            return res.status(HttpStatus.OK).json({ success: false, message: 'Product already in wishlist' });
        }
        
        wishlist.products.push({ productId });
        await wishlist.save();

        return res.status(HttpStatus.OK).json({ success: true, message: 'Product added to wishlist' });
    } catch (error) {
        console.error("Error on adding wishlist", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: 'Internal Server Error' });
    }
};
//using to remove product from whishlist
const removeProduct = async (req, res) => {
    try {
        const productId = req.query.productId;
        const userId = req.session.user;

        const wishlist = await Wishlist.findOne({ userId });

        if (!wishlist) {
            return res.status(HttpStatus.NOT_FOUND).json({ status: false, message: "Wishlist not found" });
        }

        const index = wishlist.products.findIndex(item => item.productId.toString() === productId);
        if (index > -1) {
            wishlist.products.splice(index, 1);
            await wishlist.save();
        }
        
        return res.redirect("/wishlist");
    } catch (error) {
        console.error(error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: "Internal Server Error" });
    }
};

export { loadWishlist, addToWishlist, removeProduct };
