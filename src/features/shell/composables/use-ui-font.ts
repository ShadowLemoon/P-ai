export function normalizeUiFont(value: string): string {
  const text = String(value || "").trim();
  if (!text) return "auto";
  if (text.length > 128) return text.slice(0, 128).trim() || "auto";
  return text;
}

export function resolveUiFontFamily(uiFont: string, uiLanguage: string): string {
  const normalized = normalizeUiFont(uiFont);
  if (normalized === "auto") {
    if (uiLanguage === "zh-CN") {
      return "\"Microsoft YaHei\", \"PingFang SC\", \"Noto Sans CJK SC\", \"Segoe UI\", system-ui, sans-serif";
    }
    if (uiLanguage === "zh-TW") {
      return "\"PingFang TC\", \"Microsoft JhengHei\", \"Noto Sans CJK TC\", \"Segoe UI\", system-ui, sans-serif";
    }
    return "\"Segoe UI\", \"SF Pro Text\", system-ui, -apple-system, Roboto, \"Helvetica Neue\", Arial, sans-serif";
  }
  const escaped = normalized.replace(/"/g, '\\"');
  return `"${escaped}", system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`;
}

export function applyUiFont(uiFont: string, uiLanguage: string) {
  const family = resolveUiFontFamily(uiFont, uiLanguage);
  document.documentElement.style.setProperty("--app-font-family", family);
}
