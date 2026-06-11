export interface CategoryRow {
  id: string;
  name: string;
  color: string | null;
  sort: number;
  created_at: number;
}

export interface CreateCategoryInput {
  id?: string;
  name: string;
  color?: string | null;
  sort?: number;
}

export interface UpdateCategoryInput {
  name?: string;
  color?: string | null;
  sort?: number;
}