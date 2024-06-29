import * as esbuild from "esbuild";
import esbuildSvelte from "esbuild-svelte";
import { sveltePreprocess } from "svelte-preprocess";
import stylePlugin from "esbuild-style-plugin";
import tailwindcss from "tailwindcss";
import autoprefixer from "autoprefixer";
import * as path from "node:path";
import * as fs from "node:fs";

import { fileURLToPath } from "url";

// Get the directory name of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const production = process.argv.includes("--production");
const watch = process.argv.includes("--watch");

const esbuildProblemMatcherPlugin = {
  name: "esbuild-problem-matcher",
  setup(build) {
    build.onStart(() => {
      console.log("[watch] build started");
    });
    build.onEnd((result) => {
      result.errors.forEach(({ text, location }) => {
        console.error(`✘ [ERROR] ${text}`);
        console.error(
          `    ${location.file}:${location.line}:${location.column}:`
        );
      });
      console.log("[watch] build finished");
    });
  },
};

const aliasPlugin = (aliases) => ({
  name: "alias",
  setup(build) {
    Object.entries(aliases).forEach(([alias, aliasPath]) => {
      build.onResolve({ filter: new RegExp(`^${alias}`) }, (args) => {
        const resolvedPath = path.join(
          aliasPath,
          args.path.slice(alias.length)
        );
        return { path: resolvedPath };
      });
    });
  },
});

// Function to get all SQL migration files
function getMigrationFiles(dir) {
  const files = fs
    .readdirSync(dir)
    .map((file) => path.join(dir, file))
    .filter((file) => file.endsWith(".sql"));
  console.log("Migration files", files);
  return files;
}

async function buildExtension() {
  const ctx = await esbuild.context({
    entryPoints: [
      "src/extension.ts",
      ...getMigrationFiles("src/db/migrations"),
    ],
    bundle: true,
    format: "cjs",
    minify: production,
    sourcemap: !production,
    sourcesContent: false,
    platform: "node",
    outdir: "dist/",
    external: ["vscode", "@vscode/sqlite3"],
    logLevel: "silent",
    loader: { ".json": "json", ".sql": "text" },
    plugins: [
      esbuildProblemMatcherPlugin,
      {
        name: "sql-to-js",
        setup(build) {
          build.onLoad({ filter: /\.sql$/ }, async (args) => {
            const contents = await fs.promises.readFile(args.path, "utf8");
            const fileName = path.basename(args.path, ".sql");
            return {
              contents: `
                // ${fileName}.sql
                module.exports = ${JSON.stringify(contents)};
              `,
              loader: "js",
            };
          });
        },
      },
    ],
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

async function buildUI() {
  const ctx = await esbuild.context({
    entryPoints: ["src/ui/sidebar/index.ts", "src/ui/chat/index.ts"],
    bundle: true,
    format: "iife",
    minify: production,
    sourcemap: !production,
    outdir: "dist/ui",
    conditions: ["svelte", "browser", "import"],
    plugins: [
      aliasPlugin({
        $ui: path.resolve(__dirname, "src/ui"),
      }),
      esbuildSvelte({
        preprocess: sveltePreprocess(),
      }),
      stylePlugin({
        postcss: {
          plugins: [tailwindcss, autoprefixer],
        },
      }),
      // copy({
      //     assets: {
      //         from: ['public/*'],
      //         to: ['dist/webview'],
      //     },
      // }),
    ],
  });

  if (watch) {
    await ctx.watch();
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

async function main() {
  try {
    await Promise.all([buildExtension(), buildUI()]);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

main();
