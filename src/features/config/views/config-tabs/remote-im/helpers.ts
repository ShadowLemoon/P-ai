import type { RemoteImContact } from "../../../../../types/app";

export function platformLabelOf(platform: string): string {
  const value = String(platform || "").trim().toLowerCase();
  if (value === "feishu") return "Feishu";
  if (value === "dingtalk") return "DingTalk";
  if (value === "weixin_oc") return "个人微信";
  return "OneBot v11";
}

export function normalizeActivationMode(value: string): RemoteImContact["activationMode"] {
  const mode = String(value || "").trim().toLowerCase();
  if (mode === "always" || mode === "keyword") return mode;
  return "never";
}

export function normalizeProcessingMode(value?: string): "qa" | "continuous" {
  return value === "qa" ? "qa" : "continuous";
}

export function contactRouteLabel(item: RemoteImContact): string {
  return !String(item.boundDepartmentId || "").trim() ? "主会话" : "联系人独占会话";
}

export function contactRoutingHint(item: RemoteImContact): string {
  return !String(item.boundDepartmentId || "").trim()
    ? "部门将在前台处理消息"
    : "部门将在后台处理消息";
}

export function processingModeHint(item: RemoteImContact): string {
  return normalizeProcessingMode(item.processingMode) === "qa"
    ? "当前为无上下文模式（问答模式）"
    : "当前为有上下文模式（会话模式）";
}

export function contactActivationHint(item: RemoteImContact): string {
  const mode = normalizeActivationMode(item.activationMode);
  if (mode === "always") return "始终回复：任何时候都回复。";
  if (mode === "keyword") return "关键字触发：消息命中关键字时回复。";
  return "不回复：任何时候都不回复。";
}

export function parseActivationKeywords(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of String(raw || "").split(/[,\n，]/)) {
    const keyword = item.trim();
    if (!keyword || seen.has(keyword)) continue;
    seen.add(keyword);
    out.push(keyword);
  }
  return out;
}

export function formatLogTime(timestamp: string): string {
  const d = new Date(timestamp);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
}
