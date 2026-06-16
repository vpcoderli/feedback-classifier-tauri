import { createApp } from "vue";
import { createPinia } from "pinia";
import ArcoVue from "@arco-design/web-vue";
import ArcoVueIcon from "@arco-design/web-vue/es/icon";
import App from "./App.vue";
import { router } from "./router";
import "./styles/theme.less";

document.body.setAttribute("arco-theme", "dark");

const app = createApp(App);
app.use(createPinia());
app.use(router);
app.use(ArcoVue);
app.use(ArcoVueIcon);
app.mount("#app");
