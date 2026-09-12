import express from "express";
import authController from "#modules/auth/auth.controller.js";
import { authenticate } from "#middleware/auth.middleware.js";
import wrapper from "#utils/wrapper.js";

const route = express.Router();

route.post("/login", wrapper(authController.login));
route.post("/register", wrapper(authController.register));
route.post("/logout", authenticate, wrapper(authController.logout));
route.post("/refresh", wrapper(authController.refresh));
route.post("/forgot-password", wrapper(authController.forgotPassword));
route.post("/reset-password", wrapper(authController.resetPassword));

export default route;
