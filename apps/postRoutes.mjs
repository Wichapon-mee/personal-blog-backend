import "dotenv/config";
import { Router } from "express";
import connectionPool from "../utils/db.mjs";
import protectAdmin from "../middlewares/protectAdmin.mjs";
import multer from "multer";
import { createNotification } from "../utils/notifications.mjs";
import {
  buildPostImagePath,
  uploadImageFile,
} from "../utils/supabaseStorage.mjs";

const postRouter = Router();

const multerUpload = multer({ storage: multer.memoryStorage() });

const imageFileUpload = multerUpload.fields([
  { name: "imageFile", maxCount: 1 },
]);

async function uploadImageToStorage(file) {
  return uploadImageFile(file, buildPostImagePath(file.originalname));
}

postRouter.post("/", [imageFileUpload, protectAdmin], async (req, res) => {
  try {
    const newPost = req.body;
    const file = req.files?.imageFile?.[0];

    if (!file) {
      return res.status(400).json({ message: "Image file is required" });
    }

    const publicUrl = await uploadImageToStorage(file);

    const query = `
      INSERT INTO posts (title, image, category_id, description, content, status_id, date, likes_count)
      VALUES ($1, $2, $3, $4, $5, $6, NOW(), 0)
      RETURNING id
    `;
    const values = [
      newPost.title,
      publicUrl,
      parseInt(newPost.category_id, 10),
      newPost.description,
      newPost.content,
      parseInt(newPost.status_id, 10),
    ];

    const result = await connectionPool.query(query, values);
    const postId = result.rows[0].id;
    const isDraft = Number(newPost.status_id) === 1;

    await createNotification({
      type: isDraft ? "article_draft" : "article_published",
      actorUserId: req.user.id,
      postId,
      message: isDraft
        ? `Saved a new draft article "${newPost.title}".`
        : `Published new article "${newPost.title}".`,
      link: `/admin/articles/${postId}/edit`,
    });

    return res.status(201).json({ message: "Created post successfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server could not create post",
      error: err.message,
    });
  }
});

postRouter.put("/:postId", [imageFileUpload, protectAdmin], async (req, res) => {
  const postId = Number(req.params.postId);

  if (!Number.isInteger(postId) || postId <= 0) {
    return res.status(404).json({
      message: "Server could not find a requested post to update",
    });
  }

  try {
    const updatedPost = req.body;
    const file = req.files?.imageFile?.[0];

    const existingPost = await connectionPool.query(
      "SELECT id, image FROM posts WHERE id = $1",
      [postId],
    );

    if (existingPost.rowCount === 0) {
      return res.status(404).json({
        message: "Server could not find a requested post to update",
      });
    }

    let imageUrl = updatedPost.image || existingPost.rows[0].image;

    if (file) {
      imageUrl = await uploadImageToStorage(file);
    }

    if (!imageUrl) {
      return res.status(400).json({ message: "Image is required" });
    }

    await connectionPool.query(
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
      [
        updatedPost.title,
        imageUrl,
        parseInt(updatedPost.category_id, 10),
        updatedPost.description,
        updatedPost.content,
        parseInt(updatedPost.status_id, 10),
        postId,
      ],
    );

    const isDraft = Number(updatedPost.status_id) === 1;

    await createNotification({
      type: isDraft ? "article_updated_draft" : "article_updated",
      actorUserId: req.user.id,
      postId,
      message: isDraft
        ? `Updated draft article "${updatedPost.title}".`
        : `Updated published article "${updatedPost.title}".`,
      link: `/admin/articles/${postId}/edit`,
    });

    return res.status(200).json({ message: "Updated post sucessfully" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      message: "Server could not update post",
      error: err.message,
    });
  }
});

export default postRouter;
