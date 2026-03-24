import type { LocalizeFunc } from "./localize";
import { severityIcon, type MaintenanceRepairIssue } from "./repairs-data";
import {
  limitItems,
  MAINTENANCE_COLUMN_SPAN,
  makeEmptyStateCard,
  makeRepairCard,
  makeSection,
  makeShowMoreCard,
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
): LovelaceSectionConfig => {
  const limitedIssues = limitItems(issues, options?.limit);

  return makeSection(
    localize("repair.heading"),
    "mdi:wrench",
    issues.length > 0
      ? [
          ...limitedIssues.items.map((issue) => makeRepairCard(localize, issue)),
          ...(options?.showMorePath && limitedIssues.hiddenCount > 0
            ? [
                makeShowMoreCard(
                  localize,
                  limitedIssues.hiddenCount,
                  options.showMorePath,
                ),
              ]
            : []),
        ]
      : [
          makeEmptyStateCard(
            localize("repair.empty_no_issues_title"),
            localize("repair.empty_no_issues_content"),
            "mdi:wrench",
          ),
        ],
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
      makeSection(
        localize("repair.heading"),
        "mdi:wrench",
        [
          makeEmptyStateCard(
            localize("repair.empty_no_issues_title"),
            localize("repair.empty_no_issues_content"),
            "mdi:wrench",
          ),
        ],
        MAINTENANCE_COLUMN_SPAN,
      ),
    ];
  }

  const criticalIssues = issues.filter((issue) => issue.severity === "critical");
  const errorIssues = issues.filter((issue) => issue.severity === "error");
  const warningIssues = issues.filter((issue) => issue.severity === "warning");

  const limitedCritical = limitItems(criticalIssues, options?.limit);
  const limitedError = limitItems(errorIssues, options?.limit);
  const limitedWarning = limitItems(warningIssues, options?.limit);

  const sections = [
    limitedCritical.items.length > 0
      ? makeSection(
          localize("repair.heading_critical"),
          severityIcon("critical"),
          [
            ...limitedCritical.items.map((issue) => makeRepairCard(localize, issue)),
            ...(options?.showMorePath && limitedCritical.hiddenCount > 0
              ? [makeShowMoreCard(localize, limitedCritical.hiddenCount, options.showMorePath)]
              : []),
          ],
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
    limitedError.items.length > 0
      ? makeSection(
          localize("repair.heading_error"),
          severityIcon("error"),
          [
            ...limitedError.items.map((issue) => makeRepairCard(localize, issue)),
            ...(options?.showMorePath && limitedError.hiddenCount > 0
              ? [makeShowMoreCard(localize, limitedError.hiddenCount, options.showMorePath)]
              : []),
          ],
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
    limitedWarning.items.length > 0
      ? makeSection(
          localize("repair.heading_warning"),
          severityIcon("warning"),
          [
            ...limitedWarning.items.map((issue) => makeRepairCard(localize, issue)),
            ...(options?.showMorePath && limitedWarning.hiddenCount > 0
              ? [makeShowMoreCard(localize, limitedWarning.hiddenCount, options.showMorePath)]
              : []),
          ],
          MAINTENANCE_COLUMN_SPAN,
        )
      : undefined,
  ].filter(Boolean) as LovelaceSectionConfig[];

  if (sections.length > 0) {
    return sections;
  }

  return [
    makeSection(
      localize("repair.heading"),
      "mdi:wrench",
      [
        makeEmptyStateCard(
          localize("repair.empty_no_issues_title"),
          localize("repair.empty_no_issues_content"),
          "mdi:wrench",
        ),
      ],
      MAINTENANCE_COLUMN_SPAN,
    ),
  ];
};
