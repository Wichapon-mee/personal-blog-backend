import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import pool from "./db.mjs";
import postsRouter from "./routes/posts.mjs";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json());

// ✅ ใส่ CORS ตรงนี้ (หลังสร้าง app และก่อน routes)
app.use(
  cors({
    origin: [
      "http://localhost:5173", // Frontend local (Vite)
      "http://localhost:3000", // Frontend local (React แบบอื่น)
      "https://your-frontend.vercel.app", // Frontend ที่ Deploy แล้ว
      // ✅ ให้เปลี่ยน https://your-frontend.vercel.app เป็น URL จริงของ Frontend ที่ deploy แล้ว
    ],
  })
);

app.get("/health", (req, res) => {
  res.status(200).json({ message: "OK" });
});

app.use("/posts", postsRouter);

pool
  .query("SELECT 1")
  .then(() => {
    console.log("Connected to PostgreSQL");
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to connect to PostgreSQL:", error.message);
    console.error("Check DATABASE_URL in your .env file");
    process.exit(1);
  });