import connectionPool from "./db.mjs";

export async function ensureNotificationsTable() {
  await connectionPool.query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      type VARCHAR(50) NOT NULL,
      actor_user_id UUID,
      post_id INTEGER,
      message TEXT NOT NULL,
      link VARCHAR(255) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await connectionPool.query(`
    ALTER TABLE notifications
    ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE
  `);
}

export async function createNotification({
  type,
  actorUserId = null,
  postId = null,
  message,
  link,
}) {
  await connectionPool.query(
    `
      INSERT INTO notifications (type, actor_user_id, post_id, message, link, created_at)
      VALUES ($1, $2, $3, $4, $5, NOW())
    `,
    [type, actorUserId, postId, message, link],
  );
}
