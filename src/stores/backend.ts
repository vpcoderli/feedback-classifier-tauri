import { defineStore } from "pinia";
import { invoke } from "@tauri-apps/api/core";

export const useBackendStore = defineStore("backend", {
  state: () => ({
    port: 0 as number,
    ready: false,
    error: "" as string,
  }),
  getters: {
    baseURL: (state) => state.port ? `http://127.0.0.1:${state.port}` : "",
  },
  actions: {
    async init() {
      try {
        const port = await invoke<number>("get_port");
        this.port = port;
        this.ready = true;
      } catch (e: any) {
        this.error = String(e?.message || e);
        throw e;
      }
    },
  },
});
