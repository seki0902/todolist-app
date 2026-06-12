import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Select } from '../ui/Select';
import { Plus, Trash2, Download, Upload, Play, Database, HardDrive } from 'lucide-react';
import { useCategoryStore } from '../../store/useCategoryStore';
import { useTaskStore } from '../../store/useTaskStore';
import type { TemplateRow, PriorityStyle } from '../../shared/types/database';
import { getStoredPriorityStyle, setStoredPriorityStyle, getPriorityLabel, Priority } from '../../shared/types/database';

const api = (window as any).api;

interface ManageDialogProps {
  open: boolean;
  onClose: () => void;
}

export const ManageDialog: React.FC<ManageDialogProps> = ({ open, onClose }) => {
  const { categories, loadCategories, createCategory, deleteCategory } = useCategoryStore();
  const { tasks, loadTasks } = useTaskStore();
  const [newCatName, setNewCatName] = useState('');
  const [catSubmitting, setCatSubmitting] = useState(false);
  const [tab, setTab] = useState<'categories' | 'templates' | 'preferences' | 'data'>('categories');
  const [priorityStyle, setPriorityStyle] = useState<PriorityStyle>(getStoredPriorityStyle());

  // Templates state
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [newTplName, setNewTplName] = useState('');
  const [newTplDesc, setNewTplDesc] = useState('');
  const [newTplCategoryId, setNewTplCategoryId] = useState('');
  const [newTplSteps, setNewTplSteps] = useState<{ title: string; default_priority: number }[]>([]);

  const addStep = () => {
    setNewTplSteps([...newTplSteps, { title: '', default_priority: 3 }]);
  };

  const updateStepTitle = (idx: number, title: string) => {
    const steps = [...newTplSteps];
    steps[idx] = { ...steps[idx], title };
    setNewTplSteps(steps);
  };

  const removeStep = (idx: number) => {
    setNewTplSteps(newTplSteps.filter((_, i) => i !== idx));
  };

  const updateStepPriority = (idx: number, priority: number) => {
    const steps = [...newTplSteps];
    steps[idx] = { ...steps[idx], default_priority: priority };
    setNewTplSteps(steps);
  };

  // HTML5 drag and drop for step reorder (using ref to avoid stale state)
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const dragIdxRef = useRef<number | null>(null);

  const handleDragStart = (e: React.DragEvent, idx: number) => {
    setDragIdx(idx);
    dragIdxRef.current = idx;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(idx));
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const fromIdx = dragIdxRef.current;
    if (fromIdx === null || fromIdx === idx) return;
    const steps = [...newTplSteps];
    const [moved] = steps.splice(fromIdx, 1);
    steps.splice(idx, 0, moved);
    setNewTplSteps(steps);
    dragIdxRef.current = idx;
    setDragIdx(idx);
  };

  const handleDragEnd = () => {
    setDragIdx(null);
    dragIdxRef.current = null;
  };

  useEffect(() => {
    if (open) {
      loadCategories();
      loadTasks();
      loadTemplates();
    }
  }, [open]);

  const loadTemplates = async () => {
    const res = await api.db.listTemplates();
    if (res.success) setTemplates(res.data);
  };

  const handleAddCategory = async () => {
    if (!newCatName.trim() || catSubmitting) return;
    setCatSubmitting(true);
    try {
      await createCategory({ name: newCatName.trim() });
      setNewCatName('');
    } finally {
      setCatSubmitting(false);
    }
  };

  const handleCreateTemplate = async () => {
    if (!newTplName.trim()) return;
    const steps = newTplSteps.map((step, i) => ({
      title: step.title,
      sort: i + 1,
      default_priority: step.default_priority,
      default_pomodoro: 1,
    }));
    // Store category_id in description as JSON meta
    const meta = newTplCategoryId ? JSON.stringify({ category_id: newTplCategoryId }) : null;
    const desc = newTplDesc.trim() || null;
    const combinedDesc = [desc, meta].filter(Boolean).join('\n') || null;
    await api.db.createTemplate({
      name: newTplName.trim(),
      description: combinedDesc,
      steps: steps.length > 0 ? steps : undefined,
    });
    setNewTplName('');
    setNewTplDesc('');
    setNewTplCategoryId('');
    setNewTplSteps([]);
    loadTemplates();
  };

  const handleDeleteTemplate = async (id: string) => {
    await api.db.deleteTemplate(id);
    loadTemplates();
  };

  const handleApplyTemplate = async (id: string) => {
    await api.db.applyTemplate(id);
    loadTasks();
    // Notify silently — tasks appear in the list, no jarring alert needed
    const tpl = templates.find((t) => t.id === id);
    console.log(`Template "${tpl?.name}" applied successfully`);
  };

  const handleExport = () => {
    const data = { tasks, categories, exportedAt: Date.now() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `focusflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        if (data.tasks && Array.isArray(data.tasks)) {
          for (const task of data.tasks.slice(0, 100)) {
            try {
              await api.db.createTask({
                title: task.title || 'Imported',
                description: task.description,
                priority: task.priority,
                status: 'todo',
                category_id: task.category_id,
                parent_id: task.parent_id,
                estimated_pomodoro: task.estimated_pomodoro || 1,
                due_time: task.due_time,
              });
            } catch {}
          }
          loadTasks();
          alert(`导入了 ${data.tasks.length} 个任务`);
        }
      } catch {
        alert('无效的备份文件');
      }
    };
    input.click();
  };

  return (
    <Dialog open={open} onClose={onClose} title="管理">
      <div className="flex gap-2 mb-4">
        {(['categories', 'templates', 'preferences', 'data'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {t === 'categories' ? '分类' : t === 'templates' ? '模板' : t === 'preferences' ? '偏好' : '数据'}
          </button>
        ))}
      </div>

      {tab === 'categories' ? (
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input value={newCatName} onChange={(e) => setNewCatName(e.target.value)}
              placeholder="新分类名称" className="flex-1"
              onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()} />
            <Button onClick={handleAddCategory} size="sm"><Plus className="h-3 w-3" /></Button>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {categories.map((cat) => (
              <div key={cat.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: cat.color || '#888' }} />
                  <span className="text-sm">{cat.name}</span>
                </div>
                <button onClick={() => deleteCategory(cat.id)} className="rounded p-1 text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : tab === 'templates' ? (
        <div className="space-y-3">
          <div className="flex flex-col gap-2">
            <Input value={newTplName} onChange={(e) => setNewTplName(e.target.value)} placeholder="模板名称（如：短视频制作）" />
            <Input value={newTplDesc} onChange={(e) => setNewTplDesc(e.target.value)} placeholder="描述（可选）" />
            {/* Category selector */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">分类</label>
              <select
                value={newTplCategoryId}
                onChange={(e) => setNewTplCategoryId(e.target.value)}
                className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">无分类</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            {/* Steps management — vertical card layout with drag reorder */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">步骤列表（拖动 ⠿ 排序 · 直接编辑）</p>
              <div className="space-y-2 mb-2">
                {newTplSteps.map((step, idx) => (
                  <div
                    key={idx}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                      dragIdx === idx
                        ? 'border-primary bg-primary/5 shadow-md scale-[1.02]'
                        : 'border-border hover:border-muted-foreground/30 bg-card'
                    }`}
                  >
                    {/* Drag handle */}
                    <span className="cursor-grab text-muted-foreground/40 hover:text-muted-foreground flex-shrink-0 select-none mt-1">⠿</span>
                    {/* Step number + content */}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-2">
                        {/* Large step number */}
                        <span className="text-base font-bold text-primary flex-shrink-0">{idx + 1}.</span>
                        {/* Title input */}
                        <input
                          value={step.title}
                          onChange={(e) => updateStepTitle(idx, e.target.value)}
                          placeholder={`输入步骤 ${idx + 1} 名称...`}
                          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none border-b border-transparent focus:border-primary/30 pb-0.5"
                          autoFocus={step.title === ''}
                        />
                        {/* Delete */}
                        <button onClick={() => removeStep(idx)} className="text-muted-foreground hover:text-destructive flex-shrink-0 p-1 rounded hover:bg-destructive/10">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {/* Priority row */}
                      <div className="flex items-center gap-2 ml-6">
                        <span className="text-[10px] text-muted-foreground">优先级:</span>
                        <select
                          value={step.default_priority}
                          onChange={(e) => updateStepPriority(idx, Number(e.target.value))}
                          className="text-xs rounded-md border border-border bg-background px-2 py-1 flex-shrink-0 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                          {[Priority.P1, Priority.P2, Priority.P3, Priority.P4].map((p) => (
                            <option key={p} value={p}>{getPriorityLabel(p)}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Add step button */}
              <Button onClick={addStep} variant="outline" size="sm" className="w-full">
                <Plus className="h-3 w-3" /> 添加步骤
              </Button>
            </div>
            <Button onClick={handleCreateTemplate} size="sm"><Plus className="h-3 w-3" /> 创建模板</Button>
          </div>
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {templates.length === 0 && <p className="text-xs text-muted-foreground py-4 text-center">暂无模板</p>}
            {templates.map((tpl) => (
              <div key={tpl.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
                <div>
                  <span className="text-sm font-medium">{tpl.name}</span>
                  {tpl.description && <p className="text-xs text-muted-foreground">{tpl.description}</p>}
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => handleApplyTemplate(tpl.id)}
                    className="rounded p-1 text-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-950"
                    title="应用模板">
                    <Play className="h-3.5 w-3.5" />
                  </button>
                  <button onClick={() => handleDeleteTemplate(tpl.id)}
                    className="rounded p-1 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : tab === 'preferences' ? (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">🎨 偏好设置</h3>
          <p className="text-xs text-muted-foreground">自定义 FocusFlow 的显示风格，即时生效。</p>

          <div className="rounded-xl border border-border p-4 space-y-3">
            <p className="text-sm font-medium text-foreground">优先级标签风格</p>
            <Select
              value={priorityStyle}
              onChange={(v) => {
                const style = v as PriorityStyle;
                setPriorityStyle(style);
                setStoredPriorityStyle(style);
              }}
              options={[
                { value: 'clean', label: '简洁 — 非常紧急 / 紧急 / 一般 / 不着急' },
                { value: 'funny', label: '幽默 — 🔥火烧眉毛 / ⚡有点着急 / 📋悠着来 / 🧘随缘吧' },
              ]}
            />
            <div className="flex items-center gap-2 flex-wrap pt-2">
              <span className="text-xs text-muted-foreground">预览：</span>
              {[Priority.P1, Priority.P2, Priority.P3, Priority.P4].map((p) => (
                <span key={p} className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                  p === Priority.P1 ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300' :
                  p === Priority.P2 ? 'bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300' :
                  p === Priority.P3 ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300' :
                  'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                }`}>
                  {getPriorityLabel(p, priorityStyle)}
                </span>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* JSON 导入/导出 */}
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">JSON 格式</p>
          <Button onClick={handleExport} variant="outline" className="w-full">
            <Download className="h-4 w-4" /> 导出 JSON 备份
          </Button>
          <Button onClick={handleImport} variant="outline" className="w-full">
            <Upload className="h-4 w-4" /> 导入 JSON 备份
          </Button>
          <p className="text-xs text-muted-foreground">导入时创建新任务，不覆盖现有数据。</p>

          {/* 数据库备份/恢复 */}
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">数据库文件</p>
            <Button
              onClick={async () => {
                const res = await (window as any).api.backup.backup();
                if (res.success) alert(`数据库已备份到:\n${res.data}`);
                else if (res.error !== 'Cancelled') alert(`备份失败: ${res.error}`);
              }}
              variant="outline"
              className="w-full"
            >
              <Database className="h-4 w-4" /> 备份数据库文件 (.db)
            </Button>
            <Button
              onClick={async () => {
                if (!window.confirm('恢复数据库将替换当前所有数据，确定继续？')) return;
                const res = await (window as any).api.backup.restore();
                if (res.success) {
                  alert('数据库已恢复，请重启应用以加载新数据');
                  window.location.reload();
                } else if (res.error !== 'Cancelled') alert(`恢复失败: ${res.error}`);
              }}
              variant="outline"
              className="w-full mt-2"
            >
              <HardDrive className="h-4 w-4" /> 恢复数据库文件 (.db)
            </Button>
            <p className="text-xs text-muted-foreground">备份整个 SQLite 数据库文件（含所有任务和设置）。</p>
          </div>
        </div>
      )}
    </Dialog>
  );
};
