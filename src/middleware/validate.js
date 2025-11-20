// src/middleware/validate.js
export const validateBody =
  (schema) =>
  (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        message: "Datos inválidos",
        detalles: error.details.map((d) => d.message)
      });
    }

    req.body = value;
    next();
  };
