# 错误处理指南

## 概述

本文档详细说明医疗文档上传过程中可能遇到的错误及其处理方法。

## 错误分类

### 1. 网络错误
- **连接超时**: 无法连接到API服务器
- **请求超时**: 请求处理时间过长
- **网络中断**: 上传过程中网络断开

### 2. API错误
- **认证失败**: API密钥无效或过期
- **权限不足**: 租户ID无效或权限不足
- **参数错误**: 请求参数格式错误或缺失
- **服务器错误**: API服务器内部错误

### 3. 文件错误
- **文件不存在**: 指定的文件路径无效
- **文件损坏**: 文件格式损坏无法读取
- **文件过大**: 超过大小限制
- **格式不支持**: 文件格式不在支持列表中

### 4. 处理错误
- **解析失败**: 文档内容解析失败
- **索引失败**: 搜索索引建立失败
- **存储失败**: 数据湖写入失败

## 错误代码参考

### HTTP状态码
| 状态码 | 说明 | 处理方法 |
|--------|------|----------|
| 200 | 成功 | 正常处理 |
| 400 | 请求错误 | 检查请求参数 |
| 401 | 未授权 | 检查API密钥 |
| 403 | 禁止访问 | 检查权限配置 |
| 404 | 资源不存在 | 检查URL和资源ID |
| 422 | 参数验证失败 | 检查请求数据格式 |
| 429 | 请求过多 | 降低请求频率 |
| 500 | 服务器错误 | 联系管理员 |
| 503 | 服务不可用 | 等待服务恢复 |

### 平台错误码
| 错误码 | 说明 | 可能原因 |
|--------|------|----------|
| BAD_REQUEST | 请求参数错误 | 参数缺失或格式错误 |
| UNAUTHORIZED | 未授权 | API密钥无效 |
| FORBIDDEN | 无权限 | 租户权限不足 |
| NOT_FOUND | 资源不存在 | 文档ID无效 |
| VALIDATION_ERROR | 验证失败 | 文件格式不支持 |
| INTERNAL_ERROR | 服务器错误 | 系统内部问题 |
| SERVICE_UNAVAILABLE | 服务不可用 | 依赖服务故障 |

## 错误处理策略

### 重试策略

#### 1. 指数退避重试
```python
def upload_with_retry(file_path, max_retries=3):
    base_delay = 5  # 基础延迟5秒
    
    for attempt in range(max_retries):
        try:
            return upload_file(file_path)
        except (requests.exceptions.Timeout, 
                requests.exceptions.ConnectionError) as e:
            if attempt < max_retries - 1:
                wait_time = base_delay * (2 ** attempt)  # 指数退避
                time.sleep(wait_time)
                continue
            else:
                raise e
```

#### 2. 分类重试
```python
def smart_retry(error):
    """根据错误类型决定是否重试"""
    if isinstance(error, requests.exceptions.Timeout):
        return True  # 超时可重试
    elif isinstance(error, requests.exceptions.HTTPError):
        if error.response.status_code in [429, 500, 502, 503, 504]:
            return True  # 服务器错误可重试
        elif error.response.status_code in [400, 401, 403, 404]:
            return False  # 客户端错误不重试
    return False
```

### 错误恢复

#### 1. 断点续传
```python
def resume_upload(failed_files, checkpoint_file="checkpoint.json"):
    """从检查点恢复上传"""
    if os.path.exists(checkpoint_file):
        with open(checkpoint_file, 'r') as f:
            checkpoint = json.load(f)
        
        # 跳过已成功的文件
        uploaded_files = checkpoint.get('uploaded_files', [])
        remaining_files = [f for f in failed_files 
                          if f not in uploaded_files]
        
        return remaining_files
    return failed_files
```

#### 2. 部分成功处理
```python
def handle_partial_success(results):
    """处理部分成功的情况"""
    successful = [r for r in results if r['success']]
    failed = [r for r in results if not r['success']]
    
    if successful:
        # 继续监控成功文档
        monitor_documents([r['doc_id'] for r in successful])
    
    if failed:
        # 记录失败信息供后续处理
        save_failed_records(failed)
        # 可选：尝试重新上传失败文件
        retry_failed_files(failed)
    
    return successful, failed
```

## 常见错误场景及解决方案

### 场景1: API密钥无效
**错误信息**: `401 Unauthorized`
**解决方案**:
1. 检查配置文件中的`api_key`
2. 验证API密钥是否过期
3. 联系管理员获取新密钥

```python
# 验证API密钥
def validate_api_key():
    try:
        response = requests.get(f"{api_base}/health", 
                              headers={"X-API-Key": api_key})
        return response.status_code == 200
    except:
        return False
```

### 场景2: 文件过大
**错误信息**: `413 Payload Too Large`
**解决方案**:
1. 压缩文件（如PDF压缩）
2. 分割大文件
3. 调整服务器配置

```python
def compress_pdf(input_path, output_path):
    """压缩PDF文件"""
    # 使用ghostscript或其他工具压缩
    pass

def split_large_file(file_path, max_size_mb=50):
    """分割大文件"""
    file_size_mb = os.path.getsize(file_path) / (1024 * 1024)
    if file_size_mb > max_size_mb:
        # 分割逻辑
        pass
```

### 场景3: 解析失败
**错误信息**: 状态一直为`PARSING`或转为`FAILED`
**解决方案**:
1. 尝试不同解析器
2. 检查文件格式
3. 转换为标准格式

