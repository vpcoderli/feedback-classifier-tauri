import { defineStore } from "pinia";

export const useClassifierStore = defineStore("classifier", {
  state: () => ({
    sessionId: null as string | null,
    taskId: null as string | null,
    sheets: [] as any[],
    selectedSheet: "",
    selectedColumn: "",
    useLLM: false,
    result: null as any,
  }),
});
