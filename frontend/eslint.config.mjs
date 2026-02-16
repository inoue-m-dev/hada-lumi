import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  // ① Lint 対象ファイルの指定（超重要）
  {
    files: ["**/*.ts", "**/*.tsx"],
  },

  // ② Next.js の標準設定
  ...nextVitals,
  ...nextTs,

  // ③ 無視するパス
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;