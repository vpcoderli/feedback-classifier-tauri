import { get, post, put, del, postFormData } from "./client";

export interface RuleMeta {
  id: string;
  name: string;
  description: string;
  filePath: string;
  fileName: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

export interface RuleWithContent extends RuleMeta {
  content: string;
}

export const rulesApi = {
  list(): Promise<RuleMeta[]> {
    return get<RuleMeta[]>("/api/rules");
  },

  get(id: string): Promise<RuleMeta> {
    return get<RuleMeta>(`/api/rules/${id}`);
  },

  content(id: string): Promise<RuleWithContent> {
    return get<RuleWithContent>(`/api/rules/${id}/content`);
  },

  upload(file: File, name: string, description: string): Promise<RuleMeta> {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", name);
    fd.append("description", description);
    return postFormData<RuleMeta>("/api/rules/upload", fd);
  },

  saveContent(id: string, content: string) {
    return put<void>(`/api/rules/${id}/content`, { content });
  },

  updateMeta(id: string, payload: { name?: string; description?: string }) {
    return put<RuleMeta>(`/api/rules/${id}`, payload);
  },

  remove(id: string) {
    return del<void>(`/api/rules/${id}`);
  },

  activate(id: string) {
    return post<RuleMeta>(`/api/rules/${id}/activate`);
  },
};
