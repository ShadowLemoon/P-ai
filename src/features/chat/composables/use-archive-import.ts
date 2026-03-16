import { ref, type Ref } from "vue";
import type { ArchiveImportPreview } from "./use-archives-view";

type UseArchiveImportOptions = {
  buildArchiveImportPreview: (file: File) => Promise<ArchiveImportPreview>;
  importArchivePayload: (payloadJson: string) => Promise<void>;
  setStatusError: (key: string, error: unknown) => void;
};

export function useArchiveImport(options: UseArchiveImportOptions) {
  const archiveImportPreviewDialogOpen = ref(false);
  const archiveImportPreview = ref<ArchiveImportPreview | null>(null);
  const archiveImportRunning = ref(false);

  function closeArchiveImportPreviewDialog() {
    if (archiveImportRunning.value) return;
    archiveImportPreviewDialogOpen.value = false;
    archiveImportPreview.value = null;
  }

  async function prepareArchiveImport(file: File) {
    try {
      const preview = await options.buildArchiveImportPreview(file);
      archiveImportPreview.value = preview;
      archiveImportPreviewDialogOpen.value = true;
    } catch (error) {
      options.setStatusError("status.importArchiveFailed", error);
    }
  }

  async function confirmArchiveImport() {
    if (!archiveImportPreview.value || archiveImportRunning.value) return;
    archiveImportRunning.value = true;
    try {
      await options.importArchivePayload(archiveImportPreview.value.payloadJson);
      archiveImportPreviewDialogOpen.value = false;
      archiveImportPreview.value = null;
    } catch (error) {
      options.setStatusError("status.importArchiveFailed", error);
    } finally {
      archiveImportRunning.value = false;
    }
  }

  return {
    archiveImportPreviewDialogOpen,
    archiveImportPreview,
    archiveImportRunning,
    closeArchiveImportPreviewDialog,
    prepareArchiveImport,
    confirmArchiveImport,
  };
}
