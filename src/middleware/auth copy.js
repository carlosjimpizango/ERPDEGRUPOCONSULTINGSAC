// src/middleware/auth.js
import { getPool, sql } from "../config/db.js";

// Autenticación basada en SesionesSeguras + cookie "sid"
export async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.sid;
    if (!token) {
      return res.status(401).json({ message: "No autenticado" });
    }

    const pool = await getPool();
    const request = pool.request();
    request.input("TokenSesion", sql.VarChar(200), token);

    const result = await request.query(`
      SELECT s.IdSesion, s.IdUsuario, s.FechaExpiracion, s.Estado,
             u.IdUsuario, u.NombreCompleto, u.Correo, u.UsuarioLogin
      FROM SesionesSeguras s
      INNER JOIN Usuarios u ON u.IdUsuario = s.IdUsuario
      WHERE s.TokenSesion = @TokenSesion
    `);

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: "Sesión inválida" });
    }

    const row = result.recordset[0];

    if (!row.Estado) {
      return res.status(401).json({ message: "Sesión desactivada" });
    }

    const ahora = new Date();
    if (ahora > row.FechaExpiracion) {
      const upd = pool.request();
      upd.input("IdSesion", sql.Int, row.IdSesion);
      await upd.query("UPDATE SesionesSeguras SET Estado = 0 WHERE IdSesion = @IdSesion");
      return res.status(401).json({ message: "Sesión expirada" });
    }

    // Usuario autenticado
    req.user = {
      IdUsuario: row.IdUsuario,
      NombreCompleto: row.NombreCompleto,
      Correo: row.Correo,
      UsuarioLogin: row.UsuarioLogin
    };

    next();
  } catch (err) {
    console.error("Error en requireAuth:", err.message);
    return res.status(401).json({ message: "Sesión no válida" });
  }
}

// Autorización basada en Perfiles + Permisos + OpcionesMenu
export function requirePermiso(nombreOpcion, tipoAcceso) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "No autenticado" });
      }

      const pool = await getPool();
      const request = pool.request();
      request.input("IdUsuario", sql.Int, req.user.IdUsuario);
      request.input("NombreOpcion", sql.VarChar(120), nombreOpcion);

      let columna = "PermiteLeer";
      if (tipoAcceso === "crear") columna = "PermiteCrear";
      else if (tipoAcceso === "actualizar") columna = "PermiteActualizar";
      else if (tipoAcceso === "eliminar") columna = "PermiteEliminar";

      const query = `
        SELECT COUNT(*) AS TienePermiso
        FROM UsuariosPerfiles up
        INNER JOIN Permisos p ON p.IdPerfil = up.IdPerfil
        INNER JOIN OpcionesMenu o ON o.IdOpcion = p.IdOpcion
        WHERE up.IdUsuario = @IdUsuario
          AND o.NombreOpcion = @NombreOpcion
          AND p.${columna} = 1
      `;

      const result = await request.query(query);
      const tiene = result.recordset[0].TienePermiso;

      if (!tiene) {
        return res.status(403).json({ message: "Acceso denegado" });
      }

      next();
    } catch (err) {
      console.error("Error en requirePermiso:", err.message);
      return res.status(500).json({ message: "Error interno" });
    }
  };
}
