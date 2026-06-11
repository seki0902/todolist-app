import React, { useState, useEffect } from 'react';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Plus, X } from 'lucide-react';
import type { TagRow } from '../../shared/types/database';

const api = (window as any).api;

interface TagSelectProps {
  taskId: string;
  onTagsChange?: () => void;
}

export const TagSelect: React.FC<TagSelectProps> = ({ taskId, onTagsChange }) => {
  const [allTags, setAllTags] = useState<TagRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [newTagName, setNewTagName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (taskId) {
      loadTags();
      loadSelected();
    }
  }, [taskId]);

  const loadTags = async () => {
    const res = await api.tag.list();
    if (res.success) setAllTags(res.data);
  };

  const loadSelected = async () => {
    const res = await api.tag.getForTask(taskId);
    if (res.success) setSelectedIds(new Set(res.data.map((t: TagRow) => t.id)));
  };

  const toggleTag = async (tagId: string) => {
    const next = new Set(selectedIds);
    if (next.has(tagId)) next.delete(tagId);
    else next.add(tagId);
    setSelectedIds(next);
    await api.tag.setTaskTags(taskId, Array.from(next));
    onTagsChange?.();
  };

  const createTag = async () => {
    if (!newTagName.trim()) return;
    const res = await api.tag.create(newTagName.trim());
    if (res.success) {
      setAllTags([...allTags, res.data]);
      setNewTagName('');
      // Auto-select
      const next = new Set(selectedIds);
      next.add(res.data.id);
      setSelectedIds(next);
      await api.tag.setTaskTags(taskId, Array.from(next));
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-foreground">标签</label>
      <div className="flex flex-wrap gap-1.5">
        {allTags.map((tag) => {
          const selected = selectedIds.has(tag.id);
          return (
            <button
              key={tag.id}
              onClick={() => toggleTag(tag.id)}
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors ${
                selected
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {tag.name}
              {selected && <X className="h-3 w-3" />}
            </button>
          );
        })}
      </div>
      <div className="flex gap-1">
        <Input
          value={newTagName}
          onChange={(e) => setNewTagName(e.target.value)}
          placeholder="新标签..."
          className="h-8 text-xs"
          onKeyDown={(e) => e.key === 'Enter' && createTag()}
        />
        <Button size="xs" onClick={createTag} disabled={!newTagName.trim()}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};
