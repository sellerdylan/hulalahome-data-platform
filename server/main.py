"""
HULALAHOME 数据运营中台 - FastAPI 后端
"""
from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, date
import os

from database import init_database, get_db
from services.calculator import GrossProfitCalculator
from services.data_import import DataImporter

# 初始化FastAPI
app = FastAPI(title="HULALAHOME 数据运营中台", version="1.0.0")

# CORS配置 - 支持 Vercel 部署的前端
ALLOWED_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:3000",
    # Vercel 部署地址（自动从环境变量注入）
    os.getenv("FRONTEND_URL", ""),
    "https://*.vercel.app",  # 允许所有 Vercel 部署
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 部署时换成具体域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 初始化数据库
init_database()

# 初始化服务
calculator = GrossProfitCalculator()
importer = DataImporter()


# ==================== 数据模型 ====================

class Shop(BaseModel):
    id: Optional[int] = None
    name: str
    refund_rate: float = 0
    dsp_rate: float = 0
    return_freight_rate: float = 0
    storage_rate: float = 0
    target_margin_rate: float = 0.2


class DepartmentTarget(BaseModel):
    """整体目标"""
    id: Optional[int] = None
    shop: str
    target_sales: float = 0
    target_gross_profit: float = 0
    target_margin_rate: float = 0.2
    month: str


class OperatorGroupTarget(BaseModel):
    """运营组目标"""
    id: Optional[int] = None
    operator_group: str
    target_sales: float = 0
    target_gross_profit: float = 0
    month: str


class OperatorTarget(BaseModel):
    """运营目标"""
    id: Optional[int] = None
    operator: str
    operator_group: str
    target_sales: float = 0
    target_gross_profit: float = 0
    month: str


# ==================== 路由 ====================

@app.get("/")
async def root():
    return {
        "message": "HULALAHOME 数据运营中台 API",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """健康检查"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}


@app.get("/api/debug/db-check")
async def debug_db_check():
    """数据库调试端点"""
    from database import IS_POSTGRES, get_connection
    try:
        conn = get_connection()
        cursor = conn.cursor()
        
        # 检查各表记录数
        tables = ['shops', 'sku_base_info', 'orders', 'ad_data', 'warehouse_freight']
        counts = {}
        for table in tables:
            try:
                cursor.execute(f"SELECT COUNT(*) FROM {table}")
                counts[table] = cursor.fetchone().get('count', 0)
            except Exception as e:
                counts[table] = f"Error: {str(e)}"
        
        conn.close()
        return {
            "success": True,
            "is_postgres": IS_POSTGRES,
            "database_url_set": bool(os.getenv("DATABASE_URL")),
            "table_counts": counts
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/debug/test-import")
async def debug_test_import(file: UploadFile = File(...)):
    """测试导入 - 打印解析结果"""
    content = await file.read()
    
    # 尝试解析 CSV
    from io import BytesIO
    import pandas as pd
    
    try:
        df = pd.read_csv(BytesIO(content))
        return {
            "success": True,
            "filename": file.filename,
            "rows": len(df),
            "columns": list(df.columns),
            "first_row": df.iloc[0].to_dict() if len(df) > 0 else None
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ==================== 店铺管理 ====================

@app.get("/api/shops")
async def get_shops():
    """获取所有店铺"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM shops ORDER BY name")
        shops = cursor.fetchall()
        return {"success": True, "data": shops}


@app.post("/api/shops")
async def create_shop(shop: Shop):
    """创建/更新店铺"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO shops
            (name, refund_rate, dsp_rate, return_freight_rate, storage_rate, target_margin_rate)
            VALUES (?, ?, ?, ?, ?, ?)
        """, (shop.name, shop.refund_rate, shop.dsp_rate, shop.return_freight_rate,
              shop.storage_rate, shop.target_margin_rate))
        return {"success": True, "message": "店铺保存成功"}


