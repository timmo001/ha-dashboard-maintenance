const en = {
  // View titles
  "view.summary": "Summary",
  "view.batteries": "Batteries",
  "view.all_batteries": "All batteries",
  "view.repairs": "Repairs",
  "view.all_repairs": "All repairs",
  "view.updates": "Updates",
  "view.all_updates": "All updates",
  "view.availability": "Availability",
  "view.all_availability": "All availability",
  "view.availability_area": "Availability - {area}",
  "view.stale": "Stale",
  "view.all_stale": "All stale",
  "view.stale_area": "Stale - {area}",

  // Battery sections
  "battery.heading_devices": "Battery devices",
  "battery.heading_needing_attention": "Batteries needing attention",
  "battery.empty_no_devices_title": "No battery devices found",
  "battery.empty_no_devices_content":
    "Home Assistant could not find any devices with battery sensors.",
  "battery.empty_no_attention_title": "No batteries need attention",
  "battery.empty_no_attention_content":
    "All battery devices are at or above the attention threshold.",

  // Repair sections
  "repair.heading": "Repairs",
  "repair.heading_critical": "Critical",
  "repair.heading_error": "Errors",
  "repair.heading_warning": "Warnings",
  "repair.empty_no_issues_title": "No repair issues",
  "repair.empty_no_issues_content":
    "Home Assistant has no active repair issues.",
  "repair.severity_critical": "Critical",
  "repair.severity_error": "Error",
  "repair.severity_warning": "Warning",

  // Update sections
  "update.heading": "Updates",
  "update.heading_in_progress": "Updates in progress",
  "update.heading_available": "Available updates",
  "update.heading_skipped": "Skipped updates",
  "update.heading_other": "Other update entities",
  "update.empty_no_updates_title": "No updates available",
  "update.empty_no_updates_content":
    "Home Assistant could not find any update entities that need attention.",
  "update.empty_no_entities_title": "No update entities found",
  "update.empty_no_entities_content":
    "Home Assistant could not find any update entities.",
  "update.empty_up_to_date_content":
    "All update entities are currently up to date.",

  // Availability sections
  "availability.heading": "Availability",
  "availability.heading_unavailable": "Unavailable",
  "availability.heading_issues": "Availability issues",
  "availability.device_unavailable_one": "{count} unavailable entity",
  "availability.device_unavailable_other": "{count} unavailable entities",
  "availability.ungrouped_entities": "Other entities",
  "availability.safe_list_hold_hint": "Click and hold to hide this offline device from availability.",
  "availability.empty_no_issues_title": "No availability issues",
  "availability.empty_no_issues_content":
    "Home Assistant could not find any unavailable entities.",

  // Stale sections
  "stale.heading": "Stale entities",
  "stale.heading_not_reporting": "Not recently reported",
  "stale.heading_issues": "Stale entities",
  "stale.empty_no_issues_title": "No stale entities",
  "stale.empty_no_issues_content":
    "All entities have reported within the configured threshold.",

  // Summary
  "summary.empty_title": "No maintenance issues",
  "summary.empty_content":
    "All enabled modules are clear — nothing needs your attention.",

  // Common / shared
  "common.areas": "Areas",
  "common.other_areas": "Other areas",
  "common.devices": "Devices",
  "common.other_devices": "Other devices",
  "common.entities": "Entities",
  "common.other_entities": "Other entities",
  "common.show_count_more": "Show {count} more",

  // Editor
  "editor.batteries_header": "Batteries",
  "editor.battery_threshold_label": "Battery attention threshold",
  "editor.show_attention_in_areas_label":
    "Show batteries needing attention in their area sections",
  "editor.battery_threshold_helper":
    "Devices below this battery level, or with unknown/unavailable battery state, are marked as needing attention.",
  "editor.show_attention_in_areas_helper":
    "When enabled, low-battery devices appear in the top attention section and again in their area sections.",
  "editor.repairs_header": "Repairs",
  "editor.updates_header": "Updates",
  "editor.availability_header": "Availability",
  "editor.availability_safe_list_label": "Known safe offline devices",
  "editor.availability_safe_list_helper":
    "Unavailable devices in this list are hidden from the availability results. You can also click and hold a device icon to add it.",
  "editor.stale_header": "Stale entities",
  "editor.stale_threshold_label": "Stale threshold (hours)",
  "editor.stale_threshold_helper":
    "Entities that have not reported within this many hours are shown as stale.",
  "editor.module_enabled_label": "Enabled",
  "editor.module_enabled_helper":
    "When disabled, this module is hidden from the dashboard and its data is not loaded.",
};

export type TranslationKey = keyof typeof en;

export type LocalizeFunc = (
  key: TranslationKey,
  params?: Record<string, string | number>,
) => string;

/**
 * Additional language tables can be added here. Each table only needs to
 * include the keys that differ from English — missing keys fall back to `en`.
 *
 * Example:
 *   const de: Partial<Record<TranslationKey, string>> = {
 *     "view.summary": "Zusammenfassung",
 *   };
 *   const languages: Record<string, Partial<Record<TranslationKey, string>>> = { de };
 */
const languages: Record<string, Partial<Record<TranslationKey, string>>> = {};

export const setupLocalize = (
  hass?: { locale?: { language?: string } },
): LocalizeFunc => {
  const lang = hass?.locale?.language || "en";
  const baseLang = lang.split("-")[0];

  return (key, params) => {
    let result =
      languages[lang]?.[key] ?? languages[baseLang]?.[key] ?? en[key];

    if (params) {
      for (const [param, value] of Object.entries(params)) {
        result = result.replace(`{${param}}`, String(value));
      }
    }

    return result;
  };
};
