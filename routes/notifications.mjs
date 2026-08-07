import { Router } from "express";
import connectionPool from "../utils/db.mjs";
import protectAdmin from "../middlewares/protectAdmin.mjs";

const notificationsRouter = Router();

const notificationSelect = `
  SELECT
    n.id,
    n.type,
    n.message,
    n.link,
    n.is_read,
    n.created_at,
    u.name AS author,
    u.profile_pic AS avatar
  FROM notifications n
  LEFT JOIN users u ON n.actor_user_id = u.id
`;

notificationsRouter.get("/unread-count", protectAdmin, async (req, res) => {
  try {
    const result = await connectionPool.query(
      `
        SELECT COUNT(*)::int AS count
        FROM notifications
        WHERE is_read = FALSE
      `,
    );

    return res.status(200).json({ unreadCount: result.rows[0].count });
  } catch (error) {
    console.error("Failed to fetch unread notification count:", error);
    return res.status(500).json({
      message: "Server could not read unread notification count because database connection",
    });
  }
});

notificationsRouter.patch("/read-all", protectAdmin, async (req, res) => {
  try {
    await connectionPool.query(
      `
        UPDATE notifications
        SET is_read = TRUE
        WHERE is_read = FALSE
      `,
    );

    return res.status(200).json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Failed to mark notifications as read:", error);
    return res.status(500).json({
      message: "Server could not update notifications because database connection",
    });
  }
});

notificationsRouter.get("/", protectAdmin, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);

  try {
    const [listResult, countResult] = await Promise.all([
      connectionPool.query(
        `
          ${notificationSelect}
          ORDER BY n.created_at DESC
          LIMIT $1
        `,
        [limit],
      ),
      connectionPool.query(
        `
          SELECT COUNT(*)::int AS count
          FROM notifications
          WHERE is_read = FALSE
        `,
      ),
    ]);

    return res.status(200).json({
      notifications: listResult.rows,
      unreadCount: countResult.rows[0].count,
    });
  } catch (error) {
    console.error("Failed to fetch notifications:", error);
    return res.status(500).json({
      message: "Server could not read notifications because database connection",
    });
  }
});

export default notificationsRouter;