@app.delete("/api/shops/{shop_name}")
async def delete_shop(shop_name: str):
    """删除店铺"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM shops WHERE name = ?", (shop_name,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="店铺不存在")
        return {"success": True, "message": "店铺删除成功"}


# ==================== 整体目标（店铺维度） ====================

@app.get("/api/department-targets")
async def get_department_targets(month: Optional[str] = None):
    """获取整体目标"""
    with get_db() as conn:
        cursor = conn.cursor()
        if month:
            cursor.execute(
                "SELECT * FROM department_targets WHERE month = ? ORDER BY shop",
                (month,)
            )
        else:
            cursor.execute("SELECT * FROM department_targets ORDER BY month DESC, shop")
        targets = cursor.fetchall()
        return {"success": True, "data": targets}


@app.post("/api/department-targets")
async def save_department_target(target: DepartmentTarget):
    """保存整体目标"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO department_targets
            (shop, target_sales, target_gross_profit, target_margin_rate, month)
            VALUES (?, ?, ?, ?, ?)
        """, (target.shop, target.target_sales, target.target_gross_profit,
              target.target_margin_rate, target.month))
        return {"success": True, "message": "整体目标保存成功"}


@app.delete("/api/department-targets/{target_id}")
async def delete_department_target(target_id: int):
    """删除整体目标"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM department_targets WHERE id = ?", (target_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="目标不存在")
        return {"success": True, "message": "目标删除成功"}


# ==================== 运营组目标 ====================

@app.get("/api/operator-group-targets")
async def get_operator_group_targets(month: Optional[str] = None):
    """获取运营组目标"""
    with get_db() as conn:
        cursor = conn.cursor()
        if month:
            cursor.execute(
                "SELECT * FROM operator_group_targets WHERE month = ? ORDER BY operator_group",
                (month,)
            )
        else:
            cursor.execute("SELECT * FROM operator_group_targets ORDER BY month DESC, operator_group")
        targets = cursor.fetchall()
        return {"success": True, "data": targets}


@app.post("/api/operator-group-targets")
async def save_operator_group_target(target: OperatorGroupTarget):
    """保存运营组目标"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO operator_group_targets
            (operator_group, target_sales, target_gross_profit, month)
            VALUES (?, ?, ?, ?)
        """, (target.operator_group, target.target_sales, target.target_gross_profit, target.month))
        return {"success": True, "message": "运营组目标保存成功"}


@app.delete("/api/operator-group-targets/{target_id}")
async def delete_operator_group_target(target_id: int):
    """删除运营组目标"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM operator_group_targets WHERE id = ?", (target_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="目标不存在")
        return {"success": True, "message": "目标删除成功"}


# ==================== 运营目标 ====================

@app.get("/api/operator-targets")
async def get_operator_targets(month: Optional[str] = None):
    """获取运营目标"""
    with get_db() as conn:
        cursor = conn.cursor()
        if month:
            cursor.execute(
                "SELECT * FROM operator_targets WHERE month = ? ORDER BY operator",
                (month,)
            )
        else:
            cursor.execute("SELECT * FROM operator_targets ORDER BY month DESC, operator")
        targets = cursor.fetchall()
        return {"success": True, "data": targets}


@app.post("/api/operator-targets")
async def save_operator_target(target: OperatorTarget):
    """保存运营目标"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT OR REPLACE INTO operator_targets
            (operator, operator_group, target_sales, target_gross_profit, month)
            VALUES (?, ?, ?, ?, ?)
        """, (target.operator, target.operator_group, target.target_sales,
              target.target_gross_profit, target.month))
        return {"success": True, "message": "运营目标保存成功"}


@app.delete("/api/operator-targets/{target_id}")
async def delete_operator_target(target_id: int):
    """删除运营目标"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM operator_targets WHERE id = ?", (target_id,))
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="目标不存在")
        return {"success": True, "message": "目标删除成功"}


# ==================== Dashboard 汇总数据 ====================

