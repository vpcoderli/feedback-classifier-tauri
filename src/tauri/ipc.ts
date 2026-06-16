import { invoke } from "@tauri-apps/api/core";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

export async function saveDialog(defaultName: string): Promise<string | null> {
  return invoke<string | null>("save_dialog", { defaultName });
}

export async function quitApp(): Promise<void> {
  return invoke("quit_app");
}

export async function downloadToPath(url: string, savePath: string): Promise<void> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`下载失败: ${res.status}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  await invoke("write_file_bytes", { path: savePath, bytes: Array.from(buf) });
}

export function onFileDrop(callback: (paths: string[]) => void): () => void {
  const win = getCurrentWebviewWindow();
  const unlistenPromise = win.onDragDropEvent((event) => {
    if (event.payload.type === "drop") {
      callback(event.payload.paths);
    }
  });
  return () => {
    unlistenPromise.then((fn) => fn());
  };
}

export async function readFileBytes(path: string): Promise<Uint8Array> {
  const arr = await invoke<number[]>("read_file_bytes", { path });
  return new Uint8Array(arr);
}

export function basename(path: string): string {
  const norm = path.replace(/\\/g, "/");
  return norm.substring(norm.lastIndexOf("/") + 1) || "file";
}

export async function minimizeWindow() {
  await getCurrentWebviewWindow().minimize();
}
export async function toggleMaximize() {
  await getCurrentWebviewWindow().toggleMaximize();
}
export async function closeWindow() {
  await getCurrentWebviewWindow().close();
}
