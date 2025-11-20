// src/utils/security.js
import crypto from "crypto";

export function generarTokenSesion() {
  // Token aleatorio para guardar en SesionesSeguras.TokenSesion
  return crypto.randomBytes(48).toString("hex");
}