@app.get("/api/dashboard/summary")
async def get_dashboard_summary(
    start_date: str = Query(...),
    end_date: str = Query(...),
    shop: Optional[str] = None,
    operator_group: Optional[str] = None,
    operator: Optional[str] = None,
    category: Optional[str] = None,
):
    """
    获取看板汇总数据（按日期+店铺聚合）
    用于 Dashboard 页面展示
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # 构建查询条件
        conditions = ["o.date BETWEEN ? AND ?"]
        params = [start_date, end_date]

        if shop:
            conditions.append("s.shop = ?")
            params.append(shop)
        if operator_group:
            conditions.append("s.operator_group = ?")
            params.append(operator_group)
        if operator:
            conditions.append("s.operator = ?")
            params.append(operator)
        if category:
            conditions.append("s.category = ?")
            params.append(category)

        where_clause = " AND ".join(conditions)

        # 获取每日汇总
        cursor.execute(f"""
            SELECT
                o.date,
                o.shop,
                s.operator_group,
                s.operator,
                s.category,
                s.sales_grade,
                SUM(o.sales_amount) as total_sales,
                SUM(o.commission) as total_commission,
                SUM(o.cost) as total_cost
            FROM orders o
            LEFT JOIN sku_base_info s ON o.shop = s.shop AND o.sku = s.sku
            WHERE {where_clause}
            GROUP BY o.date, o.shop, s.operator_group, s.operator
            ORDER BY o.date DESC, o.shop
        """, params)

        daily_data = cursor.fetchall()

        # 获取广告数据（按日期+店铺聚合）
        ad_conditions = ["ad.date BETWEEN ? AND ?"]
        ad_params = [start_date, end_date]
        if shop:
            ad_conditions.append("ad.shop = ?")
            ad_params.append(shop)

        ad_where = " AND ".join(ad_conditions)

        cursor.execute(f"""
            SELECT
                ad.date,
                ad.shop,
                SUM(ad.ad_spend) as total_ad_spend
            FROM ad_data ad
            WHERE {ad_where}
            GROUP BY ad.date, ad.shop
        """, ad_params)

        ad_data = {f"{row['date']}_{row['shop']}": row['total_ad_spend'] for row in cursor.fetchall()}

        # 获取店铺参数（退款率、DSP费率等）
        cursor.execute("SELECT name, refund_rate, dsp_rate, return_freight_rate, storage_rate, target_margin_rate FROM shops")
        shop_params = {row['name']: row for row in cursor.fetchall()}

        # 计算汇总
        result = []
        for d in daily_data:
            key = f"{d['date']}_{d['shop']}"
            ad_spend = ad_data.get(key, 0)
            shop_param = shop_params.get(d['shop'], {})

            # 简化毛利计算
            gross_profit = d['total_sales'] - d['total_commission'] - ad_spend
            gross_margin = gross_profit / d['total_sales'] if d['total_sales'] > 0 else 0

            result.append({
                'date': d['date'],
                'shop': d['shop'],
                'operator_group': d['operator_group'] or '',
                'operator': d['operator'] or '',
                'category': d['category'] or '',
                'sales_grade': d['sales_grade'] or '',
                'totalSales': round(d['total_sales'], 2),
                'totalGrossProfit': round(gross_profit, 2),
                'grossMarginRate': round(gross_margin, 4),
                'totalAdSpend': round(ad_spend, 2),
                'acos': round(ad_spend / d['total_sales'], 4) if d['total_sales'] > 0 else 0,
                'roas': round(d['total_sales'] / ad_spend, 2) if ad_spend > 0 else 0,
            })

        return {"success": True, "data": result}


# ==================== SPU 维度数据 ====================

@app.get("/api/spu/list")
async def get_spu_list(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    shop: Optional[str] = None,
    operator_group: Optional[str] = None,
    operator: Optional[str] = None,
    sales_grade: Optional[str] = None,
    category: Optional[str] = None,
):
    """
    获取SPU列表（按SPU聚合）
    用于 SPU分析页面
    """
    with get_db() as conn:
        cursor = conn.cursor()

        # 基础查询
        query = """
            SELECT
                s.spu,
                s.shop,
                s.category,
                s.sales_grade,
                s.operator,
                s.operator_group,
                s.refund_rate,
                s.cg_freight,
                s.pl_freight,
                s.fedex_freight,
                COALESCE(SUM(o.sales_amount), 0) as total_sales,
                COALESCE(SUM(o.commission), 0) as total_commission,
                COALESCE(SUM(o.cost), 0) as total_cost,
                COUNT(DISTINCT o.order_id) as order_count
            FROM sku_base_info s
            LEFT JOIN orders o ON s.shop = o.shop AND s.sku = o.sku
        """

        conditions = []
        params = []

        if start_date and end_date:
            conditions.append("o.date BETWEEN ? AND ?")
            params.extend([start_date, end_date])

        if shop:
            conditions.append("s.shop = ?")
            params.append(shop)
        if operator_group:
            conditions.append("s.operator_group = ?")
            params.append(operator_group)
        if operator:
            conditions.append("s.operator = ?")
            params.append(operator)
        if sales_grade:
            conditions.append("s.sales_grade = ?")
            params.append(sales_grade)
        if category:
            conditions.append("s.category = ?")
            params.append(category)

        if conditions:
            query += " WHERE " + " AND ".join(conditions)

        query += " GROUP BY s.spu, s.shop ORDER BY total_sales DESC"

        cursor.execute(query, params)
        spus = cursor.fetchall()

        # 获取广告数据
        for spu in spus:
            # 正确处理日期条件：只有当日期范围有效时才添加条件
            if start_date and end_date:
                cursor.execute("""
                    SELECT COALESCE(SUM(ad_spend), 0) as total_ad_spend
                    FROM ad_data
                    WHERE spu = ? AND shop = ?
                    AND date >= ? AND date <= ?
                """, (spu['spu'], spu['shop'], start_date, end_date))
            else:
                cursor.execute("""
                    SELECT COALESCE(SUM(ad_spend), 0) as total_ad_spend
                    FROM ad_data
                    WHERE spu = ? AND shop = ?
                """, (spu['spu'], spu['shop']))
            row = cursor.fetchone()
            spu['total_ad_spend'] = row['total_ad_spend'] if row else 0

        # 获取店铺参数
        cursor.execute("SELECT name, refund_rate, dsp_rate, return_freight_rate, storage_rate FROM shops")
        shop_params = {row['name']: row for row in cursor.fetchall()}

        # 计算毛利
        for spu in spus:
            shop_param = shop_params.get(spu['shop'], {})
            refund_rate = spu.get('refund_rate') or shop_param.get('refund_rate', 0)

            gross_profit = (
                spu['total_sales']
                - spu['total_commission']
                - spu['total_ad_spend']
                - (spu['total_sales'] * refund_rate)
            )
            spu['gross_profit'] = round(gross_profit, 2)
            spu['gross_margin_rate'] = round(gross_profit / spu['total_sales'], 4) if spu['total_sales'] > 0 else 0

        return {"success": True, "data": spus}


# ==================== 获取原始数据（用于前端展示）====================

@app.get("/api/data/orders")
async def get_orders():
    """获取所有订单数据"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, date, shop, order_id, sku, quantity, sales_amount, cost, warehouse, commission
            FROM orders ORDER BY date DESC
        """)
        rows = cursor.fetchall()
        orders = []
        for row in rows:
            # 统一转换为前端期望的 camelCase 字段名
            date_str = str(row.get('date', ''))
            # 截断时间戳部分，只保留 YYYY-MM-DD
            if len(date_str) > 10:
                date_str = date_str[:10]
            orders.append({
                'id': str(row.get('id', '')),
                'date': date_str,
                'shop': row.get('shop', ''),
                'orderId': row.get('order_id', ''),
                'sku': row.get('sku', ''),
                'spu': row.get('sku', ''),  # 后端没存 spu，临时用 sku 代替
                'quantity': row.get('quantity', 0),
                'sales': row.get('sales_amount', 0),
                'cost': row.get('cost', 0),
                'commission': row.get('commission', 0),
                'warehouse': row.get('warehouse', ''),
            })
        return {"success": True, "data": orders}


@app.get("/api/data/ad-data")
async def get_ad_data():
    """获取所有广告数据"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, date, shop, spu, ad_spend
            FROM ad_data ORDER BY date DESC
        """)
        rows = cursor.fetchall()
        ads = []
        for row in rows:
            date_str = str(row.get('date', ''))
            if len(date_str) > 10:
                date_str = date_str[:10]
            ads.append({
                'id': str(row.get('id', '')),
                'date': date_str,
                'shop': row.get('shop', ''),
                'spu': row.get('spu', ''),
                'adSpend': row.get('ad_spend', 0),
            })
        return {"success": True, "data": ads}


@app.get("/api/data/sku-base-info")
async def get_sku_base_info():
    """获取所有SKU基础信息"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM sku_base_info ORDER BY shop, sku")
        infos = cursor.fetchall()
        # 转换字段名以匹配前端期望的格式
        for info in infos:
            # 基础字段
            if 'refund_rate' in info:
                info['refundRate'] = info.pop('refund_rate')
            if 'sales_grade' in info:
                info['salesGrade'] = info.pop('sales_grade')
            if 'operator_group' in info:
                info['operatorGroup'] = info.pop('operator_group')
            if 'product_level' in info:
                info['productLevel'] = info.pop('product_level')
            # 运费字段：后端存储 cg_freight, pl_freight, fedex_freight
            # 前端 SkuFreight 类型期望 cgFreight, plFreight, selfFreight
            # 这里 fedexFreight 保持不变，selfFreight 从 sku_base_info 中没有，需要前端处理
            if 'cg_freight' in info:
                info['cgFreight'] = info.pop('cg_freight')
            if 'pl_freight' in info:
                info['plFreight'] = info.pop('pl_freight')
            if 'fedex_freight' in info:
                info['fedexFreight'] = info.pop('fedex_freight')
            # 移除元数据字段
            if 'created_at' in info:
                info.pop('created_at')
            if 'updated_at' in info:
                info.pop('updated_at')
        return {"success": True, "data": infos}


