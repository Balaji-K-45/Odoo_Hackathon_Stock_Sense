"""Manager-only inventory analysis endpoints."""

from flask import Blueprint, jsonify, request
from middleware.auth import INVENTORY_MANAGER, login_required, roles_required
from services.analysis_service import get_inventory_analysis

analysis_bp = Blueprint("analysis", __name__)


@analysis_bp.route("/api/analysis", methods=["GET"])
@login_required
@roles_required(INVENTORY_MANAGER)
def analysis():
    filters = {
        "date_from": request.args.get("date_from"),
        "date_to": request.args.get("date_to"),
        "warehouse_id": request.args.get("warehouse_id"),
        "location_id": request.args.get("location_id"),
        "category_id": request.args.get("category_id"),
        "product_id": request.args.get("product_id"),
        "operation_type": request.args.get("operation_type"),
    }
    return jsonify({
        "success": True,
        "message": "Inventory analysis loaded",
        "data": get_inventory_analysis(filters),
    }), 200