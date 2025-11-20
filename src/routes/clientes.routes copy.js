// src/routes/clientes.routes.js
import express from "express";
import { getPool, sql } from "../config/db.js";
import { requireAuth, requirePermiso } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { clienteCreateSchema, clienteUpdateSchema } from "../validation/clienteSchemas.js";
import { registrarAuditoria } from "../utils/auditoria.js";

const router = express.Router();

// LISTAR CLIENTES (activos)
router.get(
  "/",
  requireAuth,
  requirePermiso("CLIENTES", "leer"),
  async (req, res) => {
    try {
      const pool = await getPool();
      const request = pool.request();
      request.input("nombre", sql.NVarChar(255), req.query.nombre || null);

      const result = await request.query(`
        SELECT cliente_id, tipo_documento, numero_documento, nombre,
               correo, telefono, direccion, datos_extra,
               creado_por, fecha_creacion, modificado_por, fecha_modificacion, activo
        FROM Clientes
        WHERE (@nombre IS NULL OR nombre LIKE '%' + @nombre + '%')
          AND activo = 1
        ORDER BY fecha_creacion DESC
      `);

      return res.json(result.recordset);
    } catch (err) {
      console.error("Error en GET /clientes:", err);
      return res.status(500).json({ message: "Error interno" });
    }
  }
);

// OBTENER CLIENTE POR ID
router.get(
  "/:id",
  requireAuth,
  requirePermiso("CLIENTES", "leer"),
  async (req, res) => {
    try {
      const pool = await getPool();
      const request = pool.request();
      request.input("cliente_id", sql.Int, Number(req.params.id));

      const result = await request.query(`
        SELECT cliente_id, tipo_documento, numero_documento, nombre,
               correo, telefono, direccion, datos_extra,
               creado_por, fecha_creacion, modificado_por, fecha_modificacion, activo
        FROM Clientes
        WHERE cliente_id = @cliente_id
      `);

      if (result.recordset.length === 0) {
        return res.status(404).json({ message: "Cliente no encontrado" });
      }

      return res.json(result.recordset[0]);
    } catch (err) {
      console.error("Error en GET /clientes/:id:", err);
      return res.status(500).json({ message: "Error interno" });
    }
  }
);

// CREAR CLIENTE
router.post(
  "/",
  requireAuth,
  requirePermiso("CLIENTES", "crear"),
  validateBody(clienteCreateSchema),
  async (req, res) => {
    try {
      const pool = await getPool();
      const {
        tipo_documento,
        numero_documento,
        nombre,
        correo,
        telefono,
        direccion,
        datos_extra
      } = req.body;

      const request = pool.request();
      request.input("tipo_documento", sql.NVarChar(20), tipo_documento || null);
      request.input("numero_documento", sql.NVarChar(50), numero_documento || null);
      request.input("nombre", sql.NVarChar(255), nombre);
      request.input("correo", sql.NVarChar(255), correo || null);
      request.input("telefono", sql.NVarChar(50), telefono || null);
      request.input("direccion", sql.NVarChar(500), direccion || null);
      request.input("datos_extra", sql.NVarChar(sql.MAX), datos_extra || null);
      request.input("creado_por", sql.Int, req.user.IdUsuario);

      const result = await request.query(`
        INSERT INTO Clientes (
          tipo_documento, numero_documento, nombre,
          correo, telefono, direccion, datos_extra,
          creado_por, activo
        )
        OUTPUT INSERTED.*
        VALUES (
          @tipo_documento, @numero_documento, @nombre,
          @correo, @telefono, @direccion, @datos_extra,
          @creado_por, 1
        )
      `);

      const cliente = result.recordset[0];

      await registrarAuditoria({
        entidad: "Clientes",
        entidad_id: String(cliente.cliente_id),
        operacion: "CREATE",
        realizado_por: req.user.IdUsuario,
        detalles: JSON.stringify({ nombre: cliente.nombre, numero_documento: cliente.numero_documento }),
        ip: req.ip
      });

      return res.status(201).json(cliente);
    } catch (err) {
      console.error("Error en POST /clientes:", err);
      return res.status(500).json({ message: "Error interno" });
    }
  }
);

