import * as esbuild from 'esbuild';
import esbuildSvelte from 'esbuild-svelte';
import {sveltePreprocess} from 'svelte-preprocess';
import stylePlugin from 'esbuild-style-plugin';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const esbuildProblemMatcherPlugin = {
    name: 'esbuild-problem-matcher',
    setup(build) {
        build.onStart(() => {
            console.log('[watch] build started');
        });
        build.onEnd((result) => {
            result.errors.forEach(({text, location}) => {
                console.error(`✘ [ERROR] ${text}`);
                console.error(`    ${location.file}:${location.line}:${location.column}:`);
            });
            console.log('[watch] build finished');
        });
    },
};

async function buildExtension() {
    const ctx = await esbuild.context({
        entryPoints: ['src/extension.ts'],
        bundle: true,
        format: 'cjs',
        minify: production,
        sourcemap: !production,
        sourcesContent: false,
        platform: 'node',
        outfile: 'dist/extension.js',
        external: ['vscode'],
        logLevel: 'silent',
        plugins: [esbuildProblemMatcherPlugin],
    });

    if (watch) {
        await ctx.watch();
    } else {
        await ctx.rebuild();
        await ctx.dispose();
    }
}

async function buildWebview() {
    const ctx = await esbuild.context({
        entryPoints: ['src/ui/main.ts'],
        bundle: true,
        format: 'iife',
        minify: production,
        sourcemap: !production,
        outdir: 'dist/ui',
        plugins: [
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
        await Promise.all([buildExtension(), buildWebview()]);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
