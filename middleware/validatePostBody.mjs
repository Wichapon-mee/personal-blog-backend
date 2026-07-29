const postBodyRules = [
  {
    key: "title",
    type: "string",
    requiredMessage: "Title is required",
    typeMessage: "Title must be a string",
  },
  {
    key: "image",
    type: "string",
    requiredMessage: "Image is required",
    typeMessage: "Image must be a string",
  },
  {
    key: "category_id",
    type: "number",
    requiredMessage: "Category id is required",
    typeMessage: "Category id must be a number",
  },
  {
    key: "description",
    type: "string",
    requiredMessage: "Description is required",
    typeMessage: "Description must be a string",
  },
  {
    key: "content",
    type: "string",
    requiredMessage: "Content is required",
    typeMessage: "Content must be a string",
  },
  {
    key: "status_id",
    type: "number",
    requiredMessage: "Status id is required",
    typeMessage: "Status id must be a number",
  },
];

function isMissing(value) {
  return value === undefined || value === null || value === "";
}

function validatePostBody(req, res, next) {
  for (const rule of postBodyRules) {
    const value = req.body[rule.key];

    if (isMissing(value)) {
      return res.status(400).json({ message: rule.requiredMessage });
    }

    if (typeof value !== rule.type) {
      return res.status(400).json({ message: rule.typeMessage });
    }
  }

  next();
}

export default validatePostBody;
