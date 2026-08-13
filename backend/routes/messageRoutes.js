const express = require("express");
const router = express.Router();
const {
  sendMessage,
  getMessages,
  sendGroupMessage,
  getGroupMessages,
  deleteForEveryone,
  deleteForMe,
} = require("../controllers/messageController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/send", authMiddleware, sendMessage);
router.get("/:otherUserId", authMiddleware, getMessages);
router.post("/group/send", authMiddleware, sendGroupMessage);
router.get("/group/:groupId", authMiddleware, getGroupMessages);
router.delete("/:messageId/everyone", authMiddleware, deleteForEveryone);
router.delete("/:messageId/me", authMiddleware, deleteForMe);

module.exports = router;
