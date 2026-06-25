<script setup lang="ts">
import { onMounted, ref } from "vue";
import { Card, Table, Button, Message, Modal, CheckboxGroup, Checkbox, Divider, Tag } from "@arco-design/web-vue";
import { IconDownload } from "@arco-design/web-vue/es/icon";
import { uploadApi, type HistoryRecord } from "../api/upload";
import { saveDialog, downloadToPath } from "../tauri/ipc";

const history = ref<HistoryRecord[]>([]);
const loading = ref(false);

const downloadModalVisible = ref(false);
const exportColumns = ref<string[]>([]);
const selectAllColumns = ref(true);
const availableExportColumns = ref<string[]>([]);
const downloadingRecordId = ref("");

async function load() {
  loading.value = true;
  try {
    history.value = await uploadApi.history();
  } catch (e: any) {
    Message.error(String(e?.message || e));
  } finally {
    loading.value = false;
  }
}

async function startDownload(recordId: string) {
  try {
    const cols = await uploadApi.columns(recordId);
    downloadingRecordId.value = recordId;
    availableExportColumns.value = cols;
    exportColumns.value = [...cols];
    selectAllColumns.value = true;
    downloadModalVisible.value = true;
  } catch (e: any) {
    Message.error("获取列名失败：" + String(e?.message || e));
  }
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
    
    // 全选时不传 columns 参数，直接下载原始文件（保留所有 sheet）
    const isAllSelected = exportColumns.value.length === availableExportColumns.value.length;
    const url = uploadApi.downloadUrl(
      downloadingRecordId.value,
      isAllSelected ? undefined : exportColumns.value
    );
    await downloadToPath(url, target);
    Message.success("已保存");
  } catch (e: any) {
    Message.error("保存失败：" + String(e?.message || e));
  }
}

const columns = [
  {
    title: "文件名",
    dataIndex: "originalFile",
  },
  {
    title: "分类方式",
    dataIndex: "method",
    slotName: "method",
  },
  {
    title: "总数",
    dataIndex: "totalCount",
  },
  {
    title: "时间",
    dataIndex: "createdAt",
    slotName: "createdAt",
  },
  {
    title: "操作",
    slotName: "action",
  },
];

onMounted(() => load());
</script>

<template>
  <div class="history-view">
    <Card title="历史记录" :bordered="false">
      <Table :data="history" :loading="loading" :pagination="{ pageSize: 20 }" :columns="columns">
        <template #method="{ record }">
          <Tag :color="record.method === 'llm' ? 'arcoblue' : 'green'">
            {{ record.method === "llm" ? "AI 智能" : "规则匹配" }}
          </Tag>
        </template>
        <template #createdAt="{ record }">
          {{ new Date(record.createdAt).toLocaleString() }}
        </template>
        <template #action="{ record }">
          <Button type="text" size="small" @click="startDownload(record.id)">
            <template #icon><IconDownload /></template>
            下载
          </Button>
        </template>
      </Table>
    </Card>

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
.history-view {
  max-width: 1400px;
  margin: 0 auto;
}
.columns-selector-list {
  max-height: 250px;
  overflow-y: auto;
  padding: 4px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
}
</style>
