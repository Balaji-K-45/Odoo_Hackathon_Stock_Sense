"""Aggregated inventory analysis for manager reporting."""

from datetime import datetime, timedelta
from database import get_db


def _fetchall(sql, params=()):
    db = get_db()
    with db.cursor() as cur:
        cur.execute(sql, params)
        return cur.fetchall()


def _normalize_filters(args):
    return {
        "date_from": (args.get("date_from") or "").strip(),
        "date_to": (args.get("date_to") or "").strip(),
        "warehouse_id": args.get("warehouse_id", ""),
        "location_id": args.get("location_id", ""),
        "category_id": args.get("category_id", ""),
        "product_id": args.get("product_id", ""),
        "operation_type": (args.get("operation_type") or "").strip().upper(),
    }


def _date_bounds(filters):
    date_from = filters.get("date_from")
    date_to = filters.get("date_to")

    if date_from:
        start = datetime.strptime(date_from, "%Y-%m-%d")
    else:
        start = datetime.today() - timedelta(days=30)

    if date_to:
        end = datetime.strptime(date_to, "%Y-%m-%d") + timedelta(days=1)
    else:
        end = datetime.today() + timedelta(days=1)

    return start, end


def _filter_row(row, filters):
    warehouse_id = filters.get("warehouse_id")
    location_id = filters.get("location_id")
    category_id = filters.get("category_id")
    product_id = filters.get("product_id")
    operation_type = filters.get("operation_type")

    if warehouse_id and str(row.get("warehouse_id") or "") != str(warehouse_id):
        return False
    if location_id and str(row.get("location_id") or "") != str(location_id):
        return False
    if category_id and str(row.get("category_id") or "") != str(category_id):
        return False
    if product_id and str(row.get("product_id") or "") != str(product_id):
        return False
    if operation_type and operation_type != "ALL":
        operation_name = (row.get("operation_type") or row.get("operation_name") or "").upper()
        if operation_name != operation_type:
            return False
    return True


