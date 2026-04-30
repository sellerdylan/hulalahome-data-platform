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

            # 验证必要的列
            required_cols = ['店铺', 'SKU', 'SPU']
            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                return {'success': False, 'error': f'缺少必要的列: {", ".join(missing_cols)}'}

            with get_db() as conn:
                cursor = conn.cursor()
                count = 0

                for _, row in df.iterrows():
                    try:
                        cursor.execute("""
                            INSERT OR REPLACE INTO sku_base_info
                            (shop, sku, asin, spu, lifecycle, sales_grade, category,
                             product_level, operator, operator_group, refund_rate,
                             cg_freight, pl_freight, fedex_freight)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                        """, (
                            str(row['店铺']),
                            str(row['SKU']),
                            str(row.get('ASIN', '')),
                            str(row['SPU']),
                            str(row.get('生命周期', '')),
                            str(row.get('销售等级', '')),
                            str(row.get('品类', '')),
                            str(row.get('产品定级', '')),
                            str(row.get('运营', '')),
                            str(row.get('运营组', '')),
                            float(row.get('退款率', 0)),
                            float(row.get('CG运费', 0)),
                            float(row.get('3PL运费', 0)),
                            float(row.get('Fedex运费', 0)),
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

            required_cols = ['仓库', '档位', 'SKU', '运费']
            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                return {'success': False, 'error': f'缺少必要的列: {", ".join(missing_cols)}'}

            with get_db() as conn:
                cursor = conn.cursor()
                count = 0

                for _, row in df.iterrows():
                    try:
                        cursor.execute("""
                            INSERT OR REPLACE INTO warehouse_freight
                            (warehouse, tier, sku, freight)
                            VALUES (?, ?, ?, ?)
                        """, (
                            str(row['仓库']),
                            str(row['档位']),
                            str(row['SKU']),
                            float(row.get('运费', 0)),
                        ))
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

            required_cols = ['店铺名称']
            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                return {'success': False, 'error': f'缺少必要的列: {", ".join(missing_cols)}'}

            with get_db() as conn:
                cursor = conn.cursor()
                count = 0

                for _, row in df.iterrows():
                    try:
                        cursor.execute("""
                            INSERT OR REPLACE INTO shops
                            (name, refund_rate, dsp_rate, return_freight_rate, storage_rate, target_margin_rate)
                            VALUES (?, ?, ?, ?, ?, ?)
                        """, (
                            str(row['店铺名称']),
                            float(row.get('退款率', 0)),
                            float(row.get('DSP费率', 0)),
                            float(row.get('退货运费率', 0)),
                            float(row.get('仓储费率', 0)),
                            float(row.get('毛利率目标', 0.2)),
                        ))
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

            required_cols = ['月份']
            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                return {'success': False, 'error': f'缺少必要的列: {", ".join(missing_cols)}'}

            with get_db() as conn:
                cursor = conn.cursor()
                count = 0

                for _, row in df.iterrows():
                    try:
                        # 整体目标按 shop 维度存储（如果没指定 shop，默认用空字符串表示全店）
                        shop = str(row.get('店铺', ''))
                        cursor.execute("""
                            INSERT OR REPLACE INTO department_targets
                            (shop, target_sales, target_gross_profit, target_margin_rate, month)
                            VALUES (?, ?, ?, ?, ?)
                        """, (
                            shop,
                            float(row.get('销售额目标', 0)),
                            float(row.get('毛利目标', 0)),
                            float(row.get('毛利率目标', 0.2)),
                            str(row['月份']),
                        ))
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

            required_cols = ['月份', '运营组']
            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                return {'success': False, 'error': f'缺少必要的列: {", ".join(missing_cols)}'}

            with get_db() as conn:
                cursor = conn.cursor()
                count = 0

                for _, row in df.iterrows():
                    try:
                        cursor.execute("""
                            INSERT OR REPLACE INTO operator_group_targets
                            (operator_group, target_sales, target_gross_profit, month)
                            VALUES (?, ?, ?, ?)
                        """, (
                            str(row['运营组']),
                            float(row.get('销售额目标', 0)),
                            float(row.get('毛利目标', 0)),
                            str(row['月份']),
                        ))
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

            required_cols = ['月份', '运营']
            missing_cols = [col for col in required_cols if col not in df.columns]
            if missing_cols:
                return {'success': False, 'error': f'缺少必要的列: {", ".join(missing_cols)}'}

            with get_db() as conn:
                cursor = conn.cursor()
                count = 0

                for _, row in df.iterrows():
                    try:
                        cursor.execute("""
                            INSERT OR REPLACE INTO operator_targets
                            (operator, operator_group, target_sales, target_gross_profit, month)
                            VALUES (?, ?, ?, ?, ?)
                        """, (
                            str(row['运营']),
                            str(row.get('运营组', '')),
                            float(row.get('销售额目标', 0)),
                            float(row.get('毛利目标', 0)),
                            str(row['月份']),
                        ))
                        count += 1
                    except Exception as e:
                        print(f"导入运营目标失败: {e}")
                        continue

                return {'success': True, 'count': count}
        except Exception as e:
            return {'success': False, 'error': str(e)}
