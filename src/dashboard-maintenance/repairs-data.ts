import type { HomeAssistant } from "./types";

/** Raw repair issue shape from the `repairs/list_issues` WebSocket response. */
interface RepairsIssueWS {
  domain: string;
  issue_domain?: string;
  issue_id: string;
  active: boolean;
  is_fixable: boolean;
  severity: "critical" | "error" | "warning";
  breaks_in_ha_version?: string;
  ignored: boolean;
  created: string;
  dismissed_version?: string;
  learn_more_url?: string;
  translation_key?: string;
  translation_placeholders?: Record<string, string>;
}

export interface MaintenanceRepairIssue {
  domain: string;
  issueDomain?: string;
  issueId: string;
  isFixable: boolean;
  severity: "critical" | "error" | "warning";
  created: string;
  learnMoreUrl?: string;
  title: string;
  integrationName: string;
}

const SEVERITY_SORT: Record<string, number> = {
  critical: 1,
  error: 2,
  warning: 3,
};

const resolveIssueTitle = (
  hass: HomeAssistant,
  issue: RepairsIssueWS,
): string => {
  if (hass.localize) {
    const key = `component.${issue.domain}.issues.${issue.translation_key || issue.issue_id}.title`;
    const translated = hass.localize(key, issue.translation_placeholders || {});
    if (translated && translated !== key) {
      return translated;
    }
  }

  return issue.translation_key || issue.issue_id;
};

const resolveIntegrationName = (
  hass: HomeAssistant,
  domain: string,
): string => {
  if (hass.localize) {
    const key = `component.${domain}.title`;
    const translated = hass.localize(key);
    if (translated && translated !== key) {
      return translated;
    }
  }

  return domain;
};

export const getMaintenanceRepairIssues = async (
  hass: HomeAssistant,
): Promise<MaintenanceRepairIssue[]> => {
  if (!hass.connection) {
    return [];
  }

  try {
    const result = await hass.connection.sendMessagePromise<{
      issues: RepairsIssueWS[];
    }>({ type: "repairs/list_issues" });

    return result.issues
      .filter((issue) => issue.active && !issue.ignored)
      .map((issue) => ({
        domain: issue.domain,
        issueDomain: issue.issue_domain,
        issueId: issue.issue_id,
        isFixable: issue.is_fixable,
        severity: issue.severity,
        created: issue.created,
        learnMoreUrl: issue.learn_more_url,
        title: resolveIssueTitle(hass, issue),
        integrationName: resolveIntegrationName(
          hass,
          issue.issue_domain || issue.domain,
        ),
      }))
      .sort((left, right) => {
        const severityDiff =
          (SEVERITY_SORT[left.severity] || 99) -
          (SEVERITY_SORT[right.severity] || 99);
        if (severityDiff !== 0) return severityDiff;

        // Newest first within same severity
        return right.created.localeCompare(left.created);
      });
  } catch {
    return [];
  }
};

export const severityIcon = (
  severity: MaintenanceRepairIssue["severity"],
): string => {
  switch (severity) {
    case "critical":
      return "mdi:alert-octagon";
    case "error":
      return "mdi:alert-circle";
    case "warning":
      return "mdi:alert";
  }
};
