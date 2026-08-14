const pool = require("../db/db");

const sendMessage = async (req, res) => {
  try {
    const senderId = req.userId;
    const { receiverId, content } = req.body;

    if (!receiverId || !content) {
      return res
        .status(400)
        .json({ error: "receiverId and content are required" });
    }

    const newMessage = await pool.query(
      `INSERT INTO messages (sender_id, receiver_id, content) 
       VALUES ($1, $2, $3) RETURNING *`,
      [senderId, receiverId, content],
    );

    const message = newMessage.rows[0];

    const io = req.app.get("io");
    const onlineUsers = req.app.get("onlineUsers");
    const receiverSocketId = onlineUsers.get(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("receiveMessage", message);
    }

    res.status(201).json({ message });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const getMessages = async (req, res) => {
  try {
    const userId = req.userId;
    const otherUserId = req.params.otherUserId;

    const result = await pool.query(
      `SELECT m.* FROM messages m
       WHERE ((m.sender_id = $1 AND m.receiver_id = $2)
          OR (m.sender_id = $2 AND m.receiver_id = $1))
         AND NOT EXISTS (
           SELECT 1 FROM message_deletions md 
           WHERE md.message_id = m.id AND md.user_id = $1
         )
       ORDER BY m.created_at ASC`,
      [userId, otherUserId],
    );

    res.json({ messages: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const sendGroupMessage = async (req, res) => {
  try {
    const senderId = req.userId;
    const { groupId, content } = req.body;

    if (!groupId || !content) {
      return res
        .status(400)
        .json({ error: "groupId and content are required" });
    }

    const memberCheck = await pool.query(
      "SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2",
      [groupId, senderId],
    );

    if (memberCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "You are not a member of this group" });
    }

    const newMessage = await pool.query(
      `INSERT INTO messages (sender_id, group_id, content) 
       VALUES ($1, $2, $3) RETURNING *`,
      [senderId, groupId, content],
    );

    const message = newMessage.rows[0];

    const userResult = await pool.query(
      "SELECT username FROM users WHERE id = $1",
      [senderId],
    );
    const senderUsername = userResult.rows[0]?.username;

    const fullMessage = {
      ...message,
      senderUsername,
      username: senderUsername,
    };

    const io = req.app.get("io");
    const onlineUsers = req.app.get("onlineUsers");
    const senderSocketId = onlineUsers.get(senderId);

    if (senderSocketId) {
      io.to(`group_${groupId}`)
        .except(senderSocketId)
        .emit("receiveGroupMessage", fullMessage);
    } else {
      io.to(`group_${groupId}`).emit("receiveGroupMessage", fullMessage);
    }

    res.status(201).json({ message: fullMessage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const getGroupMessages = async (req, res) => {
  try {
    const userId = req.userId;
    const groupId = req.params.groupId;

    const memberCheck = await pool.query(
      "SELECT * FROM group_members WHERE group_id = $1 AND user_id = $2",
      [groupId, userId],
    );

    if (memberCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "You are not a member of this group" });
    }

    const result = await pool.query(
      `SELECT m.*, u.username 
       FROM messages m
       JOIN users u ON m.sender_id = u.id
       WHERE m.group_id = $1
         AND NOT EXISTS (
           SELECT 1 FROM message_deletions md 
           WHERE md.message_id = m.id AND md.user_id = $2
         )
       ORDER BY m.created_at ASC`,
      [groupId, userId],
    );

    res.json({ messages: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const deleteForEveryone = async (req, res) => {
  try {
    const userId = req.userId;
    const messageId = req.params.messageId;

    const result = await pool.query(
      "DELETE FROM messages WHERE id = $1 AND sender_id = $2 RETURNING *",
      [messageId, userId],
    );

    if (result.rows.length === 0) {
      return res
        .status(403)
        .json({ error: "You can only delete your own messages for everyone" });
    }

    const deletedMessage = result.rows[0];
    const io = req.app.get("io");
    const onlineUsers = req.app.get("onlineUsers");

    if (deletedMessage.receiver_id) {
      const receiverSocketId = onlineUsers.get(deletedMessage.receiver_id);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("removeMessage", {
          messageId: deletedMessage.id,
        });
      }
    } else if (deletedMessage.group_id) {
      io.to(`group_${deletedMessage.group_id}`).emit("removeGroupMessage", {
        messageId: deletedMessage.id,
      });
    }

    res.json({ message: "Message deleted for everyone" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

const deleteForMe = async (req, res) => {
  try {
    const userId = req.userId;
    const messageId = req.params.messageId;

    await pool.query(
      `INSERT INTO message_deletions (message_id, user_id) 
       VALUES ($1, $2) 
       ON CONFLICT (message_id, user_id) DO NOTHING`,
      [messageId, userId],
    );

    res.json({ message: "Message deleted for you" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  sendMessage,
  getMessages,
  sendGroupMessage,
  getGroupMessages,
  deleteForEveryone,
  deleteForMe,
};
