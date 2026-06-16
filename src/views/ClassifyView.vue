<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from "vue";
import { Card, Button, Select, Option, Switch, Progress, Result, Space, Tag, Message, Spin, Table } from "@arco-design/web-vue";
import { IconUpload, IconFile, IconRefresh, IconDownload, IconCheckCircleFill } from "@arco-design/web-vue/es/icon";
import { uploadApi, type ParseResult, type ClassifyTask, type ClassifyResult } from "../api/upload";
import { onFileDrop, saveDialog, downloadToPath } from "../tauri/ipc";
import { useBackendStore } from "../stores/backend";

type Stage = "idle" | "parsing" | "ready" | "classifying" | "done" | "error";

const backend = useBackendStore();
const stage = ref<Stage>("idle");
const fileName = ref("");
const file = ref<File | null>(null);
const parseResult = ref<ParseResult | null>(null);
const sheetName = ref("");
const columnName = ref("");
const useLLM = ref(false);
const task = ref<ClassifyTask | null>(null);
const result = ref<ClassifyResult | null>(null);
const errorMsg = ref("");

const fileInputRef = ref<HTMLInputElement | null>(null);
let pollTimer: number | null = null;
let unlistenDrop: (() => void) | null = null;

const DEFAULT_SHEET = "Sheet2";
const DEFAULT_COLUMN = "您想给医院的其他建议或意见";

watch(() => parseResult.value, (pr) => {
  if (!pr) return;
  const matched = pr.sheets.find((s) => s.name === DEFAULT_SHEET) || pr.sheets[0];
  if (matched) {
    sheetName.value = matched.name;
    if (matched.columns.includes(DEFAULT_COLUMN)) {
      columnName.value = DEFAULT_COLUMN;
    } else {
      columnName.value = matched.columns[0] || "";
    }
  }
});

function pickFile() {
  fileInputRef.value?.click();
}

async function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  const f = target.files?.[0];
  if (f) await ingestFile(f);
}

async function ingestFile(f: File) {
  if (!/\.(xlsx|xls)$/i.test(f.name)) {
    Message.error("仅支持 .xlsx / .xls");
    return;
  }
  file.value = f;
  fileName.value = f.name;
  stage.value = "parsing";
  errorMsg.value = "";
  try {
    parseResult.value = await uploadApi.parse(f);
    stage.value = "ready";
  } catch (e: any) {
    errorMsg.value = String(e?.message || e);
    stage.value = "error";
  }
}

async function ingestFromPath(path: string) {
  try {
    const blob = await (await fetch(`file://${path}`)).blob();
    const f = new File([blob], path.split("/").pop() || "file.xlsx");
    await ingestFile(f);
  } catch {
    Message.warning("拖入文件不支持，请改用点击选择");
  }
}

async function startClassify() {
  if (!parseResult.value || !sheetName.value || !columnName.value) {
    Message.warning("请选择工作表与列");
    return;
  }
  stage.value = "classifying";
  try {
    const t = await uploadApi.classify({
      sessionId: parseResult.value.sessionId,
      sheetName: sheetName.value,
      columnName: columnName.value,
      useLLM: useLLM.value,
    });
    task.value = t;
    pollTimer = window.setInterval(poll, 1000);
  } catch (e: any) {
    errorMsg.value = String(e?.message || e);
    stage.value = "error";
  }
}

async function poll() {
  if (!task.value) return;
  try {
    const t = await uploadApi.status(task.value.id);
    task.value = t;
    if (t.status === "completed") {
      stopPoll();
      result.value = t.result || null;
      stage.value = "done";
    } else if (t.status === "failed") {
      stopPoll();
      errorMsg.value = t.error || "分类失败";
      stage.value = "error";
    }
  } catch (e: any) {
    stopPoll();
    errorMsg.value = String(e?.message || e);
    stage.value = "error";
  }
}

function stopPoll() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

async function downloadResult() {
  if (!result.value) return;
  const defaultName = `分类结果_${new Date().toISOString().slice(0, 10)}.xlsx`;
  try {
    const target = await saveDialog(defaultName);
    if (!target) return;
    await downloadToPath(`${backend.baseURL}${result.value.downloadUrl}`, target);
    Message.success("已保存");
  } catch (e: any) {
    Message.error("保存失败：" + String(e?.message || e));
  }
}

function reset() {
  stage.value = "idle";
  file.value = null;
  fileName.value = "";
  parseResult.value = null;
  task.value = null;
  result.value = null;
  errorMsg.value = "";
}

const availableColumns = (() => {
  return () => {
    const sheet = parseResult.value?.sheets.find((s) => s.name === sheetName.value);
    return sheet?.columns || [];
  };
})();

onMounted(() => {
  unlistenDrop = onFileDrop((paths) => {
    if (paths[0]) ingestFromPath(paths[0]);
  });
});

onUnmounted(() => {
  stopPoll();
  unlistenDrop?.();
});
</script>

