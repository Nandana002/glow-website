import multer from "multer";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Define the upload path
const uploadPath = path.join(__dirname, "../../public/uploads/re-image");
console.log(uploadPath);
const storage = multer.diskStorage({
    destination: (req, res, cb) => {
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + "-" + file.originalname);
    }
});

export const uploadMulter = (store) => {
    return multer({ storage: store });
};

export { storage };