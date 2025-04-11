import User from "../../models/userSchema.js";
import express from 'express';
import session from 'express-session';
import nodemailer from "nodemailer";
import bcrypt from "bcrypt"
import dotenv from "dotenv";
import { sendVerificationEmail } from "./userController.js";
import { HttpStatus } from "../../statusCode.js";
import { uploadMulter,storage } from "../../utils/multer.js";

dotenv.config();

function generateOtp(){
    const digits="1234567890";
    let otp="";
    for(let i=0;i<6;i++){
        otp+=digits[Math.floor(Math.random()*10)]
    }
    return otp;
}




//using to update profile image

const updateProfileImage = async (req, res) => {
    try {
      console.log("File received:", req.file);
      
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No image file provided"
        });
      }
      
      const userId = typeof req.session.user === 'object' ? req.session.user._id : req.session.user;
      console.log("User ID:", userId);
      
      const imagePath = `/uploads/re-image/${req.file.filename}`;
      console.log("Image path:", imagePath);
      
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { profileImage: imagePath },
        { new: true }
      );
      
      if (!updatedUser) {
        console.log("User not found");
        return res.status(404).json({
          success: false,
          message: "User not found"
        });
      }
      
      if (req.session && req.session.user) {
        if (typeof req.session.user === 'object') {
          req.session.user.profileImage = imagePath;
        }
      }
      
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(200).json({
          success: true,
          message: "Profile image updated successfully",
          data: { profileImage: imagePath }
        });
      } else {
        req.flash('success', 'Profile image updated successfully');
        return res.redirect('/myaccount');
      }
      
    } catch (error) {
      console.error("Error updating profile image:", error);
      
      if (req.xhr || req.headers.accept?.includes('application/json')) {
        return res.status(500).json({
          success: false,
          message: "Failed to update profile image",
          error: error.message
        });
      } else {
        req.flash('error', 'Failed to update profile image');
        return res.redirect('/myaccount');
      }
    }
  };



//using to send verification gmail
const sendVerificationGmail=async(email,otp)=>{
    try {
        const transporter=nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD,
            }
        })
        const mailOptions={
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"your OTP for password reset",
            text:'your OTP is ${otp}',
            html:`<b><h4>your OTP:${otp}</h4><b>`

        }
        const info=await transporter.sendMail(mailOptions)
        return true;




    } catch (error) {
        console.error("erros sending email",error)
    }
}
//using to secure password
const securePassword = async(password)=>{
    try {
        
       const passwordHash = await bcrypt.hash(password,10);
       return passwordHash;

    } catch (error) {
        
    }
}


//using to get forgot pass
const getForgotPass=async(req,res)=>{
    try {
        
        res.render("forgot-password")
    } catch (error) {
        res.redirect('/pageNotFound')
    }
}
//using to forgot email
const forgotEmail = async (req, res) => {
    try {
        const { email } = req.body;
        const findUser = await User.findOne({ email: email });

        if (findUser) {
            const otp = generateOtp();
            const emailSend = await sendVerificationGmail(email, otp);
            
            if (emailSend) {
                req.session.userOtp = otp;
                req.session.email = email;
                console.log("Generated OTP:", otp);
                
                
                req.session.save((err) => {
                    if (err) {
                        console.error("Session save error:", err);
                        return res.json({ success: false, message: "Session error" });
                    }
                    
                    console.log("Session OTP saved:", req.session.userOtp);
                    console.log("Session email saved:", req.session.email);

                    
                    res.render("forgotPass_otp");
                });
            } else {
                res.json({ success: false, message: "Failed to send OTP. Please try again" });
            }
        } else {
            res.render("forgot-password", {
                message: "User with this email does not exist"
            });
        }
    } catch (error) {
        console.error("Error in forgotEmail:", error);
        res.redirect('/pageNotFound');
    }
};


//using tot send resent otp
const resendOtp = async(req,res)=>{
    try {
        
        const otp = generateOtp();
        req.session.userOtp = otp;
        const email = req.session.email;
        console.log("this is resendOtp");
        console.log("Resending OTP to email:",email);
        const  emailSend = await sendVerificationEmail(email,otp);
        if(emailSend){
            console.log("Resend OTP:",otp);
            res.status(HttpStatus.OK).json({success:true,message:"Resend OTP Successful"});
        }
    } catch (error) {
        console.error("Error in resend oto",error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({success:false,message:"Internal server error"});
    }
}
//using to verify forgot password otp
const verifyForgotPassOtp = async(req, res) => {
    try {
        const enteredOtp = req.body.otps;  
        const sessionOtp = req.session.userOtp;
        
        console.log("Entered OTP:", enteredOtp);
        console.log("Session OTP:", sessionOtp);

        if (!sessionOtp) {
            return res.json({
                success: false,
                message: "Session expired. Please request a new OTP"
            });
        }

        if (enteredOtp === sessionOtp) {
           
            req.session.otpVerified = true;
            return res.json({
                success: true,
                redirectUrl: "/reset-password"
            });
        } else {
            return res.json({
                success: false,
                message: "Invalid OTP. Please try again."
            });
        }
    } catch (error) {
        console.error("OTP verification error:", error);
        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            success: false,
            message: "An error occurred. Please try again"
        });
    }
}
//using to get reset password page
const getResetPassPage = async(req, res) => {
    try {
        if (!req.session.otpVerified) {
            return res.redirect("/forgot-password");
        }
        
        res.render("reset-password");
    } catch (error) {
        console.error("Reset page error:", error);
        res.redirect("/pageNotFound");
    }
}

