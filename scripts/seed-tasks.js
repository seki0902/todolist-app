// 模拟用户行为：创建 10 个不同类型的任务（含 3 个循环任务）
const initSqlJs = require('sql.js');
const fs = require('fs');
const crypto = require('crypto');

const DB_PATH = 'C:\\Users\\EDY\\AppData\\Roaming\\focusflow-desktop\\focusflow.db';
const BACKUP_PATH = DB_PATH + '.backup-' + Date.now();

async function main() {
  // 1. 备份数据库
  fs.copyFileSync(DB_PATH, BACKUP_PATH);
  console.log('✅ 数据库已备份:', BACKUP_PATH);

  // 2. 加载数据库
  const SQL = await initSqlJs();
  const buffer = fs.readFileSync(DB_PATH);
  const db = new SQL.Database(buffer);

  // 3. 获取分类 ID
  function queryAll(sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length) stmt.bind(params);
    const rows = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  }

  const categories = queryAll('SELECT id, name FROM categories');
  const catMap = {};
  for (const c of categories) catMap[c.name] = c.id;
  console.log('📂 分类:', Object.keys(catMap).map(k => `${k}=${catMap[k].slice(0,8)}...`).join(', '));

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
  const now = Date.now();

  // 4. 构建 10 个任务
  const tasks = [
    {
      title: '修复登录页面样式错乱',
      description: '移动端 Safari 下登录按钮偏移，需要排查 flexbox 兼容性',
      priority: 1,        // P1 紧急
      status: 'in_progress',
      progress: 50,
      category: '工作',
      pomodoro: 3,
    },
    {
      title: '每周团队站会',
      description: '同步本周进度、阻塞项、下周计划',
      priority: 2,        // P2
      status: 'todo',
      progress: 0,
      category: '工作',
      pomodoro: 1,
      recurrence_type: 'weekly',
      recurrence_days: [1],  // 每周一
    },
    {
      title: '完成 React 进阶课程第5章',
      description: '学习 useMemo/useCallback 原理及性能优化实战',
      priority: 2,        // P2
      status: 'todo',
      progress: 0,
      category: '学习',
      pomodoro: 4,
    },
    {
      title: '每周健身打卡',
      description: '力量训练 + 有氧，每次至少 30 分钟',
      priority: 3,        // P3
      status: 'todo',
      progress: 0,
      category: '生活',
      pomodoro: 1,
      recurrence_type: 'weekly',
      recurrence_days: [1, 3, 5],  // 周一三五
    },
    {
      title: '去超市采购食材',
      description: '蔬菜、水果、牛奶、鸡蛋',
      priority: 3,        // P3
      status: 'todo',
      progress: 0,
      category: '生活',
      pomodoro: 1,
    },
    {
      title: '编写项目架构文档',
      description: '更新系统设计文档，补充最近的数据层改动说明',
      priority: 1,        // P1 紧急
      status: 'todo',
      progress: 0,
      category: '项目',
      pomodoro: 5,
    },
    {
      title: 'Code Review PR #42',
      description: '审查支付模块重构代码，关注事务边界和错误处理',
      priority: 2,        // P2
      status: 'todo',
      progress: 0,
      category: '工作',
      pomodoro: 2,
    },
    {
      title: '提交每周工作总结',
      description: '汇总本周完成的任务、遇到的问题和下周规划',
      priority: 3,        // P3
      status: 'todo',
      progress: 0,
      category: '工作',
      pomodoro: 1,
      recurrence_type: 'weekly',
      recurrence_days: [5],  // 每周五
    },
    {
      title: '整理书房桌面',
      description: '清理杂物、整理线缆、擦拭桌面',
      priority: 4,        // P4
      status: 'todo',
      progress: 0,
      category: '生活',
      pomodoro: 1,
    },
    {
      title: '学习 TypeScript 泛型进阶',
      description: '条件类型、映射类型、模板字面量类型的实战应用',
      priority: 3,        // P3
      status: 'in_progress',
      progress: 30,
      category: '学习',
      pomodoro: 3,
    },
  ];

  // 5. 插入任务
  const insert = db.prepare(`
    INSERT INTO tasks (
      id, title, description, priority, status, progress,
      start_time, due_time, reminder_time,
      recurrence_type, recurrence_days,
      category_id, parent_id, sort,
      estimated_pomodoro, ai_meta,
      created_at, updated_at, target_date
    ) VALUES (
      ?, ?, ?, ?, ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?,
      ?, ?,
      ?, ?, ?
    )
  `);

  let count = 0;
  for (const t of tasks) {
    const id = crypto.randomUUID();
    const dueTime = new Date(today);
    dueTime.setHours(23, 59, 0, 0);

    insert.run([
      id,
      t.title,
      t.description,
      t.priority,
      t.status,
      t.progress,
      null,                           // start_time
      dueTime.getTime(),              // due_time (today EOD)
      null,                           // reminder_time
      t.recurrence_type || null,
      t.recurrence_days ? JSON.stringify(t.recurrence_days) : null,
      catMap[t.category] || null,
      null,                           // parent_id
      count,                          // sort
      t.pomodoro,
      null,                           // ai_meta
      now + count,                    // created_at (staggered)
      now + count,                    // updated_at
      todayStr,                       // target_date = 今天
    ]);
    count++;

    const tag = t.recurrence_type ? ' 🔁' : '';
    console.log(`  ${count}. [P${t.priority}] ${t.title}${tag} (${t.category})`);
  }
  insert.free();

  // 6. 保存
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
  db.close();

  console.log(`\n✅ 成功写入 ${count} 个任务到数据库`);
  console.log(`📅 所有任务 target_date = ${todayStr}`);
  console.log(`🔁 循环任务: 每周站会(周一)、健身(一三五)、周报(周五)`);
  console.log(`💾 备份: ${BACKUP_PATH}`);
}

main().catch(err => {
  console.error('❌ 失败:', err.message);
  process.exit(1);
});