def get_inventory_analysis(args=None):
    filters = _normalize_filters(args or {})
    start_dt, end_dt = _date_bounds(filters)

    products = _fetchall("""
        SELECT
            p.id AS product_id,
            p.name,
            p.sku,
            p.uom,
            p.category_id,
            p.reorder_level,
            COALESCE(SUM(s.quantity), 0) AS total_quantity,
            l.id AS location_id,
            l.warehouse_id
        FROM products p
        LEFT JOIN stock s ON s.product_id = p.id
        LEFT JOIN locations l ON l.id = s.location_id
        GROUP BY p.id, p.name, p.sku, p.uom, p.category_id, p.reorder_level, l.id, l.warehouse_id
        ORDER BY p.name
    """)

    products = [row for row in products if _filter_row(row, filters)]
    product_summary = {}
    for row in products:
        pid = row["product_id"]
        bucket = product_summary.setdefault(pid, {
            "product_id": pid,
            "name": row["name"],
            "sku": row["sku"],
            "uom": row["uom"],
            "category_id": row["category_id"],
            "reorder_level": float(row["reorder_level"] or 0),
            "total_quantity": 0.0,
        })
        bucket["total_quantity"] += float(row["total_quantity"] or 0)

    product_rows = list(product_summary.values())
    total_products = len(product_rows)
    total_stock = sum(item["total_quantity"] for item in product_rows)
    low_stock = sum(1 for item in product_rows if 0 < item["total_quantity"] <= item["reorder_level"])
    out_of_stock = sum(1 for item in product_rows if item["total_quantity"] == 0)
    overstock = sum(1 for item in product_rows if item["total_quantity"] > (item["reorder_level"] * 2 if item["reorder_level"] else 0))

    ledger_rows = _fetchall("""
        SELECT
            sl.id,
            sl.product_id,
            sl.operation_id,
            sl.operation_type,
            sl.location_id,
            sl.quantity_change,
            sl.reference,
            sl.created_at,
            sl.user_id,
            p.name AS product_name,
            p.sku,
            p.uom,
            p.category_id,
            p.reorder_level,
            l.warehouse_id,
            w.name AS warehouse_name,
            l.name AS location_name
        FROM stock_ledger sl
        JOIN products p ON p.id = sl.product_id
        JOIN locations l ON l.id = sl.location_id
        JOIN warehouses w ON w.id = l.warehouse_id
        WHERE sl.created_at >= %s AND sl.created_at < %s
        ORDER BY sl.created_at DESC
    """, (start_dt, end_dt))
    ledger_rows = [row for row in ledger_rows if _filter_row(row, filters)]

    movement_trend = []
    by_day = {}
    for row in ledger_rows:
        d = row["created_at"].date().isoformat()
        bucket = by_day.setdefault(d, {"date": d, "incoming": 0.0, "outgoing": 0.0, "net": 0.0})
        change = float(row["quantity_change"] or 0)
        if change > 0:
            bucket["incoming"] += change
        else:
            bucket["outgoing"] += abs(change)
        bucket["net"] += change
    for day in sorted(by_day):
        movement_trend.append(by_day[day])

    operation_rows = _fetchall("""
        SELECT
            o.id,
            o.operation_type,
            o.created_at,
            o.reference,
            o.user_id,
            oi.product_id,
            oi.quantity,
            oi.source_location_id,
            oi.destination_location_id,
            p.name AS product_name,
            p.sku,
            p.uom,
            p.category_id,
            p.reorder_level,
            src_l.warehouse_id AS source_warehouse_id,
            dst_l.warehouse_id AS destination_warehouse_id,
            src_w.name AS source_warehouse_name,
            dst_w.name AS destination_warehouse_name,
            src_l.name AS source_location_name,
            dst_l.name AS destination_location_name
        FROM operations o
        JOIN operation_items oi ON oi.operation_id = o.id
        JOIN products p ON p.id = oi.product_id
        LEFT JOIN locations src_l ON src_l.id = oi.source_location_id
        LEFT JOIN locations dst_l ON dst_l.id = oi.destination_location_id
        LEFT JOIN warehouses src_w ON src_w.id = src_l.warehouse_id
        LEFT JOIN warehouses dst_w ON dst_w.id = dst_l.warehouse_id
        WHERE o.created_at >= %s AND o.created_at < %s
        ORDER BY o.created_at DESC
    """, (start_dt, end_dt))
    operation_rows = [row for row in operation_rows if _filter_row(row, filters)]

    receipts_vs_deliveries = []
    by_day_ops = {}
    for row in operation_rows:
        d = row["created_at"].date().isoformat()
        bucket = by_day_ops.setdefault(d, {"date": d, "receipts": 0.0, "deliveries": 0.0})
        if row["operation_type"] == "RECEIPT":
            bucket["receipts"] += float(row["quantity"] or 0)
        elif row["operation_type"] == "DELIVERY":
            bucket["deliveries"] += float(row["quantity"] or 0)
    for day in sorted(by_day_ops):
        receipts_vs_deliveries.append(by_day_ops[day])

    transfers = []
    transfer_map = {}
    for row in operation_rows:
        if row["operation_type"] != "TRANSFER":
            continue
        key = (row["source_warehouse_name"], row["destination_warehouse_name"])
        bucket = transfer_map.setdefault(key, {"from": row["source_warehouse_name"], "to": row["destination_warehouse_name"], "quantity": 0.0, "count": 0})
        bucket["quantity"] += float(row["quantity"] or 0)
        bucket["count"] += 1
    transfers = sorted(transfer_map.values(), key=lambda item: item["quantity"], reverse=True)[:10]

    product_movement = []
    movement_map = {}
    for row in ledger_rows:
        key = row["product_id"]
        bucket = movement_map.setdefault(key, {
            "product_id": row["product_id"],
            "name": row["product_name"],
            "sku": row["sku"],
            "uom": row["uom"],
            "incoming": 0.0,
            "outgoing": 0.0,
            "adjustment": 0.0,
            "total_movement": 0.0,
        })
        change = float(row["quantity_change"] or 0)
        if change > 0:
            bucket["incoming"] += change
        elif change < 0:
            bucket["outgoing"] += abs(change)
        if row["operation_type"] == "ADJUSTMENT":
            bucket["adjustment"] += abs(change)
        bucket["total_movement"] = bucket["incoming"] + bucket["outgoing"] + bucket["adjustment"]
    product_movement = sorted(movement_map.values(), key=lambda item: item["total_movement"], reverse=True)[:10]

    warehouse_map = {}
    for row in products:
        warehouse_id = row.get("warehouse_id")
        if not warehouse_id:
            continue
        key = int(warehouse_id)
        if key not in warehouse_map:
            warehouse_map[key] = {"warehouse_id": key, "warehouse_name": "Warehouse", "total_stock": 0.0, "products": set(), "low_stock": 0}
        warehouse_map[key]["total_stock"] += float(row["total_quantity"] or 0)
        warehouse_map[key]["products"].add(row["product_id"])
        if 0 < float(row["total_quantity"] or 0) <= float(row["reorder_level"] or 0):
            warehouse_map[key]["low_stock"] += 1

    warehouse_rows = _fetchall("SELECT id, name FROM warehouses ORDER BY name")
    warehouse_lookup = {int(row["id"]): row["name"] for row in warehouse_rows}
    warehouse_distribution = []
    for warehouse_id, item in warehouse_map.items():
        item["warehouse_name"] = warehouse_lookup.get(warehouse_id, f"Warehouse {warehouse_id}")
        item["product_count"] = len(item["products"])
        warehouse_distribution.append({
            "warehouse_id": warehouse_id,
            "warehouse_name": item["warehouse_name"],
            "total_stock": item["total_stock"],
            "product_count": item["product_count"],
            "low_stock": item["low_stock"],
        })
    warehouse_distribution = sorted(warehouse_distribution, key=lambda item: item["total_stock"], reverse=True)

    adjustment_rows = [row for row in operation_rows if row["operation_type"] == "ADJUSTMENT"]
    adjustment_summary = []
    by_day_adjust = {}
    for row in adjustment_rows:
        d = row["created_at"].date().isoformat()
        bucket = by_day_adjust.setdefault(d, {"date": d, "positive": 0.0, "negative": 0.0})
        qty = float(row["quantity"] or 0)
        if qty >= 0:
            bucket["positive"] += qty
        else:
            bucket["negative"] += abs(qty)
    for day in sorted(by_day_adjust):
        adjustment_summary.append(by_day_adjust[day])

    low_stock_rows = []
    for row in product_rows:
        total = float(row["total_quantity"] or 0)
        reorder = float(row["reorder_level"] or 0)
        if total == 0:
            status = "Out of Stock"
        elif total <= reorder:
            status = "Low Stock"
        elif total > reorder * 2:
            status = "Overstock"
        else:
            status = "Healthy"
        if status != "Healthy":
            low_stock_rows.append({
                "product_id": row["product_id"],
                "name": row["name"],
                "sku": row["sku"],
                "warehouse_name": "Main Warehouse",
                "current_stock": total,
                "minimum_stock": reorder,
                "status": status,
            })

    inventory_health = {
        "healthy": sum(1 for r in product_rows if 0 < float(r["total_quantity"] or 0) > float(r["reorder_level"] or 0) * 2),
        "low": sum(1 for r in product_rows if 0 < float(r["total_quantity"] or 0) <= float(r["reorder_level"] or 0)),
        "out_of_stock": sum(1 for r in product_rows if float(r["total_quantity"] or 0) == 0),
        "overstock": sum(1 for r in product_rows if float(r["total_quantity"] or 0) > (float(r["reorder_level"] or 0) * 2 if float(r["reorder_level"] or 0) else 0)),
    }

    venues = _fetchall("SELECT id, name FROM warehouses ORDER BY name")
    categories = _fetchall("SELECT id, name FROM categories ORDER BY name")
    products_meta = _fetchall("SELECT id, name, sku FROM products ORDER BY name")
    locations = _fetchall("SELECT id, name, warehouse_id FROM locations ORDER BY warehouse_id, name")

    incoming_total = sum(item["incoming"] for item in movement_trend)
    outgoing_total = sum(item["outgoing"] for item in movement_trend)
    operation_type_counts = {}
    for row in operation_rows:
        t = (row["operation_type"] or "").upper()
        operation_type_counts[t] = operation_type_counts.get(t, 0) + 1

    return {
        "summary": {
            "total_products": total_products,
            "total_stock": total_stock,
            "low_stock": low_stock,
            "out_of_stock": out_of_stock,
            "overstock": overstock,
            "incoming": incoming_total,
            "outgoing": outgoing_total,
            "transfers": sum(item["quantity"] for item in transfers),
            "adjustments": sum(item["positive"] for item in adjustment_summary) + sum(item["negative"] for item in adjustment_summary),
        },
        "movement_trend": movement_trend,
        "receipts_vs_deliveries": receipts_vs_deliveries,
        "transfers": transfers,
        "warehouse_distribution": warehouse_distribution,
        "product_movement": product_movement,
        "adjustments": adjustment_summary,
        "inventory_health": inventory_health,
        "low_stock_items": low_stock_rows,
        "operation_type_counts": operation_type_counts,
        "meta": {
            "warehouses": venues,
            "locations": locations,
            "categories": categories,
            "products": products_meta,
        },
    }