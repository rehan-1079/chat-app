const express = require("express");
const router = express.Router();
const { signup, login, getAllUsers } = require("../controllers/authController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/signup", signup);
router.post("/login", login);
router.get("/users", authMiddleware, getAllUsers);

module.exports = router;
