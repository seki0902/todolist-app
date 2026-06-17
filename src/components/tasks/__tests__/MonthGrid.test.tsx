import { describe, it, expect } from 'vitest';
import type { TaskRow } from '../../../shared/types/database';
import { getTasksForDate, buildDotsMap } from '../MonthGrid';

// Pure logic tests — verify the data helpers used by MonthGrid
// (React rendering tests skipped due to jsdom+React 18 concurrent mode
//  incompatibility; visual behavior verified manually)

function makeTask(overrides: Partial<TaskRow> = {}): TaskRow {
  return {
    id: overrides.id ?? 't1',
    title: overrides.title ?? 'Test',
    description: '',
    priority: overrides.priority ?? 3,
    status: 'todo',
    progress: overrides.progress ?? 0,
    start_time: null,
    due_time: overrides.due_time ?? null,
    reminder_time: null,
    recurrence_type: overrides.recurrence_type ?? null,
    recurrence_days: overrides.recurrence_days ?? null,
    category_id: null,
    parent_id: null,
    sort: 0,
    estimated_pomodoro: 0,
    ai_meta: null,
    created_at: Date.now(),
    updated_at: Date.now(),
    target_date: overrides.target_date ?? '',
  };
}

describe('getTasksForDate', () => {
  it('returns tasks matching a given date', () => {
    const tasks: TaskRow[] = [
      makeTask({ id: 't1', title: 'A', target_date: '2026-06-16' }),
      makeTask({ id: 't2', title: 'B', target_date: '2026-06-17' }),
      makeTask({ id: 't3', title: 'C', target_date: '' }),
    ];

    const jun16 = getTasksForDate(tasks, '2026-06-16');
    expect(jun16).toHaveLength(1);
    expect(jun16[0].title).toBe('A');
  });

  it('excludes tasks with no target_date', () => {
    const tasks: TaskRow[] = [
      makeTask({ id: 't1', title: 'No date', target_date: '' }),
    ];

    const result = getTasksForDate(tasks, '2026-06-16');
    expect(result).toHaveLength(0);
  });

  it('includes weekly recurring tasks that match the date day-of-week', () => {
    // June 19, 2026 is a Friday (day 5), June 18 is a Thursday (day 4)
    const tasks: TaskRow[] = [
      makeTask({ id: 'r1', title: '健身', recurrence_type: 'weekly', recurrence_days: '[1,3,5]', target_date: '2026-06-17' }),
    ];

    const fri = getTasksForDate(tasks, '2026-06-19');
    expect(fri).toHaveLength(1);
    expect(fri[0].title).toBe('健身');

    const thu = getTasksForDate(tasks, '2026-06-18');
    expect(thu).toHaveLength(0);
  });

  it('does not double-count recurring task on its real target_date', () => {
    // June 17, 2026 is a Wednesday (day 3) — real instance + recurrence match
    const tasks: TaskRow[] = [
      makeTask({ id: 'r1', title: '站会', recurrence_type: 'weekly', recurrence_days: '[3]', target_date: '2026-06-17' }),
    ];

    const result = getTasksForDate(tasks, '2026-06-17');
    expect(result).toHaveLength(1);
  });
});

describe('buildDotsMap', () => {
  it('groups tasks by date and counts correctly', () => {
    const tasks: TaskRow[] = [
      makeTask({ id: 't1', title: 'A', priority: 1, target_date: '2026-06-16' }),
      makeTask({ id: 't2', title: 'B', priority: 1, target_date: '2026-06-16' }),
      makeTask({ id: 't3', title: 'C', priority: 3, target_date: '2026-06-16' }),
      makeTask({ id: 't4', title: 'D', priority: 2, target_date: '2026-06-17' }),
    ];

    const map = buildDotsMap(tasks, 2026, 5); // month=5 → June (month+1)
    expect(map.size).toBe(2);

    const jun16 = map.get('2026-06-16');
    expect(jun16).toBeDefined();
    expect(jun16!.count).toBe(3);
    expect(jun16!.priorities).toEqual([1, 3]);

    const jun17 = map.get('2026-06-17');
    expect(jun17).toBeDefined();
    expect(jun17!.count).toBe(1);
    expect(jun17!.priorities).toEqual([2]);
  });

  it('ignores tasks outside target year/month', () => {
    const tasks: TaskRow[] = [
      makeTask({ id: 't1', target_date: '2026-05-31' }),
      makeTask({ id: 't2', target_date: '2026-07-01' }),
      makeTask({ id: 't3', target_date: '2025-06-16' }),
    ];

    const map = buildDotsMap(tasks, 2026, 5); // June 2026
    expect(map.size).toBe(0);
  });

  it('ignores tasks with empty target_date', () => {
    const tasks: TaskRow[] = [
      makeTask({ id: 't1', title: 'No date', target_date: '' }),
      makeTask({ id: 't2', title: 'Has date', target_date: '2026-06-16' }),
    ];

    const map = buildDotsMap(tasks, 2026, 5);
    expect(map.size).toBe(1);
    expect(map.get('2026-06-16')!.count).toBe(1);
  });

  it('virtually expands weekly recurring tasks across matching days', () => {
    // June 2026: Mon=1,8,15,22,29  Wed=3,10,17,24  Fri=5,12,19,26
    // Task has real instance on June 17 (Wed) + recurrence [1,3,5] (Mon,Wed,Fri)
    const tasks: TaskRow[] = [
      makeTask({
        id: 'r1', title: '健身', priority: 2,
        recurrence_type: 'weekly', recurrence_days: '[1,3,5]',
        target_date: '2026-06-17',
      }),
    ];

    const map = buildDotsMap(tasks, 2026, 5);

    // June 17 (Wed): real instance + recurrence → count=1 (no double-count)
    const jun17 = map.get('2026-06-17');
    expect(jun17).toBeDefined();
    expect(jun17!.count).toBe(1);

    // June 19 (Fri): virtual expansion only
    const jun19 = map.get('2026-06-19');
    expect(jun19).toBeDefined();
    expect(jun19!.count).toBe(1);
    expect(jun19!.priorities).toEqual([2]);

    // June 22 (Mon): virtual expansion
    const jun22 = map.get('2026-06-22');
    expect(jun22).toBeDefined();
    expect(jun22!.count).toBe(1);

    // June 18 (Thu): no match → not in map
    expect(map.has('2026-06-18')).toBe(false);

    // All 13 matching days in June (Mon×5 + Wed×4 + Fri×4)
    expect(map.size).toBe(13);
  });

  it('virtual recurring tasks do not leak outside target month', () => {
    const tasks: TaskRow[] = [
      makeTask({
        id: 'r1', title: '周报', priority: 3,
        recurrence_type: 'weekly', recurrence_days: '[5]', // every Friday
        target_date: '2026-06-19',
      }),
    ];

    // July 2026 has 4 Fridays (3,10,17,24,31) — wait, July has 5 Fridays
    const mapJuly = buildDotsMap(tasks, 2026, 6); // July
    // Task's real target_date is June, not in July → no real instance
    // But virtual expansion should put it on July Fridays
    const julyFridays = ['2026-07-03', '2026-07-10', '2026-07-17', '2026-07-24', '2026-07-31'];
    for (const d of julyFridays) {
      expect(mapJuly.get(d)!.count).toBe(1);
    }
    expect(mapJuly.size).toBe(5);
  });
});
