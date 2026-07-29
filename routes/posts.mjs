import { Router } from "express";
import pool from "../db.mjs";
import validatePostBody from "../middleware/validatePostBody.mjs";

const postsRouter = Router();

postsRouter.get("/", async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.max(1, Number(req.query.limit) || 6);
  const category = req.query.category || null;
  const keyword = req.query.keyword || null;
  const offset = (page - 1) * limit;

  const conditions = [];
  const values = [];
  let paramIndex = 1;

  if (category) {
    conditions.push(`c.name = $${paramIndex}`);
    values.push(category);
    paramIndex++;
  }

  if (keyword) {
    const keywordPattern = `%${keyword}%`;
    conditions.push(`(
      p.title ILIKE $${paramIndex} OR
      p.description ILIKE $${paramIndex + 1} OR
      p.content ILIKE $${paramIndex + 2}
    )`);
    values.push(keywordPattern, keywordPattern, keywordPattern);
    paramIndex += 3;
  }

  const whereClause =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  try {
    const countResult = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM posts p
        INNER JOIN categories c ON p.category_id = c.id
        INNER JOIN statuses s ON p.status_id = s.id
        ${whereClause}
      `,
      values
    );

    const totalPosts = countResult.rows[0].total;
    const totalPages = Math.ceil(totalPosts / limit);
    const nextPage = page < totalPages ? page + 1 : null;

    const postsResult = await pool.query(
      `
        SELECT
          p.id,
          p.image,
          c.name AS category,
          p.title,
          p.description,
          NULL AS author,
          p.date,
          p.likes_count AS likes,
          p.content
        FROM posts p
        INNER JOIN categories c ON p.category_id = c.id
        INNER JOIN statuses s ON p.status_id = s.id
        ${whereClause}
        ORDER BY p.date DESC
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `,
      [...values, limit, offset]
    );

    return res.status(200).json({
      totalPosts,
      totalPages,
      currentPage: page,
      limit,
      posts: postsResult.rows,
      nextPage,
    });
  } catch (error) {
    console.error("Failed to fetch posts:", error);
    return res.status(500).json({
      message: "Server could not read post because database connection",
    });
  }
});

postsRouter.get("/:postId", async (req, res) => {
  const postId = Number(req.params.postId);

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(404).json({
      message: "Server could not find a requested post",
    });
  }

  try {
    const result = await pool.query(
      `
        SELECT
          p.id,
          p.image,
          c.name AS category,
          p.title,
          p.description,
          p.date,
          p.content,
          s.status,
          p.likes_count
        FROM posts p
        INNER JOIN categories c ON p.category_id = c.id
        INNER JOIN statuses s ON p.status_id = s.id
        WHERE p.id = $1
      `,
      [postId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Server could not find a requested post",
      });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Failed to fetch post:", error);
    return res.status(500).json({
      message: "Server could not read post because database connection",
    });
  }
});

postsRouter.post("/", validatePostBody, async (req, res) => {
  const { title, image, category_id, description, content, status_id } =
    req.body;

  try {
    await pool.query(
      `
        INSERT INTO posts (
          title,
          image,
          category_id,
          description,
          content,
          status_id,
          date,
          likes_count
        )
        VALUES ($1, $2, $3, $4, $5, $6, NOW(), 0)
      `,
      [title, image, category_id, description, content, status_id]
    );

    return res.status(201).json({
      message: "Created post successfully",
    });
  } catch (error) {
    console.error("Failed to create post:", error);
    return res.status(500).json({
      message: "Server could not create post because database connection",
    });
  }
});

postsRouter.put("/:postId", validatePostBody, async (req, res) => {
  const postId = Number(req.params.postId);
  const { title, image, category_id, description, content, status_id } =
    req.body;

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(404).json({
      message: "Server could not find a requested post to update",
    });
  }

  try {
    const existingPost = await pool.query(
      "SELECT id FROM posts WHERE id = $1",
      [postId]
    );

    if (existingPost.rowCount === 0) {
      return res.status(404).json({
        message: "Server could not find a requested post to update",
      });
    }

    await pool.query(
      `
        UPDATE posts
        SET
          title = $1,
          image = $2,
          category_id = $3,
          description = $4,
          content = $5,
          status_id = $6
        WHERE id = $7
      `,
      [title, image, category_id, description, content, status_id, postId]
    );

    return res.status(200).json({
      message: "Updated post sucessfully",
    });
  } catch (error) {
    console.error("Failed to update post:", error);
    return res.status(500).json({
      message: "Server could not update post because database connection",
    });
  }
});

postsRouter.delete("/:postId", async (req, res) => {
  const postId = Number(req.params.postId);

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(404).json({
      message: "Server could not find a requested post to delete",
    });
  }

  try {
    const result = await pool.query(
      "DELETE FROM posts WHERE id = $1 RETURNING id",
      [postId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        message: "Server could not find a requested post to delete",
      });
    }

    return res.status(200).json({
      message: "Deleted post successfully",
    });
  } catch (error) {
    console.error("Failed to delete post:", error);
    return res.status(500).json({
      message: "Server could not delete post because database connection",
    });
  }
});

export default postsRouter;