//using to post new password
const postNewPassword = async(req,res)=>{
    try {
        
        const {newPass1,newPass2} = req.body;
        const email = req.session.email;
        if(newPass1===newPass2){
            const passwordHash = await securePassword(newPass1);
            await User.updateOne(
                {email:email},
                {$set:{password:passwordHash}}
            )
           
            res.redirect("/login");  
          
        } else{
            res.render("reset-password",{message:'Passwords dont match'});

        }

    } catch (error) {
        console.error("error from post",error)
        res.redirect("/pageNotFound");
    }
}

//using to render change email
const changeEmail = async(req,res)=>{
    try {
        res.render("change-email");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}
//using to change the email
const changeEmailValid = async (req, res) => {
    try {
        const { email } = req.body;
        const userId = req.session.user;

        const currentUser = await User.findOne({ _id: userId });

        if (!currentUser) {
            return res.render("change-emai", { message: "User with this email not exist" });
        }
       
        if (currentUser.email != email) {
            return res.render("change-email", { message: "Please enter your current email address" })
        }
         
        const otp = generateOtp();
        console.log("Generated OTP:", otp);

        try {
            const emailSent = await sendVerificationEmail(email, otp);
            console.log("Email sending result:", emailSent);

            if (!emailSent) {
                return res.json("email-error");
            }

            req.session.userOtp = otp;
            req.session.userData = req.body;
            req.session.email = email;

            console.log("OTP:", otp)

            return res.render("change-email-otp");
        } catch (emailError) {
            console.error("Error sending email:", emailError);
            return res.render("change-email", { message: "Failed to sent OTP. Please try again" })
        }

    } catch (error) {
        console.error("Change email validation error:", error);
        return res.redirect("/pageNotFound");
    }
}

//using to verifyEmailOtp

const verifyEmailOtp = async (req, res) => {
    try {
        const enteredOtp = req.body.otp;
        if (!enteredOtp || !req.session.userOtp) {
            return res.json({
                success: false,
                message: "Invalid OTP verification attempt"
            });
        }

        if (enteredOtp === req.session.userOtp) {
            req.session.userData = req.body.userData;
            return res.render("update-email", { message: null });
        } else {
            return res.json({
                success: false,
                message: "The OTP you entered is incorrect. Please try again."
            });
        }
    } catch (error) {
        console.error("OTP verification error:", error);
        return res.json({
            success: false,
            message: "An error occurred during verification. Please try again."
        });
    }
};
//using to  render updateEmailPage

const getUpdateEmailPage = async (req, res) => {
    try {
        if (!req.session.userOtp) {
            return res.redirect('/change-email');
        }
        return res.render('update-email', { message: null });
    } catch (error) {
        console.error("Error loading update email page:", error);
        return res.redirect("/pageNotFound");
    }
};

//using to update the email

const updateEmail = async (req, res) => {
    try {

        const newEmail = req.body.email;
        const userId = req.session.user;

        console.log("New email:", newEmail);

        const emailExists = await User.findOne({ email: newEmail, _id: { $ne: userId } });

        if (emailExists) {
            return res.render("update-email", { message: "This email already exists. Please try again with a new email." });
        }

        await User.findByIdAndUpdate(userId, { email: newEmail });
        return res.redirect("/userProfile?tab=dashboard")

    } catch (error) {
        console.error("The error is here", error)
        return res.redirect("/pageNotFound")
    }
}
//using to change the password

const changePassword = async(req,res)=>{
    try {
        res.render("change-password");
    } catch (error) {
        res.redirect("/pageNotFound");
    }
}
//using to chech pass validation

const changePasswordValid = async(req,res)=>{
    try {
        
        const {email} = req.body;
        const userExists = await User.findOne({email});
        if(userExists && email == req.session.user.email){
            const otp = generateOtp();
            const emailSend = await sendVerificationEmail(email,otp);
            if(emailSend){
                req.session.userOtp = otp;
                req.session.userData = req.body;
                req.session.email = email;
                res.render("change-password-otp");
                console.log("this is changePasswordValid");
                console.log("OTP: ",otp);
            }else{
                res.json({
                    success:false,
                    message: "Failed to send OTP",
                })
            }
        }else{
            res.render("change-password",{
                message:"User with this email does not exist"
            })
        }

    } catch (error) {
        console.error("Error in changing password");
        res,redirect("/pageNotFound");
    }
}
//using to the verify change pass otp

const verifyChangePassOtp = async(req,res)=>{
    try {
        
        const enteredOtp = req.body.otp.trim();
        console.log("this is verifyChangePassOtp");
        console.log("Stored OTP:", req.session.userOtp);
        console.log("Entered OTP:", enteredOtp);
        if(enteredOtp===req.session.userOtp){
            res.json({success:true,redirectUrl:"/reset-password"});
        }else{
            res.json({success:false,message:"OTP not matching"});
        }

    } catch (error) {
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({success:false,message:"An error occured during changing password"});
    }
}

import mongoose from 'mongoose';
//using to get referal
const getReferal = async (req, res) => {
    try {
        const userId = req.session.user;

      
        if (!mongoose.Types.ObjectId.isValid(userId)) {
            return res.status(HttpStatus.BAD_REQUEST).render('error', { message: 'Invalid user ID' });
        }

        const user = await User.findById(userId).populate('referralCode');

        if (!user) {
            return res.status(HttpStatus.NOT_FOUND).render('error', { message: 'User not found' });
        }

        res.render('referal', { user });
    } catch (error) {
        console.error("Error loading referral page:", error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).render('error', { message: 'An error occurred while loading the referral page' });
    }
};

export {getForgotPass,forgotEmail,changeEmail,changeEmailValid,verifyEmailOtp,updateEmail,getResetPassPage,verifyForgotPassOtp,resendOtp,postNewPassword,verifyChangePassOtp,changePasswordValid,changePassword, getReferal,getUpdateEmailPage, updateProfileImage }