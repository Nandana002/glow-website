import { Wallet } from "../../models/walletSchema.js";
import User from "../../models/userSchema.js";
import { Cart } from "../../models/cartSchema.js";
import { Order } from "../../models/orderSchema.js";
import { Product } from "../../models/productSchema.js";
import { Address } from "../../models/addressSchema.js";
import { HttpStatus } from "../../statusCode.js";
//using to load wallet
const loadWallet = async (req, res) => {
  try {
    const user = req.session.user;

    if (!user) {
      return res.redirect('/login');
    }

    const userData = await User.findById(user);

    if (!userData) {
      console.error("User data not found");
      return res.redirect('/login');
    }

    let wallet = await Wallet.findOne({ userId: user });

    if (!wallet) {
      const newWallet = new Wallet({
        userId: user,
        balance: 0,
        transactionHistory: []
      });
      wallet = await newWallet.save();
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 10; 
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;

    const totalTransactions = wallet.transactionHistory.length;
    const sortedTransactions = wallet.transactionHistory.sort((a, b) => 
      new Date(b.transactionDate) - new Date(a.transactionDate)
    );

 const paginatedTransactions = sortedTransactions.slice(startIndex, endIndex);

    const totalPages = Math.ceil(totalTransactions / limit);

    res.render('wallet', {
      wallet: {
        ...wallet.toObject(),
        transactionHistory: paginatedTransactions
      },
      user: userData,
      currentPage: page,
      totalPages: totalPages,
      totalTransactions: totalTransactions
    });
  } catch (error) {
    console.error("Error in rendering wallet", error);
    res.redirect('/pageNotFound');
  }
};
//using to get the wallet page
const wallet = async (req, res) => {
  try {
    const { payment, addressId } = req.body;
    const userId = req.session.user;
    const wallet = await Wallet.findOne({ userId });
    const cart = await Cart.findOne({ userId });

    if (!cart || cart.items.length === 0) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Cart is empty" });
    }

    for (let item of cart.items) {
      const shade = await Product.findOne({
        _id: item.productId,
        "shades.shade": item.shade,
      }, {
        "shades.$": 1
      });

      if (!shade || shade.shades[0].quantity < item.quantity) {
        return res.status(HttpStatus.BAD_REQUEST).json({
          message: `Insufficient stock for ${item.name} in shade ${item.shade}. Only ${shade ? shade.shades[0].quantity : 0} left.`,
        });
      }
    }

    const address = await Address.findOne({ userId, "address._id": addressId });
    if (!address) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Address not found" });
    }
    
    const addressIndex = address.address.findIndex(
      (addr) => addr._id.toString() === addressId
    );
    if (addressIndex === -1) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Invalid address ID" });
    }
    
    const selectedAddress = address.address[addressIndex];
    const coupon_code = req.session.coupon;
    const final_amount = req.session.finalAmount;
    const discount_amount = req.session.discount;
    const amountToDeduct = final_amount || cart.bill;

    if (wallet.balance < amountToDeduct) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Balance is insufficient" });
    }

    let orderedItems = cart.items.map(item => ({
      product: item.productId,
      name: item.name,
      shade: item.shade,
      quantity: item.quantity,
      couponCode: coupon_code,
      price: item.price,
      returnStatus: "Not Requested",
    }));

    const newOrder = new Order({
      orderedItems,
      address: {
        name: selectedAddress.name,
        email: selectedAddress.email,
        phone: selectedAddress.phone,
        city: selectedAddress.city,
        zipCode: selectedAddress.zipCode,
        houseNumber: selectedAddress.houseNumber,
        district: selectedAddress.district,
        state: selectedAddress.state,
      },
      userId,
      paymentMethod: payment,
      status: "Pending",
      totalPrice: cart.bill,
      finalAmount: amountToDeduct,
      discount: discount_amount,
      paymentStatus: "Success",
      invoiceDate: new Date(),
    });

    await newOrder.save();

    wallet.balance -= amountToDeduct;
    wallet.transactionHistory.push({
      transactionType: 'purchase',
      transactionAmount: amountToDeduct,
      transactionDate: new Date(),
      description: `purchase from order ${newOrder._id}`,
    });
    await wallet.save();

    cart.items = [];
    cart.bill = 0;
    await cart.save();

    return res.status(HttpStatus.OK).json({
      message: "order placed successfully",
      redirectUrl: "/order-confirmation",
    });
  } catch (error) {
    console.error("The error is " + error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
      message: "Error processing order. Please try again." 
    });
  }
};

export { loadWallet, wallet };