import type { HomeAssistantConnection } from "./types";

interface LovelaceDashboardListEntry {
  url_path?: string | null;
}

export const buildDashboardSummaryPath = (urlPath?: string | null): string =>
  urlPath ? `/${encodeURIComponent(urlPath)}/summary` : "/lovelace/summary";

export const fetchLovelaceDashboardUrlPaths = async (
  connection: HomeAssistantConnection,
): Promise<Set<string | null>> => {
  const dashboards = await connection.sendMessagePromise<
    LovelaceDashboardListEntry[]
  >({ type: "lovelace/dashboards/list" });

  const urlPaths = new Set<string | null>([null]);
  for (const dashboard of dashboards) {
    urlPaths.add(dashboard.url_path ?? null);
  }

  return urlPaths;
};
