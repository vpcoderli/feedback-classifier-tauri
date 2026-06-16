<script setup lang="ts">
import { onMounted } from "vue";
import { useBackendStore } from "./stores/backend";
import { Modal } from "@arco-design/web-vue";
import AppShell from "./components/layout/AppShell.vue";

const backend = useBackendStore();

onMounted(async () => {
  try {
    await backend.init();
  } catch (e: any) {
    Modal.error({
      title: "后端启动失败",
      content: String(e?.message || e),
    });
  }
});
</script>

<template>
  <AppShell />
</template>

<style scoped>
</style>
