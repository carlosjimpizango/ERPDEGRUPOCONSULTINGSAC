// src/utils/auditoria.js
import { getPool, sql } from "../config/db.js";

export async function registrarAuditoria({
  entidad,
  entidad_id = null,
  operacion,
  realizado_por = null,
  detalles = null,
  ip = null
}) {
  try {
    const pool = await getPool();
    const request = pool.request();
    request.input("entidad", sql.NVarChar(120), entidad);
    request.input("entidad_id", sql.NVarChar(100), entidad_id);
    request.input("operacion", sql.NVarChar(20), operacion);
    request.input("realizado_por", sql.Int, realizado_por);
    request.input("detalles", sql.NVarChar(sql.MAX), detalles);
    request.input("ip", sql.NVarChar(50), ip);

    await request.query(`
      INSERT INTO Auditoria (entidad, entidad_id, operacion, realizado_por, detalles, ip)
      VALUES (@entidad, @entidad_id, @operacion, @realizado_por, @detalles, @ip)
    `);
  } catch (err) {
    // Si falla la auditoría, no rompemos la app, solo log
    console.error("Error registrando auditoría:", err.message);
  }
}
