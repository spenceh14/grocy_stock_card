class GrocyStockCard extends HTMLElement {
  static getConfigElement() {
    return document.createElement("grocy-stock-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:grocy-stock-card",
      entity: "sensor.grocy_stock",
      title: "Grocy Stock",
      quantity_step: 1
    };
  }

  setConfig(config) {
    if (!config || !config.entity) {
      throw new Error("You need to define an entity, for example sensor.grocy_stock");
    }

    this.config = {
      title: "Grocy Stock",
      quantity_step: 1,
      show_zero: false,
      sort_by: "name",
      service_domain: "grocy",
      add_service: "add_product_to_stock",
      consume_service: "consume_product_from_stock",
      ...config
    };

    if (!this.shadowRoot) {
      this.attachShadow({ mode: "open" });
    }
  }

  set hass(hass) {
    this._hass = hass;
    this._render();
  }

  getCardSize() {
    const count = this._getItems().length;
    return Math.max(3, Math.min(8, count + 1));
  }

  _render() {
    if (!this.shadowRoot || !this._hass || !this.config) return;

    const stateObj = this._hass.states[this.config.entity];

    if (!stateObj) {
      this.shadowRoot.innerHTML = this._styles() + `
        <ha-card>
          <div class="card">
            <div class="title">${this._escape(this.config.title)}</div>
            <div class="empty">Entity not found: ${this._escape(this.config.entity)}</div>
          </div>
        </ha-card>
      `;
      return;
    }

    const items = this._getItems();

    this.shadowRoot.innerHTML = this._styles() + `
      <ha-card>
        <div class="card">
          <div class="header">
            <div class="title">${this._escape(this.config.title)}</div>
            <div class="count">${items.length} item${items.length === 1 ? "" : "s"}</div>
          </div>

          ${
            items.length
              ? `<div class="rows">
                  ${items.map((item) => this._rowTemplate(item)).join("")}
                </div>`
              : `<div class="empty">No Grocy stock items found.</div>`
          }
        </div>
      </ha-card>
    `;

    this.shadowRoot.querySelectorAll("button[data-action]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.stopPropagation();
        const productId = button.dataset.productId;
        const action = button.dataset.action;
        const item = items.find((stockItem) => String(stockItem.productId) === String(productId));
        if (item) this._changeStock(item, action);
      });
    });
  }

  _rowTemplate(item) {
    const disabled = item.productId === undefined || item.productId === null || item.productId === "";
    const qty = this._formatNumber(item.quantity);

    return `
      <div class="row">
        <div class="main">
          <div class="name">${this._escape(item.name)}</div>
          ${item.location ? `<div class="location">${this._escape(item.location)}</div>` : ""}
        </div>
        <div class="quantity">
          <span class="amount">${this._escape(qty)}</span>
          ${item.unit ? `<span class="unit">${this._escape(item.unit)}</span>` : ""}
        </div>
        <div class="actions">
          <button
            class="round"
            data-action="consume"
            data-product-id="${this._escape(String(item.productId ?? ""))}"
            title="Consume ${this._escape(item.name)}"
            ${disabled ? "disabled" : ""}
          >−</button>
          <button
            class="round"
            data-action="add"
            data-product-id="${this._escape(String(item.productId ?? ""))}"
            title="Add ${this._escape(item.name)}"
            ${disabled ? "disabled" : ""}
          >+</button>
        </div>
      </div>
    `;
  }

  _getItems() {
    if (!this._hass || !this.config) return [];

    const stateObj = this._hass.states[this.config.entity];
    if (!stateObj) return [];

    const attrs = stateObj.attributes || {};
    const rawItems =
      attrs.products ??
      attrs.stock ??
      attrs.items ??
      attrs.entries ??
      attrs.stock_entries ??
      [];

    const normalizedRawItems = Array.isArray(rawItems)
      ? rawItems
      : rawItems && typeof rawItems === "object"
        ? Object.values(rawItems)
        : [];

    let items = normalizedRawItems
      .map((item) => this._normalizeItem(item))
      .filter((item) => item.name);

    if (!this.config.show_zero) {
      items = items.filter((item) => Number(item.quantity || 0) !== 0);
    }

    if (this.config.filter) {
      const filter = String(this.config.filter).toLowerCase();
      items = items.filter((item) => item.name.toLowerCase().includes(filter));
    }

    if (this.config.location) {
      const location = String(this.config.location).toLowerCase();
      items = items.filter((item) => String(item.location || "").toLowerCase().includes(location));
    }

    if (this.config.sort_by === "quantity") {
      items.sort((a, b) => Number(a.quantity || 0) - Number(b.quantity || 0));
    } else {
      items.sort((a, b) => a.name.localeCompare(b.name));
    }

    return items;
  }

  _normalizeItem(item) {
    const product = item.product || item.product_details || {};
    const quantityUnit = item.quantity_unit || item.qu || {};

    const name =
      item.name ??
      item.product_name ??
      item.name_plural ??
      product.name ??
      product.name_plural ??
      "";

    const productId =
      item.product_id ??
      item.productId ??
      item.id ??
      product.id ??
      product.product_id ??
      "";

    const quantity =
      item.amount_aggregated ??
      item.amount ??
      item.quantity ??
      item.stock_amount ??
      item.available_amount ??
      item.amount_opened ??
      0;

    const unit =
      item.quantity_unit_name ??
      item.unit ??
      item.unit_name ??
      item.qu_name ??
      quantityUnit.name ??
      quantityUnit.name_plural ??
      "";

    const locationObj = item.location || item.storage_location || {};
    const location =
      item.location_name ??
      item.storage_location_name ??
      locationObj.name ??
      "";

    return {
      raw: item,
      name: String(name),
      productId,
      quantity,
      unit: unit ? String(unit) : "",
      location: location ? String(location) : ""
    };
  }

  async _changeStock(item, action) {
    const isAdd = action === "add";
    const domain = this.config.service_domain;
    const service = isAdd ? this.config.add_service : this.config.consume_service;
    const serviceDataConfig = isAdd ? this.config.add_service_data : this.config.consume_service_data;

    const amount = Number(this.config.quantity_step || 1);

    const defaultData = {
      product_id: Number.isNaN(Number(item.productId)) ? item.productId : Number(item.productId),
      amount
    };

    const serviceData = serviceDataConfig
      ? this._templateServiceData(serviceDataConfig, item, amount)
      : defaultData;

    try {
      await this._hass.callService(domain, service, serviceData);
      this._toast(`${isAdd ? "Added" : "Consumed"} ${amount} ${item.unit || ""} ${item.name}`.trim());
    } catch (error) {
      console.error("Grocy Stock Card service call failed", error);
      this._toast(`Failed to update ${item.name}`);
    }
  }

  _templateServiceData(value, item, amount) {
    if (Array.isArray(value)) {
      return value.map((entry) => this._templateServiceData(entry, item, amount));
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([key, entryValue]) => [
          key,
          this._templateServiceData(entryValue, item, amount)
        ])
      );
    }

    if (typeof value !== "string") return value;

    const replaced = value
      .replaceAll("__product_id__", String(item.productId))
      .replaceAll("__amount__", String(amount))
      .replaceAll("__name__", item.name)
      .replaceAll("__unit__", item.unit || "");

    if (/^-?\d+(\.\d+)?$/.test(replaced)) {
      return Number(replaced);
    }

    return replaced;
  }

  _toast(message) {
    this.dispatchEvent(
      new CustomEvent("hass-notification", {
        detail: { message },
        bubbles: true,
        composed: true
      })
    );
  }

  _formatNumber(value) {
    const number = Number(value);
    if (Number.isNaN(number)) return String(value ?? "");
    return new Intl.NumberFormat(undefined, {
      maximumFractionDigits: 2
    }).format(number);
  }

  _escape(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  _styles() {
    return `
      <style>
        :host {
          display: block;
        }

        ha-card {
          overflow: hidden;
        }

        .card {
          padding: 16px;
        }

        .header {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .title {
          font-size: 20px;
          font-weight: 600;
          color: var(--primary-text-color);
        }

        .count {
          font-size: 13px;
          color: var(--secondary-text-color);
          white-space: nowrap;
        }

        .rows {
          display: flex;
          flex-direction: column;
        }

        .row {
          display: grid;
          grid-template-columns: minmax(0, 1fr) auto auto;
          gap: 12px;
          align-items: center;
          min-height: 52px;
          border-top: 1px solid var(--divider-color);
        }

        .row:first-child {
          border-top: none;
        }

        .main {
          min-width: 0;
        }

        .name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--primary-text-color);
          font-size: 15px;
          font-weight: 500;
        }

        .location {
          margin-top: 2px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: var(--secondary-text-color);
          font-size: 12px;
        }

        .quantity {
          display: flex;
          gap: 4px;
          align-items: baseline;
          justify-content: flex-end;
          min-width: 70px;
          color: var(--primary-text-color);
        }

        .amount {
          font-size: 16px;
          font-weight: 600;
        }

        .unit {
          font-size: 12px;
          color: var(--secondary-text-color);
        }

        .actions {
          display: flex;
          gap: 8px;
        }

        .round {
          width: 34px;
          height: 34px;
          border-radius: 999px;
          border: 1px solid var(--divider-color);
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-size: 20px;
          line-height: 1;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 0;
        }

        .round:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .round:not(:disabled):active {
          transform: scale(0.96);
        }

        .empty {
          padding: 16px 0 4px;
          color: var(--secondary-text-color);
          font-size: 14px;
        }
      </style>
    `;
  }
}

customElements.define("grocy-stock-card", GrocyStockCard);

window.customCards = window.customCards || [];
window.customCards.push({
  type: "grocy-stock-card",
  name: "Grocy Stock Card",
  description: "Show Grocy stock items with plus and minus quantity controls."
});

class GrocyStockCardEditor extends HTMLElement {
  setConfig(config) {
    this.config = config;
    this.render();
  }

  render() {
    this.innerHTML = `
      <div style="padding: 12px;">
        <p>Configure this card in YAML for now.</p>
        <pre>type: custom:grocy-stock-card
entity: sensor.grocy_stock
title: Freezer Inventory
quantity_step: 1</pre>
      </div>
    `;
  }
}

customElements.define("grocy-stock-card-editor", GrocyStockCardEditor);
console.info("%c GROCY-STOCK-CARD %c loaded ", "color: white; background: #03a9f4; font-weight: 700;", "color: #03a9f4; background: white; font-weight: 700;");
