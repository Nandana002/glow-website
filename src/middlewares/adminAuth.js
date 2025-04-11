const isAuthenticated = (req,res,next)=>{
    if(req.session.admin){
        next()
    }else{
        return res.redirect('/admin/adminLogin')
    }
}

const isLogin = (req,res,next)=>{
    if(!req.session.admin){
        
        next()
    }else{
       return res.redirect('/admin/dashboard')
    }
}

export{isAuthenticated,isLogin}