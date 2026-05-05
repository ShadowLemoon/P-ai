import { describe, expect, it } from "vitest";
import type { AppConfig, DepartmentConfig } from "../src/types/app";
import {
  buildDepartmentMermaidGraph,
  departmentAncestorIds,
  findDepartmentGraphCycle,
  normalizeDepartmentChildIds,
} from "../src/features/config/utils/department-graph";
import { validateDepartmentConfig } from "../src/features/config/utils/department-validation";

function createDepartment(id: string, name: string, childDepartmentIds: string[] = []): DepartmentConfig {
  return {
    id,
    name,
    summary: "",
    guide: "",
    apiConfigId: "api-a",
    apiConfigIds: ["api-a"],
    agentIds: [],
    childDepartmentIds,
    createdAt: "2026-05-05T00:00:00Z",
    updatedAt: "2026-05-05T00:00:00Z",
    orderIndex: 1,
    isBuiltInAssistant: id === "assistant-department",
    source: "main_config",
    scope: "global",
    permissionControl: {
      enabled: false,
      mode: "blacklist",
      builtinToolNames: [],
      skillNames: [],
      mcpToolNames: [],
    },
  };
}

function createConfig(departments: DepartmentConfig[]): AppConfig {
  return {
    hotkey: "Alt+·",
    uiLanguage: "zh-CN",
    uiFont: "auto",
    recordHotkey: "Alt",
    recordBackgroundWakeEnabled: false,
    minRecordSeconds: 1,
    maxRecordSeconds: 60,
    llmRoundLogCapacity: 3,
    selectedApiConfigId: "api-a",
    assistantDepartmentApiConfigId: "api-a",
    terminalShellKind: "auto",
    shellWorkspaces: [],
    mcpServers: [],
    remoteImChannels: [],
    departments,
    apiProviders: [],
    apiConfigs: [{
      id: "api-a",
      name: "api-a",
      requestFormat: "openai",
      enableText: true,
      enableImage: false,
      enableAudio: false,
      enableTools: true,
      tools: [],
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      model: "gpt-4.1-mini",
      temperature: 1,
      customTemperatureEnabled: false,
      contextWindowTokens: 128000,
      customMaxOutputTokensEnabled: false,
      maxOutputTokens: 4096,
    }],
  };
}

describe("department graph helpers", () => {
  it("normalizes child ids by trimming, deduping, and removing self references", () => {
    expect(normalizeDepartmentChildIds([" dept-a ", "dept-b", "dept-a", "", "self"], "self")).toEqual([
      "dept-a",
      "dept-b",
    ]);
  });

  it("detects cycles across department relations", () => {
    const departments = [
      createDepartment("assistant-department", "助理部门", ["dept-a"]),
      createDepartment("dept-a", "部门A", ["dept-b"]),
      createDepartment("dept-b", "部门B", ["assistant-department"]),
    ];
    expect(findDepartmentGraphCycle(departments)).toEqual([
      "assistant-department",
      "dept-a",
      "dept-b",
      "assistant-department",
    ]);
  });

  it("renders mermaid edges for shared child departments", () => {
    const mermaid = buildDepartmentMermaidGraph([
      createDepartment("assistant-department", "助理部门", ["dept-a", "dept-b"]),
      createDepartment("dept-a", "项目A", ["shared-team"]),
      createDepartment("dept-b", "项目B", ["shared-team"]),
      createDepartment("shared-team", "施工队"),
    ]);
    expect(mermaid).toContain('dept_dept_a --> dept_shared_team');
    expect(mermaid).toContain('dept_dept_b --> dept_shared_team');
  });

  it("finds all ancestor departments for child selection filtering", () => {
    const departments = [
      createDepartment("assistant-department", "助理部门", ["dept-a", "shared-team"]),
      createDepartment("dept-a", "项目A", ["dept-b"]),
      createDepartment("dept-b", "项目B", ["shared-team"]),
      createDepartment("shared-team", "施工队"),
    ];
    expect(departmentAncestorIds(departments[3], departments)).toEqual([
      "assistant-department",
      "dept-b",
      "dept-a",
    ]);
  });

  it("rejects invalid child departments and relation cycles in validation", () => {
    const invalidChildMessage = validateDepartmentConfig(
      createConfig([
        createDepartment("assistant-department", "助理部门", ["missing-dept"]),
      ]),
      createConfig([]).apiConfigs,
      (key, params) => `${key}:${JSON.stringify(params || {})}`,
    );
    expect(invalidChildMessage).toContain("config.department.validation.invalidChildDepartment");

    const cycleMessage = validateDepartmentConfig(
      createConfig([
        createDepartment("assistant-department", "助理部门", ["dept-a"]),
        createDepartment("dept-a", "部门A", ["assistant-department"]),
      ]),
      createConfig([]).apiConfigs,
      (key, params) => `${key}:${JSON.stringify(params || {})}`,
    );
    expect(cycleMessage).toContain("config.department.validation.departmentRelationCycle");
  });
});
