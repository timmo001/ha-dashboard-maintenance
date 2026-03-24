import type { LocalizeFunc } from "./localize";
import { severityIcon, type MaintenanceRepairIssue } from "./repairs-data";
import {
  limitAndMakeCards,
  MAINTENANCE_COLUMN_SPAN,
  makeEmptyStateSection,
  makeRepairCard,
  makeSection,
  SUMMARY_COLUMN_SPAN,
  type LovelaceSectionConfig,
} from "./maintenance-view-helpers";

export const makeRepairsSummarySection = (
  localize: LocalizeFunc,
  issues: MaintenanceRepairIssue[],
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): LovelaceSectionConfig | null => {
  if (issues.length === 0) {
    return null;
  }

  return makeSection(
    localize("repair.heading"),
    "mdi:wrench",
    limitAndMakeCards(localize, issues, (issue) => makeRepairCard(localize, issue), options),
    SUMMARY_COLUMN_SPAN,
    "repairs",
  );
};

export const makeRepairsSections = (
  localize: LocalizeFunc,
  issues: MaintenanceRepairIssue[],
  options?: {
    limit?: number;
    showMorePath?: string;
  },
): LovelaceSectionConfig[] => {
  if (issues.length === 0) {
    return [
      makeEmptyStateSection(
        localize("repair.empty_no_issues_title"),
        localize("repair.empty_no_issues_content"),
        "mdi:wrench",
      ),
    ];
  }

  const makeCards = (issue: MaintenanceRepairIssue) => makeRepairCard(localize, issue);

  const criticalIssues = issues.filter((issue) => issue.severity === "critical");
  const errorIssues = issues.filter((issue) => issue.severity === "error");
  const warningIssues = issues.filter((issue) => issue.severity === "warning");

  const sections = [
    criticalIssues.length > 0
      ? makeSection(
          localize("repair.heading_critical"),
          severityIcon("critical"),
          limitAndMakeCards(localize, criticalIssues, makeCards, options),
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
    errorIssues.length > 0
      ? makeSection(
          localize("repair.heading_error"),
          severityIcon("error"),
          limitAndMakeCards(localize, errorIssues, makeCards, options),
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
    warningIssues.length > 0
      ? makeSection(
          localize("repair.heading_warning"),
          severityIcon("warning"),
          limitAndMakeCards(localize, warningIssues, makeCards, options),
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
  ].filter(Boolean) as LovelaceSectionConfig[];

  if (sections.length > 0) {
    return sections;
  }

  return [
    makeEmptyStateSection(
      localize("repair.empty_no_issues_title"),
      localize("repair.empty_no_issues_content"),
      "mdi:wrench",
    ),
  ];
};
