"""
database.py
-----------
MySQL database connection layer for StockSense.
Uses PyMySQL — a pure-Python MySQL driver (no C extensions needed).

Key differences from SQLite:
  • Placeholder in queries is  %s  (not ?)
  • We open a new connection per request (stored on Flask's `g`)
  • DictCursor → rows returned as dicts (row["column_name"])
  • Autocommit is OFF — call db.commit() after writes

Environment variables required (put in backend/.env):
  MYSQL_HOST      = localhost
  MYSQL_PORT      = 3306
  MYSQL_USER      = root
  MYSQL_PASSWORD  = your_password
  MYSQL_DATABASE  = stocksense
"""

import os
from contextlib import contextmanager
import pymysql
import pymysql.cursors
from flask import g


def _get_connection():
    """Open a new PyMySQL connection using .env settings."""
    return pymysql.connect(
        host     = os.getenv("MYSQL_HOST",     "localhost"),
        port     = int(os.getenv("MYSQL_PORT", "3306")),
        user     = os.getenv("MYSQL_USER",     "root"),
        password = os.getenv("MYSQL_PASSWORD", ""),
        database = os.getenv("MYSQL_DATABASE", "stocksense"),
        charset  = "utf8mb4",
        # DictCursor → every row comes back as a plain Python dict
        cursorclass = pymysql.cursors.DictCursor,
        autocommit  = False,
    )


def get_db():
    """
    Return the MySQL connection for the current Flask request.
    Opens a new connection the first time it is called in a request,
    then reuses it for the rest of that request.
    """
    if "db" not in g:
        g.db = _get_connection()
    return g.db


@contextmanager
def transaction():
    """Commit all work in the current request transaction or roll it back."""
    db = get_db()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise


def close_db(exception=None):
    """Automatically called at the end of every Flask request."""
    db = g.pop("db", None)
    if db is not None:
        db.close()


def init_db():
    """
    Run schema.sql against MySQL to create all tables.
    Safe to call multiple times — uses CREATE TABLE IF NOT EXISTS.

    Called once from app.py at startup.
    """
    schema_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "schema.sql")

    # Read the full schema
    with open(schema_path, "r") as f:
        sql = f.read()

    # Connect WITHOUT specifying a database first (the schema creates it)
    conn = pymysql.connect(
        host     = os.getenv("MYSQL_HOST",     "localhost"),
        port     = int(os.getenv("MYSQL_PORT", "3306")),
        user     = os.getenv("MYSQL_USER",     "root"),
        password = os.getenv("MYSQL_PASSWORD", ""),
        charset  = "utf8mb4",
        autocommit = True,
    )
    try:
        with conn.cursor() as cursor:
            # Execute each statement individually
            for statement in sql.split(";"):
                stmt = statement.strip()
                if stmt:
                    cursor.execute(stmt)

            cursor.execute("SHOW COLUMNS FROM users LIKE 'email_verified'")
            if cursor.fetchone() is None:
                cursor.execute(
                    "ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 1"
                )

            cursor.execute("SHOW COLUMNS FROM otp_tokens LIKE 'purpose'")
            if cursor.fetchone() is None:
                cursor.execute(
                    "ALTER TABLE otp_tokens ADD COLUMN purpose VARCHAR(30) NOT NULL DEFAULT 'password_reset'"
                )

            cursor.execute("SHOW COLUMNS FROM otp_tokens LIKE 'otp'")
            otp_column = cursor.fetchone()
            if otp_column and str(otp_column[1]).lower() != "varchar(64)":
                cursor.execute("ALTER TABLE otp_tokens MODIFY otp VARCHAR(64) NOT NULL")
                cursor.execute("UPDATE otp_tokens SET used=1 WHERE used=0")

            cursor.execute("SHOW COLUMNS FROM otp_tokens LIKE 'attempt_count'")
            if cursor.fetchone() is None:
                cursor.execute(
                    "ALTER TABLE otp_tokens ADD COLUMN attempt_count TINYINT UNSIGNED NOT NULL DEFAULT 0"
                )
        print("[StockSense] MySQL database initialised successfully.")
    finally:
        conn.close()


def init_app(app):
    """Register the close_db teardown with the Flask app."""
    app.teardown_appcontext(close_db)
