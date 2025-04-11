import User from '../../models/userSchema.js';
import { HttpStatus } from "../../statusCode.js";
//usin for showing customer details


const customer = async (req, res) => {
    try {
        let search = req.query.search || '';
        let filter = { isAdmin: false };

        if (search) {
            filter.name = { $regex: search, $options: 'i' };  
        }

        let page = Math.max(1, parseInt(req.query.page) || 1); 
        let limit = 7;
        
        let user = await User.find(filter).sort({ createdAt: -1 }).limit(limit).skip((page - 1) * limit);
        
        let count = await User.countDocuments(filter);
        let totalpages = Math.ceil(count / limit);
        
        res.render('customers', {
            userData: user,
            currentPage: page,
            totalpages: totalpages,
            search: search
        });
    } catch (error) {
        console.log(error);
    }
}

//block the cutomer
const blockUser = async(req,res)=>{
    try {
        const{id} = req.query
        await User.updateOne({_id:id},{$set:{isBlocked:true}})
        res.redirect('/admin/customers')
    } catch (error) {
       console.log(error);
       
    }

}
//block the customer
const unblockUser = async(req,res)=>{
    try {
        const{id} = req.query
        await User.updateOne({_id:id},{$set:{isBlocked:false}})
        res.redirect('/admin/customers')
    } catch (error) {
        console.log(error);
    }

}
export{customer,blockUser,unblockUser}