import type { Priority } from './database';

export interface ParseResult {
  title: string;
  description?: string;
  priority: Priority;
  due_time?: number;           // timestamp in milliseconds
  recurrence_type?: string;    // 'daily' | 'weekly' | 'monthly' | null
  recurrence_days?: number[];  // [1,3,5] = Mon/Wed/Fri (number[] at parse stage)
  estimated_pomodoro?: number;
  reminder_offset?: number;    // minutes before due_time
  category_id?: string;
  confidence: number;          // 0-1
  ai_hint: string;             // e.g. "已自动填写「重复：每天」"
  source: 'regex' | 'ollama';  // which parser produced this result
}

/** Stored in ai_meta JSON field on tasks created via AI parsing */
export interface AIMeta {
  source: 'regex' | 'ollama';
  confidence: number;
  raw_input: string;
  parsed_at: number; // Date.now()
}
