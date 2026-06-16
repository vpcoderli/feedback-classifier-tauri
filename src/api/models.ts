import { get, post, put, del } from "./client";

export interface ModelConfig {
  id: string;
  name: string;
  type: "openai" | "lmstudio" | "anthropic";
  baseUrl: string;
  model: string;
  apiKey: string | null;
  status: "online" | "offline";
  createdAt: string;
  updatedAt: string;
}

export const modelsApi = {
  list(): Promise<ModelConfig[]> {
    return get<ModelConfig[]>("/api/models");
  },

  discover(payload: { baseUrl: string; apiKey?: string | null }) {
    return post<{ type: string; models: any[] }>("/api/models/discover", payload);
  },

  create(payload: Partial<ModelConfig>): Promise<ModelConfig> {
    return post<ModelConfig>("/api/models", payload);
  },

  update(id: string, payload: Partial<ModelConfig>): Promise<ModelConfig> {
    return put<ModelConfig>(`/api/models/${id}`, payload);
  },

  remove(id: string): Promise<void> {
    return del(`/api/models/${id}`);
  },

  test(id: string) {
    return post<any>(`/api/models/${id}/test`);
  },

  chat(id: string, message: string) {
    return post<{ reply: string }>(`/api/models/${id}/chat`, { message });
  },

  toggle(id: string): Promise<ModelConfig> {
    return post<ModelConfig>(`/api/models/${id}/toggle`);
  },
};
