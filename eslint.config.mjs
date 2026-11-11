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
      }, {
        // new Date().toISOString() es la fecha UTC: de 21:00 a 23:59 ARG ya es mañana
        // (así se corrieron un día las fichadas manuales cargadas de noche)
        selector: "CallExpression[callee.property.name='toISOString'][callee.object.type='NewExpression'][callee.object.arguments.length=0]",
        message: "new Date().toISOString() es la fecha UTC (de 21 a 24 hs ARG ya es mañana): usá hoyARG(), fechaARG() o fechaHoraLocalARG() de @/lib/utils.",
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