@app.get("/api/data/shops")
async def get_shops_data():
    """获取所有店铺费率信息"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM shops ORDER BY name")
        shops = cursor.fetchall()
        # 转换字段名以匹配前端期望的格式
        for shop in shops:
            if 'refund_rate' in shop:
                shop['refundRate'] = shop.pop('refund_rate')
            if 'dsp_rate' in shop:
                shop['dspRate'] = shop.pop('dsp_rate')
            if 'return_freight_rate' in shop:
                shop['refundFreightRate'] = shop.pop('return_freight_rate')
            if 'storage_rate' in shop:
                shop['storageRate'] = shop.pop('storage_rate')
            if 'target_margin_rate' in shop:
                shop['targetMarginRate'] = shop.pop('target_margin_rate')
            if 'name' in shop:
                # 将 name 映射为 shop（前端 ShopRate 类型期望 shop 字段）
                shop['shop'] = shop.pop('name')
            if 'id' in shop:
                # 保留 id 字段，但也要有 shopId（兼容性）
                shop['shopId'] = shop['id']
            if 'created_at' in shop:
                shop.pop('created_at')
            if 'updated_at' in shop:
                shop.pop('updated_at')
        return {"success": True, "data": shops}


@app.get("/api/data/targets")
async def get_all_targets():
    """获取所有目标数据"""
    with get_db() as conn:
        cursor = conn.cursor()
        
        # 部门目标
        cursor.execute("SELECT * FROM department_targets ORDER BY month DESC, shop")
        dept_targets = cursor.fetchall()
        for t in dept_targets:
            if 'target_sales' in t:
                t['targetSales'] = t.pop('target_sales')
            if 'target_gross_profit' in t:
                t['targetGrossProfit'] = t.pop('target_gross_profit')
            if 'target_margin_rate' in t:
                t['targetMarginRate'] = t.pop('target_margin_rate')
        
        # 运营组目标
        cursor.execute("SELECT * FROM operator_group_targets ORDER BY month DESC, operator_group")
        group_targets = cursor.fetchall()
        for t in group_targets:
            if 'target_sales' in t:
                t['targetSales'] = t.pop('target_sales')
            if 'target_gross_profit' in t:
                t['targetGrossProfit'] = t.pop('target_gross_profit')
            if 'operator_group' in t:
                t['operatorGroup'] = t.pop('operator_group')
        
        # 运营目标
        cursor.execute("SELECT * FROM operator_targets ORDER BY month DESC, operator")
        op_targets = cursor.fetchall()
        for t in op_targets:
            if 'target_sales' in t:
                t['targetSales'] = t.pop('target_sales')
            if 'target_gross_profit' in t:
                t['targetGrossProfit'] = t.pop('target_gross_profit')
            if 'operator_group' in t:
                t['operatorGroup'] = t.pop('operator_group')
        
        return {
            "success": True,
            "data": {
                "departmentTargets": dept_targets,
                "operatorGroupTargets": group_targets,
                "operatorTargets": op_targets
            }
        }


# ==================== 数据导入 ====================

@app.post("/api/import/orders")
async def import_orders(file: UploadFile = File(...)):
    """导入订单数据"""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="只支持 Excel 或 CSV 文件")

    content = await file.read()
    result = importer.import_orders(content, file.filename)

    if result['success']:
        return {"success": True, "message": f"成功导入 {result['count']} 条订单数据"}
    else:
        raise HTTPException(status_code=400, detail=result['error'])


@app.post("/api/import/ads")
async def import_ads(file: UploadFile = File(...)):
    """导入广告数据"""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="只支持 Excel 或 CSV 文件")

    content = await file.read()
    result = importer.import_ad_data(content, file.filename)

    if result['success']:
        return {"success": True, "message": f"成功导入 {result['count']} 条广告数据"}
    else:
        raise HTTPException(status_code=400, detail=result['error'])


@app.post("/api/import/sku-base")
async def import_sku_base(file: UploadFile = File(...)):
    """导入SKU基础信息"""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="只支持 Excel 或 CSV 文件")

    content = await file.read()
    result = importer.import_sku_base_info(content, file.filename)

    if result['success']:
        return {"success": True, "message": f"成功导入 {result['count']} 条SKU基础信息"}
    else:
        raise HTTPException(status_code=400, detail=result['error'])


@app.post("/api/import/warehouse-freight")
async def import_warehouse_freight(file: UploadFile = File(...)):
    """导入仓库运费配置"""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="只支持 Excel 或 CSV 文件")

    content = await file.read()
    result = importer.import_warehouse_freight(content, file.filename)

    if result['success']:
        return {"success": True, "message": f"成功导入 {result['count']} 条运费配置"}
    else:
        raise HTTPException(status_code=400, detail=result['error'])


@app.post("/api/import/shops")
async def import_shops(file: UploadFile = File(...)):
    """导入店铺信息"""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="只支持 Excel 或 CSV 文件")

    content = await file.read()
    result = importer.import_shops(content, file.filename)

    if result['success']:
        return {"success": True, "message": f"成功导入 {result['count']} 条店铺信息"}
    else:
        raise HTTPException(status_code=400, detail=result['error'])


@app.post("/api/import/department-targets")
async def import_department_targets(file: UploadFile = File(...)):
    """导入整体目标"""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="只支持 Excel 或 CSV 文件")

    content = await file.read()
    result = importer.import_department_targets(content, file.filename)

    if result['success']:
        return {"success": True, "message": f"成功导入 {result['count']} 条整体目标"}
    else:
        raise HTTPException(status_code=400, detail=result['error'])


@app.post("/api/import/operator-group-targets")
async def import_operator_group_targets(file: UploadFile = File(...)):
    """导入运营组目标"""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="只支持 Excel 或 CSV 文件")

    content = await file.read()
    result = importer.import_operator_group_targets(content, file.filename)

    if result['success']:
        return {"success": True, "message": f"成功导入 {result['count']} 条运营组目标"}
    else:
        raise HTTPException(status_code=400, detail=result['error'])


@app.post("/api/import/operator-targets")
async def import_operator_targets(file: UploadFile = File(...)):
    """导入运营目标"""
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(status_code=400, detail="只支持 Excel 或 CSV 文件")

    content = await file.read()
    result = importer.import_operator_targets(content, file.filename)

    if result['success']:
        return {"success": True, "message": f"成功导入 {result['count']} 条运营目标"}
    else:
        raise HTTPException(status_code=400, detail=result['error'])


# ==================== 批量数据导入（管理员用） ====================

@app.post("/api/import/all")
async def import_all_data(
    orders_file: UploadFile = File(...),
    ads_file: UploadFile = File(...),
    sku_base_file: UploadFile = File(...),
    shops_file: UploadFile = File(...),
):
    """一次性导入所有数据（管理员用）"""
    results = []

    # 导入订单
    if orders_file:
        orders_content = await orders_file.read()
        result = importer.import_orders(orders_content)
        results.append({"type": "orders", **result})

    # 导入广告
    if ads_file:
        ads_content = await ads_file.read()
        result = importer.import_ad_data(ads_content)
        results.append({"type": "ads", **result})

    # 导入SKU基础信息
    if sku_base_file:
        sku_content = await sku_base_file.read()
        result = importer.import_sku_base_info(sku_content)
        results.append({"type": "sku_base", **result})

    # 导入店铺信息
    if shops_file:
        shops_content = await shops_file.read()
        result = importer.import_shops(shops_content)
        results.append({"type": "shops", **result})

    return {"success": True, "results": results}


# ==================== 筛选选项 ====================

@app.get("/api/options/shops")
async def get_shop_options():
    """获取店铺选项"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT shop as name FROM (
                SELECT DISTINCT shop FROM orders
                UNION
                SELECT DISTINCT shop FROM sku_base_info
                UNION
                SELECT DISTINCT name FROM shops
            ) ORDER BY name
        """)
        return {"success": True, "data": [row['name'] for row in cursor.fetchall()]}


@app.get("/api/options/operators")
async def get_operator_options():
    """获取运营选项"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT operator as name FROM sku_base_info
            WHERE operator IS NOT NULL AND operator != ''
            ORDER BY operator
        """)
        return {"success": True, "data": [row['name'] for row in cursor.fetchall()]}


@app.get("/api/options/operator-groups")
async def get_operator_group_options():
    """获取运营组选项"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT operator_group as name FROM sku_base_info
            WHERE operator_group IS NOT NULL AND operator_group != ''
            ORDER BY operator_group
        """)
        return {"success": True, "data": [row['name'] for row in cursor.fetchall()]}


@app.get("/api/options/categories")
async def get_category_options():
    """获取品类选项"""
    with get_db() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT DISTINCT category as name FROM sku_base_info
            WHERE category IS NOT NULL AND category != ''
            ORDER BY category
        """)
        return {"success": True, "data": [row['name'] for row in cursor.fetchall()]}


