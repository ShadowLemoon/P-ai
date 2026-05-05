<template>
  <SettingsStickyLayout>
    <template #header>
      <div class="card border border-base-300 bg-base-100">
        <div class="card-body p-4">
          <div class="flex w-full flex-col gap-3">
            <div class="flex items-center justify-between">
              <span class="text-sm">{{ t("config.departmentTree.title") }}</span>
            </div>

            <div class="flex gap-1">
              <select
                :value="selectedDepartmentId"
                class="select select-bordered select-sm flex-1"
                @change="switchSelectedDepartment(($event.target as HTMLSelectElement).value)"
              >
                <option v-for="department in sortedDepartments" :key="department.id" :value="department.id">
                  {{ department.name }}
                </option>
              </select>

              <button
                class="btn btn-sm btn-square"
                type="button"
                :class="!relationDirty ? 'cursor-not-allowed bg-base-200 text-base-content/30' : 'bg-base-200'"
                :title="t('common.reset')"
                :disabled="!relationDirty || savingConfig"
                @click="restoreDraftsFromSaved"
              >
                <RotateCcw class="h-3.5 w-3.5" />
              </button>

              <button
                class="btn btn-sm btn-square transition-all duration-300"
                type="button"
                :class="relationDirty ? 'btn-primary' : 'bg-base-200 text-base-content/50 shadow-none'"
                :disabled="!selectedDepartment || !!relationValidationMessage || !relationDirty || savingConfig"
                :title="savingConfig ? t('config.api.saving') : relationDirty ? t('common.save') : t('status.configSaved')"
                @click="saveDepartmentRelations"
              >
                <Save v-if="!savingConfig" class="h-3.5 w-3.5" />
                <span v-else class="loading loading-spinner loading-sm"></span>
              </button>
            </div>

            <div class="text-sm opacity-60">{{ t("config.departmentTree.hint") }}</div>
          </div>
        </div>
      </div>
    </template>

    <div class="grid gap-3">
      <div class="overflow-hidden rounded-box border border-base-300 bg-base-100">
        <div v-if="relationValidationMessage" class="border-b border-warning/30 bg-warning/10 px-4 py-3 text-sm text-warning-content">
          {{ relationValidationMessage }}
        </div>

        <div class="px-4 py-4">
          <div class="mb-3 flex items-center justify-between gap-3">
            <div class="text-[11px] uppercase tracking-wide opacity-40">{{ t("config.departmentTree.directChildren") }}</div>
            <div class="text-xs opacity-50">{{ selectedChildIds.length }} / {{ candidateDepartments.length }}</div>
          </div>
          <div class="mb-3 text-sm opacity-60">
            {{ t("config.departmentTree.directChildrenHint") }}
          </div>

          <div v-if="!selectedDepartment" class="text-sm opacity-60">
            {{ t("config.department.selectHint") }}
          </div>
          <div v-else-if="candidateDepartments.length === 0" class="text-sm opacity-60">
            {{ t("config.departmentTree.noCandidateChildren") }}
          </div>
          <div v-else class="flex flex-wrap gap-2">
            <button
              v-for="department in candidateDepartments"
              :key="department.id"
              type="button"
              class="inline-flex h-9 max-w-full items-center gap-2 rounded-lg border px-3 text-left transition"
              :class="selectedChildIds.includes(department.id)
                ? 'border-primary/50 bg-primary/10 text-base-content shadow-sm'
                : 'border-base-content/10 bg-base-100 text-base-content hover:border-base-content/20'"
              @click="toggleChildDepartment(department.id)"
            >
              <span
                class="flex h-4 w-4 shrink-0 items-center justify-center rounded border transition"
                :class="selectedChildIds.includes(department.id)
                  ? 'border-primary bg-primary text-primary-content'
                  : 'border-base-content/20 bg-base-200 text-transparent'"
              >
                <Check class="h-3 w-3" />
              </span>
              <span class="truncate text-sm font-medium">{{ department.name }}</span>
            </button>
          </div>
        </div>
      </div>

      <div class="grid gap-3">
        <MarkdownRender
          class="department-tree-markdown"
          :nodes="mermaidNodes"
          :dark="false"
          :code-block-props="markdownCodeBlockProps"
          :mermaid-props="markdownMermaidProps"
        />
      </div>
    </div>
  </SettingsStickyLayout>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { Check, RotateCcw, Save } from "lucide-vue-next";
