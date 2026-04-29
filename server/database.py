"""
数据库模型和连接
"""
import sqlite3
from datetime import datetime
from typing import Optional
from contextlib import contextmanager

DATABASE_PATH = "hulalahome.db"

def get_connection():
    """获取数据库连接"""
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

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

def init_database():
    """初始化数据库表"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 店铺表
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
        
        # SKU基础信息表
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
        
        # 订单表
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
        
        # 广告数据表
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
        
        # 仓库运费配置表
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
        
        # KPI目标表
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
        
        # 索引
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_sku ON orders(sku)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_orders_spu ON orders(sku)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ad_data_date ON ad_data(date)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_ad_data_spu ON ad_data(spu)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_sku_spu ON sku_base_info(spu)")

        # 整体目标表（店铺维度）
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

        # 运营组目标表
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

        # 运营目标表
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

if __name__ == "__main__":
    init_database()
    print("数据库初始化完成")
