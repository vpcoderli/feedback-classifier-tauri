<script setup lang="ts">
import { minimizeWindow, toggleMaximize, closeWindow } from "../../tauri/ipc";
</script>

<template>
  <div class="title-bar" data-tauri-drag-region>
    <div class="title">反馈分类系统</div>
    <div class="window-controls">
      <button @click="minimizeWindow" class="btn-control">−</button>
      <button @click="toggleMaximize" class="btn-control">□</button>
      <button @click="closeWindow" class="btn-control btn-close">×</button>
    </div>
  </div>
</template>

<style scoped>
.title-bar {
  height: 40px;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  user-select: none;
  -webkit-app-region: drag;
}
.title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
}
.window-controls {
  display: flex;
  gap: 8px;
  -webkit-app-region: no-drag;
}
.btn-control {
  width: 32px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-2);
  cursor: pointer;
  border-radius: 4px;
  font-size: 16px;
  line-height: 1;
  transition: background 0.2s;
}
.btn-control:hover {
  background: rgba(255, 255, 255, 0.08);
}
.btn-close:hover {
  background: var(--danger);
  color: #fff;
}
</style>
