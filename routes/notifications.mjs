import { Router } from "express";
import connectionPool from "../utils/db.mjs";
import protectAdmin from "../middlewares/protectAdmin.mjs";

const notificationsRouter = Router();

notificationsRouter.get("/", protectAdmin, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);

  try {
    const result = await connectionPool.query(
      `
        SELECT
          n.id,
          n.type,
          n.message,
          n.link,
          n.created_at,
          u.name AS author,
          u.profile_pic AS avatar
        FROM notifications n
        LEFT JOIN users u ON n.actor_user_id = u.id
        ORDER BY n.created_at DESC
        LIMIT $1
      `,
      [limit],
    );

    return res.status(200).json({ notifications: result.rows });
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return res.status(500).json({
      message: "Server could not read notifications because database connection",
    });
  }
});

export default notificationsRouter;
