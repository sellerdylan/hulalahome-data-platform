"""
数据导入服务
支持文件路径和 bytes 两种输入模式
"""
import pandas as pd
from datetime import datetime
from database import get_db
from typing import List, Dict, Optional, Union
from io import BytesIO


class DataImporter:
    """数据导入器"""

    def __init__(self):
        self.db_path = "hulalahome.db"

    def _read_file(self, content: Union[bytes, str], filename: str = ""):
        """根据文件类型读取数据"""
        if isinstance(content, bytes):
            # API 传入的 bytes 内容
            if filename.endswith('.csv'):
                return pd.read_csv(BytesIO(content))
            else:
                return pd.read_excel(BytesIO(content))
        else:
            # 本地文件路径
            if content.endswith('.csv'):
                return pd.read_csv(content)
            else:
                return pd.read_excel(content)

    def import_orders(self, content: Union[bytes, str], filename: str = "") -> Dict:
        """导入订单数据"""
        try:
            df = self._read_file(content, filename)

            # 验证必要的列
            required_cols = ['日期', '店铺', '订单号', 'SKU', '销售额', '成本', '仓库', '佣金']
            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                return {'success': False, 'error': f'缺少必要的列: {", ".join(missing_cols)}'}

            # 导入数据
            with get_db() as conn:
                cursor = conn.cursor()
                count = 0

                for _, row in df.iterrows():
                    try:
                        cursor.execute("""
                            INSERT OR REPLACE INTO orders
                            (date, shop, order_id, sku, quantity, sales_amount, cost, warehouse, commission)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            str(row['日期']),
                            str(row['店铺']),
                            str(row['订单号']),
                            str(row['SKU']),
                            int(row.get('数量', 1)),
                            float(row.get('销售额', 0)),
                            float(row.get('成本', 0)),
                            str(row.get('仓库', '')),
                            float(row.get('佣金', 0)),
                        ))
                        count += 1
                    except Exception as e:
                        print(f"导入订单失败: {e}")
                        continue

                return {'success': True, 'count': count}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def import_ad_data(self, content: Union[bytes, str], filename: str = "") -> Dict:
        """导入广告数据"""
        try:
            df = self._read_file(content, filename)

            # 验证必要的列
            required_cols = ['日期', '店铺', 'SPU', '广告花费']
            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                return {'success': False, 'error': f'缺少必要的列: {", ".join(missing_cols)}'}

            with get_db() as conn:
                cursor = conn.cursor()
                count = 0

                for _, row in df.iterrows():
                    try:
                        cursor.execute("""
                            INSERT OR REPLACE INTO ad_data
                            (date, shop, spu, ad_spend)
                            VALUES (?, ?, ?, ?)
                        """, (
                            str(row['日期']),
                            str(row['店铺']),
                            str(row['SPU']),
                            float(row.get('广告花费', 0)),
                        ))
                        count += 1
                    except Exception as e:
                        print(f"导入广告数据失败: {e}")
                        continue

                return {'success': True, 'count': count}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def import_sku_base_info(self, content: Union[bytes, str], filename: str = "") -> Dict:
        """导入SKU基础信息"""
        try:
            df = self._read_file(content, filename)

            # 支持多种列名变体
            def get_col(df_row, *names):
                for name in names:
                    if name in df_row.index:
                        val = df_row[name]
                        if val is not None and str(val).strip():
                            return val
                return None

            # 验证必要的列
            shop = get_col(df.iloc[0], '店铺', 'shop', 'Shop') if len(df) > 0 else None
            sku = get_col(df.iloc[0], 'SKU', 'sku', 'Sku', 'sku_code') if len(df) > 0 else None
            spu = get_col(df.iloc[0], 'SPU', 'spu', 'Spu', 'product_id') if len(df) > 0 else None
            if shop is None or sku is None or spu is None:
                return {'success': False, 'error': '缺少必要的列: 店铺/SKU/SPU（或 shop/sku/spu）'}

            with get_db() as conn:
                cursor = conn.cursor()
                count = 0

                for _, row in df.iterrows():
                    try:
                        shop_val = str(get_col(row, '店铺', 'shop', 'Shop') or '')
                        sku_val = str(get_col(row, 'SKU', 'sku', 'Sku', 'sku_code') or '')
                        spu_val = str(get_col(row, 'SPU', 'spu', 'Spu', 'product_id') or '')

                        if not shop_val or not sku_val or not spu_val:
                            continue

                        cursor.execute("""
                            INSERT OR REPLACE INTO sku_base_info
                            (shop, sku, asin, spu, lifecycle, sales_grade, category,
                             product_level, operator, operator_group, refund_rate,
                             cg_freight, pl_freight, fedex_freight)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            shop_val,
                            sku_val,
                            str(get_col(row, 'ASIN', 'asin', 'Asin') or ''),
                            spu_val,
                            str(get_col(row, '生命周期', 'lifecycle', 'Lifecycle') or ''),
                            str(get_col(row, '销售等级', 'sales_grade', 'salesGrade', 'SalesGrade') or ''),
                            str(get_col(row, '品类', 'category', 'Category') or ''),
                            str(get_col(row, '产品定级', 'product_level', 'productLevel', 'ProductLevel') or ''),
                            str(get_col(row, '运营', 'operator', 'Operator') or ''),
                            str(get_col(row, '运营组', 'operator_group', 'operatorGroup', 'OperatorGroup') or ''),
                            float(get_col(row, '退款率', 'refund_rate', 'refundRate') or 0),
                            float(get_col(row, 'CG运费', 'cg_freight', 'cgFreight') or 0),
                            float(get_col(row, '3PL运费', 'pl_freight', 'plFreight') or 0),
                            float(get_col(row, 'Fedex运费', 'fedex_freight', 'fedexFreight') or 0),
                        ))
                        count += 1
                    except Exception as e:
                        print(f"导入SKU基础信息失败: {e}")
                        continue

                return {'success': True, 'count': count}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def import_warehouse_freight(self, content: Union[bytes, str], filename: str = "") -> Dict:
        """导入仓库运费配置"""
        try:
            df = self._read_file(content, filename)

            # 支持多种列名变体
            def get_col(df_row, *names):
                for name in names:
                    if name in df_row.index:
                        val = df_row[name]
                        if val is not None and str(val).strip():
                            return val
                return None

            # 验证必要的列
            warehouse = get_col(df.iloc[0], '仓库', 'warehouse', 'Warehouse') if len(df) > 0 else None
            sku = get_col(df.iloc[0], 'SKU', 'sku', 'Sku', 'sku_code') if len(df) > 0 else None
            if warehouse is None or sku is None:
                return {'success': False, 'error': '缺少必要的列: 仓库/SKU（或 warehouse/sku）'}

            with get_db() as conn:
                cursor = conn.cursor()
                count = 0

                for _, row in df.iterrows():
                    try:
                        warehouse_val = str(get_col(row, '仓库', 'warehouse', 'Warehouse') or '')
                        sku_val = str(get_col(row, 'SKU', 'sku', 'Sku', 'sku_code') or '')
                        tier_val = str(get_col(row, '档位', 'tier', 'Tier', 'tier_level') or '')
                        freight_val = float(get_col(row, '运费', 'freight', 'Freight') or 0)

                        if not warehouse_val or not sku_val:
                            continue

                        cursor.execute("""
                            INSERT OR REPLACE INTO warehouse_freight
                            (warehouse, tier, sku, freight)
                            VALUES (?, ?, ?, ?)
                        """, (warehouse_val, tier_val, sku_val, freight_val))
                        count += 1
                    except Exception as e:
                        print(f"导入仓库运费失败: {e}")
                        continue

                return {'success': True, 'count': count}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def import_shops(self, content: Union[bytes, str], filename: str = "") -> Dict:
        """导入店铺信息"""
        try:
            df = self._read_file(content, filename)

            # 支持多种列名变体
            def get_col(df_row, *names):
                for name in names:
                    if name in df_row.index:
                        return df_row[name]
                return None

            # 验证必要的列（支持多种列名）
            shop_name = get_col(df.iloc[0], '店铺名称', '店铺', 'shop', 'name') if len(df) > 0 else None
            if shop_name is None:
                return {'success': False, 'error': '缺少必要的列: 店铺名称（或 店铺、shop）'}

            with get_db() as conn:
                cursor = conn.cursor()
                count = 0

                for _, row in df.iterrows():
                    try:
                        # 支持多种列名
                        name = str(get_col(row, '店铺名称', '店铺', 'shop', 'name') or '')
                        refund_rate = float(get_col(row, '退款率', 'refund_rate', 'refundRate') or 0)
                        dsp_rate = float(get_col(row, 'DSP费率', 'dsp_rate', 'dspRate') or 0)
                        return_freight_rate = float(get_col(row, '退货运费率', '退货运费', 'return_freight_rate', 'refundFreightRate') or 0)
                        storage_rate = float(get_col(row, '仓储费率', 'storage_rate', 'storageRate') or 0)
                        target_margin_rate = float(get_col(row, '毛利率目标', 'target_margin_rate', 'targetMarginRate') or 0.2)

                        cursor.execute("""
                            INSERT OR REPLACE INTO shops
                            (name, refund_rate, dsp_rate, return_freight_rate, storage_rate, target_margin_rate)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """, (name, refund_rate, dsp_rate, return_freight_rate, storage_rate, target_margin_rate))
                        count += 1
                    except Exception as e:
                        print(f"导入店铺信息失败: {e}")
                        continue

                return {'success': True, 'count': count}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def import_department_targets(self, content: Union[bytes, str], filename: str = "") -> Dict:
        """导入整体目标"""
        try:
            df = self._read_file(content, filename)

            # 支持多种列名变体
            def get_col(df_row, *names):
                for name in names:
                    if name in df_row.index:
                        val = df_row[name]
                        if val is not None and str(val).strip():
                            return val
                return None

            # 验证必要的列
            month = get_col(df.iloc[0], '月份', 'month', 'Month') if len(df) > 0 else None
            if month is None:
                return {'success': False, 'error': '缺少必要的列: 月份（或 month）'}

            with get_db() as conn:
                cursor = conn.cursor()
                count = 0

                for _, row in df.iterrows():
                    try:
                        # 支持多种列名
                        shop = str(get_col(row, '店铺', 'shop') or '')
                        target_sales = float(get_col(row, '销售额目标', 'targetSales', '销售额', 'target_sales') or 0)
                        target_gross_profit = float(get_col(row, '毛利目标', 'targetGrossProfit', '毛利', 'target_gross_profit') or 0)
                        target_margin_rate = float(get_col(row, '毛利率目标', 'targetMarginRate', '毛利率', 'target_margin_rate') or 0.2)
                        month_val = str(get_col(row, '月份', 'month', 'Month') or '')

                        if not month_val:
                            continue

                        cursor.execute("""
                            INSERT OR REPLACE INTO department_targets
                            (shop, target_sales, target_gross_profit, target_margin_rate, month)
                            VALUES (?, ?, ?, ?, ?)
                        """, (shop, target_sales, target_gross_profit, target_margin_rate, month_val))
                        count += 1
                    except Exception as e:
                        print(f"导入整体目标失败: {e}")
                        continue

                return {'success': True, 'count': count}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def import_operator_group_targets(self, content: Union[bytes, str], filename: str = "") -> Dict:
        """导入运营组目标"""
        try:
            df = self._read_file(content, filename)

            # 支持多种列名变体
            def get_col(df_row, *names):
                for name in names:
                    if name in df_row.index:
                        val = df_row[name]
                        if val is not None and str(val).strip():
                            return val
                return None

            # 验证必要的列
            month = get_col(df.iloc[0], '月份', 'month', 'Month') if len(df) > 0 else None
            operator_group = get_col(df.iloc[0], '运营组', 'operatorGroup', 'operator_group') if len(df) > 0 else None
            if month is None or operator_group is None:
                return {'success': False, 'error': '缺少必要的列: 月份 和 运营组（或 month, operatorGroup）'}

            with get_db() as conn:
                cursor = conn.cursor()
                count = 0

                for _, row in df.iterrows():
                    try:
                        operator_group_val = str(get_col(row, '运营组', 'operatorGroup', 'operator_group') or '')
                        month_val = str(get_col(row, '月份', 'month', 'Month') or '')
                        target_sales = float(get_col(row, '销售额目标', 'targetSales', '销售额', 'target_sales') or 0)
                        target_gross_profit = float(get_col(row, '毛利目标', 'targetGrossProfit', '毛利', 'target_gross_profit') or 0)

                        if not operator_group_val or not month_val:
                            continue

                        cursor.execute("""
                            INSERT OR REPLACE INTO operator_group_targets
                            (operator_group, target_sales, target_gross_profit, month)
                            VALUES (?, ?, ?, ?)
                        """, (operator_group_val, target_sales, target_gross_profit, month_val))
                        count += 1
                    except Exception as e:
                        print(f"导入运营组目标失败: {e}")
                        continue

                return {'success': True, 'count': count}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def import_operator_targets(self, content: Union[bytes, str], filename: str = "") -> Dict:
        """导入运营目标"""
        try:
            df = self._read_file(content, filename)

            # 支持多种列名变体
            def get_col(df_row, *names):
                for name in names:
                    if name in df_row.index:
                        val = df_row[name]
                        if val is not None and str(val).strip():
                            return val
                return None

            # 验证必要的列
            month = get_col(df.iloc[0], '月份', 'month', 'Month') if len(df) > 0 else None
            operator = get_col(df.iloc[0], '运营', 'operator', 'Operator') if len(df) > 0 else None
            if month is None or operator is None:
                return {'success': False, 'error': '缺少必要的列: 月份 和 运营（或 month, operator）'}

            with get_db() as conn:
                cursor = conn.cursor()
                count = 0

                for _, row in df.iterrows():
                    try:
                        operator_val = str(get_col(row, '运营', 'operator', 'Operator') or '')
                        operator_group_val = str(get_col(row, '运营组', 'operatorGroup', 'operator_group') or '')
                        month_val = str(get_col(row, '月份', 'month', 'Month') or '')
                        target_sales = float(get_col(row, '销售额目标', 'targetSales', '销售额', 'target_sales') or 0)
                        target_gross_profit = float(get_col(row, '毛利目标', 'targetGrossProfit', '毛利', 'target_gross_profit') or 0)

                        if not operator_val or not month_val:
                            continue

                        cursor.execute("""
                            INSERT OR REPLACE INTO operator_targets
                            (operator, operator_group, target_sales, target_gross_profit, month)
                            VALUES (?, ?, ?, ?, ?)
                        """, (operator_val, operator_group_val, target_sales, target_gross_profit, month_val))
                        count += 1
                    except Exception as e:
                        print(f"导入运营目标失败: {e}")
                        continue

                return {'success': True, 'count': count}
        except Exception as e:
            return {'success': False, 'error': str(e)}
