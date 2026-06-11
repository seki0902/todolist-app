export interface TagRow {
  id: string;
  name: string;
}

export interface TaskTagRow {
  task_id: string;
  tag_id: string;
}

export interface CreateTagInput {
  id?: string;
  name: string;
}