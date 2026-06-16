import { defineStore } from "pinia";
import { rulesApi, type RuleMeta } from "../api/rules";

export const useRulesStore = defineStore("rules", {
  state: () => ({
    list: [] as RuleMeta[],
    loading: false,
  }),
  actions: {
    async fetch() {
      this.loading = true;
      try {
        this.list = await rulesApi.list();
      } finally {
        this.loading = false;
      }
    },
  },
});
