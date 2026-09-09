import express from "express";
import authController from "./auth.controller.js";

const route = express.Router();

route.post("/login", authController.login);
route.post("/register", authController.register);
route.post("/logout", authController.logout);
route.post("/refresh", authController.refresh);
route.post("/forgot-password", authController.forgotPassword);
route.post("/reset-password", authController.resetPassword);

export default route;
