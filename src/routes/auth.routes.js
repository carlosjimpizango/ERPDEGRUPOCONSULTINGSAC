// src/routes/auth.routes.js
import express from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import { getPool, sql } from "../config/db.js";
import {
  generateCsrfToken,
  requireCsrfProtection
} from "../middleware/csrf.middleware.js";

const router = express.Router();

/* =========================================================
   1) CAPTCHA SIMPLE EN MEMORIA
   ========================================================= */

// Estructura en memoria: { [id]: { answer: string, expiresAt: Date } }
const captchas = new Map();

// Genera una operación simple tipo "7 + 5" para humanos
function generarCaptcha() {
  const a = Math.floor(Math.random() * 9) + 1; // 1..9
  const b = Math.floor(Math.random() * 9) + 1;
  const answer = String(a + b);
  const question = `¿Cuánto es ${a} + ${b}?`;
  return { question, answer };
}

// Crear un captcha nuevo
function crearCaptcha() {
  const { question, answer } = generarCaptcha();
  const id = crypto.randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutos
  captchas.set(id, { answer, expiresAt });
  return { id, question };
}

// Validar captcha
function validarCaptcha(id, respuesta) {
  if (!id || !respuesta) return false;
  const data = captchas.get(id);
  if (!data) return false;

  // Eliminarlo para evitar reuso
  captchas.delete(id);

  if (new Date() > data.expiresAt) {
    return false;
  }

  // Comparación simple (podrías normalizar espacios, etc.)
  return data.answer === String(respuesta).trim();
}

// Endpoint: GET /api/auth/captcha
// Devuelve { id, question }
router.get("/captcha", (req, res) => {
  const cap = crearCaptcha();
  return res.json(cap);
});

/* =========================================================
   2) RATE LIMITING PARA LOGIN
   ========================================================= */

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 5, // 5 intentos por IP en ese período
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message:
      "Demasiados intentos de login. Intente nuevamente en unos minutos."
  }
});

/* =========================================================
   3) LOGIN SEGURO CON CAPTCHA + SESIÓN + CSRF
   ========================================================= */

// POST /api/auth/login
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { usuario, password, captchaId, captchaRespuesta } = req.body || {};

    // Validación básica de inputs
    if (
      !usuario ||
      typeof usuario !== "string" ||
      usuario.trim().length < 3 ||
      !password ||
      typeof password !== "string" ||
      password.length < 8
    ) {
      return res
        .status(400)
        .json({ message: "Usuario o contraseña inválidos." });
    }

    // 1) Validar CAPTCHA
    const captchaOk = validarCaptcha(captchaId, captchaRespuesta);
    if (!captchaOk) {
      return res.status(400).json({
        message: "Captcha incorrecto o expirado."
      });
    }

    // 2) Buscar usuario en BD
    const pool = await getPool();
    let request = pool.request();
    request.input("UsuarioLogin", sql.VarChar(100), usuario.trim());

    const result = await request.query(`
      SELECT TOP 1
        IdUsuario,
        NombreCompleto,
        Correo,
        UsuarioLogin,
        ContrasenaHash,
        Estado
      FROM dbo.Usuarios
      WHERE UsuarioLogin = @UsuarioLogin;
    `);

    if (result.recordset.length === 0) {
      // No revelar si es usuario o password
      return res
        .status(401)
        .json({ message: "Credenciales inválidas (usuario o contraseña)." });
    }

    const user = result.recordset[0];

    if (!user.Estado) {
      return res
        .status(403)
        .json({ message: "Usuario inactivo. Contacte al administrador." });
    }

    // 3) Verificar contraseña
    const okPass = await bcrypt.compare(password, user.ContrasenaHash);
    if (!okPass) {
      return res
        .status(401)
        .json({ message: "Credenciales inválidas (usuario o contraseña)." });
    }

    // 4) Crear sesión segura en SesionesSeguras
    const tokenSesion = crypto.randomBytes(48).toString("hex");
    const ahora = new Date();
    const expira = new Date(ahora.getTime() + 2 * 60 * 60 * 1000); // 2 horas

    request = pool.request();
    request.input("IdUsuario", sql.Int, user.IdUsuario);
    request.input("TokenSesion", sql.VarChar(200), tokenSesion);
    request.input("FechaInicio", sql.DateTimeOffset, ahora);
    request.input("FechaExpiracion", sql.DateTimeOffset, expira);
    request.input(
      "UserAgent",
      sql.VarChar(300),
      req.headers["user-agent"] || null
    );
    request.input("IpConexion", sql.VarChar(50), req.ip || null);
    request.input("Estado", sql.Bit, 1);

    await request.query(`
      INSERT INTO dbo.SesionesSeguras (
        IdUsuario,
        TokenSesion,
        FechaInicio,
        FechaExpiracion,
        UserAgent,
        IpConexion,
        Estado
      )
      VALUES (
        @IdUsuario,
        @TokenSesion,
        @FechaInicio,
        @FechaExpiracion,
        @UserAgent,
        @IpConexion,
        @Estado
      );
    `);

    // 5) Setear cookie segura (ajustar secure:true en producción HTTPS)
    res.cookie("sid", tokenSesion, {
      httpOnly: true,
      sameSite: "lax",
      secure: false, // En producción con HTTPS: true
      maxAge: 2 * 60 * 60 * 1000 // 2 horas
    });

    // 6) Generar token CSRF derivado del token de sesión
    const csrfToken = generateCsrfToken(tokenSesion);

    // 7) Respuesta sin exponer hash ni datos sensibles
    return res.json({
      message: "Login correcto.",
      user: {
        IdUsuario: user.IdUsuario,
        UsuarioLogin: user.UsuarioLogin,
        NombreCompleto: user.NombreCompleto,
        Correo: user.Correo
      },
      csrfToken // <-- lo usará el frontend en X-CSRF-Token
    });
  } catch (err) {
    console.error("Error en POST /auth/login:", err.message);
    return res.status(500).json({ message: "Error interno en login" });
  }
});

/* =========================================================
   4) ENDPOINT PARA RENOVAR/OBTENER CSRF TOKEN
   ========================================================= */

// GET /api/auth/csrf-token
// Usa la cookie "sid" actual y devuelve el token CSRF calculado
router.get("/csrf-token", (req, res) => {
  const sessionToken = req.cookies?.sid;
  if (!sessionToken) {
    return res.status(401).json({ error: "Sesión no válida." });
  }

  const csrfToken = generateCsrfToken(sessionToken);
  return res.json({ csrfToken });
});

/* =========================================================
   5) LOGOUT SEGURO CON CSRF
   ========================================================= */

// Endpoint de logout para cerrar sesión
// Ahora protegido también por requireCsrfProtection
router.post("/logout", requireCsrfProtection, async (req, res) => {
  try {
    const token = req.cookies?.sid;
    if (token) {
      const pool = await getPool();
      const request = pool.request();
      request.input("TokenSesion", sql.VarChar(200), token);
      await request.query(`
        UPDATE dbo.SesionesSeguras
        SET Estado = 0
        WHERE TokenSesion = @TokenSesion;
      `);
    }

    res.clearCookie("sid");
    return res.json({ message: "Sesión cerrada." });
  } catch (err) {
    console.error("Error en POST /auth/logout:", err.message);
    res.clearCookie("sid");
    return res.json({ message: "Sesión cerrada (con error interno)." });
  }
});

export default router;
