#!/usr/bin/env python3
"""
医疗文档状态监控工具

功能：
1. 监控批量上传文档的处理状态
2. 检查索引完成情况
3. 生成状态报告
4. 发送通知（可选）

使用示例：
python monitor_status.py --doc-ids DOC-001 DOC-002 DOC-003
python monitor_status.py --report report.json --interval 60 --duration 3600
"""

import os
import sys
import json
import time
import argparse
import logging
from typing import List, Dict
import requests
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class StatusMonitor:
    """状态监控器"""
    
    def __init__(self, config_path: str = None):
        """初始化监控器"""
        self.config = self._load_config(config_path)
        self.api_base = self.config.get('api_base', 'http://localhost:48200')
        self.api_key = self.config.get('api_key')
        self.session = requests.Session()
        if self.api_key:
            self.session.headers.update({'X-API-Key': self.api_key})
        
        self.status_history = {}
        
    def _load_config(self, config_path: str = None) -> Dict:
        """加载配置文件"""
        default_config = {
            'api_base': 'http://localhost:48200',
            'api_key': None,
            'monitor_settings': {
                'check_interval': 30,  # 检查间隔（秒）
                'max_checks': 120,     # 最大检查次数
                'timeout': 10          # 请求超时
            }
        }
        
        if config_path and os.path.exists(config_path):
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    user_config = json.load(f)
                default_config.update(user_config)
            except Exception as e:
                logger.error(f"加载配置文件失败: {e}")
        
        return default_config
    
    def check_document_status(self, doc_id: str) -> Dict:
        """检查单个文档状态"""
        try:
            response = self.session.get(
                f"{self.api_base}/api/v1/documents/{doc_id}/status",
                timeout=self.config['monitor_settings']['timeout']
            )
            
            if response.status_code == 200:
                result = response.json()
                data = result['data']
                
                status_info = {
                    'doc_id': doc_id,
                    'status': data['status'],
                    'success': True,
                    'timestamp': datetime.now().isoformat()
                }
                
                # 添加详细状态信息
                if 'parse_result' in data:
                    status_info.update({
                        'page_count': data['parse_result'].get('page_count'),
                        'char_count': data['parse_result'].get('char_count'),
                        'parser': data['parse_result'].get('parser')
                    })
                
                # 检查索引状态
                if 'storage' in data:
                    storage = data['storage']
                    status_info.update({
                        'es_indexed': storage.get('es_indexed', False),
                        'qdrant_indexed': storage.get('qdrant_indexed', False),
                        'iceberg_written': storage.get('iceberg_written', False)
                    })
                
                # 检查是否完全处理完成
                if (data['status'] == 'PARSED' and 
                    status_info.get('es_indexed') and 
                    status_info.get('iceberg_written')):
                    status_info['fully_processed'] = True
                else:
                    status_info['fully_processed'] = False
                
                return status_info
            else:
                return {
                    'doc_id': doc_id,
                    'status': 'ERROR',
                    'error': f"HTTP {response.status_code}: {response.text}",
                    'success': False,
                    'timestamp': datetime.now().isoformat()
                }
                
        except Exception as e:
            return {
                'doc_id': doc_id,
                'status': 'ERROR',
                'error': str(e),
                'success': False,
                'timestamp': datetime.now().isoformat()
            }
    
    def monitor_documents(self, doc_ids: List[str], interval: int = None, max_checks: int = None) -> Dict:
        """监控多个文档状态"""
        if interval is None:
            interval = self.config['monitor_settings']['check_interval']
        if max_checks is None:
            max_checks = self.config['monitor_settings']['max_checks']
        
        all_completed = False
        check_count = 0
        final_status = {}
        
        logger.info(f"📊 开始监控 {len(doc_ids)} 个文档，检查间隔: {interval}秒")
        
        while not all_completed and check_count < max_checks:
            check_count += 1
            logger.info(f"第 {check_count} 次检查...")
            
            current_status = {}
            completed_count = 0
            
            for doc_id in doc_ids:
                status = self.check_document_status(doc_id)
                current_status[doc_id] = status
                
                # 记录历史
                if doc_id not in self.status_history:
                    self.status_history[doc_id] = []
                self.status_history[doc_id].append(status)
                
                # 检查是否完成
                if status.get('fully_processed', False):
                    completed_count += 1
                    if doc_id not in final_status:
                        final_status[doc_id] = status
            
            # 输出当前状态
            self._print_status_summary(current_status, check_count, completed_count, len(doc_ids))
            
            # 检查是否全部完成
            if completed_count == len(doc_ids):
                all_completed = True
                logger.info("✅ 所有文档处理完成！")
                break
            
            # 等待下一次检查
            if check_count < max_checks:
                time.sleep(interval)
        
        # 生成最终报告
        report = self.generate_monitor_report(doc_ids, final_status, check_count, all_completed)
        return report
    
    def _print_status_summary(self, status_dict: Dict, check_count: int, completed: int, total: int):
        """打印状态摘要"""
        print(f"\n📈 检查 #{check_count} - 完成: {completed}/{total}")
        print("-" * 50)
        
        status_counts = {}
        for doc_id, status in status_dict.items():
            stat = status['status']
            status_counts[stat] = status_counts.get(stat, 0) + 1
        
        for stat, count in status_counts.items():
            print(f"  {stat}: {count}个")
        
        # 显示未完成文档
        if completed < total:
            print("\n⏳ 未完成文档:")
            for doc_id, status in status_dict.items():
                if not status.get('fully_processed', False):
                    print(f"  - {doc_id}: {status['status']}")
    
    def generate_monitor_report(self, doc_ids: List[str], final_status: Dict, 
                               check_count: int, all_completed: bool) -> Dict:
        """生成监控报告"""
        report = {
            'timestamp': datetime.now().isoformat(),
            'total_documents': len(doc_ids),
            'completed_documents': len(final_status),
            'all_completed': all_completed,
            'total_checks': check_count,
            'document_status': final_status,
            'summary': {
                'uploaded': 0,
                'parsing': 0,
                'parsed': 0,
                'indexed': 0,
                'error': 0
            }
        }
        
        # 统计状态
        for status in final_status.values():
            stat = status['status']
            if stat in report['summary']:
                report['summary'][stat] += 1
        
        # 保存报告
        report_file = f"monitor_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        logger.info(f"📋 监控报告已保存: {report_file}")
        return report
    
    def load_doc_ids_from_report(self, report_file: str) -> List[str]:
        """从上传报告加载文档ID"""
        try:
            with open(report_file, 'r', encoding='utf-8') as f:
                report = json.load(f)
            
            doc_ids = []
            for item in report.get('uploaded_files', []):
                if 'doc_id' in item:
                    doc_ids.append(item['doc_id'])
            
            logger.info(f"从报告加载了 {len(doc_ids)} 个文档ID")
            return doc_ids
            
        except Exception as e:
            logger.error(f"加载报告失败: {e}")
            return []


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='医疗文档状态监控工具')
    parser.add_argument('--doc-ids', nargs='+', help='文档ID列表')
    parser.add_argument('--report', help='上传报告文件路径，从中提取文档ID')
    parser.add_argument('--interval', type=int, default=30, help='检查间隔（秒）')
    parser.add_argument('--duration', type=int, default=3600, help='监控总时长（秒）')
    parser.add_argument('--config', help='配置文件路径')
    
    args = parser.parse_args()
    
    # 获取文档ID
    doc_ids = []
    if args.doc_ids:
        doc_ids = args.doc_ids
    elif args.report:
        monitor = StatusMonitor(args.config)
        doc_ids = monitor.load_doc_ids_from_report(args.report)
    else:
        logger.error("❌ 必须提供 --doc-ids 或 --report 参数")
        sys.exit(1)
    
    if not doc_ids:
        logger.error("❌ 未找到有效的文档ID")
        sys.exit(1)
    
    # 计算最大检查次数
    max_checks = args.duration // args.interval if args.interval > 0 else 120
    
    # 开始监控
    monitor = StatusMonitor(args.config)
    report = monitor.monitor_documents(
        doc_ids=doc_ids,
        interval=args.interval,
        max_checks=max_checks
    )
    
    # 输出最终结果
    print("\n" + "="*50)
    print("📊 监控完成报告")
    print("="*50)
    print(f"总文档数: {report['total_documents']}")
    print(f"完成文档: {report['completed_documents']}")
    print(f"全部完成: {'是' if report['all_completed'] else '否'}")
    print(f"检查次数: {report['total_checks']}")
    
    if not report['all_completed']:
        print("\n⚠️  未完成文档状态:")
        for doc_id, status in report['document_status'].items():
            if not status.get('fully_processed', False):
                print(f"  - {doc_id}: {status['status']}")


if __name__ == "__main__":
    main()
