# 日历虚拟展开循环任务

**日期:** 2026-06-17  
**状态:** 已确认  
**范围:** `MonthGrid.tsx` 仅改 2 个函数

## 需求

用户设「每周一三五健身」后，翻到日历上任意一个周一/周三/周五，都能看到这个任务。

完成任务只影响当前这一天。后面的循环任务不受影响（维持 `recurrence.service.ts` 的单实例滚动行为）。

## 设计

### 不改的部分（硬约束）

| 模块 | 行为 | 不碰 |
|------|------|------|
| 数据库 | 循环任务只有一行 | ✅ |
| 任务列表 (`TaskList`) | 只看 `target_date` | ✅ |
| 循环推进 (`recurrence.service`) | 完成→推进到下一期 | ✅ |
| `DayStrip` / `WeekStrip` / `FocusView` | 只看 `target_date` | ✅ |
| `StatsView` / 其他组件 | 不涉及 | ✅ |

### 改的部分（仅 MonthGrid）

`buildDotsMap(tasks, year, month)` — 增加循环任务虚拟匹配：

```
对每个任务 t：
  1. 有 target_date 且在当月的 → 正常计入（现有逻辑）
  2. 有 recurrence_type=weekly + recurrence_days 的 → 
     计算当月每一天的星期几，匹配则计入
```

`getTasksForDate(tasks, dateStr)` — 点击日期展开任务列表时：

```
除了 target_date === dateStr，也拉入：
  recurrence_type=weekly + recurrence_days 覆盖该日期的循环任务
```

### 复杂度控制

- 只改 `MonthGrid.tsx` 一个文件
- 两个函数各加 ~10 行
- 不改任何 store、数据库、IPC、类型定义
- 现有测试全部保留并通过

## 验收标准

1. 「每周健身打卡」(周一三五) 在日历 6 月的所有周一三五日期格子上出现
2. 未设置循环的普通任务行为不变
3. 7 个现有测试全部通过
4. TypeScript 零新错误
