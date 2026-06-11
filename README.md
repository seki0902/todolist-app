# FocusFlow Desktop

Offline-first personal productivity desktop application — Full MVP.

## 🛠️ Technology Stack

| Layer        | Technology                                          |
| ------------ | --------------------------------------------------- |
| Desktop      | Electron 28                                         |
| Frontend     | React 18 + TypeScript 5                             |
| Bundler      | Vite 5 + vite-plugin-electron                       |
| Styling      | TailwindCSS 3                                      |
| Database     | SQLite (sql.js)                                     |
| State        | Zustand 4                                           |
| Drag & Drop  | @dnd-kit/core + sortable                            |
| Calendar     | FullCalendar 6                                      |
| Charts       | Recharts 2                                          |
| Icons        | Lucide React                                        |
| Packaging    | Electron Builder                                    |

## 🚀 Quick Start

```bash
# Initialize
npm install

# Development
npm run dev

# Production Build  
npm run build

# Generate Installer
npm run dist
```

## ✨ Features

### MVP Complete
- ✅ **Task Management** — CRUD, 5 states (待开始/进行中/暂停/已完成/已取消), P1-P4 priority with colors
- ✅ **Subtask Tree** — Infinite hierarchy via parent_id, indented display
- ✅ **Category System** — 4 defaults (工作/学习/生活/项目), customizable
- ✅ **Template System** — Create templates with steps, apply to generate task trees
- ✅ **Focus Mode** — Default home: focus task card, today's tasks, next-up suggestions
- ✅ **Pomodoro Timer** — 15/25/35/45/60min, circular progress, pause/resume, session count
- ✅ **Calendar View** — FullCalendar month/week views, task due dates
- ✅ **Statistics Dashboard** — Recharts: completion rate, priority/status distribution, pomodoro count
- ✅ **Drag & Drop** — @dnd-kit sortable task reordering
- ✅ **Dark Mode** — Light/Dark/System theme toggle
- ✅ **Search & Filter** — Title/description search, status filter, category sidebar

### Architecture
- 🔒 **Security**: sandbox=true, contextIsolation=true, CSP headers
- 📦 **Repository Pattern**: SQL in repositories only, never in IPC handlers
- 🔄 **Real-time Sync**: db:sync broadcast with optimistic merge
- 🗃️ **Migration System**: Version-tracked, auto-applied
- 💾 **Data**: sql.js (pure JS SQLite), file persistence

## 🏗️ Project Structure

```
focusflow/
├── electron/
│   ├── main/main.ts              # Electron main process
│   ├── preload/preload.ts        # contextBridge API
│   ├── db/                       # Database + migrations + seed
│   ├── repositories/             # Task, Category, Template CRUD
│   ├── ipc/                      # IPC handlers + db:sync
│   └── services/                 # Reserved
├── src/
│   ├── components/
│   │   ├── layout/AppLayout.tsx  # Main app shell + views
│   │   ├── sidebar/CategorySidebar.tsx
│   │   ├── tasks/
│   │   │   ├── TaskList.tsx      # @dnd-kit sortable list
│   │   │   ├── TaskItem.tsx      # Draggable task card
│   │   │   ├── TaskForm.tsx      # Create/Edit dialog
│   │   │   ├── PomodoroTimer.tsx # Circular countdown
│   │   │   ├── CalendarView.tsx  # FullCalendar
│   │   │   └── StatsView.tsx     # Recharts dashboard
│   │   └── ui/                   # Button, Input, Badge, Dialog, Select
│   ├── hooks/useTheme.tsx        # Theme provider + toggle
│   ├── store/                    # Zustand: useTaskStore, useCategoryStore
│   └── shared/types/             # Shared TypeScript types
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── electron-builder.yml
└── README.md
```

## 📄 License

MIT
