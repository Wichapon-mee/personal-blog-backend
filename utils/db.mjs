// Create PostgreSQL Connection Pool here !
import * as pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg.default;

const connectionPool = new Pool({
  // ตรงนี้ต้องเปลี่ยน conimage.pngnectionString เป็นของตัวเองด้วยนะ
  connectionString: process.env.CONNECTION_STRING,
  ssl: { rejectUnauthorized: false },
});

export default connectionPool;