// ACTUALIZAR CLIENTE
router.put(
  "/:id",
  requireAuth,
  requirePermiso("CLIENTES", "actualizar"),
  validateBody(clienteUpdateSchema),
  async (req, res) => {
    try {
      const pool = await getPool();
      const id = Number(req.params.id);

      let request = pool.request();
      request.input("cliente_id", sql.Int, id);
      let result = await request.query(`
        SELECT cliente_id FROM Clientes WHERE cliente_id = @cliente_id
      `);

      if (result.recordset.length === 0) {
        return res.status(404).json({ message: "Cliente no encontrado" });
      }

      const {
        tipo_documento,
        numero_documento,
        nombre,
        correo,
        telefono,
        direccion,
        datos_extra,
        activo
      } = req.body;

      request = pool.request();
      request.input("cliente_id", sql.Int, id);
      request.input("tipo_documento", sql.NVarChar(20), tipo_documento || null);
      request.input("numero_documento", sql.NVarChar(50), numero_documento || null);
      request.input("nombre", sql.NVarChar(255), nombre);
      request.input("correo", sql.NVarChar(255), correo || null);
      request.input("telefono", sql.NVarChar(50), telefono || null);
      request.input("direccion", sql.NVarChar(500), direccion || null);
      request.input("datos_extra", sql.NVarChar(sql.MAX), datos_extra || null);
      request.input("modificado_por", sql.Int, req.user.IdUsuario);
      request.input("activo", sql.Bit, typeof activo === "boolean" ? activo : 1);

      result = await request.query(`
        UPDATE Clientes
        SET tipo_documento = @tipo_documento,
            numero_documento = @numero_documento,
            nombre = @nombre,
            correo = @correo,
            telefono = @telefono,
            direccion = @direccion,
            datos_extra = @datos_extra,
            modificado_por = @modificado_por,
            fecha_modificacion = SYSDATETIMEOFFSET(),
            activo = @activo
        OUTPUT INSERTED.*
        WHERE cliente_id = @cliente_id
      `);

      const cliente = result.recordset[0];

      await registrarAuditoria({
        entidad: "Clientes",
        entidad_id: String(cliente.cliente_id),
        operacion: "UPDATE",
        realizado_por: req.user.IdUsuario,
        detalles: JSON.stringify({ nombre: cliente.nombre }),
        ip: req.ip
      });

      return res.json(cliente);
    } catch (err) {
      console.error("Error en PUT /clientes/:id:", err);
      return res.status(500).json({ message: "Error interno" });
    }
  }
);

// ELIMINAR (borrado lógico)
router.delete(
  "/:id",
  requireAuth,
  requirePermiso("CLIENTES", "eliminar"),
  async (req, res) => {
    try {
      const pool = await getPool();
      const id = Number(req.params.id);

      let request = pool.request();
      request.input("cliente_id", sql.Int, id);
      let result = await request.query(`
        SELECT cliente_id, nombre FROM Clientes WHERE cliente_id = @cliente_id
      `);

      if (result.recordset.length === 0) {
        return res.status(404).json({ message: "Cliente no encontrado" });
      }

      const cliente = result.recordset[0];

      request = pool.request();
      request.input("cliente_id", sql.Int, id);
      request.input("modificado_por", sql.Int, req.user.IdUsuario);
      await request.query(`
        UPDATE Clientes
        SET activo = 0,
            modificado_por = @modificado_por,
            fecha_modificacion = SYSDATETIMEOFFSET()
        WHERE cliente_id = @cliente_id
      `);

      await registrarAuditoria({
        entidad: "Clientes",
        entidad_id: String(cliente.cliente_id),
        operacion: "DELETE",
        realizado_por: req.user.IdUsuario,
        detalles: JSON.stringify({ nombre: cliente.nombre }),
        ip: req.ip
      });

      return res.json({ message: "Cliente desactivado correctamente" });
    } catch (err) {
      console.error("Error en DELETE /clientes/:id:", err);
      return res.status(500).json({ message: "Error interno" });
    }
  }
);

export default router;
