<script setup lang="ts">
import { onMounted, ref, reactive } from "vue";
import {
  Card, Button, Empty, Modal, Form, FormItem, Input, Select, Option,
  Message, Space, Tag, Drawer, Textarea, Spin
} from "@arco-design/web-vue";
import { IconPlus, IconDelete, IconEdit, IconThunderbolt, IconPoweroff } from "@arco-design/web-vue/es/icon";
import { useModelsStore } from "../stores/models";
import { modelsApi, type ModelConfig } from "../api/models";

const store = useModelsStore();
const editorVisible = ref(false);
const editing = ref<Partial<ModelConfig> | null>(null);
const isNew = ref(true);

const discoveredModels = ref<{ id: string; label: string }[]>([]);
const discovering = ref(false);

const chatVisible = ref(false);
const chatTarget = ref<ModelConfig | null>(null);
const chatInput = ref("");
const chatLoading = ref(false);
const chatReply = ref("");

const form = reactive({
  name: "",
  baseUrl: "",
  model: "",
  apiKey: "",
});

function openNew() {
  isNew.value = true;
  editing.value = {};
  form.name = "";
  form.baseUrl = "";
  form.model = "";
  form.apiKey = "";
  discoveredModels.value = [];
  editorVisible.value = true;
}

function openEdit(m: ModelConfig) {
  isNew.value = false;
  editing.value = m;
  form.name = m.name;
  form.baseUrl = m.baseUrl;
  form.model = m.model;
  form.apiKey = m.apiKey || "";
  discoveredModels.value = [];
  editorVisible.value = true;
}

async function discover() {
  if (!form.baseUrl) {
    Message.warning("请先填写 API 地址");
    return;
  }
  discovering.value = true;
  try {
    const data = await modelsApi.discover({ baseUrl: form.baseUrl, apiKey: form.apiKey || null });
    discoveredModels.value = data.models;
    Message.success(`找到 ${data.models.length} 个模型`);
  } catch (e: any) {
    Message.error("发现失败：" + String(e?.message || e));
  } finally {
    discovering.value = false;
  }
}

async function save() {
  if (!form.baseUrl || !form.model) {
    Message.warning("API 地址和模型名必填");
    return;
  }
  try {
    if (isNew.value) {
      await modelsApi.create(form);
      Message.success("已创建");
    } else if (editing.value?.id) {
      await modelsApi.update(editing.value.id, form);
      Message.success("已更新");
    }
    editorVisible.value = false;
    await store.fetch();
  } catch (e: any) {
    Message.error(String(e?.message || e));
  }
}

async function remove(m: ModelConfig) {
  Modal.warning({
    title: "确认删除",
    content: `删除模型 "${m.name}"？`,
    onOk: async () => {
      await modelsApi.remove(m.id);
      Message.success("已删除");
      await store.fetch();
    },
  });
}

async function toggle(m: ModelConfig) {
  await modelsApi.toggle(m.id);
  Message.success(m.status === "online" ? "已下线" : "已上线");
  await store.fetch();
}

async function test(m: ModelConfig) {
  const hide = Message.loading({ content: "测试中...", duration: 0 });
  try {
    const res = await modelsApi.test(m.id);
    if ((res as any)?.success ?? true) {
      Message.success("连接成功");
    }
  } catch (e: any) {
    Message.error("测试失败：" + String(e?.message || e));
  } finally {
    if (typeof hide === "function") (hide as any)();
  }
}

function openChat(m: ModelConfig) {
  chatTarget.value = m;
  chatInput.value = "你好";
  chatReply.value = "";
  chatVisible.value = true;
}

async function sendChat() {
  if (!chatTarget.value) return;
  chatLoading.value = true;
  chatReply.value = "";
  try {
    const r = await modelsApi.chat(chatTarget.value.id, chatInput.value);
    chatReply.value = r.reply;
  } catch (e: any) {
    chatReply.value = "❌ " + String(e?.message || e);
  } finally {
    chatLoading.value = false;
  }
}

onMounted(() => store.fetch());
</script>

