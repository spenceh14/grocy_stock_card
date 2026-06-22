# Grocy Stock Card

A Home Assistant Lovelace custom card for showing Grocy stock items with quick **plus** and **minus** quantity controls.

This is designed for freezer inventory where you want to see each Grocy product and quickly add or consume one unit without writing per-product dashboard YAML.

## Features

- Reads products automatically from a Grocy stock sensor.
- Shows item name, quantity, and unit.
- Adds `+` and `-` buttons for each item.
- Calls Home Assistant Grocy services to add or consume stock.
- Supports optional filtering, sorting, and custom service names.
- Can show dashboard sort buttons for alphabetical, quantity low-to-high, and quantity high-to-low sorting.
- No build step required.

## Installation with HACS

1. In Home Assistant, open **HACS**.
2. Go to **Frontend**.
3. Open the three-dot menu and choose **Custom repositories**.
4. Add this repository URL:

   ```text
   https://github.com/spenceh14/grocy_stock_card
   ```

5. Category: **Dashboard**.
6. Install the card.
7. Restart Home Assistant or reload frontend resources if needed.

## Manual installation

Copy the card file into your Home Assistant config:

```text
www/community/grocy_stock_card/grocy-stock-card.js
```

Then add it as a Lovelace resource:

```yaml
url: /local/community/grocy_stock_card/grocy-stock-card.js
type: module
```

## Basic card config

```yaml
type: custom:grocy-stock-card
entity: sensor.grocy_stock
title: Freezer Inventory
quantity_step: 1
```

## Optional config

```yaml
type: custom:grocy-stock-card
entity: sensor.grocy_stock
title: Freezer Inventory
quantity_step: 1
show_zero: false
sort_by: name
sort_direction: asc
show_sort_controls: true
service_domain: grocy
add_service: add_product_to_stock
consume_service: consume_product_from_stock
```

## Dashboard sort controls

Enable sort buttons directly on the card:

```yaml
type: custom:grocy-stock-card
entity: sensor.grocy_stock
title: Freezer Inventory
quantity_step: 1
show_sort_controls: true
sort_by: name
sort_direction: asc
```

This shows three buttons on the dashboard:

- `A–Z` sorts alphabetically.
- `Qty ↑` sorts by quantity from low to high.
- `Qty ↓` sorts by quantity from high to low.

The selected sort mode is stored in the card while the dashboard page is open. The default sort after a refresh comes from `sort_by` and `sort_direction` in YAML.

Supported sort values:

```yaml
sort_by: name       # or quantity
sort_direction: asc # or desc
```

## Filtering

Filter by text in the product name:

```yaml
type: custom:grocy-stock-card
entity: sensor.grocy_stock
title: Meat Freezer
filter: beef
```

Filter by location text when the Grocy stock attribute includes a location field:

```yaml
type: custom:grocy-stock-card
entity: sensor.grocy_stock
title: Garage Freezer
location: Garage Freezer
```

## Custom service data

By default, the card calls:

```yaml
grocy.add_product_to_stock:
  product_id: <product id>
  amount: <quantity_step>

grocy.consume_product_from_stock:
  product_id: <product id>
  amount: <quantity_step>
```

If your Grocy integration expects a slightly different payload, override it:

```yaml
type: custom:grocy-stock-card
entity: sensor.grocy_stock
add_service_data:
  product_id: "__product_id__"
  amount: "__amount__"
consume_service_data:
  product_id: "__product_id__"
  amount: "__amount__"
```

Available placeholders:

- `__product_id__`
- `__amount__`
- `__name__`
- `__unit__`

## Notes

The Grocy integration can expose stock data in different attribute shapes depending on version. This card attempts to read common structures such as:

- `attributes.products`
- `attributes.stock`
- `attributes.items`
- `attributes.entries`
- `attributes.stock_entries`
- object maps of stock entries

If the card shows no products, open Home Assistant **Developer Tools → States**, inspect `sensor.grocy_stock`, and compare the attributes to the supported fields in `dist/grocy-stock-card.js`.

## Development

This card intentionally ships as plain JavaScript with no build step.

Repository structure:

```text
grocy_stock_card/
├── dist/
│   └── grocy-stock-card.js
├── hacs.json
├── LICENSE
├── package.json
└── README.md
```

## License

MIT
