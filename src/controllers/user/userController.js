import nodemailer from "nodemailer";
import User from "../../models/userSchema.js"; 
import bcrypt from "bcrypt";
import dotenv from "dotenv";
import { Category } from "../../models/categorySchema.js";
import { Product } from "../../models/productSchema.js";
import { Address } from "../../models/addressSchema.js";
import crypto from 'crypto';
import { HttpStatus } from "../../statusCode.js";
import { error } from "console";
import {Cart} from "../../models/cartSchema.js"
import {Wishlist} from "../../models/wishlistSchema.js" 
dotenv.config();

const generateReferralCode = (userId) => {
    return crypto.createHash('sha256').update(userId + Date.now().toString()).digest('hex').substr(0, 8);
};

//using for pageNotfound
const pageNotFound = async (req, res) => {
    try {
        res.render("page-404")
    } catch (error) {
        res.redirect('/pageNotFound')
    }
};
//using for loading the signup page

const loadSignup = async (req, res) => {
    try {
        return res.render('signup')

    } catch (error) {
        console.log("home page not loading:", error)
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send('server Error')
    }
}

//using for loading home page
const loadHomePage = async (req, res) => {
    try {
        const user = req.session.user;
        const category = await Category.find({isListed:true})
        const categoryIds = category.map((cat=>cat._id))
        const products = await Product.find({ isBlocked: false ,category:categoryIds})
        .sort({ createdAt: -1 })
        .limit(4)


        if (user) {

            const userData = await User.findOne({ _id: user });
            res.render("home", {
                user: userData,
                products,
            })
        } else {

            return res.render("home",{
                products,
            });
        }
    } catch (error) {
        console.log("Home page not found");
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send("Server error");
    }
};

//using for generate otp
function generateOtp() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

async function sendVerificationEmail(email, otp) {
    try {
        const transpoter = nodemailer.createTransport({
            service: 'gmail',
            port: 587,
            secure: false,
            requireTLS: true,
            auth: {
                user: process.env.NODEMAILER_EMAIL,
                pass: process.env.NODEMAILER_PASSWORD
            }

        })
        const info = await transpoter.sendMail({
            from: process.env.NODEMAILER_EMAIL,
            to: email,
            subject: "verify your account",
            text: `your OTP IS ${otp}`,
            html: `<b>Your OTP: ${otp}</b>`,



        })
        return info.accepted.length > 0

    } catch (error) {
        console.error('error  sending email', error)
        return false
    }
}
//using for signup
const signup = async (req, res) => {
  try {
      const { email, phone, name, password, CPassword } = req.body

      console.log("Received email:", email);
      if (password !== CPassword) {
          return res.render('signup', { message: "password dot not match" })
      }
      const findUser = await User.findOne({ email });
      if (findUser) {
          return res.render("signup", { message: "user with this email already exists" })
      }
      const otp = generateOtp();
      console.log(`generated`, otp)
      const emailSend = await sendVerificationEmail(email, otp)
      if (!emailSend) {
          return res.render('signup', { message: "failed to send verification emal" })
      }
      req.session.userOtp = otp;
      console.log("name is", name)
      req.session.userData = { name, phone, email, password }
      console.log("otp", req.session.userOtp)
      console.log("userdata", req.session.userData)

      return res.render('verify-otp');

      console.log('OTP send', otp)
  } catch (error) {
      console.error("signup error", error)
      res.redirect('/pageNotFound')
  }
}

