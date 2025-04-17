
import User from '../../models/userSchema.js';
import { HttpStatus } from "../../statusCode.js";
import { Messages } from '../../responseMessages.js';

import bcrypt from "bcrypt"
//using for showing login page
const loginPage = async (req, res) => {
    res.render('adminLogin')
}
//using to login
const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        console.log(req.body);

        const admin = await User.findOne({ email, isAdmin: true });
        if (!admin) {
            return res.render('adminLogin', { message: "Invalid credentials" });
        }

        const matchPassword = await bcrypt.compare(password, admin.password);
        if (!matchPassword) {
            return res.render('adminLogin', { message: "Invalid credentials" });
        }


        req.session.admin = admin._id;

        return res.redirect('/admin/dashboard');

    } catch (error) {
        console.error("Error in login:", error);
        res.status(500).send("Internal Server Error");
    }
};

//using to render pagenotfound
const pageNotFound = async (req, res) => {
    return res.render('pageerror')

}
//using for logout
const logout = async (req, res) => {
    try {
        req.session.admin = null
        return res.redirect('/admin/adminlogin')
    } catch (error) {
        console.log("Logout error ", error)
        res.redirect('/pageNotFound')

    }
}

export { loginPage, login, pageNotFound, logout }