const express = require("express");
const router = express.Router();
const {
  createGroup,
  joinGroup,
  leaveGroup,
  getGroupMembers,
  addMember,
  removeMember,
  getAllGroups,
  getGroupById,
  deleteGroup,
} = require("../controllers/groupController");
const authMiddleware = require("../middleware/authMiddleware");

router.post("/create", authMiddleware, createGroup);
router.post("/:groupId/join", authMiddleware, joinGroup);
router.delete("/:groupId/leave", authMiddleware, leaveGroup);
router.get("/:groupId/members", authMiddleware, getGroupMembers);
router.post("/:groupId/members", authMiddleware, addMember);
router.delete("/:groupId/members/:userId", authMiddleware, removeMember);
router.get("/", authMiddleware, getAllGroups);
router.get("/:groupId", authMiddleware, getGroupById);
router.delete("/:groupId", authMiddleware, deleteGroup);

module.exports = router;
