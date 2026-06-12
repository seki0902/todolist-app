export interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  category_id: string | null;
  created_at: number;
}

export interface TemplateStepRow {
  id: string;
  template_id: string;
  title: string;
  sort: number;
  default_priority: number;
  default_pomodoro: number;
}

export interface CreateTemplateInput {
  id?: string;
  name: string;
  description?: string | null;
  icon?: string | null;
  category_id?: string | null;
  steps?: CreateTemplateStepInput[];
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  icon?: string | null;
  category_id?: string | null;
}

export interface CreateTemplateStepInput {
  id?: string;
  title: string;
  sort: number;
  default_priority?: number;
  default_pomodoro?: number;
}