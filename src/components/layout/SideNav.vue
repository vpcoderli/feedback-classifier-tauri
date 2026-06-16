<script setup lang="ts">
import { useRouter } from "vue-router";
import { Menu, MenuItem } from "@arco-design/web-vue";
import { IconThunderbolt, IconHistory, IconRobot, IconBookmark } from "@arco-design/web-vue/es/icon";

const router = useRouter();
const items = [
  { key: "/classify", label: "分类工作台", icon: IconThunderbolt },
  { key: "/history", label: "历史记录", icon: IconHistory },
  { key: "/models", label: "大模型", icon: IconRobot },
  { key: "/rules", label: "分类规则", icon: IconBookmark },
];
</script>

<template>
  <aside class="side-nav">
    <div class="logo">📊 反馈分类</div>
    <Menu
      :default-selected-keys="[router.currentRoute.value.path]"
      @menu-item-click="(key: string) => router.push(key)"
    >
      <MenuItem v-for="item in items" :key="item.key">
        <template #icon><component :is="item.icon" /></template>
        {{ item.label }}
      </MenuItem>
    </Menu>
  </aside>
</template>

<style scoped>
.side-nav {
  width: 220px;
  background: var(--bg-2);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  padding: 16px 12px;
}
.logo {
  font-size: 16px;
  font-weight: 600;
  margin-bottom: 24px;
  color: var(--primary);
  text-align: center;
}
</style>
