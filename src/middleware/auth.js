// src/middleware/auth.js
import { getPool, sql } from "../config/db.js";

/**
 * Middleware de autenticación basado en cookie "sid" y tabla dbo.SesionesSeguras.
 * - Valida que exista la sesión
 * - Revisa expiración y estado
 * - Carga los datos básicos del usuario en req.user
 */
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
      SELECT TOP 1
        s.IdSesion,
        s.IdUsuario       AS SesionUsuarioId,
        s.FechaExpiracion,
        s.Estado,
        u.IdUsuario       AS UsuarioId,
        u.NombreCompleto,
        u.Correo,
        u.UsuarioLogin
      FROM dbo.SesionesSeguras s
      INNER JOIN dbo.Usuarios u ON u.IdUsuario = s.IdUsuario
      WHERE s.TokenSesion   = @TokenSesion
        AND s.Estado        = 1
        AND s.FechaExpiracion > SYSUTCDATETIME();
    `);

    if (result.recordset.length === 0) {
      // No hay sesión activa o ya expiró
      return res
        .status(401)
        .json({ message: "Sesión inválida o expirada. Inicie sesión nuevamente." });
    }

    const row = result.recordset[0];

    // 🔴 Aseguramos que IdUsuario sea entero válido
    const usuarioId = parseInt(row.UsuarioId, 10);
    if (!usuarioId || Number.isNaN(usuarioId)) {
      console.error("requireAuth: UsuarioId inválido en la sesión:", row.UsuarioId);
      return res.status(401).json({ message: "Sesión inválida" });
    }

    // Guardamos el usuario en req.user para el resto de middlewares/rutas
    req.user = {
      IdUsuario: usuarioId,
      NombreCompleto: row.NombreCompleto,
      Correo: row.Correo,
      UsuarioLogin: row.UsuarioLogin
    };

    next();
  } catch (err) {
    console.error("Error en requireAuth:", err);
    return res.status(500).json({ message: "Error interno al validar sesión" });
  }
}

/**
 * Middleware de autorización basado en:
 * - dbo.UsuariosPerfiles
 * - dbo.Perfiles
 * - dbo.Permisos
 * - dbo.OpcionesMenu
 *
 * nombreOpcion: corresponde a OpcionesMenu.NombreOpcion (por ej. "CLIENTES")
 * tipoAcceso: "leer" | "crear" | "actualizar" | "eliminar"
 */
export function requirePermiso(nombreOpcion, tipoAcceso) {
  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({ message: "No autenticado" });
      }

      // 🔴 Convertir IdUsuario de req.user a entero y validar
      const userId = parseInt(req.user.IdUsuario, 10);
      if (!userId || Number.isNaN(userId)) {
        console.error("requirePermiso: IdUsuario inválido en req.user:", req.user);
        return res.status(401).json({ message: "Sesión inválida" });
      }

      const pool = await getPool();
      const request = pool.request();
      request.input("IdUsuario", sql.Int, userId);
      request.input("NombreOpcion", sql.VarChar(120), nombreOpcion);

      let columna = "PermiteLeer";
      if (tipoAcceso === "crear") columna = "PermiteCrear";
      else if (tipoAcceso === "actualizar") columna = "PermiteActualizar";
      else if (tipoAcceso === "eliminar") columna = "PermiteEliminar";

      const query = `
        SELECT COUNT(*) AS TienePermiso
        FROM dbo.UsuariosPerfiles up
        INNER JOIN dbo.Permisos p      ON p.IdPerfil = up.IdPerfil
        INNER JOIN dbo.OpcionesMenu o  ON o.IdOpcion = p.IdOpcion
        WHERE up.IdUsuario      = @IdUsuario
          AND o.NombreOpcion    = @NombreOpcion
          AND p.${columna}      = 1;
      `;

      const result = await request.query(query);
      const tiene = result.recordset[0]?.TienePermiso || 0;

      if (!tiene) {
        return res.status(403).json({ message: "Acceso denegado" });
      }

      next();
    } catch (err) {
      console.error("Error en requirePermiso:", err);
      return res.status(500).json({ message: "Error interno en autorización" });
    }
  };
}
