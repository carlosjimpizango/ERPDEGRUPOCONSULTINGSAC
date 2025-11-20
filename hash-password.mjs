import bcrypt from "bcrypt";

const passwordPlano = "Admin123*";  // cámbialo si quieres otra clave
const saltRounds = 10;

(async () => {
  const hash = await bcrypt.hash(passwordPlano, saltRounds);
  console.log("Password plano:", passwordPlano);
  console.log("Hash bcrypt para guardar en ContrasenaHash:");
  console.log(hash);
})();
