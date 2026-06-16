import { get, post, postFormData, del, downloadURL } from "./client";

export interface SheetMeta {
  name: string;
  columns: string[];
}

export interface ParseResult {
  sessionId: string;
  originalFileName: string;
  sheets: SheetMeta[];
}

export interface ClassifyTask {
  id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress: { current: number; total: number; percentage: number; message?: string };
  result?: ClassifyResult | null;
  error?: string | null;
  createdAt?: string;
}

export interface ClassifyResult {
  id: string;
  totalCount: number;
  statistics: any;
  preview: any[];
  downloadUrl: string;
}

export interface HistoryRecord {
  id: string;
  originalFile: string;
  outputFile: string;
  method: "llm" | "keyword";
  ruleId: string;
  modelId: string | null;
  statistics: any;
  totalCount: number;
  createdAt: string;
}

export const uploadApi = {
  parse(file: File): Promise<ParseResult> {
    const fd = new FormData();
    fd.append("file", file);
    return postFormData<ParseResult>("/api/upload/parse", fd);
  },

  classify(payload: { sessionId: string; sheetName: string; columnName: string; useLLM: boolean }): Promise<ClassifyTask> {
    return post<ClassifyTask>("/api/upload/classify", payload);
  },

  status(id: string): Promise<ClassifyTask> {
    return get<ClassifyTask>(`/api/upload/classify-status/${id}`);
  },

  history(): Promise<HistoryRecord[]> {
    return get<HistoryRecord[]>("/api/upload/history");
  },

  detail(id: string): Promise<HistoryRecord> {
    return get<HistoryRecord>(`/api/upload/history/${id}`);
  },

  remove(id: string): Promise<void> {
    return del(`/api/upload/history/${id}`);
  },

  downloadUrl(id: string): string {
    return downloadURL(`/api/upload/download/${id}`);
  },
};
