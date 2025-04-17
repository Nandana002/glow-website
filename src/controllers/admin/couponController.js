import mongoose from 'mongoose';
import { Coupon } from '../../models/couponSchema.js';
import { Cart } from '../../models/cartSchema.js';
import { HttpStatus } from '../../statusCode.js';
import moment from 'moment';


//usering load coupon
const laodCoupon = async (req, res) => {
  try {

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const skip = (page - 1) * limit;


    const totalItems = await Coupon.countDocuments();
    const totalPages = Math.ceil(totalItems / limit);


    const coupons = await Coupon.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);


    res.render('coupon', {
      coupon: coupons,
      currentPage: page,
      totalPages: totalPages,
      totalItems: totalItems,
      itemsPerPage: limit
    });

  } catch (error) {
    console.error("Error in loadCoupon: ", error);

    res.status(HttpStatus.INTERNAL_SERVER_ERROR).render('error', {
      message: 'Error loading coupons',
      error: error.message
    });
  }
};
//using to render the coupon add page

const addcoupon = async (req, res) => {
  try {
    return res.render("couponAdd");
  } catch (error) {
    console.log(error);

  }
};

//using to create coupon

const createCoupon = async (req, res) => {
  try {
    const {
      code,
      discountValue,
      minPurchase,
      startDate,
      endDate,
      isActive,
      discountType,
      maxDiscount
    } = req.body;


    const formattedStartDate = moment(startDate).format('YYYY-MM-DD');
    const formattedEndDate = moment(endDate).format('YYYY-MM-DD');

    const couponExist = await Coupon.findOne({ code });
    if (couponExist) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "coupon is already exist" });
    }

    const newCoupon = new Coupon({
      code,
      discountValue: parseFloat(discountValue),
      minPurchase: Number(minPurchase),
      startDate: formattedStartDate,
      endDate: formattedEndDate,
      discountType,
      maxDiscount: Number(maxDiscount)
    });

    await newCoupon.save();
    res.status(HttpStatus.OK).json({ message: "coupon is added successfully" });
  } catch (error) {
    console.log("The error is " + error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "internal server error" });
  }
};


//using get edit coupon
const geteditCoupon = async (req, res) => {
  try {
    const { edit } = req.params;


    if (!mongoose.Types.ObjectId.isValid(edit)) {
      return res.status(HttpStatus.BAD_REQUEST).json({ message: "Invalid coupon ID format" });
    }

    const coupon = await Coupon.findById(edit);

    if (!coupon) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: "Coupon not found" });
    }

    return res.render("edit-coupon", { coupon });
  } catch (error) {
    console.log("The error is " + error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: "Internal server error" });
  }
};
//using edit coupon
const editCoupon = async (req, res) => {
  try {
    const { edit } = req.params;
    const { code, discountValue, minPurchase, startDate, endDate, discountType } = req.body;

    const updateCoupon = await Coupon.findByIdAndUpdate(
      edit,
      {
        code,
        discountValue,
        minPurchase,
        startDate,
        endDate,
        discountType,
      },
      { new: true }
    );

    if (!updateCoupon) {
      return res.status(HttpStatus.NOT_FOUND).json({ message: "Coupon not found" });
    }
    return res.status(HttpStatus.OK).json({ message: "coupon updated successfully" });
  } catch (error) { }
};
//using delete coupon
const deleteCoupon = async (req, res) => {
  try {
    const { id } = req.params;
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) {
      return res.status(HttpStatus.UNAUTHORIZED).json({ message: "coupon is not found" });
    }
    res.status(HttpStatus.OK).json({ success: true, message: "Coupon deleted successfully" });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ success: false, message: "Internal server error" });
  }
};


export {
  laodCoupon,
  addcoupon,
  createCoupon,
  editCoupon,
  geteditCoupon,
  deleteCoupon,
};