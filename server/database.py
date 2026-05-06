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
        if params is None:
            return self._cursor.execute(sql)
        return self._cursor.execute(sql, params)

    def executemany(self, sql: str, params_list: List[tuple]):
        """批量执行 SQL"""
        if self._is_postgres and '?' in sql:
            sql = sql.replace('?', '%s')
        return self._cursor.executemany(sql, params_list)

    def fetchall(self):
        """获取所有行，统一转换为纯 dict"""
        rows = self._cursor.fetchall()
        if not rows:
            return []
        
        # 统一转换：使用列名 + 索引获取值，避免 sqlite3.Row / RealDictRow 差异
        # sqlite3.Row: 通过索引获取值，但 dict(row) 转换后键是大写
        # RealDictRow: 直接是字典，dict(row) 可以工作但某些情况可能有问题
        # 统一方案：使用 description 获取列名，用索引获取值
        try:
            desc = self._cursor.description
            if desc:
                col_names = [col[0].lower() for col in desc]  # 统一小写
                result = []
                for row in rows:
                    d = {}
                    for i, col_name in enumerate(col_names):
                        try:
                            # RealDictRow 支持索引访问，sqlite3.Row 也支持
                            d[col_name] = row[i]
                        except (IndexError, TypeError, KeyError):
                            # fallback: 直接尝试 dict 转换
                            if hasattr(row, 'keys'):
                                d = dict(row)
                                break
                            else:
                                d[col_name] = row
                    if isinstance(d, dict):
                        result.append(d)
                    else:
                        result.append(d)
                return result
        except Exception:
            pass
        
        # Fallback: 尝试直接转换
        return [dict(row) if hasattr(row, 'keys') else row for row in rows]

    def fetchone(self):
        """获取一行，统一转换为纯 dict"""
        row = self._cursor.fetchone()
        if row is None:
            return None
        
        # 统一转换：使用列名 + 索引获取值
        try:
            desc = self._cursor.description
            if desc:
                col_names = [col[0].lower() for col in desc]
                d = {}
                for i, col_name in enumerate(col_names):
                    try:
                        d[col_name] = row[i]
                    except (IndexError, TypeError, KeyError):
                        if hasattr(row, 'keys'):
                            return dict(row)
                        else:
                            d[col_name] = row
                return d
        except Exception:
            pass
        
        # Fallback
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
            # PostgreSQL 语法 - 使用 NUMERIC 替代 DOUBLE PRECISION（避免拼写问题）
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS shops (
                    id SERIAL PRIMARY KEY,
                    name VARCHAR(255) UNIQUE NOT NULL,
                    refund_rate NUMERIC DEFAULT 0,
                    dsp_rate NUMERIC DEFAULT 0,
                    return_freight_rate NUMERIC DEFAULT 0,
                    storage_rate NUMERIC DEFAULT 0,
                    target_margin_rate NUMERIC DEFAULT 0.2,
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
                    refund_rate NUMERIC,
                    cg_freight NUMERIC DEFAULT 0,
                    pl_freight NUMERIC DEFAULT 0,
                    fedex_freight NUMERIC DEFAULT 0,
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
                    sales_amount NUMERIC DEFAULT 0,
                    cost NUMERIC DEFAULT 0,
                    warehouse VARCHAR(255),
                    commission NUMERIC DEFAULT 0,
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
                    ad_spend NUMERIC DEFAULT 0,
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
                    freight NUMERIC DEFAULT 0,
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
                    target_gmv NUMERIC DEFAULT 0,
                    target_margin_rate NUMERIC DEFAULT 0.2,
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
                    target_sales NUMERIC DEFAULT 0,
                    target_gross_profit NUMERIC DEFAULT 0,
                    target_margin_rate NUMERIC DEFAULT 0.2,
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
                    target_sales NUMERIC DEFAULT 0,
                    target_gross_profit NUMERIC DEFAULT 0,
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
                    target_sales NUMERIC DEFAULT 0,
                    target_gross_profit NUMERIC DEFAULT 0,
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