//using for password security
const securePassword = async (password) => {
    try {
        const passwordHash = await bcrypt.hash(password, 10)
        return passwordHash;
    } catch (error) {

    }
}
//using for verify otp
const verifyOtp = async (req, res) => {
  try {
      const { otps } = req.body;
      console.log("Body ", req.body);
      if (otps == req.session.userOtp) {
          const user = req.session.userData;
          const passwordHash = await securePassword(user.password);
          const saveUserData = new User({
              name: user.name,
              phone: user.phone,
              email: user.email,
              password: passwordHash
          });
          const referralCode = generateReferralCode(user.email);
          if (referralCode) saveUserData.referralCode = referralCode;

          console.log("Generated referralCode:", referralCode);
          await saveUserData.save();
          req.session.user = saveUserData._id;

          if (user.referralCode) {
              const referrer = await User.findOne({ referralCode: user.referralCode });
              if (referrer) {
                  referrer.referralCount += 1;
                  referrer.referralRewards += 100;         
                  referrer.wallet += referrer.referralRewards; 
                  await referrer.save();
                  console.log("Referrer updated:", referrer);
              }
          }

          return res.status(200).json({
              success: true,
              message: "OTP verified successfully.",
              redirectUrl: "/home",
          });
      } else {
          return res.status(400).json({
              success: false,
              message: "Wrong OTP.",
              redirectUrl: "user/verify-otp",
          });
      }
  } catch (error) {
      console.error("Error verifying OTP:", error);
      return res.status(500).json({ success: false, message: "An error occurred." });
  }
};

//using for sending otp

const resendOtp = async (req, res) => {
    try {
        if (!req.session.userData || !req.session.userData.email) {
            return res.status(HttpStatus.BAD_REQUEST).json({
                success: false,
                message: "Session expired. Please try signing up again."
            });
        }

        const { email } = req.session.userData;
        console.log("Resending OTP to email:", email);
        const otp = generateOtp();
        console.log("New OTP generated:", otp);

        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email, otp);

        if (!emailSent) {
            console.log("Failed to send OTP email");
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                success: false,
                message: "Failed to send OTP email. Please try again."
            });
        }

        console.log("OTP email sent successfully");
        return res.json({
            success: true,
            message: "New OTP has been sent to your email!"
        });

    } catch (error) {
        console.error("Resend OTP error:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "Something went wrong. Please try again later."
        });
    }
};
//using for showing login page
const loadLogin = async (req, res) => {
    try {
        return res.render("login");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
};

const login = async (req, res) => {
    console.log("loginreached")
    try {
        const { email, password } = req.body
        console.log("req.body", req.body)
        console.log("pass", password)
        console.log("email", email)
        const findUser = await User.findOne({ isAdmin: 0, email: email })
        console.log("finduser", findUser)
        if (!findUser) {
            return res.render("login", { message: "user not found" })
        }
        if (findUser.isBlocked) {
            return res.render("login", { message: "user is blocked by admin" })
        }
        const passwordMatch = await bcrypt.compare(password, findUser.password)
        if (!passwordMatch) {
            return res.render("login", { message: "incorrect Password" })
        }
        req.session.user = findUser._id
        res.redirect("/home")
    } catch (error) {
        console.error("login error", error)
        res.render("login", { message: "login failed.Please try again letter" })
    }

}
// using for logout
const logout = async (req, res) => {
    try {
        req.session.user = null
        return res.redirect('/home')
       
    } catch (error) {
        console.log("Logout error ", error)
        res.redirect('/user/pageNotFound')

    }
}

const loadshoppingPage = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 8;
    const skip = (page - 1) * limit;

    const categoryFilter = req.query.category; // Now can be a string or array
    const sortBy = req.query.sort || 'default';
    const minPrice = req.query.minPrice;
    const maxPrice = req.query.maxPrice;
    const searchQuery = req.query.query;

    let query = {
      isBlocked: false,
    };

    if (searchQuery) {
      query.productName = { $regex: searchQuery, $options: 'i' };
    }

    // Handle category filter
    if (categoryFilter) {
      // Convert single category to array for consistency
      const categories = Array.isArray(categoryFilter)
        ? categoryFilter
        : [categoryFilter];
      query.category = { $in: categories };
    } else {
      let categories = await Category.find({ isListed: true });
      const categoriesId = categories.map((category) => category._id.toString());
      query.category = { $in: categoriesId };
    }

    // Price filter
    if (minPrice || maxPrice) {
      query.salePrice = {};
      if (minPrice) query.salePrice.$gte = parseFloat(minPrice);
      if (maxPrice) query.salePrice.$lte = parseFloat(maxPrice);
    }

    // Sorting options
    let sortOptions = {};
    switch (sortBy) {
      case 'price-asc':
        sortOptions = { salePrice: 1 };
        break;
      case 'price-desc':
        sortOptions = { salePrice: -1 };
        break;
      case 'name-asc':
        sortOptions = { productName: 1 };
        break;
      case 'name-desc':
        sortOptions = { productName: -1 };
        break;
      default:
        sortOptions = { createdOn: -1 };
    }

    // Fetch products with filters, search, and sorting
    let products = await Product.find(query)
      .sort(sortOptions)
      .skip(skip)
      .limit(limit)
      .populate('category');

    const totalProducts = await Product.countDocuments(query);
    const totalPages = Math.ceil(totalProducts / limit);

    let categories = await Category.find({ isListed: true });
    let user = req.session.user;
    let userData = user ? await User.findOne({ _id: user }) : null;

    res.render('shop', {
      user: userData,
      products: products,
      category: categories.map((cat) => ({ _id: cat._id, name: cat.name })),
      totalProducts,
      currentPage: page,
      totalPages,
      activeCategory: categoryFilter, // Pass as array or single value
      currentSort: sortBy,
      currentMinPrice: minPrice,
      currentMaxPrice: maxPrice,
      searchQuery: searchQuery,
    });
  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
};