@app.get("/api/options/sales-grades")
async def get_sales_grade_options():
    """获取销售等级选项"""
    return {"success": True, "data": ['S', 'A', 'B', 'C']}


# ==================== SPU 每日明细 ====================

@app.get("/api/spu/daily")
async def get_spu_daily(
    spu: str = Query(...),
    shop: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
):
    """获取SPU每日明细数据"""
    with get_db() as conn:
        cursor = conn.cursor()

        conditions = ["o.shop = s.shop", "o.sku = s.sku", "s.spu = ?"]
        params = [spu]

        if shop:
            conditions.append("o.shop = ?")
            params.append(shop)
        if start_date:
            conditions.append("o.date >= ?")
            params.append(start_date)
        if end_date:
            conditions.append("o.date <= ?")
            params.append(end_date)

        where_clause = " AND ".join(conditions)

        cursor.execute(f"""
            SELECT
                o.date,
                o.shop,
                s.spu,
                s.operator,
                s.operator_group,
                s.category,
                s.sales_grade,
                SUM(o.sales_amount) as total_sales,
                SUM(o.commission) as total_commission,
                SUM(o.cost) as total_cost,
                COUNT(DISTINCT o.order_id) as order_count
            FROM orders o, sku_base_info s
            WHERE {where_clause}
            GROUP BY o.date, o.shop
            ORDER BY o.date DESC
        """, params)

        daily_data = cursor.fetchall()

        # 获取广告数据
        for d in daily_data:
            ad_conditions = ["spu = ?", "shop = ?", "date = ?"]
            ad_params = [spu, d['shop'], d['date']]

            cursor.execute(f"""
                SELECT SUM(ad_spend) as ad_spend
                FROM ad_data
                WHERE {" AND ".join(ad_conditions)}
            """, ad_params)
            row = cursor.fetchone()
            d['ad_spend'] = row['ad_spend'] if row and row['ad_spend'] else 0

        return {"success": True, "data": daily_data}


