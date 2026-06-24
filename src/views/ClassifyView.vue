<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { Card, Button, Select, Option, Switch, Progress, Result, Space, Tag, Message, Spin, Table, Modal, CheckboxGroup, Checkbox, Divider } from "@arco-design/web-vue";
import { IconUpload, IconFile, IconRefresh, IconDownload, IconCheckCircleFill } from "@arco-design/web-vue/es/icon";
import { uploadApi, type ParseResult, type ClassifyTask, type ClassifyResult } from "../api/upload";
import { onFileDrop, saveDialog, downloadToPath, readFileBytes, basename } from "../tauri/ipc";

type Stage = "idle" | "parsing" | "ready" | "classifying" | "done" | "error";

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

// Elapsed timer state
let elapsedTimer: number | null = null;
const elapsedSeconds = ref(0);
const elapsedTimeStr = ref("00:00");

// Log console state
const logs = ref<string[]>([]);
const consoleBodyRef = ref<HTMLDivElement | null>(null);
let lastLoggedProgress = -1;

// Preview state
const sheetPreview = ref<any[]>([]);
const loadingPreview = ref(false);

// Download Modal state
const downloadModalVisible = ref(false);
const exportColumns = ref<string[]>([]);
const selectAllColumns = ref(true);
const availableExportColumns = ref<string[]>([]);
const downloadingRecordId = ref("");

const DEFAULT_SHEET = "Sheet2";
const DEFAULT_COLUMN = "您想给医院的其他建议或意见";

const previewColumns = computed(() => {
  if (sheetPreview.value.length === 0) return [];
  return Object.keys(sheetPreview.value[0]).map(key => ({
    title: key,
    dataIndex: key,
    ellipsis: true,
    tooltip: true,
    width: 160,
  }));
});

watch(() => parseResult.value, async (pr) => {
  if (!pr) return;
  const matched = pr.sheets.find((s) => s.name === DEFAULT_SHEET) || pr.sheets[0];
  if (matched) {
    const oldName = sheetName.value;
    sheetName.value = matched.name;
    if (matched.columns.includes(DEFAULT_COLUMN)) {
      columnName.value = DEFAULT_COLUMN;
    } else {
      columnName.value = matched.columns[0] || "";
    }
    if (oldName === matched.name) {
      await fetchPreview();
    }
  }
});

watch(() => sheetName.value, () => {
  fetchPreview();
});

function addLog(msg: string) {
  const time = new Date().toLocaleTimeString();
  logs.value.push(`[${time}] ${msg}`);
  nextTick(() => {
    if (consoleBodyRef.value) {
      consoleBodyRef.value.scrollTop = consoleBodyRef.value.scrollHeight;
    }
  });
}

function stopElapsedTimer() {
  if (elapsedTimer !== null) {
    clearInterval(elapsedTimer);
    elapsedTimer = null;
  }
}

async function fetchPreview() {
  if (!parseResult.value || !sheetName.value) return;
  loadingPreview.value = true;
  try {
    sheetPreview.value = await uploadApi.preview({
      sessionId: parseResult.value.sessionId,
      sheetName: sheetName.value,
    });
  } catch (e: any) {
    Message.error("获取预览数据失败：" + String(e?.message || e));
  } finally {
    loadingPreview.value = false;
  }
}

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
    const bytes = await readFileBytes(path);
    const f = new File([bytes], basename(path));
    await ingestFile(f);
  } catch (e: any) {
    Message.error("读取失败：" + String(e?.message || e));
  }
}

async function startClassify() {
  if (!parseResult.value || !sheetName.value || !columnName.value) {
    Message.warning("请选择工作表与列");
    return;
  }
  stage.value = "classifying";
  logs.value = [];
  addLog("初始化分类任务...");
  addLog(`工作表: ${sheetName.value}`);
  addLog(`目标列: ${columnName.value}`);
  addLog(`分类模式: ${useLLM.value ? "AI 智能分类" : "规则关键字"}`);

  elapsedSeconds.value = 0;
  elapsedTimeStr.value = "00:00";
  elapsedTimer = window.setInterval(() => {
    elapsedSeconds.value++;
    const mins = String(Math.floor(elapsedSeconds.value / 60)).padStart(2, "0");
    const secs = String(elapsedSeconds.value % 60).padStart(2, "0");
    elapsedTimeStr.value = `${mins}:${secs}`;
  }, 1000);

  try {
    addLog("向后端请求创建分类任务...");
    const t = await uploadApi.classify({
      sessionId: parseResult.value.sessionId,
      sheetName: sheetName.value,
      columnName: columnName.value,
      useLLM: useLLM.value,
    });
    task.value = t;
    addLog(`任务已创建，ID: ${t.id}。当前状态: ${t.status}`);
    pollTimer = window.setInterval(poll, 1000);
  } catch (e: any) {
    const err = String(e?.message || e);
    addLog(`创建任务失败: ${err}`);
    errorMsg.value = err;
    stage.value = "error";
    stopElapsedTimer();
  }
}

