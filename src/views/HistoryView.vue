<script setup lang="ts">
import { onMounted } from "vue";
import { Card, Table, Button, Message } from "@arco-design/web-vue";
import { uploadApi, type HistoryRecord } from "../api/upload";
import { ref } from "vue";

const history = ref<HistoryRecord[]>([]);
const loading = ref(false);

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

function download(id: string) {
  window.open(uploadApi.downloadUrl(id));
}

onMounted(() => load());
</script>

<template>
  <div class="history-view">
    <Card title="历史记录" :bordered="false">
      <Table :data="history" :loading="loading" :pagination="{ pageSize: 20 }">
        <template #columns>
          <Table-column title="文件名" data-index="originalFile" />
          <Table-column title="分类方式" data-index="method">
            <template #cell="{ record }">
              {{ record.method === "llm" ? "AI" : "关键词" }}
            </template>
          </Table-column>
          <Table-column title="总数" data-index="totalCount" />
          <Table-column title="时间" data-index="createdAt">
            <template #cell="{ record }">
              {{ new Date(record.createdAt).toLocaleString() }}
            </template>
          </Table-column>
          <Table-column title="操作">
            <template #cell="{ record }">
              <Button type="text" size="small" @click="download(record.id)">
                下载
              </Button>
            </template>
          </Table-column>
        </template>
      </Table>
    </Card>
  </div>
</template>

<style scoped>
.history-view {
  max-width: 1400px;
  margin: 0 auto;
}
</style>
