"""
数据库模型和连接
支持 SQLite（本地开发）和 PostgreSQL（Railway 部署）
"""
import sqlite3
import os
from typing import Optional, List, Dict, Any
from contextlib import contextmanager

# 检测运行环境
IS_POSTGRES = bool(os.getenv("DATABASE_URL"))


class DictConnection:
    """包装连接，自动转换占位符并返回 dict"""
    def __init__(self, conn):
        self._conn = conn
        self._is_postgres = IS_POSTGRES

    def cursor(self):
        """返回包装过的 cursor"""
        return DictCursor(self._conn.cursor(), self._is_postgres)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        self.close()


class DictCursor:
    """包装 cursor，自动处理占位符转换和 dict 转换"""
    def __init__(self, cursor, is_postgres=False):
        self._cursor = cursor
        self._is_postgres = is_postgres

    def execute(self, sql: str, params: tuple = None):
        """执行 SQL，自动转换占位符"""
        if self._is_postgres and '?' in sql:
            sql = sql.replace('?', '%s')
        return self._cursor.execute(sql, params)

    def executemany(self, sql: str, params_list: List[tuple]):
        """批量执行 SQL"""
        if self._is_postgres and '?' in sql:
            sql = sql.replace('?', '%s')
        return self._cursor.executemany(sql, params_list)

    def fetchall(self):
        """获取所有行，自动转换为 dict"""
        rows = self._cursor.fetchall()
        if not rows:
            return []
        # PostgreSQL RealDictCursor 返回 dict，SQLite Row 也支持 dict() 转换
        return [dict(row) if hasattr(row, 'keys') else row for row in rows]

    def fetchone(self):
        """获取一行"""
        row = self._cursor.fetchone()
        if row is None:
            return None
        return dict(row) if hasattr(row, 'keys') else row

    @property
    def description(self):
        return self._cursor.description

    @property
    def rowcount(self):
        return self._cursor.rowcount

    def __getattr__(self, name):
        return getattr(self._cursor, name)


def get_connection():
    """获取数据库连接"""
    if IS_POSTGRES:
        import psycopg2
        from psycopg2.extras import RealDictCursor
        conn = psycopg2.connect(os.getenv("DATABASE_URL"))
        conn.autocommit = False
        conn.cursor_factory = RealDictCursor
    else:
        conn = sqlite3.connect("hulalahome.db")
        conn.row_factory = sqlite3.Row
    return DictConnection(conn)


@contextmanager
def get_db():
    """数据库上下文管理器"""
    conn = get_connection()
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        raise e
    finally:
        conn.close()


# ==================== 数据库初始化 ====================

