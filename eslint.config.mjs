import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Las fechas YYYY-MM-DD se arman con hoyARG()/fechaARG() de lib/utils.
    // toLocaleDateString("es-AR") no pone ceros (4/11/2026 → "2026-11-4" = Invalid Date):
    // así se cayó el bot de WhatsApp los días 1 al 9 de noviembre 2026.
    rules: {
      "no-restricted-syntax": ["error", {
        selector: "CallExpression[callee.property.name='reverse'][callee.object.callee.property.name='split'][callee.object.arguments.0.value='/']",
        message: "No armes fechas con split(\"/\").reverse(): usá hoyARG() o fechaARG() de @/lib/utils.",
      }],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
