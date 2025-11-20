// src/routes/clientes.routes.js
import express from "express";
import { getPool, sql } from "../config/db.js";
import { requirePermiso } from "../middleware/auth.js";

const router = express.Router();

/**
 * Validación básica de payload de cliente.
 * Aquí podrías usar Joi o express-validator, pero para el curso
 * lo dejamos manual y simple.
 */
function validarClientePayload(body) {
  const errores = [];

  if (!body.nombre || typeof body.nombre !== "string" || body.nombre.trim().length < 3) {
    errores.push(
      "El nombre es obligatorio y debe tener al menos 3 caracteres."
    );
  }

  if (body.correo && typeof body.correo === "string") {
    if (!body.correo.includes("@")) {
      errores.push("El correo no tiene un formato válido.");
    }
  }

  // Podrías agregar más validaciones: longitud máxima, formato de doc, etc.

  return errores;
}

/**
 * GET /api/clientes
 * Lista clientes activos.
 * Protegido por:
 *  - requireAuth (en server.js)
 *  - requirePermiso("CLIENTES", "leer")
 */
router.get(
  "/",
  requirePermiso("CLIENTES", "leer"),
  async (req, res) => {
    try {
      const pool = await getPool();
      const result = await pool.request().query(`
        SELECT
          cliente_id,
          tipo_documento,
          numero_documento,
          nombre,
          correo,
          telefono,
          direccion,
          datos_extra,
          creado_por,
          fecha_creacion,
          modificado_por,
          fecha_modificacion,
          activo
        FROM dbo.Clientes
        WHERE activo = 1
        ORDER BY cliente_id DESC;
      `);

      return res.json(result.recordset || []);
    } catch (err) {
      console.error("Error en GET /api/clientes:", err);
      return res.status(500).json({ message: "Error al listar clientes" });
    }
  }
);

/**
 * GET /api/clientes/:id
 * Obtiene un cliente por ID (solo activos).
 */
router.get(
  "/:id",
  requirePermiso("CLIENTES", "leer"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id || Number.isNaN(id)) {
        return res.status(400).json({ message: "ID de cliente inválido." });
      }

      const pool = await getPool();
      const request = pool.request();
      request.input("Id", sql.Int, id);

      const result = await request.query(`
        SELECT
          cliente_id,
          tipo_documento,
          numero_documento,
          nombre,
          correo,
          telefono,
          direccion,
          datos_extra,
          creado_por,
          fecha_creacion,
          modificado_por,
          fecha_modificacion,
          activo
        FROM dbo.Clientes
        WHERE cliente_id = @Id
          AND activo = 1;
      `);

      if (result.recordset.length === 0) {
        return res.status(404).json({ message: "Cliente no encontrado." });
      }

      return res.json(result.recordset[0]);
    } catch (err) {
      console.error("Error en GET /api/clientes/:id:", err);
      return res.status(500).json({ message: "Error al obtener cliente" });
    }
  }
);

/**
 * POST /api/clientes
 * Crea un nuevo cliente.
 * Usa req.user.IdUsuario en creado_por.
 */
router.post(
  "/",
  requirePermiso("CLIENTES", "crear"),
  async (req, res) => {
    try {
      const errores = validarClientePayload(req.body || {});
      if (errores.length > 0) {
        return res.status(400).json({ message: "Datos inválidos", errors: errores });
      }

      const {
        tipo_documento = null,
        numero_documento = null,
        nombre,
        correo = null,
        telefono = null,
        direccion = null,
        datos_extra = null
      } = req.body || {};

      const userId = parseInt(req.user.IdUsuario, 10);

      const pool = await getPool();
      const request = pool.request();
      request.input("tipo_documento", sql.NVarChar(20), tipo_documento);
      request.input("numero_documento", sql.NVarChar(50), numero_documento);
      request.input("nombre", sql.NVarChar(255), nombre.trim());
      request.input("correo", sql.NVarChar(255), correo);
      request.input("telefono", sql.NVarChar(50), telefono);
      request.input("direccion", sql.NVarChar(500), direccion);
      request.input("datos_extra", sql.NVarChar(sql.MAX), datos_extra);
      request.input("creado_por", sql.Int, userId);

      // IMPORTANTE: sin OUTPUT para evitar el problema con triggers
      const result = await request.query(`
        DECLARE @NuevoId INT;

        INSERT INTO dbo.Clientes (
          tipo_documento,
          numero_documento,
          nombre,
          correo,
          telefono,
          direccion,
          datos_extra,
          creado_por,
          activo
        )
        VALUES (
          @tipo_documento,
          @numero_documento,
          @nombre,
          @correo,
          @telefono,
          @direccion,
          @datos_extra,
          @creado_por,
          1
        );

        SET @NuevoId = SCOPE_IDENTITY();

        SELECT
          cliente_id,
          tipo_documento,
          numero_documento,
          nombre,
          correo,
          telefono,
          direccion,
          datos_extra,
          creado_por,
          fecha_creacion,
          modificado_por,
          fecha_modificacion,
          activo
        FROM dbo.Clientes
        WHERE cliente_id = @NuevoId;
      `);

      const nuevo = result.recordset[0];
      return res.status(201).json(nuevo);
    } catch (err) {
      console.error("Error en POST /api/clientes:", err);
      return res.status(500).json({ message: "Error al crear cliente" });
    }
  }
);

