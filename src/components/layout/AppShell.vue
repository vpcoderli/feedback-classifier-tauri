<script setup lang="ts">
import { RouterView } from "vue-router";
import SideNav from "./SideNav.vue";
import TitleBar from "./TitleBar.vue";
</script>

<template>
  <div class="app-shell">
    <TitleBar />
    <div class="app-body">
      <SideNav />
      <main class="app-main">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}
.app-body {
  display: flex;
  flex: 1;
  overflow: hidden;
}
.app-main {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
}
</style>
