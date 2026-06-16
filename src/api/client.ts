import { Message } from "@arco-design/web-vue";
import { useBackendStore } from "../stores/backend";

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

function url(path: string): string {
  const backend = useBackendStore();
  if (!backend.baseURL) {
    throw new Error("后端尚未就绪");
  }
  return `${backend.baseURL}${path}`;
}

export async function get<T = any>(path: string): Promise<T> {
  const res = await fetch(url(path));
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) {
    Message.error(json.message || "请求失败");
    throw new Error(json.message || "请求失败");
  }
  return json.data as T;
}

export async function post<T = any>(path: string, body?: any): Promise<T> {
  const res = await fetch(url(path), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) {
    Message.error(json.message || "请求失败");
    throw new Error(json.message || "请求失败");
  }
  return json.data as T;
}

export async function put<T = any>(path: string, body?: any): Promise<T> {
  const res = await fetch(url(path), {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) {
    Message.error(json.message || "请求失败");
    throw new Error(json.message || "请求失败");
  }
  return json.data as T;
}

export async function del<T = any>(path: string): Promise<T> {
  const res = await fetch(url(path), { method: "DELETE" });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) {
    Message.error(json.message || "请求失败");
    throw new Error(json.message || "请求失败");
  }
  return json.data as T;
}

export async function postFormData<T = any>(path: string, form: FormData): Promise<T> {
  const res = await fetch(url(path), {
    method: "POST",
    body: form,
  });
  const json = (await res.json()) as ApiResponse<T>;
  if (!json.success) {
    Message.error(json.message || "请求失败");
    throw new Error(json.message || "请求失败");
  }
  return json.data as T;
}

export function downloadURL(path: string): string {
  return url(path);
}
