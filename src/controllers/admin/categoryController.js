
import { Category } from "../../models/categorySchema.js";
import { Product } from "../../models/productSchema.js";
import { HttpStatus } from "../../statusCode.js";
import { Messages } from '../../responseMessages.js';

import Swal from 'sweetalert2'
//using for showing categories
const categoryInfo = async (req, res) => {
    try {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = 10;
        const skip = (page - 1) * limit;

        const CategoryData = await Category.find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const totalCategories = await Category.countDocuments();
        const totalPages = Math.ceil(totalCategories / limit);

        res.render("category", {
            cat: CategoryData,
            currentPage: page,
            totalPages: totalPages,
            totalCategories: totalCategories
        });
    } catch (error) {
        console.error(error);
        res.redirect('/pageerror');
    }
};
//using for add the category
const addCategory = async (req, res) => {
    const { name, description } = req.body;
    console.log(req.body)

    try {
        const existingCategory = await Category.findOne({ name });
        if (existingCategory) {
            return res.status(HttpStatus.BAD_REQUEST).json({ error: "Category already exists" });
        }
        const newCategory = new Category({
            name,
            description,
        });
        await newCategory.save();
        res.status(HttpStatus.CREATED).json({ message: "Category added successfully" });
    } catch (error) {
        console.error(error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "An error occurred while adding the category" });
    }
};
//using to add category
const addCategoryOffer = async (req, res) => {
    try {
        const percentage = parseInt(req.body.percentage);
        const categoryId = req.body.categoryId;

        if (isNaN(percentage) || percentage <= 0 || percentage >= 100) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                status: false,
                message: "Offer percentage must be between 1 and 99"
            });
        }

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(HttpStatus.NOT_FOUND).json({ status: false, message: "Category not found" });
        }
        const products = await Product.find({ category: category._id });

        const hasProductOffer = products.some(product => product.productOffer > 0);
        if (hasProductOffer) {
            return res.json({
                status: false,
                message: "Cannot add category offer when products have individual offers"
            });
        }

        await Category.updateOne(
            { _id: categoryId },
            { $set: { categoryOffer: percentage } }
        );

        for (const product of products) {
            product.productOffer = 0;
            const discountAmount = Math.floor((product.regularPrice * percentage) / 100);
            product.salePrice = Math.max(0, product.regularPrice - discountAmount);
            await product.save();
        }

        res.json({ status: true, message: "Category offer added successfully" });
    } catch (error) {
        console.error("Error in addCategoryOffer:", error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ status: false, message: "Internal server error" });
    }
};
//using to remove offer
const removeCategoryOffer = async (req, res) => {
    try {
        const categoryId = req.body.categoryId;

        const category = await Category.findById(categoryId);
        if (!category) {
            return res.status(HttpStatus.NOT_FOUND).json({ status: false, message: "Category not found" });
        }

        const products = await Product.find({ category: category._id });

        for (const product of products) {
            product.salePrice = product.regularPrice;
            product.productOffer = 0;
            await product.save();
        }

        category.categoryOffer = 0;
        await category.save();

        res.json({ status: true, message: "Category offer removed successfully" });
    } catch (error) {
        console.error("Error in removeCategoryOffer:", error);
        res.status(HttpStatus.FORBIDDEN).json({ status: false, message: "Internal server error" });
    }
};


//using for list category
const getListCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: false } })

        res.redirect('/admin/categoryInfo')
    } catch (error) {

        res.redirect('/pageerror')
    }
}
//using for unlist category
const getUnlistCategory = async (req, res) => {
    try {
        let id = req.query.id;
        await Category.updateOne({ _id: id }, { $set: { isListed: true } });
        res.redirect('/admin/categoryInfo')

    } catch (error) {
        res.redirect("/pageerror")
    }
}
// get the edit category page
const edit = async (req, res) => {
    try {
        const id = req.query.id;
        const category = await Category.findOne({ _id: id })
        res.render("edit-category", { category: category })
    } catch (error) {
        res.redirect('/pageerror')

    }
}
//edit category
const editCategory = async (req, res) => {
    try {
        const id = req.params.id;
        const { categoryName, description } = req.body;

        const existingCategory = await Category.findOne({
            name: categoryName,
            _id: { $ne: id }
        });

        if (existingCategory) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                error: "Category already exists"
            });
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            {
                name: categoryName,
                description
            },
            { new: true }
        );

        if (!updatedCategory) {
            return res.status(HttpStatus.NOT_FOUND).json({
                success: false,
                error: "Category not found"
            });
        }

        return res.status(HttpStatus.OK).json({
            success: true,
            message: "Category updated successfully",
            category: updatedCategory
        });

    } catch (error) {
        console.error(error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            error: "Internal server error"

        });

    }
};

export { categoryInfo, addCategory, removeCategoryOffer, addCategoryOffer, getListCategory, getUnlistCategory, edit, editCategory };
