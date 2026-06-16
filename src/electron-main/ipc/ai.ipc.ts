import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '../../shared/types/ipc';
import type { IPCResponse } from '../../shared/types/database';
import type { ParseResult } from '../../shared/types/ai';
import { parseWithAI, resetOllamaCheck } from '../services/ai-parser.service';

export function registerAIIpcHandlers(): void {
  ipcMain.handle(
    IPC_CHANNELS.AI.PARSE,
    async (_event, text: string): Promise<IPCResponse<ParseResult[]>> => {
      try {
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
          return { success: false, error: '请输入任务描述' };
        }
        const results = await parseWithAI(text.trim());
        if (results.length === 0) {
          return { success: false, error: '未识别到任务，请尝试更具体的描述' };
        }
        return { success: true, data: results };
      } catch (err) {
        const message = err instanceof Error ? err.message : '解析失败';
        return { success: false, error: message };
      }
    }
  );

  ipcMain.handle(IPC_CHANNELS.AI.RESET_OLLAMA, async () => {
    resetOllamaCheck();
    return { success: true };
  });
}
