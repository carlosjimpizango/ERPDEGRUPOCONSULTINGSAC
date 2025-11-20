import sql from "mssql";
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: "ERPGRUPO4",
  server: process.env.DB_SERVER,
  options: {
    encrypt: true,
    trustServerCertificate: true
  }
};

let pool;

export async function getPool() {
  if (!pool) {
    pool = await sql.connect(config);
  }
  return pool;
}

export { sql };
