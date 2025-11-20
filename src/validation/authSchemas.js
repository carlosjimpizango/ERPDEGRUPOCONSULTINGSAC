// src/validation/authSchemas.js
import Joi from "joi";

export const loginSchema = Joi.object({
  usuario: Joi.string().max(100).required(),  // UsuarioLogin
  password: Joi.string().min(8).max(128).required()
});
