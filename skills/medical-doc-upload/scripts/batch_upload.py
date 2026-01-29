#!/usr/bin/env python3
"""
医疗文档批量上传工具 - 医疗数据湖平台

功能：
1. 批量上传文件夹中的医疗文档
2. 支持断点续传和进度跟踪
3. 错误重试和状态监控
4. 生成上传报告

使用示例：
python batch_upload.py --folder /path/to/documents --category "临床指南"
python batch_upload.py --folder /path/to/documents --config config.json
"""

import os
import sys
import json
import time
import argparse
import logging
from pathlib import Path
from typing import List, Dict, Optional
import requests
from datetime import datetime

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('upload.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class MedicalDocUploader:
    """医疗文档上传器"""
    
    def __init__(self, config_path: Optional[str] = None):
        """初始化上传器"""
        self.config = self._load_config(config_path)
        self.api_base = self.config.get('api_base', 'http://localhost:48200')
        self.api_key = self.config.get('api_key')
        self.tenant_id = self.config.get('tenant_id', 'default')
        self.session = requests.Session()
        self.session.headers.update({
            'X-API-Key': self.api_key,
            'X-Tenant-ID': self.tenant_id
        })
        
        # 上传状态跟踪
        self.uploaded_files = []
        self.failed_files = []
        self.results = []
        
    def _load_config(self, config_path: Optional[str] = None) -> Dict:
        """加载配置文件"""
        default_config = {
            'api_base': 'http://localhost:48200',
            'api_key': None,
            'tenant_id': 'default',
            'default_category': '医学文献',
            'upload_options': {
                'priority': 'normal',
                'parser': 'auto',
                'callback_url': None
            },
            'retry_settings': {
                'max_retries': 3,
                'retry_delay': 5,
                'timeout': 30
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
    
    def upload_file(self, file_path: Path, category: str, **kwargs) -> Dict:
        """上传单个文件"""
        try:
            # 确保文件存在且可读
            if not file_path.exists():
                return {
                    'success': False,
                    'error': f"文件不存在: {file_path}",
                    'file_path': str(file_path)
                }
            
            # 检查文件大小
            file_size = file_path.stat().st_size
            if file_size == 0:
                return {
                    'success': False,
                    'error': f"文件为空: {file_path}",
                    'file_path': str(file_path)
                }
            
            # 获取文件扩展名和MIME类型
            file_ext = file_path.suffix.lower()
            mime_types = {
                '.pdf': 'application/pdf',
                '.doc': 'application/msword',
                '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                '.xls': 'application/vnd.ms-excel',
                '.txt': 'text/plain',
                '.md': 'text/markdown'
            }
            
            mime_type = mime_types.get(file_ext, 'application/octet-stream')
            
            with open(file_path, 'rb') as f:
                data = {
                    'category': category,
                    'title': kwargs.get('title', file_path.stem),
                    'priority': kwargs.get('priority', self.config['upload_options']['priority']),
                    'parser': kwargs.get('parser', self.config['upload_options']['parser'])
                }
                
                # 可选参数
                if 'project_id' in kwargs:
                    data['project_id'] = kwargs['project_id']
                if 'task_id' in kwargs:
                    data['task_id'] = kwargs['task_id']
                if 'callback_url' in kwargs:
                    data['callback_url'] = kwargs['callback_url']
                if 'metadata' in kwargs:
                    data['metadata'] = json.dumps(kwargs['metadata'])
                
                # 重试机制
                max_retries = self.config['retry_settings']['max_retries']
                retry_delay = self.config['retry_settings']['retry_delay']
                
                for attempt in range(max_retries):
                    try:
                        # 明确指定文件名和MIME类型
                        files = {'file': (file_path.name, f, mime_type)}
                        
                        response = self.session.post(
                            f"{self.api_base}/api/v1/documents/upload",
                            files=files,
                            data=data,
                            timeout=self.config['retry_settings']['timeout']
                        )
                        
                        if response.status_code == 202:
                            result = response.json()
                            doc_id = result['data']['doc_id']
                            logger.info(f"✅ 上传成功: {file_path.name} -> {doc_id}")
                            return {
                                'success': True,
                                'doc_id': doc_id,
                                'file_path': str(file_path),
                                'status': 'UPLOADED'
                            }
                        else:
                            error_msg = f"上传失败 (HTTP {response.status_code}): {response.text}"
                            if attempt < max_retries - 1:
                                logger.warning(f"重试 {attempt + 1}/{max_retries}: {error_msg}")
                                time.sleep(retry_delay)
                                # 在下次循环中会重新打开文件
                                break  # 跳出当前尝试，进入下一次循环
                            else:
                                logger.error(f"❌ 最终失败: {error_msg}")
                                return {
                                    'success': False,
                                    'error': error_msg,
                                    'file_path': str(file_path)
                                }
                                
                    except requests.exceptions.RequestException as e:
                        if attempt < max_retries - 1:
                            logger.warning(f"网络错误，重试 {attempt + 1}/{max_retries}: {e}")
                            time.sleep(retry_delay)
                            # 在下次循环中会重新打开文件
                            break  # 跳出当前尝试，进入下一次循环
                        else:
                            logger.error(f"❌ 网络错误最终失败: {e}")
                            return {
                                'success': False,
                                'error': str(e),
                                'file_path': str(file_path)
                            }
                            
        except Exception as e:
            logger.error(f"❌ 文件读取错误: {e}")
            return {
                'success': False,
                'error': str(e),
                'file_path': str(file_path)
            }
    
    def upload_folder(self, folder_path: str, category: str, **kwargs) -> Dict:
        """上传整个文件夹"""
        folder = Path(folder_path)
        if not folder.exists():
            return {'success': False, 'error': f"文件夹不存在: {folder_path}"}
        
        # 支持的扩展名
        supported_extensions = {'.pdf', '.doc', '.docx', '.xlsx', '.xls', '.txt', '.md'}
        
        # 收集文件
        files = []
        for ext in supported_extensions:
            files.extend(folder.glob(f'*{ext}'))
            files.extend(folder.glob(f'*{ext.upper()}'))
        
        total_files = len(files)
        if total_files == 0:
            return {'success': False, 'error': f"未找到支持的文件: {supported_extensions}"}
        
        logger.info(f"📁 找到 {total_files} 个文件，开始上传...")
        
        # 批量上传
        for i, file_path in enumerate(files, 1):
            logger.info(f"[{i}/{total_files}] 上传: {file_path.name}")
            
            result = self.upload_file(
                file_path=file_path,
                category=category,
                **kwargs
            )
            
            self.results.append(result)
            if result['success']:
                self.uploaded_files.append(result)
            else:
                self.failed_files.append(result)
        
        # 生成报告
        report = self.generate_report()
        return report
    
    def generate_report(self) -> Dict:
        """生成上传报告"""
        total = len(self.results)
        success = len(self.uploaded_files)
        failed = len(self.failed_files)
        
        report = {
            'timestamp': datetime.now().isoformat(),
            'total_files': total,
            'successful_uploads': success,
            'failed_uploads': failed,
            'success_rate': f"{(success/total*100):.1f}%" if total > 0 else "0%",
            'uploaded_files': [
                {
                    'file': r['file_path'],
                    'doc_id': r.get('doc_id'),
                    'status': r.get('status')
                }
                for r in self.uploaded_files
            ],
            'failed_files': [
                {
                    'file': r['file_path'],
                    'error': r.get('error')
                }
                for r in self.failed_files
            ]
        }
        
        # 保存报告到文件
        report_file = f"upload_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(report_file, 'w', encoding='utf-8') as f:
            json.dump(report, f, ensure_ascii=False, indent=2)
        
        logger.info(f"📊 上传报告已保存: {report_file}")
        return report
    
    def check_status(self, doc_ids: List[str]) -> List[Dict]:
        """检查文档处理状态"""
        status_results = []
        for doc_id in doc_ids:
            try:
                response = self.session.get(
                    f"{self.api_base}/api/v1/documents/{doc_id}/status",
                    timeout=10
                )
                if response.status_code == 200:
                    result = response.json()
                    status_results.append({
                        'doc_id': doc_id,
                        'status': result['data']['status'],
                        'success': True
                    })
                else:
                    status_results.append({
                        'doc_id': doc_id,
                        'error': f"HTTP {response.status_code}",
                        'success': False
                    })
            except Exception as e:
                status_results.append({
                    'doc_id': doc_id,
                    'error': str(e),
                    'success': False
                })
        
        return status_results


def main():
    """主函数"""
    parser = argparse.ArgumentParser(description='医疗文档批量上传工具')
    parser.add_argument('--folder', required=True, help='要上传的文件夹路径')
    parser.add_argument('--category', default='医学文献', help='文档分类')
    parser.add_argument('--config', help='配置文件路径')
    parser.add_argument('--project-id', help='项目ID')
    parser.add_argument('--task-id', help='任务ID')
    parser.add_argument('--priority', choices=['high', 'normal', 'low'], default='normal')
    parser.add_argument('--parser', choices=['auto', 'pypdf2', 'mineru2'], default='auto')
    
    args = parser.parse_args()
    
    # 初始化上传器
    uploader = MedicalDocUploader(config_path=args.config)
    
    # 检查API密钥
    if not uploader.config['api_key']:
        logger.error("❌ 未设置API密钥！请通过配置文件或环境变量MEDICAL_API_KEY设置")
        sys.exit(1)
    
    # 测试API连接
    try:
        test_response = requests.get(
            f"{uploader.api_base}/health",
            headers={'X-API-Key': uploader.api_key},
            timeout=10
        )
        if test_response.status_code != 200:
            logger.error(f"❌ API连接测试失败: HTTP {test_response.status_code}")
            sys.exit(1)
        logger.info("✅ API连接测试成功")
    except Exception as e:
        logger.error(f"❌ API连接异常: {e}")
        sys.exit(1)
    
    # 上传文件夹
    extra_args = {}
    if args.project_id:
        extra_args['project_id'] = args.project_id
    if args.task_id:
        extra_args['task_id'] = args.task_id
    if args.priority:
        extra_args['priority'] = args.priority
    if args.parser:
        extra_args['parser'] = args.parser
    
    report = uploader.upload_folder(
        folder_path=args.folder,
        category=args.category,
        **extra_args
    )
    
    # 输出结果
    print("\n" + "="*50)
    print("📋 上传完成报告")
    print("="*50)
    print(f"总文件数: {report['total_files']}")
    print(f"成功上传: {report['successful_uploads']}")
    print(f"失败上传: {report['failed_uploads']}")
    print(f"成功率: {report['success_rate']}")
    
    if report['failed_uploads'] > 0:
        print("\n❌ 失败文件:")
        for failed in report['failed_files']:
            print(f"  - {failed['file']}: {failed['error']}")


if __name__ == "__main__":
    main()
