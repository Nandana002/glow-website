import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import User from "../models/userSchema.js"; 
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";

dotenv.config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: '/auth/google/callback'
},
async (req, accessToken, refreshToken, profile, done) => {
    try {
        if (!profile.emails || !profile.emails.length) {
            return done(new Error('No email found in Google profile'), null);
        }

        let user = await User.findOne({ email: profile.emails[0].value });
        
        if (user) {
            if (!user.googleId) {
                user.googleId = profile.id;
                await user.save();
            }
            return done(null, user);
        } else {
            const newUser = new User({
                name: profile.displayName,
                email: profile.emails[0].value,
                googleId: profile.id,
                isAdmin: false,
                isBlocked: false,
                referralCode: uuidv4().substring(0, 8),
                redeemed: false
            });

            await newUser.save();
            console.log("New user created with referralCode:", newUser.referralCode);
            return done(null, newUser);
        }
    } catch (error) {
        console.error('Google Strategy Error:', error);
        return done(error, null);
    }
}));

passport.serializeUser((user, done) => {
    try {
        done(null, user.id);
    } catch (err) {
        done(err, null);
    }
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id).select('-password');
        if (!user) {
            return done(new Error('User not found'), null);
        }
        done(null, user);
    } catch (err) {
        console.error('Deserialization error:', err);
        done(err, null);
    }
});

export { passport };