import { ReactiveElement } from "lit";
import { customElement } from "lit/decorators.js";
import "./editor";
import { setupLocalize, type TranslationKey } from "./localize";
import { makeModuleSummarySection } from "./maintenance-module-sections";
import {
  makeEmptyStateSection,
  type LovelaceSectionConfig,
} from "./maintenance-view-helpers";
import { shouldRegenerateMaintenance } from "./strategy-regenerate";
import {
  isMaintenanceModuleId,
  type HomeAssistant,
  type MaintenanceModuleId,
  type MaintenanceSectionStrategyConfig,
} from "./types";

const STRATEGY_TYPE = "custom:maintenance";

// The section sits on the user's own dashboard, so the column span is theirs to set
type GeneratedSectionConfig = Omit<LovelaceSectionConfig, "column_span"> & {
  disabled?: boolean;
};

interface SectionModule {
  /**
   * Home Assistant's own page for the module, as the maintenance dashboard's
   * views may not exist.
   */
  navigationPath?: string;
  icon: string;
  emptyTitle: TranslationKey;
  emptyContent: TranslationKey;
}

const SECTION_MODULES: Record<MaintenanceModuleId, SectionModule> = {
  system: {
    icon: "mdi:server",
    emptyTitle: "system.empty_title",
    emptyContent: "system.empty_content",
  },
  batteries: {
    icon: "mdi:battery-heart-variant",
    emptyTitle: "battery.empty_no_attention_title",
    emptyContent: "battery.empty_no_attention_content",
  },
  repairs: {
    navigationPath: "/config/repairs",
    icon: "mdi:wrench",
    emptyTitle: "repair.empty_no_issues_title",
    emptyContent: "repair.empty_no_issues_content",
  },
  updates: {
    navigationPath: "/config/updates",
    icon: "mdi:package-up",
    emptyTitle: "update.empty_no_updates_title",
    emptyContent: "update.empty_no_updates_content",
  },
  availability: {
    icon: "mdi:help-circle-outline",
    emptyTitle: "availability.empty_no_issues_title",
    emptyContent: "availability.empty_no_issues_content",
  },
  stale: {
    icon: "mdi:clock-alert-outline",
    emptyTitle: "stale.empty_no_issues_title",
    emptyContent: "stale.empty_no_issues_content",
  },
  integrations: {
    navigationPath: "/config/integrations/dashboard",
    icon: "mdi:puzzle",
    emptyTitle: "integration.empty_no_issues_title",
    emptyContent: "integration.empty_no_issues_content",
  },
};

// Modules tried for the section picker preview, most useful first
const STUB_MODULES = [
  "batteries",
  "repairs",
  "updates",
  "availability",
  "integrations",
  "stale",
  "system",
] as const satisfies readonly MaintenanceModuleId[];

const makeSection = (
  module: MaintenanceModuleId,
  hass: HomeAssistant,
  config: MaintenanceSectionStrategyConfig,
): Promise<LovelaceSectionConfig | null> =>
  makeModuleSummarySection(module, setupLocalize(hass), hass, config, {
    navigationPath: SECTION_MODULES[module].navigationPath,
  });

@customElement("ll-strategy-section-maintenance")
export class MaintenanceSectionStrategy extends ReactiveElement {
  public static shouldRegenerate(
    config: MaintenanceSectionStrategyConfig,
    oldHass: HomeAssistant,
    newHass: HomeAssistant,
  ): boolean {
    return shouldRegenerateMaintenance(
      config,
      oldHass,
      newHass,
      isMaintenanceModuleId(config.module) ? [config.module] : [],
    );
  }

  public static async generate(
    config: MaintenanceSectionStrategyConfig,
    hass: HomeAssistant,
  ): Promise<GeneratedSectionConfig> {
    const localize = setupLocalize(hass);

    if (!isMaintenanceModuleId(config.module)) {
      return {
        type: "grid",
        cards: [{ type: "markdown", content: localize("section.unknown_module") }],
      };
    }

    const section = await makeSection(config.module, hass, config);

    if (section) {
      const { column_span: _columnSpan, ...generated } = section;

      return generated;
    }

    // Hidden on the dashboard, but still shown while editing it
    const sectionModule = SECTION_MODULES[config.module];

    const { column_span: _columnSpan, ...empty } = makeEmptyStateSection(
      localize(sectionModule.emptyTitle),
      localize(sectionModule.emptyContent),
      sectionModule.icon,
    );

    return { ...empty, disabled: true };
  }

  /**
   * The new section and its preview when it's added from the section picker:
   * the first module with something to show.
   */
  public static async getStubConfig(
    hass: HomeAssistant,
  ): Promise<MaintenanceSectionStrategyConfig> {
    for (const module of STUB_MODULES) {
      const config: MaintenanceSectionStrategyConfig = {
        type: STRATEGY_TYPE,
        module,
      };

      if (await makeSection(module, hass, config)) {
        return config;
      }
    }

    return { type: STRATEGY_TYPE, module: "repairs" };
  }

  public static getConfigElement(): HTMLElement {
    return document.createElement("dashboard-maintenance-section-editor");
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "ll-strategy-section-maintenance": MaintenanceSectionStrategy;
  }
}
