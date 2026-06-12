# 调试指南：`ReferenceError: X is not defined`（JSX 简写 + Vite HMR 场景）

## 问题特征

```
[window.onerror] Uncaught ReferenceError: categories is not defined
  at http://localhost:5173/src/components/layout/AppLayout.tsx:491:15
```

**核心模式**：浏览器报 `ReferenceError`，但报错的行号指向 JSX 注释或看似无关的代码，让你找不到实际引用点。

## 为什么会发生

### 三个阶段叠加导致这个问题：

**阶段 1：代码层面 — 解构遗漏**

在 React 组件中，从 Zustand store（或任何 hook）解构时，漏掉了 JSX 中需要传递的变量：

```tsx
// ❌ 错误：categories 未解构
const { loadCategories, initSync } = useCategoryStore();

// 下面 JSX 却用了 categories
<TaskForm categories={categories} />  // ReferenceError!
```

```tsx
// ✅ 正确
const { categories, loadCategories, initSync } = useCategoryStore();
<TaskForm categories={categories} />
```

**阶段 2：Vite 转换 — JSX 简写导致行号偏移**

Vite 将 TSX 转换为 JS 时，`categories={categories}` 会被化简为 `categories`（ES6 属性简写）。这导致：

- 源码中报错位置（如第 491 行）和实际引用位置（如第 312 行）**不对应**
- 转换后的 JS 文件中，`categories` 裸变量出现在与源码完全不同的行号
- Source map 可能不够精确，尤其在包含多个组件定义的文件中

**阶段 3：Vite HMR / 缓存 — 修复后仍报错**

即使你在磁盘上修复了代码，以下情况可能导致错误持续出现：

| 原因 | 表现 |
|------|------|
| Vite 模块缓存 (`node_modules/.vite/deps_temp_*`) | 旧版转换结果被缓存 |
| HMR 未正确传播更新 | 浏览器运行旧模块 |
| Electron 渲染进程未刷新 | 页面维持旧状态 |
| `import type` 与 `import value` 混用 | 模块依赖图混乱 |

## 快速诊断流程

### 第 1 步：在源码中搜索变量名

```bash
# 找到所有引用该变量的位置
grep -n "categories" src/components/layout/AppLayout.tsx
```

**判断**：
- 如果只找到 `categories={categories}` 这种用法，而没有 `const { categories } = useXxxStore()` 声明 → **这就是 bug**
- 如果有声明但只有 1 处使用，检查是否在声明之后

### 第 2 步：检查 Git diff

```bash
git diff HEAD -- src/components/layout/AppLayout.tsx
```

重点关注：
- 是否有新增的 JSX prop 传递（如 `categories={categories}`）
- 对应的 hook 解构是否也添加了该变量
- `import` 语句变化

### 第 3 步：查看 Vite 转换后的实际 JS

```bash
# 从 Vite 开发服务器获取转换后的文件
curl -s "http://localhost:5173/src/components/layout/AppLayout.tsx" | grep -n "categories"
```

**期望看到**：
```
56:  const { categories, loadCategories, initSync } = useCategoryStore();  // 声明
491:              categories                                                // 使用
```

如果声明和使用不在同一个函数作用域内 → **这就是 bug**

### 第 4 步：确认作用域

检查报错变量是否在正确的作用域内声明。特别注意：
- 同一文件中定义了多个组件（如 `AppLayout` + `FocusView`），变量可能跨组件遗漏
- `useCallback` / `useEffect` 闭包中引用了外部变量但未加入依赖

## 标准修复步骤

### 方案 A：变量未声明（最常见）

```tsx
// 在对应的 hook 解构中添加缺失的变量
const { categories, loadCategories, initSync } = useCategoryStore();
//       ^^^^^^^^^^ 添加这个
```

### 方案 B：如果代码已修复但错误仍在

```bash
# 1. 清除 Vite 缓存
rm -rf node_modules/.vite/deps_temp_*

# 2. 重启开发服务器
# 先杀掉旧进程
taskkill //F //PID <vite-pid>
# 再重启
npx electron-vite dev

# 3. 强制刷新浏览器/Electron
# 浏览器：Ctrl+Shift+R
# Electron：关闭窗口重新启动
```

### 方案 C：验证修复

```bash
# 确认服务器返回 200
curl -s -o /dev/null -w "%{http_code}" "http://localhost:5173/"

# 确认转换后的代码正确
curl -s "http://localhost:5173/src/components/layout/AppLayout.tsx" | grep -A0 -B0 "categories"
```

## 防范措施

### 1. 添加/修改 JSX prop 时同步更新解构

修改组件时，如果要传递一个新的 prop：
```tsx
<SomeChild newProp={newProp} />
```

确认 `newProp` 在组件作用域内已声明（来自 hook、state、props 或计算值）。

### 2. 使用 TypeScript 严格模式

确保 `tsconfig.json` 中有：
```json
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

虽然 Vite/esbuild 不做类型检查，但 IDE（VS Code）会实时标红未定义的变量。

### 3. 提交前检查清单

- [ ] 新增的 JSX prop 是否在组件作用域内已声明？
- [ ] 修改 hook 解构后，该文件中所有使用该变量的位置是否仍有效？
- [ ] `import type` 和 `import value` 是否分离清晰？
- [ ] 是否运行过 `npx tsc --noEmit` 检查类型？

### 4. Git hook：提交前类型检查

在 `.git/hooks/pre-commit` 或 CI 中添加：
```bash
npx tsc --noEmit
```
这会捕获所有「变量未定义」的问题。

## 相关案例记录

### 案例 1：categories 未定义 (2026-06-12)

- **文件**：`src/components/layout/AppLayout.tsx`
- **原因**：提交 6cba527 在 TaskForm 上添加了 `categories={categories}` prop，但未同步更新 `useCategoryStore()` 的解构
- **报错行**：第 491 行（Vite 转换后位置，实际源码在第 312 行）
- **修复**：在解构中添加 `categories`，清除 Vite 缓存，重启开发服务器
- **耗时**：诊断 ~15min，实际修改 1 行代码 + 重启

---

> **一句话总结**：当你看到 `ReferenceError: X is not defined` 但报错行号看起来不对时，直接 `grep -n "X"` 源文件，找「有使用但无声明」的位置。99% 的情况是忘记从 hook/store 解构变量。
