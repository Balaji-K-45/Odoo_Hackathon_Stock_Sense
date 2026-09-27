"""
models/warehouse.py  —  MySQL version

This project deliberately maintains a single permanent warehouse named "Main Warehouse".
All warehouse operations are scoped to that single warehouse unless the project later adds
explicit warehouse assignment rules.
"""

from database import get_db, transaction


MAIN_WAREHOUSE_NAME = "Main Warehouse"


def ensure_main_warehouse_exists():
    db = get_db()
    with db.cursor() as cur:
        cur.execute("SELECT id, name FROM warehouses WHERE name=%s", (MAIN_WAREHOUSE_NAME,))
        warehouse = cur.fetchone()
        if warehouse:
            return warehouse

        cur.execute("INSERT INTO warehouses (name) VALUES (%s)", (MAIN_WAREHOUSE_NAME,))
        warehouse_id = cur.lastrowid
        cur.execute(
            "INSERT INTO locations (warehouse_id, name) VALUES (%s, %s)",
            (warehouse_id, "Main Storage"),
        )
        db.commit()
        return {"id": warehouse_id, "name": MAIN_WAREHOUSE_NAME}


def get_main_warehouse():
    return ensure_main_warehouse_exists()


def get_all_warehouses():
    warehouse = get_main_warehouse()
    return [warehouse]


def get_warehouse_by_id(warehouse_id):
    db = get_db()
    with db.cursor() as cur:
        cur.execute("SELECT * FROM warehouses WHERE id=%s", (warehouse_id,))
        return cur.fetchone()


def create_warehouse(name):
    normalized = (name or "").strip()
    if normalized and normalized.lower() != MAIN_WAREHOUSE_NAME.lower():
        raise ValueError("Only the permanent Main Warehouse is supported.")
    return get_main_warehouse()["id"]


def delete_warehouse(warehouse_id):
    warehouse = get_warehouse_by_id(warehouse_id)
    if not warehouse:
        return "Warehouse not found"
    if str(warehouse["name"]).lower() == MAIN_WAREHOUSE_NAME.lower():
        return "Main Warehouse cannot be deleted. The system has one permanent warehouse."
    return None


# ── Locations ───────────────────────────────────────────────────────────────

def get_all_locations(warehouse_id=None):
    db = get_db()
    with db.cursor() as cur:
        if warehouse_id:
            cur.execute("""
                SELECT l.*, w.name AS warehouse_name
                FROM locations l
                JOIN warehouses w ON w.id = l.warehouse_id
                WHERE l.warehouse_id=%s
                ORDER BY w.name, l.name
            """, (warehouse_id,))
        else:
            cur.execute("""
                SELECT l.*, w.name AS warehouse_name
                FROM locations l
                JOIN warehouses w ON w.id = l.warehouse_id
                ORDER BY w.name, l.name
            """)
        return cur.fetchall()


def get_location_by_id(location_id):
    db = get_db()
    with db.cursor() as cur:
        cur.execute("""
            SELECT l.*, w.name AS warehouse_name
            FROM locations l
            JOIN warehouses w ON w.id = l.warehouse_id
            WHERE l.id=%s
        """, (location_id,))
        return cur.fetchone()


def create_location(warehouse_id, name):
    db = get_db()
    with db.cursor() as cur:
        cur.execute(
            "INSERT INTO locations (warehouse_id, name) VALUES (%s, %s)",
            (warehouse_id, name)
        )
        new_id = cur.lastrowid
    db.commit()
    return new_id
