import { create } from 'zustand';
import type { TagRow } from '../shared/types/database';
import { DBSyncEvent } from '../shared/types/ipc';

interface TagState {
  tags: TagRow[];
  loading: boolean;
  error: string | null;
  selectedTagIds: string[];

  loadTags: () => Promise<void>;
  createTag: (name: string) => Promise<TagRow | null>;
  deleteTag: (id: string) => Promise<boolean>;
  toggleSelectedTag: (tagId: string) => void;
  clearTagFilter: () => void;
  handleSync: (event: DBSyncEvent) => void;
  initSync: () => void;
}

export const useTagStore = create<TagState>((set, get) => ({
  tags: [],
  loading: false,
  error: null,
  selectedTagIds: [],

  loadTags: async () => {
    set({ loading: true, error: null });
    try {
      const response = await window.api.tag.list();
      if (response.success && response.data) {
        set({ tags: response.data, loading: false });
      } else {
        set({ error: response.error ?? 'Failed to load tags', loading: false });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  createTag: async (name: string) => {
    const response = await window.api.tag.create(name);
    if (response.success && response.data) {
      set((state) => ({ tags: [...state.tags, response.data!] }));
      return response.data;
    }
    return null;
  },

  deleteTag: async (id: string) => {
    const response = await window.api.tag.delete(id);
    if (response.success) {
      set((state) => ({
        tags: state.tags.filter((t) => t.id !== id),
        selectedTagIds: state.selectedTagIds.filter((tid) => tid !== id),
      }));
      return true;
    }
    return false;
  },

  toggleSelectedTag: (tagId: string) => {
    set((state) => {
      const exists = state.selectedTagIds.includes(tagId);
      return {
        selectedTagIds: exists
          ? state.selectedTagIds.filter((id) => id !== tagId)
          : [...state.selectedTagIds, tagId],
      };
    });
  },

  clearTagFilter: () => {
    set({ selectedTagIds: [] });
  },

  handleSync: (event: DBSyncEvent) => {
    if (event.table !== 'tags') return;

    const { tags } = get();

    switch (event.action) {
      case 'insert': {
        if (event.payload) {
          const newItems = Array.isArray(event.payload) ? event.payload : [event.payload];
          set({
            tags: [
              ...tags,
              ...newItems.filter(
                (nt: TagRow) => !tags.some((t) => t.id === nt.id)
              ),
            ],
          });
        } else {
          get().loadTags();
        }
        break;
      }
      case 'delete': {
        set({
          tags: tags.filter((t) => !event.ids.includes(t.id)),
          selectedTagIds: get().selectedTagIds.filter((tid) => !event.ids.includes(tid)),
        });
        break;
      }
    }
  },

  initSync: () => {
    window.api.app.onSync((event) => {
      get().handleSync(event);
    });
  },
}));
