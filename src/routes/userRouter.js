import express from "express";
import * as userController from "../controllers/user/userController.js";
import passport from "passport";
import { userAuth, block } from "../middlewares/userAuth.js"
import * as productController from '../controllers/user/productController.js';
import * as profileController from "../controllers/user/profileController.js";
import * as authController from "../controllers/user/authController.js"
import * as wishlistController from "../controllers/user/wishlistController.js"
import * as cartController from "../controllers/user/cartController.js";
import * as checkoutController from "../controllers/user/checkoutController.js"
import * as  orderController from "../controllers/user/orderController.js"
import * as walletController from "../controllers/user/walletController.js"
import * as contactController from "../controllers/user/contactController.js"




const router = express.Router();


router.get("/pageNotFound", userController.pageNotFound)
router.get("/signup", userController.loadSignup)
router.post("/signup", userController.signup)
router.post('/verify-otp', userController.verifyOtp)
router.post("/resend-otp", userController.resendOtp)





// router.get("/auth/google", passport.authenticate("google", { scope: ["profile", "email"] }));


// router.get(
//   "/auth/google/callback",
//   passport.authenticate("google", { failureRedirect: "/signup" }),
//   (req, res) => {
//     res.redirect("/home");
//   }
// );


router.get('/auth/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get(
  '/auth/google/callback',
  passport.authenticate('google', { failureRedirect: '/signup' }),
  authController.googleCallback
);



router.get('/login', block, userController.loadLogin)
router.post('/login', userController.login)
router.get('/logout', block, userController.logout)
router.get('/home', userController.loadHomePage)
router.get('/shop', block, userController.loadshoppingPage)
router.get('/product-details', productController.productDetails)
router.get('/forgot-password', profileController.getForgotPass)
router.post('/forgot-email-valid', profileController.forgotEmail)
router.post("/verify-passForgot-otp", profileController.verifyForgotPassOtp);
router.post("/resend-forgot-otp", profileController.resendOtp);
router.get('/reset-password', profileController.getResetPassPage);
router.post("/reset-password", profileController.postNewPassword);

router.get('/myaccount', block, userAuth, userController.loadProfile)
router.get('/update-profile-image',profileController. updateProfileImage )
router.get('/updateProfile', block, userAuth, userController.updateProfile)
router.put('/update-profile', userController.profileUpdate)
router.get('/getAddress', userAuth, block, userController.getAddress)
router.get('/add-address', block, userAuth, userController.addAddress)
router.put("/set-default-address/:id", userController.setDefaultAddress);

router.post('/address', userController.address)
router.get('/editAddress', block, userAuth, userController.getEditPage)
router.put('/edit/:id', userAuth, userController.edit)
router.put('/updateAddress', userAuth, userController.edit);
router.delete('/delete-address/:id', userController.deleteAddress)

router.get('/referal', userAuth, profileController.getReferal)

router.get("/cart", userAuth, cartController.loadCart);
router.post("/addToCart", userAuth, cartController.addToCart);
router.post("/updateQuantity/:cartItemId", userAuth, cartController.updateCartQuantity);
router.delete("/removeFromCart/:cartItemId", userAuth, cartController.removeFromCart);



router.get("/wishlist", userAuth, wishlistController.loadWishlist);
router.post("/addToWishlist", userAuth, wishlistController.addToWishlist);
router.post('/check-cart-quantity',cartController.checkCartQuantity)
router.get("/removeFromWishlist", userAuth, wishlistController.removeProduct);

router.get("/checkout", userAuth, checkoutController.getCheckoutPage);
router.post("/addAddress-checkout", userAuth, checkoutController.addAddressCheckout);
router.post('/editAddress-checkout/:id', userAuth, checkoutController.editAddressCheckout);
router.post("/applyCoupon", userAuth, checkoutController.applyCoupon);
router.post("/removeCoupon", userAuth, checkoutController.removeCoupon);
router.post("/placeOrder", userAuth, checkoutController.placeOrder);
router.post("/payment-failed", userAuth, checkoutController.paymentFailed);
router.post("/updateOrderStatus", userAuth, checkoutController.updateOrderStatus);
router.post("/initiate-retry-payment", userAuth, checkoutController.initiateRetryPayment);
router.post('/verify-retry-payment', userAuth, checkoutController.verifyRetryPayment);
router.get('/orderSuccess/:orderId', userAuth, checkoutController.getOrderSuccess);
router.get('/download-invoice/:orderId', userAuth, checkoutController.downloadInvoice);


router.post('/place-order', checkoutController.placeOrder)

router.get('/wallet', block, walletController.loadWallet)
router.post('/place-order/wallet', walletController.wallet)

router.get('/orders', block, userAuth, orderController.orders)
router.get('/user/view-order/:orderid', block, orderController.viewOrder)
router.post('/order-cancel', orderController.cancelOrder)
router.post('/return-order', orderController.returnOrder)


router.get("/change-email", userAuth, profileController.changeEmail);
router.post("/change-email", userAuth, profileController.changeEmailValid);
router.post("/verify-email-otp", userAuth, profileController.verifyEmailOtp);
router.get("/update-email", profileController.getUpdateEmailPage)
router.post("/update-email", profileController.updateEmail);
router.get("/change-password", userAuth, profileController.changePassword);
router.post("/change-password", userAuth, profileController.changePasswordValid);
router.post("/verify-changepassword-otp", userAuth, profileController.verifyChangePassOtp);

router.get('/contact', userAuth, contactController.getContactPage);
router.post('/contact', userAuth, contactController.handleContactForm)

router.get('/edit-address/:id', userController.getEditPage);
router.post('/edit-address/:id', userController.edit);


router.get('/')

router.post(
  '/productDetailsPage/review',
  userAuth,
  productController.submitReview
);


router.get('/about',userController.about)
export default router;
