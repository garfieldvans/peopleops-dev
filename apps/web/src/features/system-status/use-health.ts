import { useQuery } from "@tanstack/react-query";
import { fetchHealth } from "../../lib/api";

export const healthQueryKey = ["system", "health"] as const;

export function useHealth() {
  return useQuery({
    queryKey: healthQueryKey,
    queryFn: ({ signal }) => fetchHealth(signal),
    refetchInterval: 30_000,
  });
}
