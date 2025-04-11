import { Product } from "../../models/productSchema.js"
import { Category } from "../../models/categorySchema.js"
import User from "../../models/userSchema.js"
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { name } from "ejs"
import { HttpStatus } from "../../statusCode.js";
//showing product add page
const getProductAddPage = async (req, res) => {
    try {
        const category = await Category.find({ isListed: true })
        res.render('product-add', {
            category: category,
        })
    } catch (error) {
        console.error("Error in getProductAddPage:", error)
        res.redirect('/admin/pageerror')
    }
}
//add the products
const addProducts = async (req, res) => {
    try {
        const products = req.body;
        const productExists = await Product.findOne({
            productName: products.productName,
        });


        const shades = req.body.shades || [];
        const shadeQuantities = req.body.shadeQuantities || [];

        const shadeVariants = [];
        for (let i = 0; i < shades.length; i++) {
            if (shades[i] && shadeQuantities[i]) {
                shadeVariants.push({
                    shade: shades[i],
                    quantity: parseInt(shadeQuantities[i], 10)
                });
            }
        }
        const uniqueShades = new Set(shadeVariants.map((entry) => entry.shade));
        if (uniqueShades.size !== shadeVariants.length) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: "Duplicate shades are not allowed",
            });
        }

        if (!productExists) {
            const images = [];
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const originalImagePath = req.files[i].path;
                    const resizedImagePath = path.join(
                        "public",
                        "uploads",
                        "product-image",
                        req.files[i].filename
                    );

                    await sharp(originalImagePath)
                        .resize({ width: 440, height: 440 })
                        .toFile(resizedImagePath);

                    images.push(req.files[i].filename);
                }
            }

            const categoryId = await Category.findOne({ _id: products.category });
            if (!categoryId) {
                return res.status(HttpStatus.BAD_REQUEST).json("Invalid category name");
            }

            const newProduct = new Product({
                productName: products.productName,
                description: products.description,
                category: categoryId._id,
                regularPrice: products.regularPrice,
                salePrice: products.salePrice,
                quantity: products.quantity || 0,
                createdOn: new Date(),
                productImage: images,
                status: "Available",
                shadeVariants: shadeVariants,
            });

            await newProduct.save();
            return res.redirect("/admin/product-add");
        } else {
            return res.status(HttpStatus.BAD_REQUEST).json("Product already exists, please try with another name");
        }
    } catch (error) {
        console.error("Error saving Product", error);
        return res.redirect("/admin/pageerror");
    }
};
//using to getProductPage

const getProductPage = async (req, res) => {
    try {
        const search = req.query.search || "";
        const page = parseInt(req.query.page) || 1;
        const limit = 10;

        const searchQuery = {
            productName: { $regex: search, $options: "i" },
        };

        const productData = await Product.find(searchQuery)
            .limit(limit)
            .skip((page - 1) * limit)
            .populate({ path: "category", select: "name" });
        console.log("fetched products:", productData)

        const count = await Product.countDocuments(searchQuery);
        const totalPages = Math.ceil(count / limit);

        res.render("product", {
            data: productData,
            currentPage: page,
            totalPages,
            search,
        });
    } catch (error) {
        console.error("Error in getProductPage:", error);
        res.redirect('/admin/pageerror');
    }
};
//using to addProductOffer
const addProductOffer = async (req, res) => {
    try {
        const { productId, percentage } = req.body;
        const numericPercentage = parseFloat(percentage);

        if (isNaN(numericPercentage) || numericPercentage <= 0 || numericPercentage >= 100) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                status: false,
                message: "Offer percentage must be between 1 and 99"
            });
        }

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(HttpStatus.NOT_FOUND).json({ status: false, message: "Product not found" });
        }

        if (!product.regularPrice || product.regularPrice <= 0) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                status: false,
                message: "Invalid regular price"
            });
        }

        const category = await Category.findById(product.category);
        if (!category) {
            return res.status(HttpStatus.NOT_FOUND).json({ status: false, message: "Category not found" });
        }

        if (category.categoryOffer >= numericPercentage) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                status: false,
                message: "Cannot add product offer because the category offer is equal to or greater than the proposed offer."
            });
        }

        if (category.categoryOffer > 0) {
            if (category.categoryOffer >= numericPercentage) {
                return res.json({
                    status: false,
                    message: "Category offer is already equal or better than the proposed product offer"
                });
            }
            category.categoryOffer = 0;
            await category.save();
        }

        const discountAmount = (product.regularPrice * numericPercentage) / 100;
        const newSalePrice = Math.max(0, Math.round(product.regularPrice - discountAmount));

        if (newSalePrice >= product.regularPrice) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                status: false,
                message: "Sale price must be less than regular price"
            });
        }

        product.salePrice = newSalePrice;
        product.productOffer = numericPercentage;
        await product.save();

        return res.json({
            status: true,
            message: "Product offer added successfully"
        });
    } catch (error) {
        console.error("Error in addProductOffer:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: "Internal server error" });
    }
};
//using to remove ProductOFfer

