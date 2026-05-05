import type { DepartmentConfig } from "../../../types/app";

function normalizeDepartmentId(value: unknown): string {
  return String(value || "").trim();
}

export function normalizeDepartmentChildIds(
  value: unknown,
  selfId = "",
): string[] {
  if (!Array.isArray(value)) return [];
  const normalizedSelfId = normalizeDepartmentId(selfId);
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const id = normalizeDepartmentId(item);
    if (!id || id === normalizedSelfId || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
  }
  return result;
}

export function departmentDirectChildIds(
  department: DepartmentConfig | null | undefined,
  departments: DepartmentConfig[] | null | undefined,
): string[] {
  if (!department) return [];
  const existingIds = new Set((departments || []).map((item) => normalizeDepartmentId(item.id)).filter(Boolean));
  return normalizeDepartmentChildIds(department.childDepartmentIds, department.id)
    .filter((id) => existingIds.has(id));
}

export function departmentAncestorIds(
  department: DepartmentConfig | null | undefined,
  departments: DepartmentConfig[] | null | undefined,
): string[] {
  const selectedId = normalizeDepartmentId(department?.id);
  if (!selectedId) return [];
  const list = Array.isArray(departments) ? departments : [];
  const existingIds = new Set(
    list.map((item) => normalizeDepartmentId(item.id)).filter(Boolean),
  );
  const parentIdsByChild = new Map<string, string[]>();
  for (const item of list) {
    const parentId = normalizeDepartmentId(item.id);
    if (!parentId) continue;
    for (const childId of normalizeDepartmentChildIds(item.childDepartmentIds, parentId)) {
      if (!existingIds.has(childId)) continue;
      const current = parentIdsByChild.get(childId) || [];
      current.push(parentId);
      parentIdsByChild.set(childId, current);
    }
  }
  const visited = new Set<string>();
  const queue = [...(parentIdsByChild.get(selectedId) || [])];
  while (queue.length > 0) {
    const parentId = normalizeDepartmentId(queue.shift());
    if (!parentId || parentId === selectedId || visited.has(parentId)) continue;
    visited.add(parentId);
    queue.push(...(parentIdsByChild.get(parentId) || []));
  }
  return Array.from(visited);
}

export function findDepartmentGraphCycle(
  departments: DepartmentConfig[] | null | undefined,
): string[] | null {
  const list = Array.isArray(departments) ? departments : [];
  const byId = new Map(
    list
      .map((item) => [normalizeDepartmentId(item.id), item] as const)
      .filter(([id]) => !!id),
  );
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  function visit(id: string): string[] | null {
    if (visiting.has(id)) {
      const cycleStart = path.indexOf(id);
      return cycleStart >= 0 ? [...path.slice(cycleStart), id] : [id, id];
    }
    if (visited.has(id)) return null;
    const department = byId.get(id);
    if (!department) {
      visited.add(id);
      return null;
    }
    visiting.add(id);
    path.push(id);
    for (const childId of normalizeDepartmentChildIds(department.childDepartmentIds, id)) {
      if (!byId.has(childId)) continue;
      const cycle = visit(childId);
      if (cycle) return cycle;
    }
    path.pop();
    visiting.delete(id);
    visited.add(id);
    return null;
  }

  for (const id of byId.keys()) {
    const cycle = visit(id);
    if (cycle) return cycle;
  }
  return null;
}

export function buildDepartmentMermaidGraph(
  departments: DepartmentConfig[] | null | undefined,
): string {
  const list = Array.isArray(departments) ? departments : [];
  const lines = ["flowchart TD"];
  const byId = new Map(
    list
      .map((item) => [normalizeDepartmentId(item.id), item] as const)
      .filter(([id]) => !!id),
  );

  for (const [id, department] of byId) {
    const label = String(department.name || "").trim() || id;
    const escapedLabel = label.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
    lines.push(`  ${mermaidNodeId(id)}["${escapedLabel}"]`);
  }

  for (const [id, department] of byId) {
    for (const childId of normalizeDepartmentChildIds(department.childDepartmentIds, id)) {
      if (!byId.has(childId)) continue;
      lines.push(`  ${mermaidNodeId(id)} --> ${mermaidNodeId(childId)}`);
    }
  }

  return lines.join("\n");
}

function mermaidNodeId(id: string): string {
  return `dept_${id.replace(/[^A-Za-z0-9_]/g, "_")}`;
}
