const pool = require("../db/db");

const createGroup = async (req, res) => {
  try {
    const { name } = req.body;
    const userId = req.userId;

    if (!name) {
      return res.status(400).json({ error: "Group name is required" });
    }

    const newGroup = await pool.query(
      "INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING *",
      [name, userId],
    );

    const group = newGroup.rows[0];

    await pool.query(
      "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)",
      [group.id, userId],
    );

    req.app.get("io").emit("groupsUpdated");
    res.status(201).json({ group });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const joinGroup = async (req, res) => {
  try {
    const userId = req.userId;
    const groupId = req.params.groupId;

    const groupCheck = await pool.query("SELECT * FROM groups WHERE id = $1", [
      groupId,
    ]);
    if (groupCheck.rows.length === 0) {
      return res.status(404).json({ error: "Group not found" });
    }
    const group = groupCheck.rows[0];

    const existingMember = await pool.query(
      "SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2",
      [groupId, userId],
    );

    if (existingMember.rows.length > 0) {
      return res
        .status(400)
        .json({ error: "You are already a member of this group" });
    }

    await pool.query(
      "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)",
      [groupId, userId],
    );

    if (group.created_by === null) {
      await pool.query("UPDATE groups SET created_by = $1 WHERE id = $2", [
        userId,
        groupId,
      ]);
    }

    const io = req.app.get("io");
    io.emit("groupsUpdated");
    io.to(`group_${groupId}`).emit("groupMembersUpdated");

    res.status(201).json({ message: "Joined group successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const leaveGroup = async (req, res) => {
  try {
    const userId = req.userId;
    const groupId = req.params.groupId;

    const groupResult = await pool.query("SELECT * FROM groups WHERE id = $1", [
      groupId,
    ]);
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: "Group not found" });
    }
    const group = groupResult.rows[0];

    const result = await pool.query(
      "DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 RETURNING *",
      [groupId, userId],
    );

    if (result.rows.length === 0) {
      return res
        .status(400)
        .json({ error: "You are not a member of this group" });
    }

    if (group.created_by === userId) {
      const nextAdmin = await pool.query(
        "SELECT user_id FROM group_members WHERE group_id = $1 ORDER BY joined_at ASC LIMIT 1",
        [groupId],
      );

      const newAdminId =
        nextAdmin.rows.length > 0 ? nextAdmin.rows[0].user_id : null;
      await pool.query("UPDATE groups SET created_by = $1 WHERE id = $2", [
        newAdminId,
        groupId,
      ]);
    }

    const io = req.app.get("io");
    io.emit("groupsUpdated");
    io.to(`group_${groupId}`).emit("groupMembersUpdated");

    res.json({ message: "Left group successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const getGroupMembers = async (req, res) => {
  try {
    const groupId = req.params.groupId;

    const result = await pool.query(
      `SELECT u.id, u.username, u.email, gm.joined_at
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1
       ORDER BY gm.joined_at ASC`,
      [groupId],
    );

    res.json({ members: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const addMember = async (req, res) => {
  try {
    const adminId = req.userId;
    const groupId = req.params.groupId;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const groupResult = await pool.query("SELECT * FROM groups WHERE id = $1", [
      groupId,
    ]);
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: "Group not found" });
    }
    const group = groupResult.rows[0];

    if (group.created_by !== adminId) {
      return res
        .status(403)
        .json({ error: "Only the group admin can add members" });
    }

    const existing = await pool.query(
      "SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2",
      [groupId, userId],
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: "User is already a member" });
    }

    await pool.query(
      "INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)",
      [groupId, userId],
    );

    const io = req.app.get("io");
    io.emit("groupsUpdated");
    io.to(`group_${groupId}`).emit("groupMembersUpdated");

    res.status(201).json({ message: "Member added" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const removeMember = async (req, res) => {
  try {
    const adminId = req.userId;
    const groupId = req.params.groupId;
    const targetUserId = req.params.userId;

    const groupResult = await pool.query("SELECT * FROM groups WHERE id = $1", [
      groupId,
    ]);
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: "Group not found" });
    }
    const group = groupResult.rows[0];

    if (group.created_by !== adminId) {
      return res
        .status(403)
        .json({ error: "Only the group admin can remove members" });
    }

    if (String(targetUserId) === String(adminId)) {
      return res
        .status(400)
        .json({ error: "Admin cannot remove themselves. Use Leave instead." });
    }

    const result = await pool.query(
      "DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 RETURNING *",
      [groupId, targetUserId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Member not found in this group" });
    }

    const io = req.app.get("io");
    const onlineUsers = req.app.get("onlineUsers");

    io.emit("groupsUpdated");
    io.to(`group_${groupId}`).emit("groupMembersUpdated");

    const targetSocketId = onlineUsers.get(Number(targetUserId));
    if (targetSocketId) {
      io.to(targetSocketId).emit("removedFromGroup", { groupId });
    }

    res.json({ message: "Member removed" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const getAllGroups = async (req, res) => {
  try {
    const userId = req.userId;

    const result = await pool.query(
      `SELECT g.*,
        EXISTS(
          SELECT 1 FROM group_members gm
          WHERE gm.group_id = g.id AND gm.user_id = $1
        ) AS is_member,
        (g.created_by = $1) AS is_admin
       FROM groups g
       ORDER BY g.created_at DESC`,
      [userId],
    );

    res.json({ groups: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const getGroupById = async (req, res) => {
  try {
    const userId = req.userId;
    const groupId = req.params.groupId;

    const result = await pool.query(
      `SELECT g.*,
        EXISTS(
          SELECT 1 FROM group_members gm
          WHERE gm.group_id = g.id AND gm.user_id = $1
        ) AS is_member,
        (g.created_by = $1) AS is_admin
       FROM groups g
       WHERE g.id = $2`,
      [userId, groupId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Group not found" });
    }

    res.json({ group: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const deleteGroup = async (req, res) => {
  try {
    const userId = req.userId;
    const groupId = req.params.groupId;

    const result = await pool.query(
      "DELETE FROM groups WHERE id = $1 AND created_by = $2 RETURNING *",
      [groupId, userId],
    );

    if (result.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "Only the group admin can delete this group" });
    }

    req.app.get("io").emit("groupsUpdated");
    res.json({ message: "Group deleted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  createGroup,
  joinGroup,
  leaveGroup,
  getGroupMembers,
  addMember,
  removeMember,
  getAllGroups,
  getGroupById,
  deleteGroup,
};
