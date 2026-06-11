import { create } from 'zustand';
import type { CategoryRow, CreateCategoryInput, UpdateCategoryInput } from '../shared/types/database';
import { DBSyncEvent } from '../shared/types/ipc';

interface CategoryState {
  categories: CategoryRow[];
  loading: boolean;
  error: string | null;

  loadCategories: () => Promise<void>;
  createCategory: (input: CreateCategoryInput) => Promise<CategoryRow | null>;
  updateCategory: (id: string, input: UpdateCategoryInput) => Promise<CategoryRow | null>;
  deleteCategory: (id: string) => Promise<boolean>;
  handleSync: (event: DBSyncEvent) => void;
  initSync: () => void;
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  loading: false,
  error: null,

  loadCategories: async () => {
    set({ loading: true, error: null });
    try {
      const response = await window.api.db.listCategories();
      if (response.success && response.data) {
        set({ categories: response.data, loading: false });
      } else {
        set({ error: response.error ?? 'Failed to load categories', loading: false });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      set({ error: message, loading: false });
    }
  },

  createCategory: async (input: CreateCategoryInput) => {
    const response = await window.api.db.createCategory(input);
    if (response.success && response.data) {
      set((state) => ({ categories: [...state.categories, response.data!] }));
      return response.data;
    }
    return null;
  },

  updateCategory: async (id: string, input: UpdateCategoryInput) => {
    const response = await window.api.db.updateCategory(id, input);
    if (response.success && response.data) {
      set((state) => ({
        categories: state.categories.map((c) => (c.id === id ? response.data! : c)),
      }));
      return response.data;
    }
    return null;
  },

  deleteCategory: async (id: string) => {
    const response = await window.api.db.deleteCategory(id);
    if (response.success) {
      set((state) => ({
        categories: state.categories.filter((c) => c.id !== id),
      }));
      return true;
    }
    return false;
  },

  handleSync: (event: DBSyncEvent) => {
    if (event.table !== 'categories') return;

    const { categories } = get();

    switch (event.action) {
      case 'insert': {
        if (event.payload) {
          const newItems = Array.isArray(event.payload) ? event.payload : [event.payload];
          set({
            categories: [
              ...categories,
              ...newItems.filter(
                (nc: CategoryRow) => !categories.some((c) => c.id === nc.id)
              ),
            ],
          });
        } else {
          get().loadCategories();
        }
        break;
      }
      case 'update': {
        if (event.payload) {
          const updated = Array.isArray(event.payload) ? event.payload[0] : event.payload;
          if (updated) {
            set({
              categories: categories.map((c) =>
                c.id === (updated as CategoryRow).id ? (updated as CategoryRow) : c
              ),
            });
          }
        } else {
          get().loadCategories();
        }
        break;
      }
      case 'delete': {
        set({
          categories: categories.filter((c) => !event.ids.includes(c.id)),
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
