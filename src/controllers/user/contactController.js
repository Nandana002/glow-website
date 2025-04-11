import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import { HttpStatus } from "../../statusCode.js";
import { Messages } from '../../responseMessages.js';

dotenv.config();

// Render the Contact Us page
const getContactPage = async (req, res) => {
    try {
        const user = req.session.user; 
        res.render('contact', { user });
    } catch (error) {
        console.error('Error rendering contact page:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(Messages.INTERNAL_SERVER_ERROR);
    }
};

// Handle form submissions
const handleContactForm = async (req, res) => {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
        return res.status(HttpStatus.BAD_REQUEST).json({ error: 'All fields are required.' });
    }

    try {
        const transporter = nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.NODEMAILER_EMAIL, 
                pass: process.env.NODEMAILER_PASSWORD, 
            },
        });

        const mailOptions = {
            from: `"${name}" <${email}>`, 
            to: 'nandanakodiveettil@gmail.com', 
            subject: `Contact Form Submission: ${subject}`,
            text: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
        };

        await transporter.sendMail(mailOptions);

        res.status(HttpStatus.OK).json({ message: 'Your message has been sent successfully.' });
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ error: 'An error occurred while sending your message. Please try again later.' });
    }
};

export {
    getContactPage,
    handleContactForm,
};