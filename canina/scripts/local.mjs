/**
 * Arranque local en un solo comando, sin Docker ni cuentas externas:
 *   npm run local
 * Levanta PostgreSQL embebido (datos en .pgdata/, puerto 5433), aplica migraciones,
 * carga los datos demo y arranca la app en http://localhost:3025.
 * Usa la app compilada (rápida); solo recompila si el código cambió.
 * Para desarrollar con recarga en caliente: npm run local -- --dev
 */
import { execSync, spawn } from "node:child_process";
import { existsSync, copyFileSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { randomBytes } from "node:crypto";
import EmbeddedPostgres from "embedded-postgres";

const DB_URL = "postgresql://cania:cania@localhost:5433/cania?schema=public";

if (!existsSync(".env")) {
  copyFileSync(".env.example", ".env");
  const env = readFileSync(".env", "utf8").replace(/^AUTH_SECRET=.*$/m, `AUTH_SECRET="${randomBytes(32).toString("hex")}"`);
  writeFileSync(".env", env);
  console.log("· Creado .env a partir de .env.example");
}

// PostgreSQL se niega a arrancar con permisos de administrador (PowerShell "como administrador")
if (process.platform === "win32") {
  let elevated = false;
  try { execSync("net session", { stdio: "ignore" }); elevated = true; } catch {}
  if (elevated) {
    console.error("\n✖ Esta ventana está abierta como ADMINISTRADOR y PostgreSQL no puede arrancar así.");
    console.error("  Ciérrala, abre PowerShell con un clic normal (sin \"Ejecutar como administrador\") y repite: npm run local\n");
    process.exit(1);
  }
}

const pg = new EmbeddedPostgres({ databaseDir: ".pgdata", user: "cania", password: "cania", port: 5433, persistent: true,
  // UTF-8 siempre: en Windows en español initdb usaría WIN1252 y fallarían las migraciones
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});
const firstRun = !existsSync(".pgdata/PG_VERSION");
if (firstRun) {
  console.log("· Inicializando PostgreSQL embebido (solo la primera vez)…");
  await pg.initialise();
}
// Un cierre brusco deja el candado postmaster.pid: se borra si ese proceso ya no existe
const lock = ".pgdata/postmaster.pid";
if (existsSync(lock)) {
  const pid = Number(readFileSync(lock, "utf8").split("\n")[0]);
  let alive = false;
  try { process.kill(pid, 0); alive = true; } catch {}
  if (alive) {
    console.error(`\n✖ Ya hay un CRM (base de datos, proceso ${pid}) abierto en este PC.`);
    console.error("  Cierra la otra ventana donde se está ejecutando, o detenlo con:");
    console.error(`  Stop-Process -Id ${pid} -Force\n`);
    process.exit(1);
  }
  rmSync(lock);
}
await pg.start();
if (firstRun) await pg.createDatabase("cania");

const env = { ...process.env, DATABASE_URL: DB_URL, DIRECT_URL: DB_URL };
const run = (cmd) =>
  new Promise((resolve, reject) => {
    const p = spawn(cmd, { stdio: "inherit", shell: true, env });
    p.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} → código ${code}`))));
  });

let app;
const stop = async () => {
  app?.kill();
  await pg.stop().catch(() => {});
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);

try {
  await run("npx prisma migrate deploy");
  await run("npx prisma db seed");
} catch (e) {
  console.error(e);
  await pg.stop();
  process.exit(1);
}

const devMode = process.argv.includes("--dev");
if (!devMode) {
  // Recompila solo si no hay build o si el código cambió desde la última (commit de git)
  let head = "";
  try { head = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim(); } catch {}
  const stamp = ".next/.local-build";
  const built = existsSync(".next/BUILD_ID") && existsSync(stamp) && readFileSync(stamp, "utf8") === head && head !== "";
  if (!built) {
    console.log("· Compilando la app (unos minutos, solo cuando hay cambios)…");
    try {
      await run("npx next build");
      writeFileSync(stamp, head);
    } catch (e) {
      console.error(e);
      await pg.stop();
      process.exit(1);
    }
  }
}

console.log("\n✅ Abre http://localhost:3025 · admin@cania.test / cania1234 (Ctrl+C para parar)\n");
app = spawn(devMode ? "npx next dev -p 3025" : "npx next start -p 3025", { stdio: "inherit", shell: true, env });
app.on("exit", stop);
