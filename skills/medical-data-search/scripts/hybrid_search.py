#!/usr/bin/env python3
"""
医疗数据混合检索工具 - 医疗数据湖平台

功能：
1. 混合检索（关键词+语义搜索）
2. 支持三种搜索模式：hybrid/keyword/semantic
3. 多数据类型联合搜索
4. 结果融合和排序

使用示例：
python hybrid_search.py --query "糖尿病并发症预防" --mode hybrid
python hybrid_search.py --query "心血管疾病风险因素" --mode semantic --top-k 20
python hybrid_search.py --query "CT检查报告" --mode keyword --data-types dicom
"""

import os
import sys
import json
import argparse
import logging
from typing import List, Dict, Optional
import requests
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('hybrid_search.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class HybridSearchClient:
    """混合检索客户端"""
    
    def __init__(self, config_path: Optional[str] = None):
        """初始化混合检索客户端"""
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
                'default_mode': 'hybrid',
                'default_top_k': 10,
                'timeout': 30
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
    
    def hybrid_search(self, query: str, **kwargs) -> Dict:
        """
        混合检索
        
        Args:
            query: 查询文本
            **kwargs: 其他参数
            
        Returns:
            检索结果字典
        """
        # 构建请求参数
        search_params = {
            'query': query,
            'search_mode': kwargs.get('mode', self.config['search_options']['default_mode']),
            'top_k': kwargs.get('top_k', self.config['search_options']['default_top_k'])
        }
        
        # 添加可选参数
        if 'data_types' in kwargs and kwargs['data_types']:
            search_params['data_types'] = kwargs['data_types']
        
        if 'score_threshold' in kwargs:
            search_params['score_threshold'] = kwargs['score_threshold']
        
        try:
            logger.info(f"执行混合检索: {query} (模式: {search_params['search_mode']})")
            
            # 使用POST请求
            response = self.session.post(
                f"{self.api_base}/api/v1/search/hybrid",
                json=search_params,
                timeout=self.config['search_options']['timeout']
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get('success'):
                data = result.get('data', {})
                logger.info(f"混合检索成功，找到 {data.get('total', 0)} 条结果")
                logger.info(f"搜索模式: {data.get('search_mode')}, 耗时: {data.get('took_ms', 0)}ms")
                return data
            else:
                logger.error(f"混合检索失败: {result.get('message')}")
                return {'error': result.get('message'), 'results': []}
                
        except requests.exceptions.RequestException as e:
            logger.error(f"混合检索请求失败: {e}")
            return {'error': str(e), 'results': []}
        except Exception as e:
            logger.error(f"混合检索处理失败: {e}")
            return {'error': str(e), 'results': []}
    
    def compare_search_modes(self, query: str, data_types: Optional[List[str]] = None) -> Dict:
        """比较不同搜索模式的结果"""
        modes = ['hybrid', 'keyword', 'semantic']
        results = {}
        
        for mode in modes:
            logger.info(f"测试搜索模式: {mode}")
            result = self.hybrid_search(
                query=query,
                mode=mode,
                data_types=data_types,
                top_k=5  # 每个模式只取前5个结果进行比较
            )
            
            if 'error' not in result:
                results[mode] = {
                    'total': result.get('total', 0),
                    'took_ms': result.get('took_ms', 0),
                    'top_results': result.get('results', [])[:3]
                }
            else:
                results[mode] = {'error': result['error']}
        
        return results
    
    def analyze_search_results(self, results: Dict) -> Dict:
        """分析搜索结果"""
        if 'error' in results:
            return {'error': results['error']}
        
        analysis = {
            'query': results.get('query'),
            'search_mode': results.get('search_mode'),
            'total_results': results.get('total', 0),
            'response_time_ms': results.get('took_ms', 0),
            'data_type_distribution': {},
            'score_distribution': {'high': 0, 'medium': 0, 'low': 0}
        }
        
        # 分析数据类型分布
        for item in results.get('results', []):
            data_type = item.get('data_type', 'unknown')
            analysis['data_type_distribution'][data_type] = \
                analysis['data_type_distribution'].get(data_type, 0) + 1
            
            # 分析分数分布
            score = item.get('score', 0)
            if score > 0.8:
                analysis['score_distribution']['high'] += 1
            elif score > 0.5:
                analysis['score_distribution']['medium'] += 1
            else:
                analysis['score_distribution']['low'] += 1
        
        return analysis
    
    def print_results(self, results: Dict, detailed: bool = False):
        """打印搜索结果"""
        if 'error' in results:
            print(f"错误: {results['error']}")
            return
        
        print(f"\n=== 混合检索结果 ===")
        print(f"查询: {results.get('query')}")
        print(f"模式: {results.get('search_mode')}")
        print(f"总计: {results.get('total', 0)} 条结果")
        print(f"耗时: {results.get('took_ms', 0)}ms")
        print("-" * 80)
        
        for i, item in enumerate(results.get('results', [])[:10], 1):
            print(f"\n{i}. {item.get('title', '无标题')}")
            print(f"   类型: {item.get('data_type', '未知')}")
            print(f"   分类: {item.get('category', '未知')}")
            
            if detailed:
                print(f"   作者: {item.get('author', '未知')}")
                print(f"   日期: {item.get('date', '未知')}")
                print(f"   分数: {item.get('score', 0):.3f}")
                
                # 显示摘要
                content = item.get('content', '')
                if content and len(content) > 200:
                    print(f"   摘要: {content[:200]}...")
                elif content:
                    print(f"   摘要: {content}")
            
            # 显示高亮片段
            highlights = item.get('highlights', [])
            if highlights:
                print(f"   相关片段:")
                for highlight in highlights[:2]:
                    print(f"     - {highlight}")
    
    def export_results(self, results: Dict, format: str = 'json', output_path: Optional[str] = None):
        """导出搜索结果"""
        if 'error' in results:
            logger.warning(f"无法导出错误结果: {results['error']}")
            return
        
        if format.lower() == 'json':
            if output_path:
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(results, f, ensure_ascii=False, indent=2)
                logger.info(f"结果已导出到JSON: {output_path}")
            else:
                print(json.dumps(results, ensure_ascii=False, indent=2))
                
        elif format.lower() == 'csv':
            import pandas as pd
            items = results.get('results', [])
            if items:
                df = pd.DataFrame(items)
                if output_path:
                    df.to_csv(output_path, index=False, encoding='utf-8-sig')
                    logger.info(f"结果已导出到CSV: {output_path}")
                else:
                    print(df.to_string())
            else:
                logger.warning("没有结果可导出")
                
        else:
            logger.error(f"不支持的导出格式: {format}")


def main():
    """命令行入口"""
    parser = argparse.ArgumentParser(description='医疗数据混合检索工具')
    
    # 搜索参数
    parser.add_argument('--query', '-q', required=True, help='查询文本')
    parser.add_argument('--mode', '-m', default='hybrid', 
                       choices=['hybrid', 'keyword', 'semantic'], 
                       help='搜索模式')
    parser.add_argument('--data-types', help='数据类型（逗号分隔）')
    parser.add_argument('--top-k', type=int, default=10, help='返回结果数量')
    parser.add_argument('--score-threshold', type=float, help='相似度阈值')
    
    # 输出选项
    parser.add_argument('--output', '-o', default='print', 
                       choices=['json', 'csv', 'print'], help='输出格式')
    parser.add_argument('--save', help='保存结果到文件')
    parser.add_argument('--detailed', '-d', action='store_true', 
                       help='显示详细信息')
    parser.add_argument('--compare', action='store_true', 
                       help='比较不同搜索模式')
    
    # 配置选项
    parser.add_argument('--config', help='配置文件路径')
    parser.add_argument('--api-key', help='API密钥')
    parser.add_argument('--api-base', help='API基础地址')
    
    args = parser.parse_args()
    
    # 初始化客户端
    client = HybridSearchClient(args.config)
    
    # 覆盖配置
    if args.api_key:
        client.config['api_key'] = args.api_key
    if args.api_base:
        client.config['api_base'] = args.api_base
    
    # 处理数据类型
    data_types = None
    if args.data_types:
        data_types = [dt.strip() for dt in args.data_types.split(',')]
    
    if args.compare:
        # 比较不同搜索模式
        print(f"比较搜索模式: {args.query}")
        results = client.compare_search_modes(args.query, data_types)
        
        for mode, data in results.items():
            print(f"\n=== {mode.upper()} 模式 ===")
            if 'error' in data:
                print(f"错误: {data['error']}")
            else:
                print(f"结果数: {data['total']}")
                print(f"耗时: {data['took_ms']}ms")
                print("前3个结果:")
                for i, item in enumerate(data['top_results'], 1):
                    title = item.get('title', '无标题')
                    print(f"  {i}. {title[:50]}...")
        
    else:
        # 执行混合检索
        results = client.hybrid_search(
            query=args.query,
            mode=args.mode,
            data_types=data_types,
            top_k=args.top_k,
            score_threshold=args.score_threshold
        )
        
        # 处理结果
        if 'error' in results:
            print(f"检索错误: {results['error']}")
            sys.exit(1)
        
        # 分析结果
        analysis = client.analyze_search_results(results)
        print(f"\n=== 检索分析 ===")
        print(f"查询: {analysis['query']}")
        print(f"模式: {analysis['search_mode']}")
        print(f"总结果数: {analysis['total_results']}")
        print(f"响应时间: {analysis['response_time_ms']}ms")
        
        if analysis['data_type_distribution']:
            print("数据类型分布:")
            for dt, count in analysis['data_type_distribution'].items():
                print(f"  {dt}: {count}")
        
        print("分数分布:")
        for level, count in analysis['score_distribution'].items():
            print(f"  {level}: {count}")
        
        # 输出结果
        if args.output == 'print':
            client.print_results(results, args.detailed)
        else:
            output_path = args.save or f"hybrid_search_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{args.output}"
            client.export_results(results, args.output, output_path if args.save else None)


if __name__ == "__main__":
    main()