import { useQuery } from "@tanstack/react-query";
import type {
  Branch,
  DepartmentTreeNode,
  EmployeeListItem,
  JobLevel,
  PaginatedResponse,
  Position,
} from "@peopleops/shared-types";
import { apiRequest } from "../../lib/http";

export function useBranchOptions() {
  return useQuery({
    queryKey: ["branches", "options"],
    queryFn: () => apiRequest<PaginatedResponse<Branch>>("/branches?pageSize=100&status=ACTIVE"),
    staleTime: 60_000,
  });
}

export function useDepartmentTree() {
  return useQuery({
    queryKey: ["departments", "tree"],
    queryFn: () => apiRequest<DepartmentTreeNode[]>("/departments/tree"),
    staleTime: 60_000,
  });
}

export function usePositionOptions() {
  return useQuery({
    queryKey: ["positions", "options"],
    queryFn: () => apiRequest<PaginatedResponse<Position>>("/positions?pageSize=100&status=ACTIVE"),
    staleTime: 60_000,
  });
}

export function useJobLevelOptions() {
  return useQuery({
    queryKey: ["job-levels", "options"],
    queryFn: () => apiRequest<JobLevel[]>("/job-levels?status=ACTIVE"),
    staleTime: 60_000,
  });
}

export function useManagerOptions(enabled = true) {
  return useQuery({
    queryKey: ["employees", "managers"],
    queryFn: () =>
      apiRequest<PaginatedResponse<EmployeeListItem>>(
        "/employees?pageSize=100&employmentStatus=ACTIVE&sortBy=name",
      ),
    enabled,
    staleTime: 30_000,
  });
}

export function departmentChoiceOptions(
  nodes: DepartmentTreeNode[],
  depth = 0,
): { label: string; value: string }[] {
  return nodes.flatMap((node) => [
    { label: `${"— ".repeat(depth)}${node.name}`, value: node.id },
    ...departmentChoiceOptions(node.children, depth + 1),
  ]);
}
