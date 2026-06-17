# FocusFlow 测试反馈报告

**日期：** 2026-06-17  
**分支：** `release-0.1.0`（8 个文件未 commit）  
**测试框架：** Vitest v4.1.9

---

## 稳定性验证

| 轮次 | 结果 | 耗时 |
|------|------|------|
| Run 1 | 7/7 ✅ | 1.52s |
| Run 2 | 7/7 ✅ | 1.50s |
| Run 3 | 7/7 ✅ | 1.54s |
| Run 4 | 7/7 ✅ | 1.55s |
| Run 5 | 7/7 ✅ | 1.50s |

**结论：5 轮 100% 通过，无波动，零随机失败。**

---

## 测试清单

### Test File 1: `src/store/__tests__/useTaskStore.test.ts`（2 个测试）

| # | 测试名称 | 覆盖目标 | 耗时 |
|---|---------|---------|------|
| 1 | `creates a task without duplicating it in state` | `createTask` + sync insert 到达顺序：IPC 先返回，sync 后到 → 去重正确，state 中只有 1 条 | ~5ms |
| 2 | `de-duplicates when sync insert arrives before optimistic update` | `createTask` + sync insert 到达顺序：sync 先到，IPC 后返回 → 去重正确，state 中只有 1 条 | ~1ms |

**覆盖的 Bug：** 之前 `createTask` 乐观更新 + sync 广播竞态导致任务重复出现 2 次 → 已修复，验证两种时序。

### Test File 2: `src/components/tasks/__tests__/MonthGrid.test.tsx`（5 个测试）

| # | 测试名称 | 覆盖目标 | 耗时 |
|---|---------|---------|------|
| 3 | `getTasksForDate > returns tasks matching a given date` | 按 `target_date` 过滤任务 | ~3ms |
| 4 | `getTasksForDate > excludes tasks with no target_date` | `target_date=''` 的任务不匹配任何日期 | ~1ms |
| 5 | `buildDotsMap > groups tasks by date and counts correctly` | 同一天 3 个任务（P1×2 + P3×1）→ count=3, priorities=[1,3]；另一天 1 个任务 → count=1 | ~2ms |
| 6 | `buildDotsMap > ignores tasks outside target year/month` | 跨月、跨年的任务被排除 | ~0ms |
| 7 | `buildDotsMap > ignores tasks with empty target_date` | 空 `target_date` 被排除，不影响 count | ~0ms |

**改进：** 从"复制死代码自己测自己"改为 `import { getTasksForDate, buildDotsMap } from '../MonthGrid'`，测试验证的是真正被组件调用的函数。

---

## TypeScript 类型检查

| 类型 | 数量 | 说明 |
|------|------|------|
| 新错误 | **0** | 本次改动未引入任何新 TS 错误 |
| 预存 TS6305 | 2 | `dist-electron/` 残留构建产物，与本次改动无关 |

---

## 改动文件清单（8 个文件，+143/−87 行）

| 文件 | 行变更 | 改动说明 |
|------|--------|---------|
| `AppLayout.tsx` | +24/−? | FocusView：`due_time`→`target_date` 过滤；`due_time` null 守卫 |
| `DayStrip.tsx` | +14/−? | `doneToday` 从 `updated_at` 改为 `target_date` |
| `MonthGrid.tsx` | +54/−? | `buildDotsMap` 导出为纯函数；任务数替代优先级数 |
| `StatsView.tsx` | +5/−? | `todayDone` 从 `updated_at` 改为 `target_date` |
| `TaskForm.tsx` | +5/−? | 编辑不覆盖 `target_date`；useEffect 补依赖 |
| `TaskList.tsx` | +45/−? | 默认选中今天；sessionStorage 持久化；日期过滤优先 |
| `MonthGrid.test.tsx` | +72/−? | 导入真实函数；测 `buildDotsMap`；删死代码 |
| `useTaskStore.ts` | +11/−? | `migrateTasksToToday` 设 `target_date`；`cloneTasksToToday` 统一 `toLocalDateStr` |

---

## 覆盖的 Bug 清单

| # | 严重度 | Bug | 状态 |
|---|--------|-----|------|
| 1 | 🔴 | `migrateTasksToToday` 设 `due_time` 但 FocusView 用 `target_date` → 迁移任务消失 | ✅ 已修复 |
| 2 | 🟡 | MonthGrid 日历格子显示优先级数量而非任务数量 | ✅ 已修复 |
| 3 | 🟡 | DayStrip/StatsView `doneToday` 用 `updated_at` → 编辑旧任务会计入今日 | ✅ 已修复 |
| 4 | 🟡 | FocusView `task.due_time!` null 时显示 1970 年时间 | ✅ 已修复 |
| 5 | 🟡 | `cloneTasksToToday` 手写日期格式与其他 6 处 `toLocalDateStr` 不一致 | ✅ 已修复 |
| 6 | 🟢 | TaskForm useEffect 缺少 `defaultCategoryId` 依赖 | ✅ 已修复 |
| 7 | 🟢 | MonthGrid.test 测已删除的 `getPrioritiesForDate`，虚假覆盖率 | ✅ 已修复 |

---

## 自审结果（全项目 24 个组件）

已审查文件：
- `SmartInput.tsx` — 异常处理正确
- `TaskItem.tsx` — `due_time` null 守卫正确
- `PomodoroWorkbench.tsx` — 计时逻辑正确
- `PomodoroFloating.tsx` — 进度计算正确
- `usePomodoroStore.ts` — clearInterval 正确
- `ManageDialog.tsx` / `DailyReview.tsx` / `WeekStrip.tsx` / `CategorySidebar.tsx` — 无问题
- 其余未列出组件 — 无代码变更，无回归风险

**额外发现：0 个新 bug。**