const removeProductOffer = async (req, res) => {
    try {
        const { productId } = req.body;

        const product = await Product.findById(productId);
        if (!product) {
            return res.status(HttpStatus.NOT_FOUND).json({ status: false, message: "Product not found" });
        }

        if (!product.regularPrice || product.regularPrice <= 0) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                status: false,
                message: "Invalid regular price"
            });
        }

        const category = await Category.findById(product.category);
        if (!category) {
            return res.status(HttpStatus.NOT_FOUND).json({ status: false, message: "Category not found" });
        }

        product.productOffer = 0;

        if (category.categoryOffer > 0) {
            const discountAmount = Math.round((product.regularPrice * category.categoryOffer) / 100);
            product.salePrice = Math.max(0, product.regularPrice - discountAmount);
        } else {
            product.salePrice = product.regularPrice;
        }

        if (product.salePrice > product.regularPrice) {
            product.salePrice = product.regularPrice;
        }

        await product.save();

        return res.json({
            status: true,
            message: "Product offer removed successfully"
        });
    } catch (error) {
        console.error("Error in removeProductOffer:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: "Internal server error" });
    }
};

//block the product
const blockProduct = async (req, res) => {
    try {
        const { id } = req.query;
        await Product.updateOne({ _id: id }, { $set: { isBlocked: true } });

        res.redirect("/admin/product");
    } catch (error) {
        res.redirect("/admin/pageerror");
    }
};
//unblock the product

const unblockProduct = async (req, res) => {
    try {
        const { id } = req.query;
        await Product.updateOne({ _id: id }, { $set: { isBlocked: false } });
        res.redirect("/admin/product");
    } catch (error) {
        console.log(error);
    }
};
// get the edit product page
const getEditProduct = async (req, res) => {
    try {
        const id = req.query.id;
        const product = await Product.findOne({ _id: id });
        const category = await Category.findOne({ _id: product.category });
        const categories = await Category.find({});

        res.render("edit-product", {
            product: product,
            cat: category,
            categories: categories
        });
    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageerror");
    }
};
//using to edit prduct
const editProduct = async (req, res) => {
    try {
        const id = req.params.id;
        const product = await Product.findOne({ _id: id });
        const data = req.body;

        const existingProduct = await Product.findOne({
            productName: data.productName,
            _id: { $ne: id }
        });

        const categoryId = await Category.findOne({ name: data.category });

        if (existingProduct) {
            return res.status(HttpStatus.BAD_REQUEST).json({ error: "Product with this name already exists, Please try with another name" });
        }

        const images = [];
        if (req.files && req.files.length > 0) {
            for (let i = 0; i < req.files.length; i++) {
                images.push(req.files[i].filename);
            }
        }


        const shades = Array.isArray(data.shades) ? data.shades : [data.shades].filter(Boolean);
        const shadeQuantities = Array.isArray(data.shadeQuantities) ? data.shadeQuantities : [data.shadeQuantities].filter(Boolean);
        const updatedShadeVariants = [];

        for (let i = 0; i < shades.length; i++) {
            if (shades[i]) {
                const shade = shades[i];
                const quantity = Number(shadeQuantities[i]) || 0;
                const existingShade = product.shadeVariants.find(item => item.shade === shade);

                if (existingShade) {
                    existingShade.quantity = quantity;
                    updatedShadeVariants.push(existingShade);
                } else {
                    updatedShadeVariants.push({ shade, quantity });
                }
            }
        }

        const updateFields = {
            productName: data.productName,
            description: data.description,
            brand: data.brand,
            category: categoryId ? categoryId._id : product.category,
            regularPrice: data.regularPrice,
            salePrice: data.salePrice,
            productOffer: data.productOffer || 0,
            quantity: data.quantity || product.quantity,
            status: data.status || product.status,
            isBlocked: data.isBlocked !== undefined ? data.isBlocked : product.isBlocked,
            shadeVariants: updatedShadeVariants
        };

        if (req.files.length > 0) {
            updateFields.$push = { productImage: { $each: images } };
        }

        await Product.findByIdAndUpdate(id, updateFields, { new: true });
        res.redirect("/admin/product");
    } catch (error) {
        console.error(error);
        res.redirect("/admin/pageerror");
    }
};

//using to delete single image
const deleteSingleImage = async (req, res) => {
    try {
        const { imageNameToServer, productIdToServer } = req.body;


        if (!imageNameToServer || !productIdToServer) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                status: false,
                message: 'Image name and product ID are required'
            });
        }

        const product = await Product.findById(productIdToServer);
        if (!product) {
            return res.status(HttpStatus.NOT_FOUND).json({
                status: false,
                message: 'Product not found'
            });
        }


        if (!product.productImage.includes(imageNameToServer)) {
            return res.status(HttpStatus.NOT_FOUND).json({
                status: false,
                message: 'Image not found in product'
            });
        }


        await Product.findByIdAndUpdate(
            productIdToServer,
            { $pull: { productImage: imageNameToServer } },
            { new: true }
        );


        const imagePath = path.join(process.cwd(), "public", "uploads", "re-image", imageNameToServer);

        if (fs.existsSync(imagePath)) {
            await fs.promises.unlink(imagePath);
            console.log(`Image ${imageNameToServer} deleted successfully`);
        } else {
            console.log(`Image file ${imageNameToServer} not found, but removed from database`);
        }

        res.json({
            status: true,
            message: 'Image deleted successfully'
        });

    } catch (error) {
        console.error("Error deleting image:", error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            status: false,
            message: 'Internal server error while deleting image'
        });
    }
}


export { getProductAddPage, addProducts, getProductPage, unblockProduct, blockProduct, editProduct, getEditProduct, deleteSingleImage, addProductOffer, removeProductOffer };