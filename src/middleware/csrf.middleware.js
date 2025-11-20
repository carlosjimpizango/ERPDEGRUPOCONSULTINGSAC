// middleware/csrf.middleware.js
import crypto from "crypto";

const CSRF_HEADER = "x-csrf-token"; // los headers son case-insensitive en Node

// En producción, define CSRF_SECRET en el .env con un valor fuerte y único
const CSRF_SECRET =
  process.env.CSRF_SECRET || "CAMBIAR_ESTE_VALOR_SECRETO_EN_PRODUCCION";

/**
 * Genera un token CSRF derivado del token de sesión.
 * No se guarda en BD: se recalcula cada vez con HMAC(sessionToken, CSRF_SECRET).
 */
export function generateCsrfToken(sessionToken) {
  if (!sessionToken) return null;

  return crypto
    .createHmac("sha256", CSRF_SECRET)
    .update(sessionToken)
    .digest("hex");
}

/**
 * Middleware de protección CSRF para métodos que modifican estado.
 * Requiere:
 *  - Cookie "sid" con el token de sesión.
 *  - Header "X-CSRF-Token" con el token HMAC correspondiente.
 */
export function requireCsrfProtection(req, res, next) {
  const method = req.method.toUpperCase();

  // Métodos "seguros" NO requieren CSRF
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return next();
  }

  const sessionToken = req.cookies?.sid;
  if (!sessionToken) {
    return res.status(401).json({
      message: "Sesión no válida para verificación CSRF."
    });
  }

  const expectedToken = generateCsrfToken(sessionToken);
  const incomingToken = req.get(CSRF_HEADER);

  if (!incomingToken) {
    return res.status(403).json({
      message: "Falta cabecera CSRF.",
      details: `Debe enviar el header '${CSRF_HEADER}' en las peticiones que modifican datos.`
    });
  }

  if (incomingToken !== expectedToken) {
    return res.status(403).json({
      message: "Token CSRF inválido."
    });
  }

  return next();
}