<template>
  <div class="classify-view">
    <!-- 空态 -->
    <div v-if="stage === 'idle' || stage === 'parsing'" class="hero">
      <div
        class="drop-zone glass"
        @click="pickFile"
        @dragover.prevent
        @drop.prevent="(e) => { const f = e.dataTransfer?.files?.[0]; if (f) ingestFile(f); }"
      >
        <Spin v-if="stage === 'parsing'" />
        <template v-else>
          <IconUpload class="drop-icon" />
          <div class="drop-title">拖入 Excel 文件 或 点击选择</div>
          <div class="drop-hint">支持 .xlsx / .xls，单文件最大 10MB</div>
        </template>
        <input ref="fileInputRef" type="file" accept=".xlsx,.xls" hidden @change="onFileChange" />
      </div>
    </div>

    <!-- 解析后选择 sheet/列 -->
    <Card v-else-if="stage === 'ready'" class="glass" :bordered="false">
      <template #title>
        <Space>
          <IconFile />
          <span>{{ fileName }}</span>
          <Button size="mini" type="text" @click="reset"><IconRefresh /></Button>
        </Space>
      </template>
      <div class="form-grid">
        <div>
          <div class="label">工作表</div>
          <Select v-model="sheetName">
            <Option v-for="s in parseResult?.sheets" :key="s.name" :value="s.name">{{ s.name }}</Option>
          </Select>
        </div>
        <div>
          <div class="label">反馈内容列</div>
          <Select v-model="columnName">
            <Option v-for="c in availableColumns()" :key="c" :value="c">{{ c }}</Option>
          </Select>
        </div>
        <div>
          <div class="label">使用 AI 分类</div>
          <Switch v-model="useLLM" />
          <span class="hint">{{ useLLM ? "更准确，速度较慢" : "关键词匹配，速度快" }}</span>
        </div>
      </div>
      <div class="actions">
        <Button type="primary" size="large" @click="startClassify">开始分类</Button>
      </div>
    </Card>

    <!-- 分类中 -->
    <Card v-else-if="stage === 'classifying'" class="glass" :bordered="false">
      <div class="progress-wrap">
        <Progress
          type="circle"
          :percent="task ? task.progress.percentage / 100 : 0"
          :width="160"
        />
        <div class="progress-msg">{{ task?.progress.message || "处理中..." }}</div>
        <div class="progress-meta">
          {{ task?.progress.current || 0 }} / {{ task?.progress.total || 0 }}
        </div>
      </div>
    </Card>

    <!-- 完成 -->
    <div v-else-if="stage === 'done' && result" class="result-area">
      <div class="kpi-row">
        <div class="kpi glass">
          <div class="kpi-label">总条数</div>
          <div class="kpi-value tnum">{{ result.totalCount }}</div>
        </div>
        <div
          v-for="item in result.statistics.slice(0, 3)"
          :key="item.category"
          class="kpi glass"
        >
          <div class="kpi-label">{{ item.category }}</div>
          <div class="kpi-value tnum">{{ item.count }}</div>
        </div>
      </div>

      <Card class="glass" :bordered="false">
        <template #title>
          <Space>
            <IconCheckCircleFill style="color: var(--success)" />
            <span>分类完成</span>
          </Space>
        </template>
        <template #extra>
          <Space>
            <Button @click="reset">重新开始</Button>
            <Button type="primary" @click="downloadResult"><template #icon><IconDownload /></template>下载结果</Button>
          </Space>
        </template>

        <div class="stat-tags">
          <Tag
            v-for="item in result.statistics"
            :key="item.category"
            color="purple"
            size="medium"
          >
            {{ item.category }} <span class="tnum">{{ item.count }}</span>
          </Tag>
        </div>

        <div class="preview-title">前 10 条预览</div>
        <Table :data="result.preview" :pagination="false" size="small">
          <template #columns>
            <Table-column
              v-for="key in Object.keys(result.preview[0] || {})"
              :key="key"
              :title="key"
              :data-index="key"
              ellipsis
              tooltip
            />
          </template>
        </Table>
      </Card>
    </div>

    <!-- 错误 -->
    <Result
      v-else-if="stage === 'error'"
      status="error"
      :title="errorMsg"
    >
      <template #extra>
        <Button type="primary" @click="reset">重试</Button>
      </template>
    </Result>
  </div>
</template>

<style scoped>
.classify-view {
  max-width: 1280px;
  margin: 0 auto;
}
.hero {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}
.drop-zone {
  width: 560px;
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: transform 0.2s, border-color 0.2s;
  border: 2px dashed var(--border);
}
.drop-zone:hover {
  transform: translateY(-2px);
  border-color: var(--primary);
}
.drop-icon {
  font-size: 48px;
  color: var(--primary);
  margin-bottom: 12px;
}
.drop-title {
  font-size: 16px;
  font-weight: 500;
  color: var(--text-1);
  margin-bottom: 6px;
}
.drop-hint {
  font-size: 12px;
  color: var(--text-3);
}
.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}
.label {
  font-size: 12px;
  color: var(--text-2);
  margin-bottom: 8px;
}
.hint {
  margin-left: 12px;
  font-size: 12px;
  color: var(--text-3);
}
.actions {
  display: flex;
  justify-content: flex-end;
}
.progress-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 0;
  gap: 16px;
}
.progress-msg {
  font-size: 14px;
  color: var(--text-1);
}
.progress-meta {
  font-size: 12px;
  color: var(--text-3);
}
.kpi-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}
.kpi {
  padding: 20px;
}
.kpi-label {
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 8px;
}
.kpi-value {
  font-size: 28px;
  font-weight: 600;
  color: var(--primary);
}
.stat-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 24px;
}
.preview-title {
  font-size: 13px;
  color: var(--text-2);
  margin: 16px 0 8px;
}
</style>
