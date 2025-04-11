import User from "../../models/userSchema.js";

const googleCallback = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      console.error('User not found');
      return res.redirect('/signup');
    }
    if (user.isBlocked) {
      req.logout((err) => {
        if (err) {
          console.error('Error logging out:', err);
          return res.redirect('/signup');
        }
        return res.render('login',{message:"User is blocked by admin"}); 
      });
      return; 
    }

    req.session.user = req.user._id;
    req.session.save((err) => {
      if (err) {
        console.error('Session save error:', err);
        return res.redirect('/signup');
      }
      return res.redirect('/home');
    });
  } catch (error) {
    console.error('Error during Google callback:', error);
    return res.redirect('/signup');
  }
};
export {googleCallback}