"""
三级毛利计算服务
"""
from typing import List, Dict, Optional, Tuple
from database import get_db
import sqlite3

class GrossProfitCalculator:
    """三级毛利计算器"""
    
    def __init__(self):
        self.db_path = "hulalahome.db"
    
    def get_connection(self):
        conn = sqlite3.connect(self.db_path)
        conn.row_factory = sqlite3.Row
        return conn
    
    def get_sku_info(self, shop: str, sku: str) -> Optional[Dict]:
        """获取SKU基础信息"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM sku_base_info WHERE shop = ? AND sku = ?",
                (shop, sku)
            )
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def get_shop_params(self, shop: str) -> Optional[Dict]:
        """获取店铺全局参数"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT * FROM shops WHERE name = ?",
                (shop,)
            )
            row = cursor.fetchone()
            return dict(row) if row else None
    
    def get_warehouse_freight(self, warehouse: str, sku: str) -> float:
        """获取仓库运费"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            # 先尝试精确匹配
            cursor.execute(
                """SELECT freight FROM warehouse_freight 
                   WHERE warehouse = ? AND sku = ?""",
                (warehouse, sku)
            )
            row = cursor.fetchone()
            if row:
                return row['freight']
            
            # 如果没有精确匹配，尝试通用配置
            cursor.execute(
                """SELECT freight FROM warehouse_freight 
                   WHERE warehouse = ? AND (sku = '*' OR sku = '')""",
                (warehouse,)
            )
            row = cursor.fetchone()
            return row['freight'] if row else 0
    
    def get_ad_spend_by_spu_date(self, shop: str, spu: str, date: str) -> float:
        """获取某SPU某日的广告花费"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "SELECT ad_spend FROM ad_data WHERE shop = ? AND spu = ? AND date = ?",
                (shop, spu, date)
            )
            row = cursor.fetchone()
            return row['ad_spend'] if row else 0
    
    def calculate_order_profit(self, order: Dict) -> Dict:
        """计算单个订单的利润"""
        shop = order['shop']
        sku = order['sku']
        spu_info = self.get_sku_info(shop, sku)
        shop_params = self.get_shop_params(shop)
        
        if not shop_params:
            return {
                'order_id': order['order_id'],
                'spu': spu_info['spu'] if spu_info else '',
                'error': '店铺参数未配置'
            }
        
        # 基础数据
        sales_amount = order['sales_amount']
        commission = order['commission']
        warehouse = order.get('warehouse', '')
        
        # 退款费（优先使用SKU退款率，否则用店铺退款率）
        if spu_info and spu_info.get('refund_rate'):
            refund_rate = spu_info['refund_rate']
        else:
            refund_rate = shop_params.get('refund_rate', 0)
        refund = sales_amount * refund_rate / 100
        
        # 运费
        freight = self.get_warehouse_freight(warehouse, sku)
        
        # 仓储费
        storage_rate = shop_params.get('storage_rate', 0)
        storage = sales_amount * storage_rate / 100
        
        # DSP费
        dsp_rate = shop_params.get('dsp_rate', 0)
        dsp = sales_amount * dsp_rate / 100
        
        # 退货运费
        return_freight_rate = shop_params.get('return_freight_rate', 0)
        return_freight = sales_amount * return_freight_rate / 100
        
        # 广告费（需要根据SPU日花费均摊）
        ad_spend = 0  # 订单级别的广告费需要批量计算
        
        # 计算毛利
        gross_profit = (
            sales_amount 
            - commission 
            - ad_spend 
            - refund 
            - freight 
            - storage 
            - dsp 
            - return_freight
        )
        gross_margin_rate = gross_profit / sales_amount if sales_amount > 0 else 0
        
        return {
            'order_id': order['order_id'],
            'spu': spu_info['spu'] if spu_info else '',
            'sku': sku,
            'sales_amount': sales_amount,
            'commission': commission,
            'ad_spend': ad_spend,
            'refund': refund,
            'freight': freight,
            'storage': storage,
            'dsp': dsp,
            'return_freight': return_freight,
            'gross_profit': gross_profit,
            'gross_margin_rate': gross_margin_rate,
        }
    
    def calculate_spu_profit(self, shop: str, spu: str, start_date: str, end_date: str) -> Dict:
        """计算SPU维度在某时间段的利润"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # 获取该SPU在时间段内的所有订单
            cursor.execute("""
                SELECT o.*, s.spu 
                FROM orders o
                JOIN sku_base_info s ON o.shop = s.shop AND o.sku = s.sku
                WHERE o.shop = ? AND s.spu = ? AND o.date BETWEEN ? AND ?
            """, (shop, spu, start_date, end_date))
            
            orders = [dict(row) for row in cursor.fetchall()]
            
            if not orders:
                return {
                    'spu': spu,
                    'shop': shop,
                    'order_count': 0,
                    'total_sales': 0,
                    'gross_profit': 0,
                    'gross_margin_rate': 0
                }
            
            # 获取SPU日广告花费
            cursor.execute("""
                SELECT date, ad_spend 
                FROM ad_data 
                WHERE shop = ? AND spu = ? AND date BETWEEN ? AND ?
            """, (shop, spu, start_date, end_date))
            
            ad_spends = {row['date']: row['ad_spend'] for row in cursor.fetchall()}
            
            # 按日期分组订单
            orders_by_date = {}
            for order in orders:
                date = order['date']
                if date not in orders_by_date:
                    orders_by_date[date] = []
                orders_by_date[date].append(order)
            
            # 获取店铺和SKU参数
            shop_params = self.get_shop_params(shop)
            sku_info = {}
            for order in orders:
                sku = order['sku']
                if sku not in sku_info:
                    sku_info[sku] = self.get_sku_info(shop, sku)
            
            # 计算汇总
            total_sales = 0
            total_commission = 0
            total_refund = 0
            total_freight = 0
            total_storage = 0
            total_dsp = 0
            total_return_freight = 0
            total_ad_spend = 0
            
            for date, date_orders in orders_by_date.items():
                day_ad_spend = ad_spends.get(date, 0)
                order_count = len(date_orders)
                
                for order in date_orders:
                    sales_amount = order['sales_amount']
                    commission = order['commission']
                    warehouse = order.get('warehouse', '')
                    sku = order['sku']
                    
                    # 计算各项费用
                    info = sku_info.get(sku, {})
                    
                    # 退款率
                    refund_rate = info.get('refund_rate') if info.get('refund_rate') else shop_params.get('refund_rate', 0)
                    refund = sales_amount * refund_rate / 100
                    
                    # 运费
                    freight = self.get_warehouse_freight(warehouse, sku)
                    
                    # 仓储费
                    storage_rate = shop_params.get('storage_rate', 0)
                    storage = sales_amount * storage_rate / 100
                    
                    # DSP费
                    dsp_rate = shop_params.get('dsp_rate', 0)
                    dsp = sales_amount * dsp_rate / 100
                    
                    # 退货运费
                    return_rate = shop_params.get('return_freight_rate', 0)
                    return_freight = sales_amount * return_rate / 100
                    
                    # 广告费均摊
                    ad = day_ad_spend / order_count if order_count > 0 else 0
                    
                    total_sales += sales_amount
                    total_commission += commission
                    total_refund += refund
                    total_freight += freight
                    total_storage += storage
                    total_dsp += dsp
                    total_return_freight += return_freight
                    total_ad_spend += ad
            
            # 计算毛利
            gross_profit = (
                total_sales 
                - total_commission 
                - total_ad_spend 
                - total_refund 
                - total_freight 
                - total_storage 
                - total_dsp 
                - total_return_freight
            )
            gross_margin_rate = gross_profit / total_sales if total_sales > 0 else 0
            
            return {
                'spu': spu,
                'shop': shop,
                'order_count': len(orders),
                'total_sales': total_sales,
                'total_commission': total_commission,
                'total_ad_spend': total_ad_spend,
                'total_refund': total_refund,
                'total_freight': total_freight,
                'total_storage': total_storage,
                'total_dsp': total_dsp,
                'total_return_freight': total_return_freight,
                'gross_profit': gross_profit,
                'gross_margin_rate': gross_margin_rate,
            }
    
    def get_spu_with_unallocated_ad(self, shop: str, date: str) -> List[Dict]:
        """获取某天有广告花费但未出单的SPU"""
        with self.get_connection() as conn:
            cursor = conn.cursor()
            
            # 获取该天有广告花费的SPU
            cursor.execute("""
                SELECT spu, ad_spend 
                FROM ad_data 
                WHERE shop = ? AND date = ? AND ad_spend > 0
            """, (shop, date))
            
            ad_spus = {row['spu']: row['ad_spend'] for row in cursor.fetchall()}
            
            if not ad_spus:
                return []
            
            # 获取该天有出单的SPU
            cursor.execute("""
                SELECT DISTINCT s.spu
                FROM orders o
                JOIN sku_base_info s ON o.shop = s.shop AND o.sku = s.sku
                WHERE o.shop = ? AND o.date = ?
            """, (shop, date))
            
            ordered_spus = {row['spu'] for row in cursor.fetchall()}
            
            # 找出未出单的
            unallocated = []
            for spu, ad_spend in ad_spus.items():
                if spu not in ordered_spus:
                    # 获取该SPU的运营信息
                    cursor.execute("""
                        SELECT DISTINCT operator, operator_group
                        FROM sku_base_info
                        WHERE shop = ? AND spu = ?
                        LIMIT 1
                    """, (shop, spu))
                    row = cursor.fetchone()
                    unallocated.append({
                        'spu': spu,
                        'shop': shop,
                        'date': date,
                        'ad_spend': ad_spend,
                        'operator': row['operator'] if row else '',
                        'operator_group': row['operator_group'] if row else '',
                    })
            
            return unallocated


if __name__ == "__main__":
    calc = GrossProfitCalculator()
    result = calc.calculate_spu_profit('HULALAHOME US', 'FURN-SOFA-001', '2026-04-01', '2026-04-15')
    print(result)
