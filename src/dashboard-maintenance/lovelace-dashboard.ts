import type {
  HomeAssistantConnection,
  MaintenanceStrategyConfig,
} from "./types";

export interface LovelaceDashboardConfig {
  strategy?: MaintenanceStrategyConfig | { type?: string };
}

interface LovelaceDashboardListEntry {
  url_path?: string | null;
}

export const buildDashboardSummaryPath = (urlPath?: string | null): string =>
  urlPath ? `/${encodeURIComponent(urlPath)}/summary` : "/lovelace/summary";

const fetchLovelaceDashboardUrlPaths = async (
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

export const findLovelaceDashboardConfig = async <T>(
  connection: HomeAssistantConnection,
  getMatch: (config: LovelaceDashboardConfig | null) => T | undefined,
): Promise<{ urlPath: string | null; match: T } | undefined> => {
  const urlPaths = await fetchLovelaceDashboardUrlPaths(connection);

  for (const urlPath of urlPaths) {
    try {
      const config = await connection.sendMessagePromise<LovelaceDashboardConfig | null>({
        type: "lovelace/config",
        url_path: urlPath,
        force: false,
      });

      const match = getMatch(config);

      if (match !== undefined) {
        return { urlPath, match };
      }
    } catch {
      // Skip dashboards that are not accessible.
    }
  }

  return undefined;
};
