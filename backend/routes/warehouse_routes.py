"""
routes/warehouse_routes.py
---------------------------
Single-warehouse architecture for StockSense.
The application keeps a single permanent Main Warehouse and scopes all locations and stock to it.
"""

from flask import Blueprint, request, jsonify
from middleware.auth import (
    login_required, roles_required,
    INVENTORY_MANAGER, WAREHOUSE_STAFF,
)
from models.user import get_users_for_warehouse
from models.warehouse import (
    get_all_warehouses, get_warehouse_by_id, create_warehouse, delete_warehouse,
    get_all_locations, get_location_by_id, create_location,
    ensure_main_warehouse_exists, get_main_warehouse,
)

warehouse_bp = Blueprint("warehouses", __name__)


# ── Warehouses ──────────────────────────────────────────────────────────────

@warehouse_bp.route("/api/warehouses", methods=["GET"])
@login_required
@roles_required(INVENTORY_MANAGER, WAREHOUSE_STAFF)
def get_warehouses():
    ensure_main_warehouse_exists()
    return jsonify({"success": True, "data": get_all_warehouses()}), 200


@warehouse_bp.route("/api/warehouse", methods=["GET"])
@login_required
@roles_required(INVENTORY_MANAGER, WAREHOUSE_STAFF)
def get_single_warehouse():
    warehouse = get_main_warehouse()
    return jsonify({"success": True, "data": warehouse}), 200


@warehouse_bp.route("/api/warehouse/employees", methods=["GET"])
@login_required
@roles_required(INVENTORY_MANAGER)
def get_warehouse_employees():
    users = get_users_for_warehouse()
    manager = next((user for user in users if user["role"] == INVENTORY_MANAGER), None)
    employees = [user for user in users if user["role"] == WAREHOUSE_STAFF]
    return jsonify({
        "success": True,
        "data": {
            "warehouse": get_main_warehouse(),
            "manager": manager,
            "employees": employees,
        },
    }), 200


@warehouse_bp.route("/api/warehouses", methods=["POST"])
@login_required
@roles_required(INVENTORY_MANAGER)
def add_warehouse():
    return jsonify({
        "success": False,
        "message": "Only the permanent Main Warehouse is supported. Warehouse creation is disabled.",
    }), 409


@warehouse_bp.route("/api/warehouses/<int:warehouse_id>", methods=["DELETE"])
@login_required
@roles_required(INVENTORY_MANAGER)
def remove_warehouse(warehouse_id):
    if not get_warehouse_by_id(warehouse_id):
        return jsonify({"success": False, "message": "Warehouse not found"}), 404
    error = delete_warehouse(warehouse_id)
    if error:
        return jsonify({"success": False, "message": error}), 409
    return jsonify({"success": False, "message": "Main Warehouse cannot be deleted."}), 409


# ── Locations ───────────────────────────────────────────────────────────────

@warehouse_bp.route("/api/locations", methods=["GET"])
@login_required
@roles_required(INVENTORY_MANAGER, WAREHOUSE_STAFF)
def get_locations():
    warehouse_id = request.args.get("warehouse_id") or get_main_warehouse()["id"]
    locations = get_all_locations(warehouse_id=warehouse_id)
    return jsonify({"success": True, "data": locations}), 200


@warehouse_bp.route("/api/locations", methods=["POST"])
@login_required
@roles_required(INVENTORY_MANAGER)
def add_location():
    data = request.get_json() or {}
    warehouse_id = data.get("warehouse_id") or get_main_warehouse()["id"]
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({
            "success": False,
            "message": "Location name is required",
        }), 400
    if not get_warehouse_by_id(warehouse_id):
        return jsonify({"success": False, "message": "Warehouse not found"}), 404
    if str(get_main_warehouse()["id"]) != str(warehouse_id):
        return jsonify({
            "success": False,
            "message": "Only the Main Warehouse can be used for locations.",
        }), 409
    loc_id = create_location(warehouse_id, name)
    return jsonify({
        "success": True,
        "message": "Location created",
        "data": get_location_by_id(loc_id),
    }), 201
