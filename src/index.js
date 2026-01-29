import dotenv from "dotenv"
dotenv.config()
import {app}from "./app.js"
import connectDB from "./db/index.js"




const PORT =process.env.PORT||7000

connectDB()
.then(()=>{
    app.listen(PORT,()=>{
        console.log(`server is running on port ${PORT}`)
    })
})
.catch((err)=>{
    console.log("mongodb  connection error",err)
})


