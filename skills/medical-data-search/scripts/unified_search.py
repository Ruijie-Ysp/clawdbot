#!/usr/bin/env python3
"""
医疗数据统一搜索工具 - 医疗数据湖平台

功能：
1. 统一搜索医疗文献、病历、影像数据
2. 支持多条件组合查询
3. 分页查询和结果导出
4. 聚合统计和结果分析

使用示例：
python unified_search.py --query "糖尿病治疗" --data-types document
python unified_search.py --query "高血压" --category "临床指南" --author "张三"
python unified_search.py --query "CT检查" --data-types dicom --output csv
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
from pathlib import Path

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('search.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class MedicalSearchClient:
    """医疗数据搜索客户端"""
    
    def __init__(self, config_path: Optional[str] = None):
        """初始化搜索客户端"""
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
            'search_options': {
                'default_page_size': 20,
                'timeout': 30,
                'retry_times': 3
            }
        }
        
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    user_config = json.load(f)
                # 合并配置
                default_config.update(user_config)
                logger.info(f"已加载配置文件: {config_path}")
            except Exception as e:
                logger.error(f"加载配置文件失败: {e}")
        
        # 检查环境变量
        env_api_key = os.getenv('MEDICAL_API_KEY')
        if env_api_key and not default_config['api_key']:
            default_config['api_key'] = env_api_key
            
        return default_config
    
    def unified_search(self, query: Optional[str] = None, **kwargs) -> Dict:
        """
        统一医疗数据搜索
        
        Args:
            query: 搜索关键词
            **kwargs: 其他搜索参数
            
        Returns:
            搜索结果字典
        """
        # 构建搜索请求
        search_params = {}
        if query:
            search_params['query'] = query
        
        # 添加其他参数
        param_mapping = {
            'data_types': 'data_types',
            'title': 'title',
            'author': 'author',
            'category': 'category',
            'department': 'department',
            'keywords': 'keywords',
            'date_from': 'date_from',
            'date_to': 'date_to',
            'source': 'source',
            'file_type': 'file_type',
            'patient_id': 'patient_id',
            'visit_type': 'visit_type',
            'diagnosis': 'diagnosis',
            'modality': 'modality',
            'body_part': 'body_part',
            'study_id': 'study_id',
            'sort_by': 'sort_by',
            'sort_order': 'sort_order',
            'page': 'page',
            'size': 'size',
            'return_fields': 'return_fields',
            'include_aggregations': 'include_aggregations'
        }
        
        for key, value in kwargs.items():
            if key in param_mapping and value is not None:
                search_params[param_mapping[key]] = value
        
        try:
            logger.info(f"执行搜索: {search_params.get('query', '无关键词')}")
            response = self.session.post(
                f"{self.api_base}/api/v1/search",
                json=search_params,
                timeout=self.config['search_options']['timeout']
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get('success'):
                logger.info(f"搜索成功，找到 {result.get('data', {}).get('total', 0)} 条结果")
                return result['data']
            else:
                logger.error(f"搜索失败: {result.get('message')}")
                return {'error': result.get('message'), 'items': []}
                
        except requests.exceptions.RequestException as e:
            logger.error(f"搜索请求失败: {e}")
            return {'error': str(e), 'items': []}
        except Exception as e:
            logger.error(f"搜索处理失败: {e}")
            return {'error': str(e), 'items': []}
    
    def search_suggest(self, query: str, data_type: Optional[str] = None) -> List[str]:
        """搜索建议/自动补全"""
        try:
            params = {'q': query}
            if data_type:
                params['data_type'] = data_type
                
            response = self.session.get(
                f"{self.api_base}/api/v1/search/suggest",
                params=params,
                timeout=10
            )
            response.raise_for_status()
            return response.json().get('data', [])
            
        except Exception as e:
            logger.error(f"搜索建议失败: {e}")
            return []
    
    def batch_search(self, search_queries: List[Dict]) -> List[Dict]:
        """批量搜索"""
        results = []
        for i, query_params in enumerate(search_queries):
            logger.info(f"执行批量搜索 {i+1}/{len(search_queries)}")
            result = self.unified_search(**query_params)
            results.append({
                'query': query_params.get('query', '未知查询'),
                'result': result
            })
        return results
    
    def export_results(self, results: Dict, format: str = 'json', output_path: Optional[str] = None):
        """导出搜索结果"""
        if not results.get('items'):
            logger.warning("没有结果可导出")
            return
        
        if format.lower() == 'csv':
            df = pd.DataFrame(results['items'])
            if output_path:
                df.to_csv(output_path, index=False, encoding='utf-8-sig')
                logger.info(f"结果已导出到CSV: {output_path}")
            else:
                print(df.to_string())
                
        elif format.lower() == 'json':
            if output_path:
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(results, f, ensure_ascii=False, indent=2)
                logger.info(f"结果已导出到JSON: {output_path}")
            else:
                print(json.dumps(results, ensure_ascii=False, indent=2))
                
        elif format.lower() == 'table':
            self._print_table(results)
            
        else:
            logger.error(f"不支持的导出格式: {format}")
    
    def _print_table(self, results: Dict):
        """以表格形式打印结果"""
        items = results.get('items', [])
        if not items:
            print("没有搜索结果")
            return
        
        # 获取所有字段
        all_fields = set()
        for item in items:
            all_fields.update(item.keys())
        
        # 选择要显示的字段
        display_fields = ['title', 'author', 'category', 'data_type', 'date']
        available_fields = [f for f in display_fields if f in all_fields]
        
        # 打印表头
        header = " | ".join([f"{field:20}" for field in available_fields])
        print(header)
        print("-" * len(header))
        
        # 打印数据
        for item in items:
            row = []
            for field in available_fields:
                value = str(item.get(field, ''))[:20]
                row.append(f"{value:20}")
            print(" | ".join(row))
        
        # 打印统计信息
        print(f"\n总计: {results.get('total', 0)} 条结果")
        print(f"页码: {results.get('page', 1)}/{results.get('total_pages', 1)}")


def main():
    """命令行入口"""
    parser = argparse.ArgumentParser(description='医疗数据统一搜索工具')
    
    # 搜索参数
    parser.add_argument('--query', '-q', help='搜索关键词')
    parser.add_argument('--data-types', help='数据类型（逗号分隔: document,patient_record,dicom）')
    parser.add_argument('--title', help='标题关键词')
    parser.add_argument('--author', help='作者/医生')
    parser.add_argument('--category', help='分类筛选')
    parser.add_argument('--department', help='科室筛选')
    parser.add_argument('--keywords', help='多个关键词（逗号分隔）')
    parser.add_argument('--date-from', help='开始日期 YYYY-MM-DD')
    parser.add_argument('--date-to', help='结束日期 YYYY-MM-DD')
    parser.add_argument('--source', help='来源（文献）')
    parser.add_argument('--file-type', help='文件类型（文献）')
    parser.add_argument('--patient-id', help='患者ID（病历）')
    parser.add_argument('--visit-type', help='就诊类型（病历）')
    parser.add_argument('--diagnosis', help='诊断关键词（病历）')
    parser.add_argument('--modality', help='检查类型（影像）')
    parser.add_argument('--body-part', help='检查部位（影像）')
    parser.add_argument('--study-id', help='检查ID（影像）')
    
    # 分页和排序
    parser.add_argument('--page', type=int, default=1, help='页码')
    parser.add_argument('--size', type=int, default=20, help='每页数量')
    parser.add_argument('--sort-by', default='score', help='排序字段')
    parser.add_argument('--sort-order', default='desc', help='排序方向')
    
    # 输出选项
    parser.add_argument('--output', '-o', default='table', 
                       choices=['json', 'csv', 'table'], help='输出格式')
    parser.add_argument('--save', help='保存结果到文件')
    parser.add_argument('--include-aggregations', action='store_true', 
                       help='包含聚合统计')
    
    # 配置选项
    parser.add_argument('--config', help='配置文件路径')
    parser.add_argument('--api-key', help='API密钥')
    parser.add_argument('--api-base', help='API基础地址')
    
    args = parser.parse_args()
    
    # 初始化客户端
    client = MedicalSearchClient(args.config)
    
    # 覆盖配置
    if args.api_key:
        client.config['api_key'] = args.api_key
    if args.api_base:
        client.config['api_base'] = args.api_base
    
    # 准备搜索参数
    search_kwargs = {}
    
    # 处理数据类型
    if args.data_types:
        search_kwargs['data_types'] = [dt.strip() for dt in args.data_types.split(',')]
    
    # 处理关键词
    if args.keywords:
        search_kwargs['keywords'] = [k.strip() for k in args.keywords.split(',')]
    
    # 添加其他参数
    for key, value in vars(args).items():
        if key not in ['query', 'data_types', 'keywords', 'output', 'save', 
                      'config', 'api_key', 'api_base', 'include_aggregations']:
            if value is not None:
                search_kwargs[key] = value
    
    # 包含聚合统计
    if args.include_aggregations:
        search_kwargs['include_aggregations'] = True
    
    # 执行搜索
    results = client.unified_search(args.query, **search_kwargs)
    
    # 处理结果
    if 'error' in results:
        print(f"搜索错误: {results['error']}")
        sys.exit(1)
    
    # 导出结果
    output_path = args.save or f"search_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{args.output}"
    client.export_results(results, args.output, output_path if args.save else None)
    
    # 打印聚合统计
    if args.include_aggregations and 'aggregations' in results:
        print("\n=== 聚合统计 ===")
        aggs = results['aggregations']
        if aggs.get('categories'):
            print("分类分布:")
            for cat in aggs['categories']:
                print(f"  {cat['key']}: {cat['doc_count']}")
        
        if aggs.get('data_types'):
            print("\n数据类型分布:")
            for dt in aggs['data_types']:
                print(f"  {dt['key']}: {dt['doc_count']}")


if __name__ == "__main__":
    main()