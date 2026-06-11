import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { useCategoryStore } from '../../store/useCategoryStore';
import { LayoutGrid } from 'lucide-react';

interface CategorySidebarProps {
  selectedId: string | null;
  dragOverId: string | null;
  onSelect: (id: string | null) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  '#3B82F6': 'bg-blue-500',
  '#8B5CF6': 'bg-purple-500',
  '#10B981': 'bg-emerald-500',
  '#F59E0B': 'bg-amber-500',
};

function AllTasksButton({
  isSelected,
  isDragOver,
  onClick,
}: {
  isSelected: boolean;
  isDragOver: boolean;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: 'cat:none' });
  const highlight = isDragOver || isOver;

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all duration-200 ${
        highlight
          ? 'bg-primary/20 ring-2 ring-primary/50 scale-[1.03] text-foreground font-medium'
          : isSelected
            ? 'bg-white/60 dark:bg-white/10 backdrop-blur text-foreground font-medium shadow-sm'
            : 'text-muted-foreground hover:bg-white/40 dark:hover:bg-white/5 hover:text-foreground'
      }`}
    >
      <span className="flex h-2 w-2 rounded-full bg-muted-foreground/40" />
      全部任务
      {highlight && (
        <span className="ml-auto text-xs text-primary animate-pulse">解除分类</span>
      )}
    </button>
  );
}

function CategoryDropButton({
  catId,
  catName,
  catColor,
  isSelected,
  isDragOver,
  onClick,
}: {
  catId: string;
  catName: string;
  catColor?: string | null;
  isSelected: boolean;
  isDragOver: boolean;
  onClick: () => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `cat:${catId}` });

  const highlight = isDragOver || isOver;

  return (
    <button
      ref={setNodeRef}
      onClick={onClick}
      className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-all duration-200 ${
        highlight
          ? 'bg-primary/20 ring-2 ring-primary/50 scale-[1.03] text-foreground font-medium'
          : isSelected
            ? 'bg-white/60 dark:bg-white/10 backdrop-blur text-foreground font-medium shadow-sm'
            : 'text-muted-foreground hover:bg-white/40 dark:hover:bg-white/5 hover:text-foreground'
      }`}
    >
      <span
        className={`flex h-2 w-2 rounded-full ${
          CATEGORY_COLORS[catColor ?? ''] ?? 'bg-primary'
        }`}
      />
      {catName}
      {highlight && (
        <span className="ml-auto text-xs text-primary animate-pulse">释放到这里</span>
      )}
    </button>
  );
}

export const CategorySidebar: React.FC<CategorySidebarProps> = ({
  selectedId,
  dragOverId,
  onSelect,
}) => {
  const { categories } = useCategoryStore();

  return (
    <aside className="flex h-full w-56 flex-col p-4">
      <div className="flex items-center gap-2 mb-4">
        <LayoutGrid className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold text-foreground">分类</span>
        <span className="text-xs text-muted-foreground ml-auto">可拖入</span>
      </div>

      <nav className="flex flex-col gap-1">
        <AllTasksButton
          isSelected={selectedId === null}
          isDragOver={dragOverId === 'cat:none'}
          onClick={() => onSelect(null)}
        />

        {categories.map((cat) => (
          <CategoryDropButton
            key={cat.id}
            catId={cat.id}
            catName={cat.name}
            catColor={cat.color}
            isSelected={selectedId === cat.id}
            isDragOver={dragOverId === `cat:${cat.id}`}
            onClick={() => onSelect(cat.id)}
          />
        ))}
      </nav>
    </aside>
  );
};