async function poll() {
  if (!task.value) return;
  try {
    const t = await uploadApi.status(task.value.id);
    task.value = t;

    if (t.progress) {
      if (t.progress.current !== lastLoggedProgress) {
        lastLoggedProgress = t.progress.current;
        addLog(t.progress.message || `正在处理第 ${t.progress.current}/${t.progress.total} 条数据...`);
      }
    }

    if (t.status === "completed") {
      stopPoll();
      stopElapsedTimer();
      addLog(`分类完成！总计处理 ${t.result?.totalCount || 0} 条。`);
      result.value = t.result || null;
      stage.value = "done";
    } else if (t.status === "failed") {
      stopPoll();
      stopElapsedTimer();
      const err = t.error || "分类失败";
      addLog(`分类失败: ${err}`);
      errorMsg.value = err;
      stage.value = "error";
    }
  } catch (e: any) {
    stopPoll();
    stopElapsedTimer();
    const err = String(e?.message || e);
    addLog(`获取任务状态失败: ${err}`);
    errorMsg.value = err;
    stage.value = "error";
  }
}

function stopPoll() {
  if (pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
  lastLoggedProgress = -1;
}

function openDownloadModal(recordId: string, columns: string[]) {
  downloadingRecordId.value = recordId;
  availableExportColumns.value = columns;
  exportColumns.value = [...columns];
  selectAllColumns.value = true;
  downloadModalVisible.value = true;
}

function handleSelectAllChange(val: any) {
  if (val) {
    exportColumns.value = [...availableExportColumns.value];
  } else {
    exportColumns.value = [];
  }
}

function handleColumnsChange(val: any) {
  selectAllColumns.value = val.length === availableExportColumns.value.length;
}

async function handleDownloadConfirm() {
  if (exportColumns.value.length === 0) {
    Message.warning("请至少选择一列进行导出");
    return;
  }
  downloadModalVisible.value = false;

  const defaultName = `分类结果_${new Date().toISOString().slice(0, 10)}.xlsx`;
  try {
    const target = await saveDialog(defaultName);
    if (!target) return;
    const url = uploadApi.downloadUrl(downloadingRecordId.value, exportColumns.value);
    await downloadToPath(url, target);
    Message.success("已保存");
  } catch (e: any) {
    Message.error("保存失败：" + String(e?.message || e));
  }
}

function downloadResult() {
  if (!result.value) return;
  let cols = Object.keys(result.value.preview[0] || {});
  if (cols.length === 0 && parseResult.value) {
    const sheet = parseResult.value.sheets.find((s) => s.name === sheetName.value);
    cols = sheet ? [...sheet.columns, "分类"] : ["分类"];
  }
  openDownloadModal(result.value.id, cols);
}

function reset() {
  stage.value = "idle";
  file.value = null;
  fileName.value = "";
  parseResult.value = null;
  task.value = null;
  result.value = null;
  errorMsg.value = "";
  sheetPreview.value = [];
  stopElapsedTimer();
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
  stopElapsedTimer();
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
      
      <!-- 数据预览区 -->
      <div class="sheet-preview-section">
        <div class="preview-header">
          <span class="preview-title">工作表数据预览 (前 10 条)</span>
          <Spin v-if="loadingPreview" :size="16" />
        </div>
        <div class="preview-table-wrapper">
          <Table 
            :data="sheetPreview" 
            :columns="previewColumns"
            :pagination="false" 
            size="small"
            :scroll="{ x: '100%', y: '240px' }"
            :bordered="false"
            class="preview-table"
          />
          <div v-if="sheetPreview.length === 0 && !loadingPreview" class="empty-preview">
            暂无预览数据
          </div>
        </div>
      </div>

      <div class="actions" style="margin-top: 20px;">
        <Button type="primary" size="large" @click="startClassify">开始分类</Button>
      </div>
    </Card>

    <!-- 分类中 -->
    <Card v-else-if="stage === 'classifying'" class="glass progress-card" :bordered="false">
      <div class="progress-container">
        <!-- 左侧: 进度图表 -->
        <div class="progress-visual">
          <Progress
            type="circle"
            :percent="task ? task.progress.percentage / 100 : 0"
            :width="150"
            :stroke-width="6"
          />
          <div class="progress-details">
            <div class="progress-percent">{{ task ? task.progress.percentage : 0 }}%</div>
            <div class="progress-count">{{ task?.progress.current || 0 }} / {{ task?.progress.total || 0 }}</div>
          </div>
        </div>

        <!-- 右侧: 任务配置与时间 -->
        <div class="progress-info">
          <div class="info-title">任务分类执行中</div>
          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">解析文件：</span>
              <span class="info-value">{{ fileName }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">当前工作表：</span>
              <span class="info-value">{{ sheetName }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">分析字段：</span>
              <span class="info-value">{{ columnName }}</span>
            </div>
            <div class="info-item">
              <span class="info-label">分类模式：</span>
              <span class="info-value">
                <Tag :color="useLLM ? 'arcoblue' : 'green'">{{ useLLM ? "AI 智能分类" : "规则关键字" }}</Tag>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">已运行时间：</span>
              <span class="info-value tnum">{{ elapsedTimeStr }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 下方: 终端样式日志控制台 -->
      <div class="console-log">
        <div class="console-header">
          <span class="console-dot red"></span>
          <span class="console-dot yellow"></span>
          <span class="console-dot green"></span>
          <span class="console-title">分类运行日志</span>
        </div>
        <div class="console-body" ref="consoleBodyRef">
          <div v-for="(log, idx) in logs" :key="idx" class="console-line">
            {{ log }}
          </div>
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
        <Table
          :data="result.preview"
          :columns="Object.keys(result.preview[0] || {}).map(k => ({ title: k, dataIndex: k, ellipsis: true, tooltip: true, width: 160 }))"
          :pagination="false"
          size="small"
        />
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

    <!-- 列选择下载 Modal -->
    <Modal
      v-model:visible="downloadModalVisible"
      title="选择下载列"
      @ok="handleDownloadConfirm"
      @cancel="downloadModalVisible = false"
      width="440px"
      ok-text="确定"
      cancel-text="取消"
    >
      <div style="margin-bottom: 12px;">
        <Checkbox
          v-model="selectAllColumns"
          @change="handleSelectAllChange"
        >
          全选所有列
        </Checkbox>
      </div>
      <Divider style="margin: 8px 0 16px;" />
      <div class="columns-selector-list">
        <CheckboxGroup
          v-model="exportColumns"
          @change="handleColumnsChange"
          direction="vertical"
        >
          <Checkbox
            v-for="col in availableExportColumns"
            :key="col"
            :value="col"
            style="margin-bottom: 8px;"
          >
            {{ col }}
          </Checkbox>
        </CheckboxGroup>
      </div>
    </Modal>
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
  margin-bottom: 16px;
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

/* Data sheet preview styles */
.sheet-preview-section {
  margin-top: 24px;
  border-top: 1px solid var(--border);
  padding-top: 20px;
}
.preview-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.preview-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-1);
}
.preview-table-wrapper {
  position: relative;
  border-radius: 6px;
  border: 1px solid var(--border);
  overflow: hidden;
  background: rgba(255, 255, 255, 0.01);
}
.preview-table {
  background: transparent;
}
.empty-preview {
  padding: 40px;
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
}

/* Progress dashboard styles */
.progress-card {
  padding: 24px;
}
.progress-container {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 32px;
  align-items: center;
  margin-bottom: 24px;
}
.progress-visual {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  width: 180px;
  height: 180px;
}
.progress-details {
  position: absolute;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.progress-percent {
  font-size: 32px;
  font-weight: 700;
  color: var(--primary);
  line-height: 1.2;
}
.progress-count {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 4px;
}
.progress-info {
  display: flex;
  flex-direction: column;
  justify-content: center;
}
.info-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-1);
  margin-bottom: 16px;
}
.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}
.info-item {
  display: flex;
  align-items: center;
  font-size: 13px;
}
.info-label {
  color: var(--text-3);
  width: 90px;
  flex-shrink: 0;
}
.info-value {
  color: var(--text-1);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Log Console Terminal styles */
.console-log {
  border-radius: 8px;
  background: #0d1117;
  border: 1px solid rgba(255, 255, 255, 0.1);
  overflow: hidden;
  font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
}
.console-header {
  background: #161b22;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}
.console-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-right: 8px;
  display: inline-block;
}
.console-dot.red { background-color: #ff5f56; }
.console-dot.yellow { background-color: #ffbd2e; }
.console-dot.green { background-color: #27c93f; }
.console-title {
  color: #8b949e;
  font-size: 12px;
  margin-left: 8px;
}
.console-body {
  padding: 16px;
  height: 180px;
  overflow-y: auto;
  font-size: 12px;
  color: #c9d1d9;
  line-height: 1.6;
  text-align: left;
}
.console-line {
  margin-bottom: 4px;
  white-space: pre-wrap;
  word-break: break-all;
}

/* Column selector modal */
.columns-selector-list {
  max-height: 250px;
  overflow-y: auto;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
}
</style>
