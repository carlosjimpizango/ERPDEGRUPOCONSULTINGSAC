// src/validation/clienteSchemas.js
import Joi from "joi";

export const clienteCreateSchema = Joi.object({
  tipo_documento: Joi.string().max(20).allow(null, ""),
  numero_documento: Joi.string().max(50).allow(null, ""),
  nombre: Joi.string().max(255).required(),
  correo: Joi.string().email().max(255).allow(null, ""),
  telefono: Joi.string().max(50).allow(null, ""),
  direccion: Joi.string().max(500).allow(null, ""),
  datos_extra: Joi.string().allow(null, "")
});

export const clienteUpdateSchema = Joi.object({
  tipo_documento: Joi.string().max(20).allow(null, ""),
  numero_documento: Joi.string().max(50).allow(null, ""),
  nombre: Joi.string().max(255).required(),
  correo: Joi.string().email().max(255).allow(null, ""),
  telefono: Joi.string().max(50).allow(null, ""),
  direccion: Joi.string().max(500).allow(null, ""),
  datos_extra: Joi.string().allow(null, ""),
  activo: Joi.boolean().optional()
});
