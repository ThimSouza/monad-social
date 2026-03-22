/**
 * Envio regenerates `generated/index.js` with:
 *   module.exports = { ...handlers, BigDecimal, TestHelpers };
 *
 * Node's ESM↔CJS named export detection (cjs-module-lexer) does not infer names
 * from object spread, so `import { Interactions } from "generated"` fails with:
 * "does not provide an export named 'Interactions'".
 *
 * This script rewrites the entry file with explicit `exports.*` assignments.
 * Run automatically after `envio codegen` via `npm run codegen`.
 */

const fs = require("fs");
const path = require("path");

const target = path.join(__dirname, "..", "generated", "index.js");

const contents = `/**
 This file serves as an entry point when referencing generated as a node module

 NOTE: Named exports must be assigned explicitly on \`exports\` so Node can expose
 them to ESM consumers (\`import { Interactions } from "generated"\`). A plain
 \`module.exports = { ...handlers }\` is not analyzed by cjs-module-lexer, so
 those names disappear at runtime. See scripts/fix-generated-cjs-exports.cjs
 (run automatically after \`npm run codegen\`).
 */

const handlers = require("./src/Handlers.res.js");
const TestHelpersModule = require("./src/TestHelpers.res.js");
const BigDecimal = require("bignumber.js");

exports.Posts = handlers.Posts;
exports.SocialGraph = handlers.SocialGraph;
exports.Interactions = handlers.Interactions;
exports.onBlock = handlers.onBlock;
exports.BigDecimal = BigDecimal;
exports.TestHelpers = {
  Interactions: TestHelpersModule.Interactions,
  Posts: TestHelpersModule.Posts,
  SocialGraph: TestHelpersModule.SocialGraph,
  MockDb: TestHelpersModule.MockDb,
  Addresses: TestHelpersModule.Addresses,
};
`;

fs.writeFileSync(target, contents, "utf8");
console.log("[fix-generated-cjs-exports] Patched generated/index.js for ESM named imports.");
