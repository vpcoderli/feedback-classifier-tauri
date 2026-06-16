import { createRouter, createWebHashHistory } from "vue-router";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", redirect: "/classify" },
    {
      path: "/classify",
      name: "classify",
      component: () => import("../views/ClassifyView.vue"),
      meta: { title: "分类工作台", icon: "icon-thunderbolt" },
    },
    {
      path: "/history",
      name: "history",
      component: () => import("../views/HistoryView.vue"),
      meta: { title: "历史记录", icon: "icon-history" },
    },
    {
      path: "/models",
      name: "models",
      component: () => import("../views/ModelsView.vue"),
      meta: { title: "大模型", icon: "icon-robot" },
    },
    {
      path: "/rules",
      name: "rules",
      component: () => import("../views/RulesView.vue"),
      meta: { title: "分类规则", icon: "icon-bookmark" },
    },
  ],
});