```python
def try_different_parsers(file_path):
    """尝试不同解析器"""
    parsers = ['auto', 'mineru2', 'pypdf2']
    
    for parser in parsers:
        result = upload_file(file_path, parser=parser)
        if result['success']:
            return result
    
    return {'success': False, 'error': '所有解析器都失败'}
```

### 场景4: 网络不稳定
**错误信息**: `ConnectionError` 或 `Timeout`
**解决方案**:
1. 增加超时时间
2. 实现断点续传
3. 使用更稳定的网络

```python
def upload_with_resume(file_path, chunk_size=1024*1024):  # 1MB chunks
    """分块上传支持断点续传"""
    file_size = os.path.getsize(file_path)
    uploaded = 0
    
    with open(file_path, 'rb') as f:
        while uploaded < file_size:
            chunk = f.read(chunk_size)
            # 上传分块并记录进度
            upload_chunk(chunk, uploaded, file_size)
            uploaded += len(chunk)
```

## 错误日志记录

### 日志格式
```python
import logging
import json
from datetime import datetime

def setup_logging():
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[
            logging.FileHandler(f'upload_errors_{datetime.now():%Y%m%d}.log'),
            logging.StreamHandler()
        ]
    )
```

### 结构化错误日志
```python
def log_structured_error(error_type, file_path, error_details, context=None):
    """记录结构化错误日志"""
    error_log = {
        'timestamp': datetime.now().isoformat(),
        'error_type': error_type,
        'file_path': file_path,
        'error_details': str(error_details),
        'context': context or {},
        'retry_count': 0
    }
    
    with open('error_log.jsonl', 'a') as f:
        f.write(json.dumps(error_log) + '\n')
```

## 监控和告警

### 错误率监控
```python
class ErrorMonitor:
    def __init__(self, error_threshold=0.1):
        self.total_requests = 0
        self.error_count = 0
        self.error_threshold = error_threshold
    
    def record_request(self, success):
        self.total_requests += 1
        if not success:
            self.error_count += 1
        
        error_rate = self.error_count / self.total_requests
        if error_rate > self.error_threshold:
            self.trigger_alert(error_rate)
    
    def trigger_alert(self, error_rate):
        """触发告警"""
        alert_message = f"错误率过高: {error_rate:.1%}"
        send_alert(alert_message)
```

### 健康检查
```python
def health_check():
    """系统健康检查"""
    checks = [
        check_api_connectivity,
        check_disk_space,
        check_memory_usage,
        check_network_latency
    ]
    
    results = {}
    for check in checks:
        try:
            results[check.__name__] = check()
        except Exception as e:
            results[check.__name__] = {'status': 'ERROR', 'error': str(e)}
    
    return results
```

## 用户友好的错误信息

### 错误信息映射
```python
ERROR_MESSAGES = {
    'UNAUTHORIZED': 'API密钥无效，请检查配置',
    'NOT_FOUND': '文档不存在或已被删除',
    'VALIDATION_ERROR': '文件格式不支持，请检查文件类型',
    'SERVICE_UNAVAILABLE': '服务暂时不可用，请稍后重试',
    'INTERNAL_ERROR': '服务器内部错误，请联系管理员'
}

def get_user_friendly_error(error_code):
    """获取用户友好的错误信息"""
    return ERROR_MESSAGES.get(error_code, '未知错误，请查看日志')
```

### 错误恢复建议
```python
RECOVERY_SUGGESTIONS = {
    'network_error': [
        '检查网络连接',
        '尝试使用有线网络',
        '减少并发上传数量'
    ],
    'file_error': [
        '检查文件是否损坏',
        '尝试重新下载文件',
        '转换为PDF格式再上传'
    ],
    'api_error': [
        '验证API配置',
        '检查服务状态',
        '联系技术支持'
    ]
}
```

## 测试用例

### 错误场景测试
```python
import pytest

def test_upload_errors():
    """测试各种错误场景"""
    # 测试无效API密钥
    with pytest.raises(requests.exceptions.HTTPError) as e:
        upload_with_invalid_key()
    assert e.value.response.status_code == 401
    
    # 测试文件过大
    with pytest.raises(requests.exceptions.HTTPError) as e:
        upload_large_file()
    assert e.value.response.status_code == 413
    
    # 测试网络超时
    with pytest.raises(requests.exceptions.Timeout):
        upload_with_timeout()
```

### 恢复测试
```python
def test_error_recovery():
    """测试错误恢复功能"""
    # 模拟网络中断
    interrupt_network()
    
    # 尝试上传
    result = upload_with_retry(test_file)
    
    # 恢复网络
    restore_network()
    
    # 验证恢复后能成功上传
    assert result['success'] == True
```

## 最佳实践

### 1. 防御性编程
- 验证所有输入参数
- 检查文件完整性
- 处理边界情况

### 2. 优雅降级
- 部分功能失败不影响整体流程
- 提供替代方案
- 记录详细日志供后续修复

### 3. 监控和告警
- 实时监控错误率
- 设置合理的阈值
- 及时通知相关人员

### 4. 用户反馈
- 提供清晰的错误信息
- 给出恢复建议
- 记录用户操作历史

## 工具和资源

### 内置工具
1. **错误日志分析脚本**: 分析错误日志，找出常见问题
2. **健康检查工具**: 定期检查系统健康状况
3. **恢复工具**: 自动恢复失败的上传任务

### 外部工具
1. **Sentry**: 错误监控和告警
2. **Prometheus**: 系统监控和指标收集
3. **ELK Stack**: 日志分析和可视化