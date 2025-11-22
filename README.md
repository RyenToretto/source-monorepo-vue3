# 手写vue3

## monorepo

- 得新建一个 pnpm-workspace.yaml 管理各个包
  packages/
  ├── compiler-core/          # 编译器核心代码
  ├── compiler-dom/          # 浏览器平台编译器
  ├── compiler-sfc/          # 单文件组件编译器
  ├── compiler-ssr/          # 服务端渲染编译器
  ├── reactivity/            # 响应式系统
  ├── runtime-core/          # 运行时核心代码
  ├── runtime-dom/           # 浏览器运行时
  ├── runtime-test/          # 测试相关运行时
  ├── server-renderer/       # 服务端渲染
  ├── shared/               # 共享工具代码
  └── vue/                  # 完整版本入口

### 代码格式化

pnpm i -D -w prettier

### 在根目录装依赖

pnpm i -D -w typescript
pnpm i -D -w @types/node    # 类型提示
npx tsc --init              # 生成tsconfig

pnpm i -D -w esbuild        # 打包  

### 给子包安装依赖

- 给 packages 中 @vue/reactivity 包，安装当前工作控件中的 @vue/shared 包

pnpm i @vue/shared --workspace --filter @vue/reactivity