# ==================== 统计摘要 ====================

@app.get("/api/stats/overview")
async def get_stats_overview(start_date: Optional[str] = None, end_date: Optional[str] = None):
    """获取全局统计摘要"""
    with get_db() as conn:
        cursor = conn.cursor()

        # 总订单数
        cursor.execute("SELECT COUNT(*) as count FROM orders")
        order_count = cursor.fetchone()['count']

        # 总广告花费
        cursor.execute("SELECT COUNT(*) as count, SUM(ad_spend) as total FROM ad_data")
        ad_row = cursor.fetchone()
        ad_count = ad_row['count']
        ad_total = ad_row['total'] or 0

        # 总SKU数
        cursor.execute("SELECT COUNT(*) as count FROM sku_base_info")
        sku_count = cursor.fetchone()['count']

        # 总店铺数
        cursor.execute("SELECT COUNT(*) as count FROM shops")
        shop_count = cursor.fetchone()['count']

        # 数据日期范围
        cursor.execute("SELECT MIN(date) as min_date, MAX(date) as max_date FROM orders")
        date_range = cursor.fetchone()

        return {
            "success": True,
            "data": {
                "order_count": order_count,
                "ad_count": ad_count,
                "sku_count": sku_count,
                "shop_count": shop_count,
                "date_range": {
                    "start": date_range['min_date'],
                    "end": date_range['max_date'],
                },
                "total_ad_spend": round(ad_total, 2),
            }
        }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
