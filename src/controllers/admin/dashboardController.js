import  User from '../../models/userSchema.js'
import { Order } from "../../models/orderSchema.js"
import { Product } from '../../models/productSchema.js'
//using to load dashboard
const loadDashboard = async (req, res) => {
    if (!req.session.admin) {
        return res.redirect('/admin/login');
    }

    try {
        const admin = await User.findOne({ isAdmin: true });
        if (!admin) {
            return res.redirect('/admin/login');
        }

        const aggregationResult = await Order.aggregate([
            {
                $facet: {
                    totalOrders: [{ $count: "totalOrders" }],
                    totalDiscountPrice: [{ $group: { _id: null, totalDiscount: { $sum: "$discount" } } }],
                    discountGreaterThanZero: [
                        { $match: { discount: { $gt: 0 } } },
                        { $count: "totalDiscountCount" }
                    ],
                    totalQuantitySold: [
                        { $match: { status: "Delivered" } },
                        { $unwind: "$orderedItems" },
                        { $group: { _id: null, totalQuantity: { $sum: "$orderedItems.quantity" } } }
                    ]
                }
            },
            {
                $project: {
                    totalOrders: { $arrayElemAt: ["$totalOrders.totalOrders", 0] },
                    totalDiscountPrice: { $arrayElemAt: ["$totalDiscountPrice.totalDiscount", 0] },
                    totalDiscountCount: { $arrayElemAt: ["$discountGreaterThanZero.totalDiscountCount", 0] },
                    totalQuantitySold: { $arrayElemAt: ["$totalQuantitySold.totalQuantity", 0] }
                }
            }
        ]);

        const results = aggregationResult[0] || {};
        const totalOrders = results.totalOrders || 0;
        const totalDiscountPrice = results.totalDiscountPrice || 0;
        const totalDiscountCount = results.totalDiscountCount || 0;
        const totalQuantitySold = results.totalQuantitySold || 0;
        
//find the mostsoldProduct
        const mostSoldProduct = await Order.aggregate([
            { $match: { status: "Delivered" } },
            { $unwind: "$orderedItems" },
            { $group: { 
                _id: "$orderedItems.product",
                count: { $sum: "$orderedItems.quantity" } 
            }},
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $lookup: {
                from: 'products',
                localField: '_id',
                foreignField: '_id',
                as: 'productDetails'
            }},
            { $unwind: '$productDetails' }
        ]) || [];
//find the best selling category
        const bestSellingCategory = await Order.aggregate([
            { $match: { status: "Delivered" } },
            { $unwind: "$orderedItems" },
            { $lookup: {
                from: 'products',
                localField: 'orderedItems.product',
                foreignField: '_id',
                as: 'productDetails'
            }},
            { $unwind: '$productDetails' },
            { $group: { 
                _id: "$productDetails.category", 
                count: { $sum: "$orderedItems.quantity" } 
            }},
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $lookup: {
                from: 'categories',
                localField: '_id',
                foreignField: '_id',
                as: 'categoryDetails'
            }},
            { $unwind: '$categoryDetails' }
        ]) || [];

       
        
        const countUser = await User.countDocuments() || 0;
        res.render('dashboard', {
            totalOrders,
            totalDiscountPrice,
            totalDiscountCount,
            totalSales: totalQuantitySold,
            totalUser: countUser,
            mostSoldProduct: mostSoldProduct.length ? mostSoldProduct : [],
            bestSellingCategory: bestSellingCategory.length ? bestSellingCategory : [],
          
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        res.redirect("/admin/pageerror");
    }
};

export { loadDashboard };