import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectionPool from "./utils/db.mjs";
import postRouter from "./apps/postRoutes.mjs";
import postsRouter from "./routes/posts.mjs";
import categoriesRouter from "./routes/categories.mjs";
import authRouter from "./routes/auth.mjs";
import notificationsRouter from "./routes/notifications.mjs";
import protectUser from "./middlewares/protectUser.mjs";
import protectAdmin from "./middlewares/protectAdmin.mjs";
import { ensureNotificationsTable } from "./utils/notifications.mjs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000",
  "https://wichapon-dev-blog.vercel.app",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins,
  })
);

app.use(express.json());

let bootstrapPromise = null;

function bootstrapDatabase() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      await connectionPool.query("SELECT 1");
      await connectionPool.query(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS bio VARCHAR(120) DEFAULT ''"
      );
      await ensureNotificationsTable();
    })().catch((error) => {
      bootstrapPromise = null;
      throw error;
    });
  }

  return bootstrapPromise;
}

app.use(async (req, res, next) => {
  try {
    await bootstrapDatabase();
    next();
  } catch (error) {
    console.error("Failed to connect to PostgreSQL:", error.message);
    return res.status(500).json({
      message: "Server could not connect to database",
    });
  }
});

app.get("/health", (req, res) => {
  res.status(200).json({ message: "OK" });
});

app.use("/posts", postRouter);
app.use("/posts", postsRouter);
app.use("/categories", categoriesRouter);
app.use("/auth", authRouter);
app.use("/notifications", notificationsRouter);

app.get("/protected-route", protectUser, (req, res) => {
  res.json({ message: "This is protected content", user: req.user });
});

app.get("/admin-only", protectAdmin, (req, res) => {
  res.json({ message: "This is admin-only content", admin: req.user });
});

if (!process.env.VERCEL) {
  bootstrapDatabase()
    .then(() => {
      console.log("Connected to PostgreSQL");
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error("Failed to connect to PostgreSQL:", error.message);
      console.error("Check CONNECTION_STRING in your .env file");
      process.exit(1);
    });
}

export default app;