import MarkdownRender, { enableMermaid, getMarkdown, parseMarkdownToStructure } from "markstream-vue";
import "markstream-vue/index.css";
import type { AppConfig, DepartmentConfig } from "../../../../types/app";
import SettingsStickyLayout from "../../components/SettingsStickyLayout.vue";
import {
  buildDepartmentMermaidGraph,
  departmentAncestorIds,
  departmentDirectChildIds,
  normalizeDepartmentChildIds,
} from "../../utils/department-graph";
import { validateDepartmentConfig } from "../../utils/department-validation";

enableMermaid();

const props = defineProps<{
  config: AppConfig;
  savingConfig: boolean;
  saveConfigAction: () => Promise<boolean> | boolean;
  setStatusAction: (text: string) => void;
}>();

const { t } = useI18n();
const selectedDepartmentId = ref("assistant-department");
const markdown = getMarkdown();

type DepartmentRelationDraft = {
  id: string;
  childDepartmentIds: string[];
};

const markdownCodeBlockProps = {
  showHeader: false,
  showCopyButton: false,
  showPreviewButton: false,
  showExpandButton: false,
  showCollapseButton: false,
  showFontSizeButtons: false,
  enableFontSizeControl: false,
  isShowPreview: false,
  showTooltips: false,
};

const markdownMermaidProps = {
  showHeader: true,
  showCopyButton: true,
  showExportButton: false,
  showFullscreenButton: true,
  showCollapseButton: false,
  showZoomControls: true,
  showModeToggle: false,
  enableWheelZoom: true,
  showTooltips: false,
};

function cloneRelationDrafts(departments: DepartmentConfig[] | null | undefined): DepartmentRelationDraft[] {
  return (departments || []).map((department) => ({
    id: String(department.id || "").trim(),
    childDepartmentIds: normalizeDepartmentChildIds(department.childDepartmentIds, department.id),
  }));
}

function buildRelationSnapshot(drafts: DepartmentRelationDraft[]): string {
  return JSON.stringify(
    drafts
      .map((draft) => ({
        id: draft.id,
        childDepartmentIds: [...draft.childDepartmentIds],
      }))
      .sort((left, right) => left.id.localeCompare(right.id, "zh-CN")),
  );
}

function departmentSortRank(id: string): number {
  if (id === "assistant-department") return 0;
  if (id === "remote-customer-service-department") return 1;
  return 2;
}

function mergeRelationDraftsIntoDepartments(
  departments: DepartmentConfig[] | null | undefined,
  drafts: DepartmentRelationDraft[],
  updateChangedAt = false,
): DepartmentConfig[] {
  const now = new Date().toISOString();
  const draftById = new Map(drafts.map((draft) => [draft.id, draft] as const));
  return (departments || []).map((department) => {
    const id = String(department.id || "").trim();
    const draft = draftById.get(id);
    const nextChildIds = normalizeDepartmentChildIds(draft?.childDepartmentIds || department.childDepartmentIds, id);
    const changed = JSON.stringify(nextChildIds) !== JSON.stringify(normalizeDepartmentChildIds(department.childDepartmentIds, id));
    return {
      ...department,
      childDepartmentIds: nextChildIds,
      updatedAt: updateChangedAt && changed ? now : department.updatedAt,
    };
  });
}

const relationDrafts = ref<DepartmentRelationDraft[]>(cloneRelationDrafts(props.config.departments || []));
const sourceRelationSnapshot = computed(() => buildRelationSnapshot(cloneRelationDrafts(props.config.departments || [])));
const relationSnapshot = computed(() => buildRelationSnapshot(relationDrafts.value));
const relationDirty = computed(() => relationSnapshot.value !== sourceRelationSnapshot.value);

const sortedDepartments = computed(() =>
  [...(props.config.departments || [])].sort((left, right) => {
    const leftId = String(left.id || "").trim();
    const rightId = String(right.id || "").trim();
    return departmentSortRank(leftId) - departmentSortRank(rightId)
      || Number(left.orderIndex || 0) - Number(right.orderIndex || 0)
      || leftId.localeCompare(rightId, "zh-CN");
  }),
);

const selectedDepartment = computed(() =>
  sortedDepartments.value.find((department) => department.id === selectedDepartmentId.value) || sortedDepartments.value[0] || null,
);

const selectedChildIds = computed(() => {
  const departmentId = String(selectedDepartment.value?.id || "").trim();
  return relationDrafts.value.find((item) => item.id === departmentId)?.childDepartmentIds || [];
});

