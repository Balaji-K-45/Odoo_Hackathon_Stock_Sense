// ──────────────────────────────────────────────────────────
// src/services/warehouseApi.js — Warehouses & Locations API service
// ──────────────────────────────────────────────────────────

import { apiGet, apiPost, apiDelete, USE_MOCKS } from "./api";
import { mockWarehouses, mockLocations } from "../mock/dashboard";

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

let _warehouses = [...mockWarehouses];
let _locations = [...mockLocations];
let _nextLocId = _locations.length + 1;

export async function getWarehouses() {
  if (USE_MOCKS) {
    await delay(200);
    return { success: true, data: [{ id: 1, name: "Main Warehouse" }] };
  }
  return apiGet("/api/warehouses");
}

export async function getWarehouseEmployees() {
  if (USE_MOCKS) {
    await delay(200);
    return {
      success: true,
      data: {
        warehouse: { id: 1, name: "Main Warehouse" },
        manager: { id: 1, name: "Balaji K", email: "manager@stocksense.com", role: "INVENTORY_MANAGER" },
        employees: [
          { id: 2, name: "Alex Rivera", email: "staff@stocksense.com", role: "WAREHOUSE_STAFF", is_active: 1 },
        ],
      },
    };
  }
  return apiGet("/api/warehouse/employees");
}

export async function createWarehouse(data) {
  if (USE_MOCKS) {
    await delay(200);
    throw new Error("Only the permanent Main Warehouse is supported.");
  }
  return apiPost("/api/warehouses", { name: data.name });
}

export async function deleteWarehouse(id) {
  if (USE_MOCKS) {
    await delay(200);
    throw new Error("Main Warehouse cannot be deleted.");
  }
  return apiDelete(`/api/warehouses/${id}`);
}

export async function getLocations() {
  if (USE_MOCKS) {
    await delay(200);
    return { success: true, data: [..._locations] };
  }
  const response = await apiGet("/api/locations");
  return {
    ...response,
    data: response.data.map((location) => ({
      ...location,
      warehouseId: location.warehouse_id,
    })),
  };
}

export async function createLocation(data) {
  if (USE_MOCKS) {
    await delay(200);
    const newLoc = {
      id: _nextLocId++,
      name: data.name,
      warehouseId: Number(data.warehouseId || 1),
      type: data.type || "internal",
    };
    _locations.push(newLoc);
    return { success: true, data: newLoc };
  }
  return apiPost("/api/locations", {
    name: data.name,
    warehouse_id: Number(data.warehouseId || 1),
  });
}
