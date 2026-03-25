import esbuild from "esbuild"

const watch = process.argv.includes("--watch")

const ctx = await esbuild.context({
  bundle: true,
  entryPoints: ["main.ts"],
  external: ["obsidian"],
  format: "cjs",
  outfile: "dist/main.js",
  platform: "browser",
  sourcemap: true,
  target: "es2022",
  tsconfig: "tsconfig.json",
})

if (watch) {
  await ctx.watch()
} else {
  await ctx.rebuild()
  await ctx.dispose()
}
