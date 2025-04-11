
import User from '../models/userSchema.js';



const userAuth = async(req,res,next)=>{
    if(req.session.user){
            next()     
    }else{
        return res.redirect('/login')
    }
}
const userLogin = (req,res,next)=>{
    if(req.session.user){
        return res.redirect("/")
    }else{
        return next();
    }
}

const block = async (req, res, next) => {
    try {
        if (!req.session.user) {
            return next();
        }

        const user = await User.findById(req.session.user);

        if (user.isBlocked) {
            req.session.destroy()
            return res.redirect('/login');
        }else{
            return next();
        }
       
    } catch (error) {
        console.error('Block middleware error:', error);
        return res.redirect('/login');
    }
};
export{userAuth,userLogin,block}  