/**
 * PUT /api/clientes/:id
 * Actualiza un cliente existente.
 * Usa req.user.IdUsuario en modificado_por.
 */
router.put(
  "/:id",
  requirePermiso("CLIENTES", "actualizar"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id || Number.isNaN(id)) {
        return res.status(400).json({ message: "ID de cliente inválido." });
      }

      const errores = validarClientePayload(req.body || {});
      if (errores.length > 0) {
        return res.status(400).json({ message: "Datos inválidos", errors: errores });
      }

      const {
        tipo_documento = null,
        numero_documento = null,
        nombre,
        correo = null,
        telefono = null,
        direccion = null,
        datos_extra = null,
        activo = true
      } = req.body || {};

      const userId = parseInt(req.user.IdUsuario, 10);

      const pool = await getPool();
      const request = pool.request();
      request.input("Id", sql.Int, id);
      request.input("tipo_documento", sql.NVarChar(20), tipo_documento);
      request.input("numero_documento", sql.NVarChar(50), numero_documento);
      request.input("nombre", sql.NVarChar(255), nombre.trim());
      request.input("correo", sql.NVarChar(255), correo);
      request.input("telefono", sql.NVarChar(50), telefono);
      request.input("direccion", sql.NVarChar(500), direccion);
      request.input("datos_extra", sql.NVarChar(sql.MAX), datos_extra);
      request.input("modificado_por", sql.Int, userId);
      request.input("activo", sql.Bit, activo ? 1 : 0);

      const result = await request.query(`
        UPDATE dbo.Clientes
        SET
          tipo_documento      = @tipo_documento,
          numero_documento    = @numero_documento,
          nombre              = @nombre,
          correo              = @correo,
          telefono            = @telefono,
          direccion           = @direccion,
          datos_extra         = @datos_extra,
          modificado_por      = @modificado_por,
          fecha_modificacion  = SYSUTCDATETIME(),
          activo              = @activo
        WHERE cliente_id = @Id;

        SELECT
          cliente_id,
          tipo_documento,
          numero_documento,
          nombre,
          correo,
          telefono,
          direccion,
          datos_extra,
          creado_por,
          fecha_creacion,
          modificado_por,
          fecha_modificacion,
          activo
        FROM dbo.Clientes
        WHERE cliente_id = @Id;
      `);

      if (result.recordset.length === 0) {
        return res.status(404).json({ message: "Cliente no encontrado." });
      }

      return res.json(result.recordset[0]);
    } catch (err) {
      console.error("Error en PUT /api/clientes/:id:", err);
      return res.status(500).json({ message: "Error al actualizar cliente" });
    }
  }
);

/**
 * DELETE /api/clientes/:id
 * Eliminación lógica: activo = 0
 * Usa req.user.IdUsuario en modificado_por.
 */
router.delete(
  "/:id",
  requirePermiso("CLIENTES", "eliminar"),
  async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (!id || Number.isNaN(id)) {
        return res.status(400).json({ message: "ID de cliente inválido." });
      }

      const userId = parseInt(req.user.IdUsuario, 10);

      const pool = await getPool();
      const request = pool.request();
      request.input("Id", sql.Int, id);
      request.input("modificado_por", sql.Int, userId);

      const result = await request.query(`
        UPDATE dbo.Clientes
        SET
          activo             = 0,
          modificado_por     = @modificado_por,
          fecha_modificacion = SYSUTCDATETIME()
        WHERE cliente_id = @Id;

        SELECT @@ROWCOUNT AS Filas;
      `);

      const filas = result.recordset[0]?.Filas || 0;

      if (!filas) {
        return res.status(404).json({ message: "Cliente no encontrado." });
      }

      return res.json({ message: "Cliente desactivado correctamente." });
    } catch (err) {
      console.error("Error en DELETE /api/clientes/:id:", err);
      return res.status(500).json({ message: "Error al desactivar cliente" });
    }
  }
);

export default router;
