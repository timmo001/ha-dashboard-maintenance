import { css, html, nothing } from "lit";
import type { TemplateResult } from "lit";

export interface EditorItemGroupOptions {
  header: string;
  secondary: string;
  icon: string;
  expanded: boolean;
  onExpandedChanged: (ev: CustomEvent<{ expanded: boolean }>) => void;
  rows: TemplateResult[];
  adder: TemplateResult;
}

export interface EditorItemRowOptions {
  icon: TemplateResult;
  primary: string;
  secondary?: string;
  actions: TemplateResult;
}

export const renderEditorItemGroup = ({
  header,
  secondary,
  icon,
  expanded,
  onExpandedChanged,
  rows,
  adder,
}: EditorItemGroupOptions) => html`
  <ha-expansion-panel
    class="item-group"
    outlined
    .expanded=${expanded}
    @expanded-changed=${onExpandedChanged}
    .header=${header}
    .secondary=${secondary}
  >
    <ha-icon slot="leading-icon" icon=${icon}></ha-icon>
    <div class="items">${rows} ${adder}</div>
  </ha-expansion-panel>
`;

export const renderEditorItemRow = ({
  icon,
  primary,
  secondary,
  actions,
}: EditorItemRowOptions) => html`
  <div class="item-row">
    ${icon}
    <div class="item-content">
      <span class="item-name">${primary}</span>
      ${secondary ? html`<span class="secondary">${secondary}</span>` : nothing}
    </div>
    ${actions}
  </div>
`;

export const editorItemGroupStyles = css`
  ha-expansion-panel.item-group {
    display: block;
    margin-top: var(--ha-space-6, 24px);
  }

  .items {
    display: flex;
    flex-direction: column;
    padding: var(--ha-space-3, 12px);
  }

  .item-row {
    display: flex;
    align-items: center;
    gap: 12px;
    min-height: 48px;
  }

  .item-row ha-state-icon,
  .item-row ha-domain-icon,
  .item-row ha-icon {
    color: var(--state-icon-color, var(--secondary-text-color));
    margin-inline-end: 0;
    flex-shrink: 0;
  }

  .item-content {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }

  .item-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .item-row ha-icon-button {
    --ha-icon-button-size: 36px;
    color: var(--secondary-text-color);
  }

  .items ha-button {
    align-self: flex-start;
    margin-top: 8px;
  }

  .items ha-entity-picker,
  .items ha-device-picker {
    display: block;
    margin-top: 8px;
  }
`;
