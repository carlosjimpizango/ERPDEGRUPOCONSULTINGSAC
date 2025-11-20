import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import cors from "cors";

import authRoutes from "./routes/auth.routes.js";
import clientesRoutes from "./routes/clientes.routes.js";

import { requireAuth } from "./middleware/auth.js";
import { requireCsrfProtection } from "./middleware/csrf.middleware.js";

const app = express();

// Seguridad básica
app.use(helmet());
app.use(express.json());
app.use(cookieParser());

// CORS: permitir front SAPUI5
app.use(
  cors({
    origin: process.env.FRONTEND_ORIGIN || "http://localhost:8080",
    credentials: true // importante para enviar cookie "sid"
  })
);

// Healthcheck simple
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// ================================
// RUTAS DE AUTENTICACIÓN
// ================================
// Aquí van: /login, /captcha, /logout, etc.
// NO requieren requireAuth ni CSRF, porque justamente crean la sesión.
app.use("/api/auth", authRoutes);

// ================================
// RUTAS DE CLIENTES (PROTEGIDAS)
// ================================
// - requireAuth: exige sesión válida en dbo.SesionesSeguras
// - requireCsrfProtection:
//    * GET: pasa sin token
//    * POST/PUT/DELETE: requiere header X-CSRF-Token correcto
app.use("/api/clientes", requireAuth, requireCsrfProtection, clientesRoutes);

// ================================
// INICIO DEL SERVIDOR
// ================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("API segura escuchando en puerto " + PORT);
});
