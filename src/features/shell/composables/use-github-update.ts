import { ref, type Ref } from "vue";
import { invokeTauri } from "../../../services/tauri-api";

type ViewModeRef = Ref<"chat" | "archives" | "config">;

type UseGithubUpdateOptions = {
  viewMode: ViewModeRef;
  status: Ref<string>;
};

export function useGithubUpdate(options: UseGithubUpdateOptions) {
  const checkingUpdate = ref(false);
  const updateDialogOpen = ref(false);
  const updateDialogTitle = ref("检查更新");
  const updateDialogBody = ref("");
  const updateDialogKind = ref<"info" | "error">("info");
  const updateDialogReleaseUrl = ref("");

  function closeUpdateDialog() {
    updateDialogOpen.value = false;
  }

  function openUpdateDialog(text: string, kind: "info" | "error", releaseUrl?: string) {
    updateDialogTitle.value = "检查更新";
    updateDialogBody.value = text;
    updateDialogKind.value = kind;
    updateDialogReleaseUrl.value = releaseUrl || "";
    updateDialogOpen.value = true;
  }

  function openUpdateRelease() {
    const url = updateDialogReleaseUrl.value.trim();
    if (!url) return;
    void invokeTauri("open_external_url", { url });
  }

  async function checkGithubUpdate(silent: boolean) {
    if (options.viewMode.value !== "config") return;
    if (checkingUpdate.value) return;
    checkingUpdate.value = true;
    try {
      options.status.value = "检查更新中...";
      const result = await invokeTauri<{
        currentVersion: string;
        latestVersion: string;
        hasUpdate: boolean;
        releaseUrl: string;
        updateSource?: string;
      }>("check_github_update");
      if (!result?.hasUpdate) {
        if (!silent) {
          options.status.value = `当前已是最新版本 ${result.currentVersion}`;
          openUpdateDialog(`当前已是最新版本 ${result.currentVersion}`, "info");
        }
        return;
      }
      options.status.value = `发现新版本 ${result.latestVersion}（当前 ${result.currentVersion}）`;
      if (!silent) {
        openUpdateDialog(
          `发现新版本 ${result.latestVersion}\n当前版本 ${result.currentVersion}\n\n可前往发布页下载更新（来源：${result.updateSource || "github"}）。`,
          "info",
          result.releaseUrl,
        );
      }
    } catch (error) {
      if (!silent) {
        options.status.value = `检查更新失败: ${String(error)}`;
        openUpdateDialog(`检查更新失败：${String(error)}`, "error");
      }
      console.warn("[UPDATE] check_github_update failed:", error);
    } finally {
      checkingUpdate.value = false;
    }
  }

  async function autoCheckGithubUpdate() {
    await checkGithubUpdate(true);
  }

  async function manualCheckGithubUpdate() {
    await checkGithubUpdate(false);
  }

  return {
    checkingUpdate,
    updateDialogOpen,
    updateDialogTitle,
    updateDialogBody,
    updateDialogKind,
    updateDialogReleaseUrl,
    closeUpdateDialog,
    openUpdateRelease,
    autoCheckGithubUpdate,
    manualCheckGithubUpdate,
  };
}
