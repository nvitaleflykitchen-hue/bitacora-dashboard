import { execFileSync } from "node:child_process";

function git(...args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function abortar(mensaje) {
  console.error(`\nDEPLOY BLOQUEADO: ${mensaje}\n`);
  process.exit(1);
}

try {
  const rama = git("branch", "--show-current");
  if (rama !== "main") abortar(`la rama actual es '${rama}'. Producción solo se publica desde main.`);
  if (git("status", "--porcelain")) abortar("hay archivos modificados o sin seguimiento. Hacé commit o limpiá el workspace primero.");

  execFileSync("git", ["fetch", "origin", "main", "--quiet"], { stdio: "inherit" });
  const atrasados = Number(git("rev-list", "--count", "HEAD..origin/main"));
  const adelantados = Number(git("rev-list", "--count", "origin/main..HEAD"));
  if (atrasados) abortar(`main está ${atrasados} commit(s) detrás de origin/main. Ejecutá git pull --ff-only.`);
  if (adelantados) abortar(`main tiene ${adelantados} commit(s) sin subir. Hacé push antes del deploy.`);

  console.log("Predeploy OK: main limpio y sincronizado con origin/main.");
} catch (error) {
  if (error?.status) abortar("no se pudo verificar Git/GitHub. Revisá conexión y autenticación.");
  throw error;
}
