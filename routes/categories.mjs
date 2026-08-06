import { Router } from "express";
import connectionPool from "../utils/db.mjs";
import protectAdmin from "../middlewares/protectAdmin.mjs";

const categoriesRouter = Router();

categoriesRouter.get("/", async (req, res) => {
  const keyword = req.query.keyword?.trim() || null;

  try {
    let query = "SELECT id, name FROM categories";
    const values = [];

    if (keyword) {
      query += " WHERE name ILIKE $1";
      values.push(`%${keyword}%`);
    }

    query += " ORDER BY name ASC";

    const result = await connectionPool.query(query, values);

    return res.status(200).json({ categories: result.rows });
  } catch (error) {
    console.error("Failed to fetch categories:", error);
    return res.status(500).json({
      message: "Server could not read categories because database connection",
    });
  }
});

categoriesRouter.get("/:categoryId", async (req, res) => {
  const categoryId = Number(req.params.categoryId);

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.status(404).json({ message: "Category not found" });
  }

  try {
    const result = await connectionPool.query(
      "SELECT id, name FROM categories WHERE id = $1",
      [categoryId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error("Failed to fetch category:", error);
    return res.status(500).json({
      message: "Server could not read category because database connection",
    });
  }
});

categoriesRouter.post("/", protectAdmin, async (req, res) => {
  const { name } = req.body;
  const trimmedName = name?.trim();

  if (!trimmedName) {
    return res.status(400).json({ error: "Category name is required" });
  }

  try {
    const existing = await connectionPool.query(
      "SELECT id FROM categories WHERE LOWER(name) = LOWER($1)",
      [trimmedName]
    );

    if (existing.rowCount > 0) {
      return res.status(400).json({ error: "This category already exists" });
    }

    const result = await connectionPool.query(
      "INSERT INTO categories (name) VALUES ($1) RETURNING id, name",
      [trimmedName]
    );

    return res.status(201).json({
      message: "Category created successfully",
      category: result.rows[0],
    });
  } catch (error) {
    console.error("Failed to create category:", error);
    return res.status(500).json({
      message: "Server could not create category because database connection",
    });
  }
});

categoriesRouter.put("/:categoryId", protectAdmin, async (req, res) => {
  const categoryId = Number(req.params.categoryId);
  const { name } = req.body;
  const trimmedName = name?.trim();

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.status(404).json({ message: "Category not found" });
  }

  if (!trimmedName) {
    return res.status(400).json({ error: "Category name is required" });
  }

  try {
    const existingCategory = await connectionPool.query(
      "SELECT id FROM categories WHERE id = $1",
      [categoryId]
    );

    if (existingCategory.rowCount === 0) {
      return res.status(404).json({ message: "Category not found" });
    }

    const duplicate = await connectionPool.query(
      "SELECT id FROM categories WHERE LOWER(name) = LOWER($1) AND id <> $2",
      [trimmedName, categoryId]
    );

    if (duplicate.rowCount > 0) {
      return res.status(400).json({ error: "This category already exists" });
    }

    const result = await connectionPool.query(
      "UPDATE categories SET name = $1 WHERE id = $2 RETURNING id, name",
      [trimmedName, categoryId]
    );

    return res.status(200).json({
      message: "Category updated successfully",
      category: result.rows[0],
    });
  } catch (error) {
    console.error("Failed to update category:", error);
    return res.status(500).json({
      message: "Server could not update category because database connection",
    });
  }
});

categoriesRouter.delete("/:categoryId", protectAdmin, async (req, res) => {
  const categoryId = Number(req.params.categoryId);

  if (!Number.isInteger(categoryId) || categoryId <= 0) {
    return res.status(404).json({ message: "Category not found" });
  }

  try {
    const postsUsingCategory = await connectionPool.query(
      "SELECT id FROM posts WHERE category_id = $1 LIMIT 1",
      [categoryId]
    );

    if (postsUsingCategory.rowCount > 0) {
      return res.status(400).json({
        error: "Cannot delete category that is used by existing articles",
      });
    }

    const result = await connectionPool.query(
      "DELETE FROM categories WHERE id = $1 RETURNING id",
      [categoryId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.status(200).json({ message: "Category deleted successfully" });
  } catch (error) {
    console.error("Failed to delete category:", error);
    return res.status(500).json({
      message: "Server could not delete category because database connection",
    });
  }
});

export default categoriesRouter;
