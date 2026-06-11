export interface TemplateRow {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
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
  steps?: CreateTemplateStepInput[];
}

export interface UpdateTemplateInput {
  name?: string;
  description?: string | null;
  icon?: string | null;
}

export interface CreateTemplateStepInput {
  id?: string;
  title: string;
  sort: number;
  default_priority?: number;
  default_pomodoro?: number;
}