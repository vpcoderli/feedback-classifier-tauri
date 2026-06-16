<script setup lang="ts">
import { onMounted, ref, reactive } from "vue";
import {
  Card, Button, Empty, Modal, Form, FormItem, Input, Textarea,
  Message, Space, Tag, Drawer, Upload
} from "@arco-design/web-vue";
import { IconPlus, IconDelete, IconEdit, IconCheckCircle, IconBookmark } from "@arco-design/web-vue/es/icon";
import { useRulesStore } from "../stores/rules";
import { rulesApi, type RuleMeta } from "../api/rules";

const store = useRulesStore();
const uploadVisible = ref(false);
const editorVisible = ref(false);
const currentRule = ref<RuleMeta | null>(null);

const upload = reactive({
  name: "",
  description: "",
  file: null as File | null,
});

const editor = reactive({
  name: "",
  description: "",
  content: "",
});

function openUpload() {
  upload.name = "";
  upload.description = "";
  upload.file = null;
  uploadVisible.value = true;
}

function onFileSelected(fileList: any[]) {
  if (fileList[0]?.file) {
    upload.file = fileList[0].file;
    if (!upload.name) upload.name = fileList[0].file.name.replace(/\.md$/, "");
  }
}

async function doUpload() {
  if (!upload.file) {
    Message.warning("请选择文件");
    return;
  }
  try {
    await rulesApi.upload(upload.file, upload.name, upload.description);
    Message.success("上传成功");
    uploadVisible.value = false;
    await store.fetch();
  } catch (e: any) {
    Message.error(String(e?.message || e));
  }
}

async function openEdit(r: RuleMeta) {
  try {
    const data = await rulesApi.content(r.id);
    currentRule.value = r;
    editor.name = data.name;
    editor.description = data.description || "";
    editor.content = data.content;
    editorVisible.value = true;
  } catch (e: any) {
    Message.error(String(e?.message || e));
  }
}

async function saveContent() {
  if (!currentRule.value) return;
  try {
    await rulesApi.saveContent(currentRule.value.id, editor.content);
    if (editor.name !== currentRule.value.name || editor.description !== currentRule.value.description) {
      await rulesApi.updateMeta(currentRule.value.id, {
        name: editor.name,
        description: editor.description,
      });
    }
    Message.success("已保存");
    editorVisible.value = false;
    await store.fetch();
  } catch (e: any) {
    Message.error(String(e?.message || e));
  }
}

async function remove(r: RuleMeta) {
  Modal.warning({
    title: "确认删除",
    content: `删除规则 "${r.name}"？`,
    onOk: async () => {
      await rulesApi.remove(r.id);
      Message.success("已删除");
      await store.fetch();
    },
  });
}

async function activate(r: RuleMeta) {
  await rulesApi.activate(r.id);
  Message.success("已激活");
  await store.fetch();
}

onMounted(() => store.fetch());
</script>

<template>
  <div class="rules-view">
    <Card title="分类规则" :bordered="false" class="glass">
      <template #extra>
        <Button type="primary" @click="openUpload">
          <template #icon><IconPlus /></template>上传规则
        </Button>
      </template>
      <Empty v-if="!store.list.length" description="暂无规则，点击右上角上传" />
      <div v-else class="rule-list">
        <div v-for="r in store.list" :key="r.id" class="rule-card glass">
          <div class="rule-head">
            <div>
              <div class="rule-name">
                <IconBookmark style="color: var(--primary)" />
                {{ r.name }}
              </div>
              <div class="rule-desc">{{ r.description || "无描述" }}</div>
            </div>
            <Tag :color="r.status === 'active' ? 'green' : 'gray'">
              {{ r.status === "active" ? "已激活" : "未激活" }}
            </Tag>
          </div>
          <div class="rule-meta">
            更新于 {{ new Date(r.updatedAt).toLocaleString() }}
          </div>
          <div class="rule-actions">
            <Space>
              <Button v-if="r.status !== 'active'" size="mini" type="primary" @click="activate(r)">
                <template #icon><IconCheckCircle /></template>激活
              </Button>
              <Button size="mini" @click="openEdit(r)">
                <template #icon><IconEdit /></template>编辑
              </Button>
              <Button size="mini" status="danger" @click="remove(r)">
                <template #icon><IconDelete /></template>
              </Button>
            </Space>
          </div>
        </div>
      </div>
    </Card>

    <Modal v-model:visible="uploadVisible" title="上传规则" @ok="doUpload">
      <Form :model="upload" layout="vertical">
        <FormItem label="规则名称">
          <Input v-model="upload.name" placeholder="例如：医院反馈分类规则 v1" />
        </FormItem>
        <FormItem label="描述">
          <Input v-model="upload.description" placeholder="可选" />
        </FormItem>
        <FormItem label="规则文件 *">
          <Upload
            :auto-upload="false"
            accept=".md"
            :limit="1"
            @change="(fileList: any) => onFileSelected(Array.isArray(fileList) ? fileList : [fileList])"
          />
        </FormItem>
      </Form>
    </Modal>

    <Drawer v-model:visible="editorVisible" :width="720" title="编辑规则" @ok="saveContent">
      <Form :model="editor" layout="vertical">
        <FormItem label="名称">
          <Input v-model="editor.name" />
        </FormItem>
        <FormItem label="描述">
          <Input v-model="editor.description" />
        </FormItem>
        <FormItem label="规则内容（Markdown）">
          <Textarea v-model="editor.content" :auto-size="{ minRows: 18, maxRows: 30 }" class="mono" />
        </FormItem>
      </Form>
    </Drawer>
  </div>
</template>

<style scoped>
.rules-view {
  max-width: 1280px;
  margin: 0 auto;
}
.rule-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
.rule-card {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.rule-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}
.rule-name {
  font-weight: 600;
  font-size: 15px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.rule-desc {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 4px;
}
.rule-meta {
  font-size: 11px;
  color: var(--text-3);
}
.mono :deep(textarea) {
  font-family: "JetBrains Mono", "SF Mono", Menlo, monospace;
  font-size: 12px;
  line-height: 1.6;
}
</style>
