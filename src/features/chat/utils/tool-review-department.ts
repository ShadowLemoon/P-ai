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
  if (optionIdSet.size === 0) {
    return "";
  }
  const reportDepartmentId = normalizeDepartmentId(input.reportDepartmentId);
  if (reportDepartmentId && optionIdSet.has(reportDepartmentId)) {
    return reportDepartmentId;
  }
  const currentDepartmentId = normalizeDepartmentId(input.currentDepartmentId);
  if (currentDepartmentId && optionIdSet.has(currentDepartmentId)) {
    return currentDepartmentId;
  }
  return optionIds[0] || "";
}
