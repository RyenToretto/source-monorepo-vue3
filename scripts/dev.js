/**
 * 打包开发环境
 *
 * node scripts/dev.js --format esm
 */

import { parseArgs } from 'node:util'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import esbuild from 'esbuild'
import { createRequire } from 'node:module'
/**
 * 解析命令行参数
 */
const {
  values: { format, watch },
  positionals,
} = parseArgs({
  allowPositionals: true,
  options: {
    format: {
      type: 'string',
      short: 'f',
      default: 'esm',
    },
    watch: {
      type: 'boolean',
      short: 'w',
      default: false,
    },
  },
})

// 创建 esm 的 __filename
const __filename = fileURLToPath(import.meta.url)
// 创建 esm 的 __dirname
const __dirname = dirname(__filename)

const require = createRequire(import.meta.url)
const target = positionals.length ? positionals[0] : 'vue'

const entry = resolve(__dirname, `../packages/${target}/src/index.ts`)

/**
 * --format cjs or esm
 * cjs => reactive.cjs.js
 * esm => reactive.esm.js
 * @type {string}
 */
const outfile = resolve(
  __dirname,
  `../packages/${target}/dist/${target}.${format}.js`,
)

const pkg = require(`../packages/${target}/package.json`)

esbuild
  .context({
    entryPoints: [entry], // 入口文件
    outfile, // 输出文件
    format, // 打包格式 cjs esm iife
    platform: format === 'cjs' ? 'node' : 'browser',
    sourcemap: true,
    bundle: true,
    globalName: pkg.buildOptions.name,
  })
  .then(async ctx => {
    if (watch) {
      return ctx.watch()
    } else {
      await ctx.rebuild()
      await ctx.dispose()
      process.exit(0)
    }
  })
