import express from "express"
// import csrf from "csurf";
import cookieParser from "cookie-parser";
import cors from "cors"
import path from "path"

import helmet from 'helmet';
import session from "express-session"; 
import { fileURLToPath } from "url"
import { passport } from "./db/passport.js"; 
import userRouter from "./routes/userRouter.js"; 
import { loadHomePage } from "./controllers/user/userController.js"; // Add ".js"
import{ errorHandler} from "./middlewares/errorHandling.js";

import adminRouter from "./routes/adminRouter.js"

const app=express()
// app.use(helmet())
app.use(
    cors({
        origin:process.env.CORS_ORIGIN,
        credentials:true
    })
)
app.use(express.json({limit:"16kb"}))
app.use(express.urlencoded({extended:true,limit:"16kb"}))
app.use(express.static('public'))

app.use(session({
    secret:process.env.SESSION_SECRET,
    resave:false,
    saveUninitialized:true,
    cookie:{
        secure:false,
        httpOnly:true,
        maxAge:365*24*60*60*1000
    }
    
}))
app.use(passport.initialize())
app.use(passport.session())


// app.use(cookieParser());
// app.use((req, res, next) => {
//     res.cookie("XSRF-TOKEN", req.csrfToken());
//     next();
// });
// app.post("/submit", (req, res) => {
//     res.json({ message: "Form submitted successfully!" });
// });

// app.use((err, req, res, next) => {
//     if (err.code === "EBADCSRFTOKEN") {
//         return res.status(403).json({ error: "Invalid CSRF token" });
//     }
//     next(err);
// });
console.log(process.env.SESSION_SECRET)


const __filename=fileURLToPath(import.meta.url)

const __dirname=path.dirname(__filename)

app.set("view engine","ejs")

const v =app.set('views', [path.join(__dirname, 'views/user'), path.join(__dirname, 'views/admin')])
console.log(v)
// app.set("views", path.join(__dirname, "views")); 


app.use(express.static(path.join(__dirname,"public")))


app.use('/',userRouter)
app.use('/admin',adminRouter)

app.get('/',loadHomePage)

app.use(helmet());
app.use(errorHandler);





app.use((req, res, next) => {
    const isAdminRoute = req.originalUrl.startsWith('/admin');
    const redirectUrl = isAdminRoute ? '/admin/dashboard' : '/'; 
    
    res.status(404).render(isAdminRoute ? "pageerror" : "page-404", { 
        title: "Page Not Found", 
        message: "The page you are looking for does not exist.",
        status: 404,
    })
})


export{app}


