import { apiGet, USE_MOCKS } from "./api";

function buildQueryString(filters = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "" && value !== "ALL") {
      params.set(key, value);
    }
  });
  const query = params.toString();
  return query ? `?${query}` : "";
}

export async function getInventoryAnalysis(filters = {}) {
  if (USE_MOCKS) {
    return {
      success: true,
      data: {
        summary: { total_products: 0, total_stock: 0, low_stock: 0, out_of_stock: 0, overstock: 0, incoming: 0, outgoing: 0, transfers: 0, adjustments: 0 },
        movement_trend: [],
        receipts_vs_deliveries: [],
        transfers: [],
        warehouse_distribution: [],
        product_movement: [],
        adjustments: [],
        inventory_health: { healthy: 0, low: 0, out_of_stock: 0, overstock: 0 },
        low_stock_items: [],
        operation_type_counts: {},
        meta: { warehouses: [], locations: [], categories: [], products: [] },
      },
    };
  }
  return apiGet(`/api/analysis${buildQueryString(filters)}`);
}