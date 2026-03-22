/**
 * npm/pnpm may install `file:./generated` as a copy under node_modules/.pnpm/... without
 * compiled ReScript (*.res.js), which breaks require("./src/Handlers.res.js").
 *
 * This script replaces node_modules/generated with a symlink to ../generated (the real
 * folder on disk after `envio codegen` + rescript build).
 *
 * Runs on postinstall and after codegen.
 */

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const generatedDir = path.resolve(root, "generated");
const linkPath = path.join(root, "node_modules", "generated");

function main() {
  if (!fs.existsSync(generatedDir)) {
    console.warn(
      "[ensure-generated-symlink] Skip: ./generated not found (run `npm run codegen` first)."
    );
    return;
  }
  if (!fs.existsSync(path.join(generatedDir, "package.json"))) {
    console.warn("[ensure-generated-symlink] Skip: generated/package.json missing.");
    return;
  }

  const nm = path.join(root, "node_modules");
  fs.mkdirSync(nm, { recursive: true });

  const want = fs.realpathSync(generatedDir);
  try {
    if (fs.existsSync(linkPath)) {
      const st = fs.lstatSync(linkPath);
      if (st.isSymbolicLink()) {
        const resolved = fs.realpathSync(linkPath);
        if (resolved === want) return;
      }
    }
  } catch {
    /* replace broken link */
  }

  fs.rmSync(linkPath, { recursive: true, maxRetries: 5, retryDelay: 200, force: true });

  const rel = path.relative(path.dirname(linkPath), generatedDir);
  fs.symlinkSync(rel, linkPath);
  console.log("[ensure-generated-symlink] node_modules/generated ->", rel);
}

main();