//load user Profile page
const loadProfile = async (req, res) => {
  try {
    const userId = req.session.user; // Changed 'users' to 'userId' for clarity
    const userProfile = await User.findById(userId);
    
    if (!userProfile) {
      return res.status(HttpStatus.NOT_FOUND).render('user/pageNotFound', { message: 'User not found' });
    }

    // Fetch userAddress from Address model (adjust based on your schema)
    const userAddress = await Address.findOne({ user: userId }); // Example query

    return res.render('myaccount', {
      user: userProfile,
      userAddress: userAddress || null // Pass userAddress, fallback to null
    });
  } catch (error) {
    console.error('Error loading profile:', error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).render('user/pageNotFound', { message: 'An error occurred' });
  }
};

//load users addAdress page

const addAddress = async (req, res) => {
  try {
    return res.render("addAddress");
  } catch (error) {
    console.log(error);
    
  }
};

const address = async (req, res) => {
  try {
    const user = req.session.user;
    const formData = req.body;
    const userAddress = await Address.findOne({ userId: user });

    const newAddressData = {
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      city: formData.city,
      pincode: formData.pincode,
      state: formData.state,
      houseNumber: formData.houseNumber,
      district: formData.district,
    };
    if (userAddress) {
      userAddress.address.push(newAddressData);
      await userAddress.save();
      return res
        .status(HttpStatus.OK)
        .json({ message: "Address is addedd successfully" });
    } else {
      const newAddress = new Address({
        userId: user,
        address: [newAddressData],
      });
      await newAddress.save();
      return res.status(HttpStatus.OK).json({ message: "Address added successfully" });
    }
  } catch (error) {
    console.error("Error saving address:", error);
    return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: "Internal server error" });
  }
};

const getAddress = async (req, res) => {
  try {
    const user = req.session.user;
    const userId = user._id || user;
    
    const existingAddress = await Address.findOne({ userId });

    if (!existingAddress) {
      return res.render("getAddress", { address: [], user });
    }

    return res.render("getAddress", { address: existingAddress.address, user });
  } catch (error) {
    console.log("The error is: " + error);
    res.status(500).send("Internal Server Error");
  }
};




const getEditPage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.session.user;
    const userAddress = await Address.findOne({ userId });
    if (!userAddress) {
      return res.redirect("/getAddress");
    }
    const address = userAddress.address.find(
      (addr) => addr._id.toString() === id
    );
    if (!address) {
      return res.redirect("/getAddress");
    }
    return res.render("edit-address", { address });
  } catch (error) {
    console.log("Error in get edit page", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).render('error', { error: 'Internal Server Error' });
  }
};