const selectedAncestorIdSet = computed(() =>
  new Set(
    departmentAncestorIds(selectedDepartment.value, previewDepartments.value),
  ),
);

const candidateDepartments = computed(() => {
  const selectedId = String(selectedDepartment.value?.id || "").trim();
  const selectedIds = new Set(selectedChildIds.value);
  return sortedDepartments.value
    .filter((department) => {
      const departmentId = String(department.id || "").trim();
      if (!departmentId || departmentId === selectedId) return false;
      return !selectedAncestorIdSet.value.has(departmentId);
    })
    .sort((left, right) => {
      const leftSelected = selectedIds.has(String(left.id || "").trim());
      const rightSelected = selectedIds.has(String(right.id || "").trim());
      if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;
      return 0;
    });
});

const previewDepartments = computed(() => mergeRelationDraftsIntoDepartments(props.config.departments || [], relationDrafts.value));
const relationValidationMessage = computed(() =>
  validateDepartmentConfig(
    {
      ...props.config,
      departments: previewDepartments.value,
    },
    props.config.apiConfigs,
    (key, params) => t(key, params ?? {}),
  ),
);

const mermaidMarkdown = computed(() => {
  const graph = buildDepartmentMermaidGraph(previewDepartments.value);
  return `\`\`\`mermaid\n${graph}\n\`\`\``;
});

const mermaidNodes = computed(() => parseMarkdownToStructure(mermaidMarkdown.value, markdown, { final: true }));

function restoreDraftsFromSaved() {
  relationDrafts.value = cloneRelationDrafts(props.config.departments || []);
}

function toggleChildDepartment(childDepartmentId: string) {
  const departmentId = String(selectedDepartment.value?.id || "").trim();
  if (!departmentId) return;
  const draft = relationDrafts.value.find((item) => item.id === departmentId);
  if (!draft) return;
  const childId = String(childDepartmentId || "").trim();
  if (!childId || childId === departmentId) return;
  const next = new Set(draft.childDepartmentIds);
  if (next.has(childId)) {
    next.delete(childId);
  } else if (candidateDepartments.value.some((department) => String(department.id || "").trim() === childId)) {
    next.add(childId);
  }
  draft.childDepartmentIds = normalizeDepartmentChildIds(Array.from(next), departmentId);
}

function switchSelectedDepartment(nextId: string) {
  const trimmedId = String(nextId || "").trim();
  if (!trimmedId || trimmedId === selectedDepartmentId.value) return;
  if (relationDirty.value) {
    const currentName = String(selectedDepartment.value?.name || selectedDepartmentId.value || "").trim() || t("config.departmentTree.title");
    props.setStatusAction(t("status.departmentUnsavedSwitchHint", { name: currentName }));
  }
  selectedDepartmentId.value = trimmedId;
}

async function saveDepartmentRelations() {
  if (!selectedDepartment.value || relationValidationMessage.value) return;
  const previousDepartments = (props.config.departments || []).map((department) => ({
    ...department,
    childDepartmentIds: [...(department.childDepartmentIds || [])],
  }));
  props.config.departments = mergeRelationDraftsIntoDepartments(previousDepartments, relationDrafts.value, true);
  const saved = await Promise.resolve(props.saveConfigAction());
  if (!saved) {
    props.config.departments = previousDepartments;
    return;
  }
  restoreDraftsFromSaved();
}

watch(
  () => sortedDepartments.value.map((item) => item.id).join("|"),
  () => {
    if (!sortedDepartments.value.some((item) => item.id === selectedDepartmentId.value)) {
      selectedDepartmentId.value = sortedDepartments.value[0]?.id || "assistant-department";
    }
  },
  { immediate: true },
);

watch(
  () => sourceRelationSnapshot.value,
  () => {
    if (relationDirty.value) return;
    restoreDraftsFromSaved();
  },
);
</script>

<style scoped>
.department-tree-markdown:deep(.ecall-markdown-content ._mermaid) {
  width: 100%;
  overflow: hidden;
  border-radius: 1rem;
  border: 1px solid color-mix(in srgb, currentColor 10%, transparent);
}

.department-tree-markdown:deep(.ecall-markdown-content :where(p,ul,ol,blockquote,pre,table,figure,.paragraph-node,.list-node,.blockquote,.table-node-wrapper,.code-block-container,._mermaid,.vmr-container)) {
  margin-top: 0;
  margin-bottom: 0;
}
</style>