<template>
  <div class="models-view">
    <Card title="大模型配置" :bordered="false" class="glass">
      <template #extra>
        <Button type="primary" @click="openNew">
          <template #icon><IconPlus /></template>添加模型
        </Button>
      </template>
      <Empty v-if="!store.list.length" description="暂无模型，点击右上角添加" />
      <div v-else class="model-list">
        <div v-for="m in store.list" :key="m.id" class="model-card glass">
          <div class="model-head">
            <div>
              <div class="model-name">{{ m.name }}</div>
              <div class="model-id">{{ m.model }}</div>
            </div>
            <Tag :color="m.status === 'online' ? 'green' : 'gray'">
              {{ m.status === "online" ? "在线" : "离线" }}
            </Tag>
          </div>
          <div class="model-url">{{ m.baseUrl }}</div>
          <div class="model-actions">
            <Space>
              <Button size="mini" @click="test(m)"><template #icon><IconThunderbolt /></template>测试</Button>
              <Button size="mini" @click="openChat(m)">对话</Button>
              <Button size="mini" :type="m.status === 'online' ? 'outline' : 'primary'" @click="toggle(m)">
                <template #icon><IconPoweroff /></template>
                {{ m.status === "online" ? "下线" : "上线" }}
              </Button>
              <Button size="mini" @click="openEdit(m)"><template #icon><IconEdit /></template></Button>
              <Button size="mini" status="danger" @click="remove(m)"><template #icon><IconDelete /></template></Button>
            </Space>
          </div>
        </div>
      </div>
    </Card>

    <Drawer v-model:visible="editorVisible" :title="isNew ? '添加模型' : '编辑模型'" :width="480" @ok="save">
      <Form :model="form" layout="vertical">
        <FormItem label="API 地址 *">
          <Input v-model="form.baseUrl" placeholder="https://api.openai.com/v1" />
          <div class="hint">
            LM Studio: http://localhost:1234/v1<br />
            百炼 OpenAI: https://dashscope.aliyuncs.com/compatible-mode/v1<br />
            百炼 Anthropic: https://dashscope.aliyuncs.com/apps/anthropic
          </div>
        </FormItem>
        <FormItem label="API Key">
          <Input v-model="form.apiKey" placeholder="本地模型可留空" type="password" />
        </FormItem>
        <FormItem label="模型 *">
          <Space>
            <Select v-model="form.model" allow-create placeholder="选择或填写模型名" style="width: 280px">
              <Option v-for="m in discoveredModels" :key="m.id" :value="m.id">{{ m.label }}</Option>
            </Select>
            <Button :loading="discovering" @click="discover">拉取列表</Button>
          </Space>
        </FormItem>
        <FormItem label="名称（可选）">
          <Input v-model="form.name" placeholder="默认使用模型名" />
        </FormItem>
      </Form>
    </Drawer>

    <Modal v-model:visible="chatVisible" title="对话测试" :footer="false" :width="600">
      <div v-if="chatTarget" class="chat-meta">{{ chatTarget.name }} / {{ chatTarget.model }}</div>
      <Textarea v-model="chatInput" :rows="3" placeholder="输入测试消息" />
      <div class="chat-actions">
        <Button type="primary" :loading="chatLoading" @click="sendChat">发送</Button>
      </div>
      <div v-if="chatLoading" class="chat-loading"><Spin /></div>
      <div v-else-if="chatReply" class="chat-reply">{{ chatReply }}</div>
    </Modal>
  </div>
</template>

<style scoped>
.models-view {
  max-width: 1280px;
  margin: 0 auto;
}
.model-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
.model-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.model-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.model-name {
  font-weight: 600;
  font-size: 15px;
}
.model-id {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 4px;
}
.model-url {
  font-size: 11px;
  color: var(--text-3);
  word-break: break-all;
}
.hint {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 4px;
  line-height: 1.6;
}
.chat-meta {
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 8px;
}
.chat-actions {
  margin: 12px 0;
  text-align: right;
}
.chat-loading {
  text-align: center;
  padding: 24px;
}
.chat-reply {
  background: var(--bg-3);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  white-space: pre-wrap;
  font-size: 13px;
  line-height: 1.7;
  max-height: 320px;
  overflow-y: auto;
}
</style>
