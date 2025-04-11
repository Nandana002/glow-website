import express from "express"
const router = express.Router()
import { loginPage, login, pageNotFound, logout } from "../controllers/admin/adminController.js"
import { isAuthenticated } from "../middlewares/adminAuth.js"

import{loadDashboard} from "../controllers/admin/dashboardController.js"
import { customer, blockUser, unblockUser } from "../controllers/admin/customerController.js"
import { categoryInfo, addCategory,addCategoryOffer,removeCategoryOffer, getListCategory, getUnlistCategory, edit, editCategory } from "../controllers/admin/categoryController.js"
import { getProductAddPage, addProducts, getProductPage, blockProduct, unblockProduct, getEditProduct, editProduct, deleteSingleImage ,addProductOffer,removeProductOffer} from "../controllers/admin/productController.js"
import { orderList,orderStatus,handleReturn ,orderCancelled,viewOrders} from "../controllers/admin/orderController.js" // Add this import
import { getSalesReport,exportSalesReport,getSalesData} from "../controllers/admin/salesReportController.js"
import { uploadMulter, storage } from "../utils/multer.js"
import { getAllWallets,getUserWallet,createWallet,debitWallet} from "../controllers/admin/walletController.js"

import { laodCoupon,createCoupon,editCoupon,geteditCoupon,deleteCoupon ,addcoupon} from "../controllers/admin/couponController.js"
const uploads = uploadMulter(storage)
router.get('/dashboard',isAuthenticated,loadDashboard)


// Admin Authentication Routes
router.get('/adminLogin', loginPage)
router.post('/adminLogin', login)
router.get('/logout', logout)


 
router.get('/pageerror', pageNotFound)

// Customer Management Routes
router.get('/customers', isAuthenticated, customer)
router.get('/blockUser', isAuthenticated, blockUser)
router.get('/unblockUser', isAuthenticated, unblockUser)

// Category Management Routes
router.get("/categoryInfo", isAuthenticated, categoryInfo)
router.post('/addCategory', isAuthenticated, uploads.single("image"), addCategory)
router.post("/addCategoryOffer",isAuthenticated, addCategoryOffer);
router.post("/removeCategoryOffer",isAuthenticated, removeCategoryOffer);
router.get('/listCategory', isAuthenticated, getListCategory)
router.get('/unlistCategory', isAuthenticated, getUnlistCategory)
router.get('/edit', isAuthenticated, edit)
router.post('/edit-page/:id', isAuthenticated, editCategory)

// Product Management Routes
router.get('/product-add', isAuthenticated, getProductAddPage)
router.post('/addProducts', isAuthenticated, uploads.array('images', 4), addProducts)
router.get('/product', isAuthenticated, getProductPage)
router.post("/addProductOffer", isAuthenticated,addProductOffer);
router.post("/removeProductOffer", isAuthenticated,removeProductOffer);
router.get('/blockProduct', isAuthenticated, blockProduct)
router.get('/unblockProduct', isAuthenticated, unblockProduct)
router.get('/editProduct', isAuthenticated, getEditProduct)
router.post('/editProduct/:id', isAuthenticated, uploads.array('images', 4), editProduct)
router.post('/deleteImage', isAuthenticated, deleteSingleImage)

// router.get('/coupon',isAuthenticated,couponController.loadCoupon)
// // // Order Management Routes
router.get('/orderList',isAuthenticated,orderList)
router.post('/order-status',orderStatus)
router.post('/handleReturn',handleReturn)
router.post('/cancelorder/',orderCancelled)
router.get('/view-orders/:orderid',viewOrders)
//sales report
router.get('/salesReport',isAuthenticated,getSalesReport)
router.get('/sales-report/export',isAuthenticated,exportSalesReport)
router.get('/sales-data',isAuthenticated,getSalesData)



router.get('/coupon',isAuthenticated,laodCoupon)
router.get('/addCoupon',isAuthenticated,addcoupon)
router.post('/coupon',createCoupon)
router.get('/editCoupon/:edit',isAuthenticated,geteditCoupon)
router.put('/editCoupon/:edit',editCoupon)
router.delete('/deleteCoupon/:id',deleteCoupon)

router.get('/wallets',isAuthenticated,getAllWallets);
router.get('/wallets/:userId',isAuthenticated,getUserWallet);
router.post('/wallets/:userId/credit',isAuthenticated,createWallet)
router.post('/wallets/:userId/debit',isAuthenticated,debitWallet)



export default router