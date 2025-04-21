import { Product } from "../../models/productSchema.js";
import { Category } from "../../models/categorySchema.js";
import User from "../../models/userSchema.js";
import { HttpStatus } from "../../statusCode.js";
import { Messages } from '../../responseMessages.js';





// Display product details
let productDetails = async (req, res) => {
    try {
        const user = req.session.user;
        const userData = await User.find({ _id: user });
        const productId = req.query.id;
        
        const product = await Product.findOne({ _id: productId, isBlocked: false }).populate('category');
        
        if (!product) {
            return res.status(HttpStatus.NOT_FOUND).send('Product not found');
        }
        
        const findCategory = product.category;
        const categoryOffer = findCategory ? findCategory.categoryOffer || 0 : 0;
        const productOffer = product.productOffer || 0;
        const totalOffer = categoryOffer + productOffer;
        
        const totalQuantity = product.shadeVariants.reduce((sum, variant) => sum + variant.quantity, 0) || product.quantity;

        const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: productId },
            isBlocked: false
        }).limit(4);
        
     


        const renderOptions = {
            product,
            totalQuantity,
            totalOffer,
            category: findCategory,
            relatedProducts,
            shadeVariants: product.shadeVariants,
              
        }
        
        if (user) {
            renderOptions.user = userData;
        }
        
        return res.render('product-details', renderOptions);
    } catch (error) {
        return res.redirect('page-404')
    }
};
// Edit product - GET
let editProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const product = await Product.findById(productId).populate('category');
        const categories = await Category.find({ isBlocked: false });

        if (!product) {
            return res.status(HttpStatus.NOT_FOUND).send('Product not found');
        }

        res.render('admin/edit-product', {
            product,
            category: categories,
            shadeVariants: product.shadeVariants 
        });
    } catch (error) {
        console.log("Error in edit product: " + error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(Messages.INTERNAL_SERVER_ERROR);
    }
};

// Update product - POST
let updateProduct = async (req, res) => {
    try {
        const productId = req.params.id;
        const {
            productName,
            descriptionData,
            regularPrice,
            salePrice,
            quantity,
            category,
            colorVariants,
            shadeVariants
        } = req.body;

       

        
        let shades = [];
        if (Array.isArray(shadeVariants)) {
            for (let i = 0; i < shadeVariants.length; i++) {
                if (req.body[`shadeName_${i}`] && req.body[`shadeStock_${i}`]) {
                    shades.push({
                        Shade: req.body[`shadeName_${i}`],
                        quantity: parseInt(req.body[`shadeStock_${i}`])
                    });
                }
            }
        } else if (req.body.shadeName_0 && req.body.shadeStock_0) {
            shades.push({
                Shade: req.body.shadeName_0,
                quantity: parseInt(req.body.shadeStock_0)
            });
        }

     
        let productImages = [];
        if (req.files && req.files.images) {
            const files = Array.isArray(req.files.images) ? req.files.images : [req.files.images];
            for (const file of files) {
                productImages.push(file.filename);
            }
        }

      
        const existingProduct = await Product.findById(productId);
        if (productImages.length === 0 && existingProduct) {
            productImages = existingProduct.productImage;
        }

        
        await Product.findByIdAndUpdate(productId, {
            productName,
            description: descriptionData,
            regularPrice,
            salePrice,
            quantity,
            category,
            colorVariants: variants,
            shadeVariants: shades, 
            productImage: productImages,
            totalStock: shades.reduce((sum, shade) => sum + shade.quantity, 0) || quantity
        });

        res.redirect('');
    } catch (error) {
        console.log("Error updating product: " + error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(Messages.INTERNAL_SERVER_ERROR);
    }
};

// Delete product image
let deleteProductImage = async (req, res) => {
    try {
        const { imageNameToServer, productIdToServer } = req.body;

        const product = await Product.findById(productIdToServer);
        if (!product) {
            return res.json({ status: false, message: 'Product not found' });
        }

        const updatedImages = product.productImage.filter(img => img !== imageNameToServer);

        await Product.findByIdAndUpdate(productIdToServer, {
            productImage: updatedImages
        });

        return res.json({ status: true, message: 'Image deleted successfully' });
    } catch (error) {
        console.log("Error deleting image: " + error);
        return res.json({ status: false, message: 'Error deleting image' });
    }
};
//using to sub


export { productDetails, editProduct, updateProduct, deleteProductImage ,};

