#!/usr/bin/env python3
"""
医疗数据湖SQL查询工具

功能：
1. 执行SQL查询医疗数据湖
2. 支持联邦查询和跨数据源JOIN
3. 查询结果导出和分析
4. 数据目录和表结构查询

使用示例：
python sql_query.py --sql "SELECT * FROM iceberg.bronze.ods_documents_parsed LIMIT 10"
python sql_query.py --sql "SELECT title, author FROM iceberg.bronze.ods_documents_parsed WHERE category='临床指南'"
python sql_query.py --list-catalogs
python sql_query.py --list-tables iceberg bronze
"""

import os
import sys
import json
import argparse
import logging
from typing import List, Dict, Optional, Any
import requests
import pandas as pd
from datetime import datetime
from tabulate import tabulate

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('sql_query.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class SQLQueryClient:
    """SQL查询客户端"""
    
    def __init__(self, config_path: Optional[str] = None):
        """初始化SQL查询客户端"""
        self.config = self._load_config(config_path)
        self.api_base = self.config.get('api_base', 'http://localhost:48200')
        self.api_key = self.config.get('api_key')
        self.tenant_id = self.config.get('tenant_id', 'default')
        self.session = requests.Session()
        self.session.headers.update({
            'X-API-Key': self.api_key,
            'X-Tenant-ID': self.tenant_id,
            'Content-Type': 'application/json'
        })
        
    def _load_config(self, config_path: Optional[str] = None) -> Dict:
        """加载配置文件"""
        default_config = {
            'api_base': 'http://localhost:48200',
            'api_key': None,
            'tenant_id': 'default',
            'query_options': {
                'default_catalog': 'iceberg',
                'timeout': 60,
                'max_rows': 1000
            }
        }
        
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    user_config = json.load(f)
                default_config.update(user_config)
                logger.info(f"已加载配置文件: {config_path}")
            except Exception as e:
                logger.error(f"加载配置文件失败: {e}")
        
        # 检查环境变量
        env_api_key = os.getenv('MEDICAL_API_KEY')
        if env_api_key and not default_config['api_key']:
            default_config['api_key'] = env_api_key
            
        return default_config
    
    def execute_sql(self, sql: str, catalog: Optional[str] = None) -> Dict:
        """
        执行SQL查询
        
        Args:
            sql: SQL语句
            catalog: 数据目录
            
        Returns:
            查询结果字典
        """
        if not catalog:
            catalog = self.config['query_options']['default_catalog']
        
        query_params = {
            'sql': sql,
            'catalog': catalog
        }
        
        try:
            logger.info(f"执行SQL查询: {sql[:100]}...")
            response = self.session.post(
                f"{self.api_base}/api/v1/query/sql",
                json=query_params,
                timeout=self.config['query_options']['timeout']
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get('success'):
                data = result.get('data', {})
                logger.info(f"SQL查询成功，返回 {data.get('row_count', 0)} 行数据")
                logger.info(f"查询耗时: {data.get('took_ms', 0)}ms")
                return data
            else:
                logger.error(f"SQL查询失败: {result.get('message')}")
                return {'error': result.get('message'), 'rows': []}
                
        except requests.exceptions.RequestException as e:
            logger.error(f"SQL查询请求失败: {e}")
            return {'error': str(e), 'rows': []}
        except Exception as e:
            logger.error(f"SQL查询处理失败: {e}")
            return {'error': str(e), 'rows': []}
    
    def list_catalogs(self) -> List[str]:
        """获取数据目录列表"""
        try:
            response = self.session.get(
                f"{self.api_base}/api/v1/query/catalogs",
                timeout=10
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get('success'):
                return result.get('data', [])
            else:
                logger.error(f"获取目录列表失败: {result.get('message')}")
                return []
                
        except Exception as e:
            logger.error(f"获取目录列表失败: {e}")
            return []
    
    def list_tables(self, catalog: str, schema: str) -> List[Dict]:
        """获取指定目录和模式下的表列表"""
        try:
            response = self.session.get(
                f"{self.api_base}/api/v1/query/tables/{catalog}/{schema}",
                timeout=10
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get('success'):
                return result.get('data', [])
            else:
                logger.error(f"获取表列表失败: {result.get('message')}")
                return []
                
        except Exception as e:
            logger.error(f"获取表列表失败: {e}")
            return []
    
    def query_data_lake(self, schema: str, table: str, **kwargs) -> Dict:
        """
        查询数据湖表
        
        Args:
            schema: 模式名称
            table: 表名称
            **kwargs: 查询参数
            
        Returns:
            查询结果
        """
        try:
            params = {
                'schema': schema,
                'table': table,
                'page': kwargs.get('page', 1),
                'size': kwargs.get('size', 20)
            }
            
            # 添加可选参数
            optional_params = [
                'snapshot_id', 'columns', 'title', 'category', 'author',
                'content', 'keywords', 'source', 'file_type', 'date_from',
                'date_to', 'sort_by', 'sort_order'
            ]
            
            for param in optional_params:
                if param in kwargs and kwargs[param] is not None:
                    params[param] = kwargs[param]
            
            response = self.session.get(
                f"{self.api_base}/api/v1/lake/tables/{schema}/{table}/data",
                params=params,
                timeout=30
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get('success'):
                return result.get('data', {})
            else:
                logger.error(f"数据湖查询失败: {result.get('message')}")
                return {'error': result.get('message'), 'items': []}
                
        except Exception as e:
            logger.error(f"数据湖查询失败: {e}")
            return {'error': str(e), 'items': []}
    
    def export_results(self, results: Dict, format: str = 'table', output_path: Optional[str] = None):
        """导出查询结果"""
        if 'error' in results:
            logger.warning(f"无法导出错误结果: {results['error']}")
            return
        
        rows = results.get('rows', [])
        columns = results.get('columns', [])
        
        if not rows:
            logger.warning("没有结果可导出")
            return
        
        if format.lower() == 'csv':
            df = pd.DataFrame(rows, columns=columns)
            if output_path:
                df.to_csv(output_path, index=False, encoding='utf-8-sig')
                logger.info(f"结果已导出到CSV: {output_path}")
            else:
                print(df.to_string())
                
        elif format.lower() == 'json':
            export_data = {
                'columns': columns,
                'rows': rows,
                'row_count': results.get('row_count', len(rows)),
                'took_ms': results.get('took_ms', 0)
            }
            
            if output_path:
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(export_data, f, ensure_ascii=False, indent=2)
                logger.info(f"结果已导出到JSON: {output_path}")
            else:
                print(json.dumps(export_data, ensure_ascii=False, indent=2))
                
        elif format.lower() == 'table':
            self._print_table(columns, rows, results)
            
        else:
            logger.error(f"不支持的导出格式: {format}")
    
    def _print_table(self, columns: List[str], rows: List[List], results: Dict):
        """以表格形式打印结果"""
        if not rows:
            print("没有查询结果")
            return
        
        # 使用tabulate打印美观的表格
        table_data = []
        for row in rows[:50]:  # 限制显示前50行
            table_data.append(row)
        
        print(tabulate(table_data, headers=columns, tablefmt='grid'))
        
        # 显示统计信息
        print(f"\n总计: {results.get('row_count', len(rows))} 行数据")
        print(f"查询耗时: {results.get('took_ms', 0)}ms")
        
        if len(rows) > 50:
            print(f"（仅显示前50行，共{len(rows)}行）")
    
    def analyze_query(self, sql: str) -> Dict:
        """分析SQL查询"""
        analysis = {
            'sql': sql,
            'estimated_cost': 'unknown',
            'suggestions': [],
            'warnings': []
        }
        
        # 简单的SQL分析
        sql_lower = sql.lower()
        
        # 检查是否有LIMIT子句
        if 'limit' not in sql_lower:
            analysis['warnings'].append('查询没有LIMIT子句，可能返回大量数据')
            analysis['suggestions'].append('添加LIMIT子句限制返回行数')
        
        # 检查SELECT *
        if 'select *' in sql_lower:
            analysis['suggestions'].append('建议指定具体列名而不是使用SELECT *')
        
        # 检查是否有WHERE条件
        if 'where' not in sql_lower and 'join' not in sql_lower:
            analysis['warnings'].append('查询没有WHERE条件，可能扫描全表')
        
        return analysis


def main():
    """命令行入口"""
    parser = argparse.ArgumentParser(description='医疗数据湖SQL查询工具')
    
    # 查询参数
    parser.add_argument('--sql', help='SQL语句')
    parser.add_argument('--catalog', default='iceberg', help='数据目录')
    
    # 数据湖查询参数
    parser.add_argument('--schema', help='模式名称（数据湖查询）')
    parser.add_argument('--table', help='表名称（数据湖查询）')
    parser.add_argument('--page', type=int, default=1, help='页码')
    parser.add_argument('--size', type=int, default=20, help='每页数量')
    parser.add_argument('--snapshot-id', help='快照ID（Time Travel）')
    parser.add_argument('--columns', help='查询列（逗号分隔）')
    parser.add_argument('--title', help='标题关键词')
    parser.add_argument('--category', help='分类筛选')
    parser.add_argument('--author', help='作者筛选')
    parser.add_argument('--content', help='内容关键词')
    parser.add_argument('--keywords', help='多个关键词（逗号分隔）')
    parser.add_argument('--date-from', help='开始日期')
    parser.add_argument('--date-to', help='结束日期')
    
    # 信息查询
    parser.add_argument('--list-catalogs', action='store_true', 
                       help='列出所有数据目录')
    parser.add_argument('--list-tables', nargs=2, metavar=('CATALOG', 'SCHEMA'),
                       help='列出指定目录和模式下的表')
    
    # 输出选项
    parser.add_argument('--output', '-o', default='table', 
                       choices=['json', 'csv', 'table'], help='输出格式')
    parser.add_argument('--save', help='保存结果到文件')
    parser.add_argument('--analyze', action='store_true', 
                       help='分析SQL查询')
    
    # 配置选项
    parser.add_argument('--config', help='配置文件路径')
    parser.add_argument('--api-key', help='API密钥')
    parser.add_argument('--api-base', help='API基础地址')
    
    args = parser.parse_args()
    
    # 初始化客户端
    client = SQLQueryClient(args.config)
    
    # 覆盖配置
    if args.api_key:
        client.config['api_key'] = args.api_key
    if args.api_base:
        client.config['api_base'] = args.api_base
    
    # 处理信息查询
    if args.list_catalogs:
        catalogs = client.list_catalogs()
        print("=== 数据目录列表 ===")
        for catalog in catalogs:
            print(f"  {catalog}")
        sys.exit(0)
    
    if args.list_tables:
        catalog, schema = args.list_tables
        tables = client.list_tables(catalog, schema)
        print(f"=== 表列表 ({catalog}.{schema}) ===")
        for table in tables:
            print(f"  {table.get('name', '未知')}")
        sys.exit(0)
    
    # 检查必要的参数
    if not args.sql and not (args.schema and args.table):
        parser.error("需要提供 --sql 参数或 --schema 和 --table 参数")
    
    # 执行查询
    if args.sql:
        # SQL查询
        if args.analyze:
            analysis = client.analyze_query(args.sql)
            print("=== SQL查询分析 ===")
            print(f"SQL: {analysis['sql']}")
            
            if analysis['warnings']:
                print("\n警告:")
                for warning in analysis['warnings']:
                    print(f"  ⚠️  {warning}")
            
            if analysis['suggestions']:
                print("\n建议:")
                for suggestion in analysis['suggestions']:
                    print(f"  💡 {suggestion}")
            
            print("\n是否继续执行？(y/n): ", end='')
            if input().lower() != 'y':
                sys.exit(0)
        
        results = client.execute_sql(args.sql, args.catalog)
        
    else:
        # 数据湖查询
        query_kwargs = {
            'page': args.page,
            'size': args.size
        }
        
        # 添加可选参数
        optional_args = [
            'snapshot_id', 'columns', 'title', 'category', 'author',
            'content', 'keywords', 'date_from', 'date_to'
        ]
        
        for arg in optional_args:
            if getattr(args, arg, None):
                query_kwargs[arg] = getattr(args, arg)
        
        # 处理关键词
        if args.keywords:
            query_kwargs['keywords'] = args.keywords
        
        results = client.query_data_lake(args.schema, args.table, **query_kwargs)
        
        # 转换数据湖查询结果为统一格式
        if 'error' not in results:
            items = results.get('items', [])
            if items:
                columns = list(items[0].keys()) if items else []
                rows = [list(item.values()) for item in items]
                results = {
                    'columns': columns,
                    'rows': rows,
                    'row_count': len(items),
                    'total': results.get('total', len(items))
                }
    
    # 处理结果
    if 'error' in results:
        print(f"查询错误: {results['error']}")
        sys.exit(1)
    
    # 导出结果
    output_path = args.save or f"sql_query_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{args.output}"
    client.export_results(results, args.output, output_path if args.save else None)


if __name__ == "__main__":
    main()