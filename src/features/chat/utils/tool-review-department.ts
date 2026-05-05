type DepartmentOption = {
  id: string;
};

function normalizeDepartmentId(value: string | null | undefined): string {
  return String(value || "").trim();
}

export function resolveRetryToolReviewDepartmentId(input: {
  reportDepartmentId?: string | null;
  currentDepartmentId?: string | null;
  departmentOptions?: DepartmentOption[] | null;
}): string {
  const optionIds = (Array.isArray(input.departmentOptions) ? input.departmentOptions : [])
    .map((item) => normalizeDepartmentId(item?.id))
    .filter((id, index, list) => !!id && list.indexOf(id) === index);
  const optionIdSet = new Set(optionIds);
  const reportDepartmentId = normalizeDepartmentId(input.reportDepartmentId);
  if (reportDepartmentId && (optionIdSet.size === 0 || optionIdSet.has(reportDepartmentId))) {
    return reportDepartmentId;
  }
  const currentDepartmentId = normalizeDepartmentId(input.currentDepartmentId);
  if (currentDepartmentId && (optionIdSet.size === 0 || optionIdSet.has(currentDepartmentId))) {
    return currentDepartmentId;
  }
  return optionIds[0] || "";
}
