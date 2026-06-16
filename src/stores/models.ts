import { defineStore } from "pinia";
import { modelsApi, type ModelConfig } from "../api/models";

export const useModelsStore = defineStore("models", {
  state: () => ({
    list: [] as ModelConfig[],
    loading: false,
  }),
  actions: {
    async fetch() {
      this.loading = true;
      try {
        this.list = await modelsApi.list();
      } finally {
        this.loading = false;
      }
    },
  },
});