const edit = async (req, res) => {
  try {
    const user = req.session.user;
    const { id } = req.params;
    const data = req.body;
    
   
    if (data.isDefault) {

      await Address.updateOne(
        { userId: user },
        { $set: { "address.$[].isDefault": false } }
      );
    }

    
    await Address.updateOne(
      { userId: user, "address._id": id },
      {
        $set: {
          "address.$.name": data.name,
          "address.$.phone": data.phone,
          "address.$.altPhone": data.altPhone || undefined,
          "address.$.city": data.city,
          "address.$.state": data.state,
          "address.$.pincode": data.pincode,
          "address.$.landMark": data.landMark || undefined,
          "address.$.addressType": data.addressType,
          "address.$.isDefault": data.isDefault
        },
      }
    );
    
    res.status(HttpStatus.OK).json({ message: "Address updated successfully" });
  } catch (error) {
    console.log("Something went wrong", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "An error occurred while updating the address" });
  }
};
const setDefaultAddress = async (req, res) => {
  try {
    const user = req.session.user;
    const { id } = req.params;

    const userAddress = await Address.findOne({ userId: user });
    if (!userAddress) {
      return res.status(404).json({ message: "Address record not found" });
    }

    userAddress.address.forEach(addr => addr.isDefault = false);

    const defaultAddress = userAddress.address.find(addr => addr._id.toString() === id);
    if (!defaultAddress) {
      return res.status(404).json({ message: "Address not found" });
    }

    defaultAddress.isDefault = true;

    await userAddress.save();

    return res.status(200).json({ message: "Default address set successfully" });
  } catch (error) {
    console.error("Error setting default address:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};


const deleteAddress = async (req, res) => {
  try {
    const user = req.session.user;
    const { id } = req.params;
    const address = await Address.findOneAndUpdate(
      { userId: user },
      { $pull: { address: { _id: id } } },
      { new: true }
    );
    if (!address) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: "Address not found" });
    }
    return res.status(HttpStatus.OK).json({ message: "address deleted successfully" });
  } catch (error) {
    console.log("The error is" + error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
  }
};

const updateProfile = async (req, res) => {
  try {
    const user = req.session.user;
    const userData = await User.findOne({ _id: user });
    return res.render("updateProfile", { userData });
  } catch (error) {
    console.log("The error is" + error);
  }
};

const profileUpdate = async (req, res) => {
  try {
    const userId = req.session.user;
    const previousMail = await User.findOne({ _id: userId }); 
    const oldEmail = previousMail.email; 
    const { email, password } = req.body;
    const otp = randomString.generate({ length: 6, charset: "numeric" });
     await Otp.create({ email: oldEmail, otp });
    
    req.session.updateProfile = { email, password };
    return res
      .status(HttpStatus.OK)
      .json({ message: "OTP sent to your current email address." });
  } catch (error) {
    console.log("The error is" + error);
  }
};


const otpVerification = async (req, res) => {
  try {
    return res.render("update-otp-verification");
  } catch (error) {
    console.log("otp error" + error);
  }
};
const about = async (req, res) => {
  try {
    const user = req.session.user; // Get the logged-in user

    return res.render('about', { user }); // Pass user to EJS
  } catch (error) {
    console.log("error: " + error);
    res.status(500).send("Internal Server Error");
  }
};



export {
    loadHomePage,
    pageNotFound,
    loadSignup,
    signup,
    sendVerificationEmail,
    verifyOtp,
    resendOtp,
    loadLogin,
    login,
    logout,
    loadshoppingPage,
    loadProfile,
    updateProfile,
    getAddress,
    addAddress,
    address,
    getEditPage,
    edit,
    deleteAddress,
    profileUpdate,
    about,
setDefaultAddress,



}

