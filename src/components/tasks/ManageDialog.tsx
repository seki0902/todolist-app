import React, { useState, useEffect, useCallback } from 'react';
import { Dialog } from '../ui/Dialog';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Plus, Trash2, Download, Upload, Play, Database, HardDrive } from 'lucide-react';
import { useCategoryStore } from '../../store/useCategoryStore';
import { useTaskStore } from '../../store/useTaskStore';
import type { TemplateRow } from '../../shared/types/database';

const api = (window as any).api;

interface ManageDialogProps {
  open: boolean;
  onClose: () => void;
}

export const ManageDialog: React.FC<ManageDialogProps> = ({ open, onClose }) => {
  const { categories, loadCategories, createCategory, deleteCategory } = useCategoryStore();
  const { tasks, loadTasks } = useTaskStore();
  const [newCatName, setNewCatName] = useState('');
  const [tab, setTab] = useState<'categories' | 'templates' | 'data'>('categories');

  // Templates state
  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [newTplName, setNewTplName] = useState('');
  const [newTplDesc, setNewTplDesc] = useState('');
  const [newTplSteps, setNewTplSteps] = useState<string[]>([]);
  const [stepInput, setStepInput] = useState('');

  const addStep = () => {
    if (!stepInput.trim()) return;
    setNewTplSteps([...newTplSteps, stepInput.trim()]);
    setStepInput('');
  };

  const removeStep = (idx: number) => {
    setNewTplSteps(newTplSteps.filter((_, i) => i !== idx));
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
    if (!newCatName.trim()) return;
    await createCategory({ name: newCatName.trim() });
    setNewCatName('');
  };

  const handleCreateTemplate = async () => {
    if (!newTplName.trim()) return;
    const steps = newTplSteps.map((title, i) => ({
      title,
      sort: i + 1,
      default_priority: 3,
      default_pomodoro: 1,
    }));
    await api.db.createTemplate({
      name: newTplName.trim(),
      description: newTplDesc.trim() || null,
      steps: steps.length > 0 ? steps : undefined,
    });
    setNewTplName('');
    setNewTplDesc('');
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
        {(['categories', 'templates', 'data'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
            }`}
          >
            {t === 'categories' ? '分类' : t === 'templates' ? '模板' : '数据'}
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
            {/* Steps management */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">步骤（如：选题、写口播稿、剪辑...）</p>
              <div className="flex gap-1 mb-1.5">
                <Input
                  value={stepInput}
                  onChange={(e) => setStepInput(e.target.value)}
                  placeholder="输入步骤名称..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === 'Enter' && addStep()}
                />
                <Button onClick={addStep} size="sm" disabled={!stepInput.trim()}><Plus className="h-3 w-3" /></Button>
              </div>
              {newTplSteps.length > 0 && (
                <div className="space-y-1 mb-2">
                  {newTplSteps.map((step, idx) => (
                    <div key={idx} className="flex items-center gap-2 rounded-lg border border-border px-3 py-1.5 text-sm">
                      <span className="text-xs text-muted-foreground w-5">{idx + 1}.</span>
                      <span className="flex-1">{step}</span>
                      <button onClick={() => removeStep(idx)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
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