def init_database():
    """初始化数据库表"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        if IS_POSTGRES:
            # PostgreSQL 语法
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS shops (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) UNIQUE NOT NULL,
                    refund_rate DOUBLE PRECISION DEFAULT 0,
                    dsp_rate DOUBLE PRECISION DEFAULT 0,
                    return_freight_rate DOUBLE PRECISION DEFAULT 0,
                    storage_rate DOUBLE PRECISION DEFAULT 0,
                    target_margin_rate DOUBLE PRECISION DEFAULT 0.2,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sku_base_info (
                    id SERIAL PRIMARY KEY,
                    shop VARCHAR(255) NOT NULL,
                    sku VARCHAR(255) NOT NULL,
                    asin VARCHAR(255),
                    spu VARCHAR(255) NOT NULL,
                    lifecycle VARCHAR(255),
                    sales_grade VARCHAR(10),
                    category VARCHAR(255),
                    product_level VARCHAR(255),
                    operator VARCHAR(255),
                    operator_group VARCHAR(255),
                    refund_rate DOUBLE PRECISION,
                    cg_freight DOUBLE PRECISION DEFAULT 0,
                    pl_freight DOUBLE PRECISION DEFAULT 0,
                    fedex_freight DOUBLE PRECISION DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(shop, sku)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS orders (
                    id SERIAL PRIMARY KEY,
                    date VARCHAR(50) NOT NULL,
                    shop VARCHAR(255) NOT NULL,
                    order_id VARCHAR(255) NOT NULL,
                    sku VARCHAR(255) NOT NULL,
                    quantity INTEGER DEFAULT 1,
                    sales_amount DOUBLE PRECISION DEFAULT 0,
                    cost DOUBLE PRECISION DEFAULT 0,
                    warehouse VARCHAR(255),
                    commission DOUBLE PRECISION DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(date, order_id, sku)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ad_data (
                    id SERIAL PRIMARY KEY,
                    date VARCHAR(50) NOT NULL,
                    shop VARCHAR(255) NOT NULL,
                    spu VARCHAR(255) NOT NULL,
                    ad_spend DOUBLE PRECISION DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(date, shop, spu)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS warehouse_freight (
                    id SERIAL PRIMARY KEY,
                    warehouse VARCHAR(255) NOT NULL,
                    tier VARCHAR(50) NOT NULL,
                    sku VARCHAR(255) NOT NULL,
                    freight DOUBLE PRECISION DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(warehouse, tier, sku)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS kpi_targets (
                    id SERIAL PRIMARY KEY,
                    type VARCHAR(50) NOT NULL,
                    target_id VARCHAR(255) NOT NULL,
                    target_name VARCHAR(255) NOT NULL,
                    target_gmv DOUBLE PRECISION DEFAULT 0,
                    target_margin_rate DOUBLE PRECISION DEFAULT 0.2,
                    month VARCHAR(50) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(type, target_id, month)
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_sku ON orders(sku)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ad_data_date ON ad_data(date)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ad_data_spu ON ad_data(spu)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sku_spu ON sku_base_info(spu)")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS department_targets (
                    id SERIAL PRIMARY KEY,
                    shop VARCHAR(255) NOT NULL,
                    target_sales DOUBLE PRECISION DEFAULT 0,
                    target_gross_profit DOUBLE PRECISION DEFAULT 0,
                    target_margin_rate DOUBLE PRECISION DEFAULT 0.2,
                    month VARCHAR(50) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(shop, month)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS operator_group_targets (
                    id SERIAL PRIMARY KEY,
                    operator_group VARCHAR(255) NOT NULL,
                    target_sales DOUBLE PRECISION DEFAULT 0,
                    target_gross_profit DOUBLE PRECISION DEFAULT 0,
                    month VARCHAR(50) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(operator_group, month)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS operator_targets (
                    id SERIAL PRIMARY KEY,
                    operator VARCHAR(255) NOT NULL,
                    operator_group VARCHAR(255),
                    target_sales DOUBLE PRECISION DEFAULT 0,
                    target_gross_profit DOUBLE PRECISION DEFAULT 0,
                    month VARCHAR(50) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(operator, month)
                )
            """)
        else:
            # SQLite 语法
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS shops (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT UNIQUE NOT NULL,
                    refund_rate REAL DEFAULT 0,
                    dsp_rate REAL DEFAULT 0,
                    return_freight_rate REAL DEFAULT 0,
                    storage_rate REAL DEFAULT 0,
                    target_margin_rate REAL DEFAULT 0.2,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sku_base_info (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    shop TEXT NOT NULL,
                    sku TEXT NOT NULL,
                    asin TEXT,
                    spu TEXT NOT NULL,
                    lifecycle TEXT,
                    sales_grade TEXT CHECK(sales_grade IN ('S', 'A', 'B', 'C')),
                    category TEXT,
                    product_level TEXT,
                    operator TEXT,
                    operator_group TEXT,
                    refund_rate REAL,
                    cg_freight REAL DEFAULT 0,
                    pl_freight REAL DEFAULT 0,
                    fedex_freight REAL DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(shop, sku)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS orders (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    shop TEXT NOT NULL,
                    order_id TEXT NOT NULL,
                    sku TEXT NOT NULL,
                    quantity INTEGER DEFAULT 1,
                    sales_amount REAL DEFAULT 0,
                    cost REAL DEFAULT 0,
                    warehouse TEXT,
                    commission REAL DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(date, order_id, sku)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ad_data (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    date TEXT NOT NULL,
                    shop TEXT NOT NULL,
                    spu TEXT NOT NULL,
                    ad_spend REAL DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(date, shop, spu)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS warehouse_freight (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    warehouse TEXT NOT NULL,
                    tier TEXT NOT NULL,
                    sku TEXT NOT NULL,
                    freight REAL DEFAULT 0,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(warehouse, tier, sku)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS kpi_targets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    type TEXT NOT NULL CHECK(type IN ('shop', 'operator', 'spu')),
                    target_id TEXT NOT NULL,
                    target_name TEXT NOT NULL,
                    target_gmv REAL DEFAULT 0,
                    target_margin_rate REAL DEFAULT 0.2,
                    month TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(type, target_id, month)
                )
            """)
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_sku ON orders(sku)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_spu ON orders(sku)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ad_data_date ON ad_data(date)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_ad_data_spu ON ad_data(spu)")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_sku_spu ON sku_base_info(spu)")
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS department_targets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    shop TEXT NOT NULL,
                    target_sales REAL DEFAULT 0,
                    target_gross_profit REAL DEFAULT 0,
                    target_margin_rate REAL DEFAULT 0.2,
                    month TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(shop, month)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS operator_group_targets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    operator_group TEXT NOT NULL,
                    target_sales REAL DEFAULT 0,
                    target_gross_profit REAL DEFAULT 0,
                    month TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(operator_group, month)
                )
            """)
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS operator_targets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    operator TEXT NOT NULL,
                    operator_group TEXT,
                    target_sales REAL DEFAULT 0,
                    target_gross_profit REAL DEFAULT 0,
                    month TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE(operator, month)
                )
            """)
        cursor.close()
        conn.commit()
    finally:
        conn.close()


if __name__ == "__main__":
    init_database()
    print("数据库初始化完成")
