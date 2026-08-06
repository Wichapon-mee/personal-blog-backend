import "dotenv/config";
import { Router } from "express";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";
import connectionPool from "../utils/db.mjs";
import {
  buildProfileImagePath,
  uploadImageFile,
} from "../utils/supabaseStorage.mjs";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const authRouter = Router();

const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
});

const profilePictureUpload = multerUpload.single("profileFile");

async function getUserIdFromToken(token) {
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

authRouter.post("/register", async (req, res) => {
  const { email, password, username, name } = req.body;

  try {
    const usernameCheckQuery = `
      SELECT * FROM users
      WHERE username = $1
    `;
    const usernameCheckValues = [username];
    const { rows: existingUser } = await connectionPool.query(
      usernameCheckQuery,
      usernameCheckValues
    );

    if (existingUser.length > 0) {
      return res.status(400).json({ error: "This username is already taken" });
    }

    const { data, error: supabaseError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (supabaseError) {
      if (supabaseError.code === "user_already_exists") {
        return res
          .status(400)
          .json({ error: "User with this email already exists" });
      }
      return res
        .status(400)
        .json({ error: "Failed to create user. Please try again." });
    }

    const supabaseUserId = data.user.id;
    const query = `
      INSERT INTO users (id, username, name, role)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `;
    const values = [supabaseUserId, username, name, "user"];
    const { rows } = await connectionPool.query(query, values);

    res.status(201).json({
      message: "User created successfully",
      user: rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: "An error occurred during registration" });
  }
});

authRouter.post("/login", async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) {
      if (
        error.code === "invalid_credentials" ||
        error.message.includes("Invalid login credentials")
      ) {
        return res.status(400).json({
          error: "Your password is incorrect or this email doesn't exist",
        });
      }
      return res.status(400).json({ error: error.message });
    }
    return res.status(200).json({
      message: "Signed in successfully",
      access_token: data.session.access_token,
    });
  } catch (error) {
    return res.status(500).json({ error: "An error occurred during login" });
  }
});

authRouter.get("/get-user", async (req, res) => { 
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Token missing" });
  }
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      return res.status(401).json({ error: "Unauthorized or token expired" });
    }
    const supabaseUserId = data.user.id;
    const query = `
      SELECT * FROM users
      WHERE id = $1
    `;
    const values = [supabaseUserId];
    const { rows } = await connectionPool.query(query, values);

    if (rows.length === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json({
      id: data.user.id,
      email: data.user.email,
      username: rows[0].username,
      name: rows[0].name,
      role: rows[0].role,
      profilePic: rows[0].profile_pic,
      bio: rows[0].bio || "",
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});

authRouter.put("/profile", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const { name, username, bio } = req.body;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Token missing" });
  }

  if (!name?.trim() || !username?.trim()) {
    return res.status(400).json({ error: "Name and username are required" });
  }

  if (bio != null && String(bio).length > 120) {
    return res.status(400).json({ error: "Bio must be at most 120 characters" });
  }

  try {
    const userId = await getUserIdFromToken(token);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized or token expired" });
    }

    const usernameCheck = await connectionPool.query(
      "SELECT id FROM users WHERE username = $1 AND id <> $2",
      [username.trim(), userId]
    );

    if (usernameCheck.rowCount > 0) {
      return res.status(400).json({ error: "This username is already taken" });
    }

    const result = await connectionPool.query(
      `
        UPDATE users
        SET name = $1, username = $2, bio = $3
        WHERE id = $4
        RETURNING id, username, name, role, profile_pic, bio
      `,
      [name.trim(), username.trim(), bio?.trim() || "", userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const { data } = await supabase.auth.getUser(token);

    return res.status(200).json({
      message: "Profile updated successfully",
      user: {
        id: result.rows[0].id,
        email: data.user.email,
        username: result.rows[0].username,
        name: result.rows[0].name,
        role: result.rows[0].role,
        profilePic: result.rows[0].profile_pic,
        bio: result.rows[0].bio || "",
      },
    });
  } catch (error) {
    console.error("Failed to update profile:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

authRouter.put("/profile-picture", profilePictureUpload, async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Token missing" });
  }

  const file = req.file;

  if (!file) {
    return res.status(400).json({ error: "Profile picture file is required" });
  }

  if (!file.mimetype.startsWith("image/")) {
    return res.status(400).json({ error: "Please select an image file" });
  }

  try {
    const userId = await getUserIdFromToken(token);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized or token expired" });
    }

    const storagePath = buildProfileImagePath(userId, file.originalname);
    const publicUrl = await uploadImageFile(file, storagePath);

    const result = await connectionPool.query(
      `
        UPDATE users
        SET profile_pic = $1
        WHERE id = $2
        RETURNING id, username, name, role, profile_pic, bio
      `,
      [publicUrl, userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "User not found" });
    }

    const { data } = await supabase.auth.getUser(token);

    return res.status(200).json({
      message: "Profile picture updated successfully",
      user: {
        id: result.rows[0].id,
        email: data.user.email,
        username: result.rows[0].username,
        name: result.rows[0].name,
        role: result.rows[0].role,
        profilePic: result.rows[0].profile_pic,
        bio: result.rows[0].bio || "",
      },
    });
  } catch (error) {
    console.error("Failed to update profile picture:", error);
    return res.status(500).json({
      error: "Internal server error",
      message: error.message,
    });
  }
});

authRouter.put("/reset-password", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const { oldPassword, newPassword } = req.body;

  if (!token) {
    return res.status(401).json({ error: "Unauthorized: Token missing" });
  }
  if (!newPassword) {
    return res.status(400).json({ error: "New password is required" });
  }

  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error) {
      return res.status(401).json({ error: "Unauthorized or token expired" });
    }

    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: data.user.email,
      password: oldPassword,
    });

    if (loginError) {
      return res.status(400).json({ error: "Invalid old password" });
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      return res.status(400).json({ error: updateError.message });
    }

    return res.status(200).json({ message: "Password updated successfully" });
  } catch (error) {
    return res.status(500).json({ error: "Internal server error" });
  }
});

authRouter.get("/author-profile", async (req, res) => {
  try {
    const result = await connectionPool.query(
      `
        SELECT name, profile_pic, bio
        FROM users
        WHERE role = 'admin'
        ORDER BY name ASC
        LIMIT 1
      `,
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Author profile not found" });
    }

    const author = result.rows[0];

    return res.status(200).json({
      name: author.name,
      profilePic: author.profile_pic,
      bio: author.bio || "",
    });
  } catch (error) {
    console.error("Failed to fetch author profile:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default authRouter;
