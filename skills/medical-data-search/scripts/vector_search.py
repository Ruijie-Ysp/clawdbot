#!/usr/bin/env python3
"""
医疗数据向量搜索工具

功能：
1. 文本向量化（Embedding）
2. 向量相似搜索
3. 向量集合管理
4. 向量服务状态监控

使用示例：
python vector_search.py --text "糖尿病胰岛素治疗方案" --action embed
python vector_search.py --query "高血压药物副作用" --top-k 10
python vector_search.py --action collections
python vector_search.py --action health
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
        logging.FileHandler('vector_search.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class VectorSearchClient:
    """向量搜索客户端"""
    
    def __init__(self, config_path: Optional[str] = None):
        """初始化向量搜索客户端"""
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
            'vector_options': {
                'default_collection': 'medical_documents',
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
    
    def embed_text(self, texts: List[str], model: Optional[str] = None) -> Dict:
        """
        文本向量化
        
        Args:
            texts: 文本列表
            model: 向量化模型
            
        Returns:
            向量化结果
        """
        if not texts:
            return {'error': '文本列表不能为空'}
        
        # 限制文本数量
        if len(texts) > 100:
            texts = texts[:100]
            logger.warning(f"文本数量超过限制，只处理前100条")
        
        request_data = {'texts': texts}
        if model:
            request_data['model'] = model
        
        try:
            logger.info(f"文本向量化，处理 {len(texts)} 条文本")
            response = self.session.post(
                f"{self.api_base}/api/v1/embeddings/text",
                json=request_data,
                timeout=self.config['vector_options']['timeout']
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get('success'):
                data = result.get('data', {})
                logger.info(f"文本向量化成功，生成 {len(data.get('embeddings', []))} 个向量")
                return data
            else:
                logger.error(f"文本向量化失败: {result.get('message')}")
                return {'error': result.get('message')}
                
        except requests.exceptions.RequestException as e:
            logger.error(f"文本向量化请求失败: {e}")
            return {'error': str(e)}
        except Exception as e:
            logger.error(f"文本向量化处理失败: {e}")
            return {'error': str(e)}
    
    def vector_search(self, query: str, **kwargs) -> Dict:
        """
        向量相似搜索
        
        Args:
            query: 查询文本
            **kwargs: 其他参数
            
        Returns:
            搜索结果
        """
        request_data = {
            'query': query,
            'top_k': kwargs.get('top_k', self.config['vector_options']['default_top_k'])
        }
        
        # 添加可选参数
        if 'collection' in kwargs and kwargs['collection']:
            request_data['collection'] = kwargs['collection']
        
        if 'filter' in kwargs and kwargs['filter']:
            request_data['filter'] = kwargs['filter']
        
        if 'score_threshold' in kwargs:
            request_data['score_threshold'] = kwargs['score_threshold']
        
        try:
            logger.info(f"向量搜索: {query}")
            response = self.session.post(
                f"{self.api_base}/api/v1/embeddings/search",
                json=request_data,
                timeout=self.config['vector_options']['timeout']
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get('success'):
                data = result.get('data', {})
                logger.info(f"向量搜索成功，找到 {len(data.get('results', []))} 条结果")
                return data
            else:
                logger.error(f"向量搜索失败: {result.get('message')}")
                return {'error': result.get('message'), 'results': []}
                
        except requests.exceptions.RequestException as e:
            logger.error(f"向量搜索请求失败: {e}")
            return {'error': str(e), 'results': []}
        except Exception as e:
            logger.error(f"向量搜索处理失败: {e}")
            return {'error': str(e), 'results': []}
    
    def get_embedding_status(self, doc_id: str, collection: Optional[str] = None) -> Dict:
        """查询文档向量化状态"""
        try:
            params = {'doc_id': doc_id}
            if collection:
                params['collection'] = collection
            
            response = self.session.get(
                f"{self.api_base}/api/v1/embeddings/status/{doc_id}",
                params=params,
                timeout=10
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get('success'):
                return result.get('data', {})
            else:
                logger.error(f"查询向量化状态失败: {result.get('message')}")
                return {'error': result.get('message')}
                
        except Exception as e:
            logger.error(f"查询向量化状态失败: {e}")
            return {'error': str(e)}
    
    def list_collections(self) -> List[Dict]:
        """获取向量集合列表"""
        try:
            response = self.session.get(
                f"{self.api_base}/api/v1/embeddings/collections",
                timeout=10
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get('success'):
                return result.get('data', [])
            else:
                logger.error(f"获取向量集合列表失败: {result.get('message')}")
                return []
                
        except Exception as e:
            logger.error(f"获取向量集合列表失败: {e}")
            return []
    
    def get_vector_stats(self) -> Dict:
        """获取向量服务统计信息"""
        try:
            response = self.session.get(
                f"{self.api_base}/api/v1/vectors/stats",
                timeout=10
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get('success'):
                return result.get('data', {})
            else:
                logger.error(f"获取向量统计失败: {result.get('message')}")
                return {'error': result.get('message')}
                
        except Exception as e:
            logger.error(f"获取向量统计失败: {e}")
            return {'error': str(e)}
    
    def get_vector_health(self) -> Dict:
        """检查向量服务健康状态"""
        try:
            response = self.session.get(
                f"{self.api_base}/api/v1/vectors/health",
                timeout=10
            )
            response.raise_for_status()
            result = response.json()
            
            if result.get('success'):
                return result.get('data', {})
            else:
                logger.error(f"检查向量服务健康状态失败: {result.get('message')}")
                return {'error': result.get('message')}
                
        except Exception as e:
            logger.error(f"检查向量服务健康状态失败: {e}")
            return {'error': str(e)}
    
    def print_results(self, results: Dict, action: str):
        """打印结果"""
        if 'error' in results:
            print(f"错误: {results['error']}")
            return
        
        if action == 'embed':
            embeddings = results.get('embeddings', [])
            print(f"=== 文本向量化结果 ===")
            print(f"生成向量数: {len(embeddings)}")
            print(f"向量维度: {len(embeddings[0]) if embeddings else 0}")
            
            # 显示前3个向量的前5个维度
            for i, embedding in enumerate(embeddings[:3]):
                print(f"\n文本 {i+1} 向量（前5维）:")
                print(f"  {embedding[:5]}")
        
        elif action == 'search':
            search_results = results.get('results', [])
            print(f"=== 向量搜索结果 ===")
            print(f"查询: {results.get('query')}")
            print(f"结果数: {len(search_results)}")
            
            for i, item in enumerate(search_results[:10], 1):
                print(f"\n{i}. 分数: {item.get('score', 0):.4f}")
                print(f"   文档ID: {item.get('doc_id', '未知')}")
                print(f"   标题: {item.get('title', '无标题')}")
                
                # 显示内容片段
                content = item.get('content', '')
                if content and len(content) > 100:
                    print(f"   内容: {content[:100]}...")
                elif content:
                    print(f"   内容: {content}")
        
        elif action == 'collections':
            collections = results
            print(f"=== 向量集合列表 ===")
            for i, collection in enumerate(collections, 1):
                print(f"\n{i}. 集合: {collection.get('name', '未知')}")
                print(f"   向量数: {collection.get('vectors_count', 0)}")
                print(f"   维度: {collection.get('vector_size', 0)}")
        
        elif action == 'stats':
            print(f"=== 向量服务统计 ===")
            for key, value in results.items():
                print(f"{key}: {value}")
        
        elif action == 'health':
            print(f"=== 向量服务健康状态 ===")
            for key, value in results.items():
                print(f"{key}: {value}")


def main():
    """命令行入口"""
    parser = argparse.ArgumentParser(description='医疗数据向量搜索工具')
    
    # 操作类型
    parser.add_argument('--action', '-a', default='search',
                       choices=['embed', 'search', 'status', 'collections', 'stats', 'health'],
                       help='操作类型')
    
    # 文本参数
    parser.add_argument('--text', help='文本内容（embed时使用）')
    parser.add_argument('--query', '-q', help='查询文本（search时使用）')
    parser.add_argument('--file', help='文本文件路径（每行一个文本）')
    
    # 搜索参数
    parser.add_argument('--collection', help='向量集合名称')
    parser.add_argument('--top-k', type=int, default=10, help='返回结果数量')
    parser.add_argument('--score-threshold', type=float, help='相似度阈值')
    parser.add_argument('--filter', help='过滤条件（JSON格式）')
    
    # 状态查询
    parser.add_argument('--doc-id', help='文档ID（查询状态时使用）')
    
    # 输出选项
    parser.add_argument('--output', '-o', default='print',
                       choices=['json', 'print'], help='输出格式')
    parser.add_argument('--save', help='保存结果到文件')
    
    # 配置选项
    parser.add_argument('--config', help='配置文件路径')
    parser.add_argument('--api-key', help='API密钥')
    parser.add_argument('--api-base', help='API基础地址')
    
    args = parser.parse_args()
    
    # 初始化客户端
    client = VectorSearchClient(args.config)
    
    # 覆盖配置
    if args.api_key:
        client.config['api_key'] = args.api_key
    if args.api_base:
        client.config['api_base'] = args.api_base
    
    # 根据操作类型执行相应功能
    results = {}
    
    if args.action == 'embed':
        # 文本向量化
        texts = []
        
        if args.text:
            texts = [args.text]
        elif args.file and os.path.exists(args.file):
            with open(args.file, 'r', encoding='utf-8') as f:
                texts = [line.strip() for line in f if line.strip()]
        else:
            parser.error("需要提供 --text 或 --file 参数")
        
        results = client.embed_text(texts)
        
    elif args.action == 'search':
        # 向量搜索
        if not args.query:
            parser.error("需要提供 --query 参数")
        
        search_kwargs = {
            'top_k': args.top_k
        }
        
        if args.collection:
            search_kwargs['collection'] = args.collection
        
        if args.score_threshold:
            search_kwargs['score_threshold'] = args.score_threshold
        
        if args.filter:
            try:
                search_kwargs['filter'] = json.loads(args.filter)
            except json.JSONDecodeError:
                logger.error(f"过滤条件JSON格式错误: {args.filter}")
                search_kwargs['filter'] = {}
        
        results = client.vector_search(args.query, **search_kwargs)
        
    elif args.action == 'status':
        # 查询向量化状态
        if not args.doc_id:
            parser.error("需要提供 --doc-id 参数")
        
        results = client.get_embedding_status(args.doc_id, args.collection)
        
    elif args.action == 'collections':
        # 获取向量集合列表
        results = client.list_collections()
        
    elif args.action == 'stats':
        # 获取向量统计
        results = client.get_vector_stats()
        
    elif args.action == 'health':
        # 检查健康状态
        results = client.get_vector_health()
    
    # 处理结果
    if 'error' in results:
        print(f"操作错误: {results['error']}")
        sys.exit(1)
    
    # 输出结果
    if args.output == 'print':
        client.print_results(results, args.action)
    else:
        output_path = args.save or f"vector_{args.action}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        if args.save:
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(results, f, ensure_ascii=False, indent=2)
            logger.info(f"结果已保存到: {output_path}")
        else:
            print(json.dumps(results, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()