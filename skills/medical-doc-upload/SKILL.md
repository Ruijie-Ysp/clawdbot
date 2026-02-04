---
name: medical-doc-upload
description: 医疗数据湖平台的文档批量上传和管理技能。当用户需要：1) 批量上传医疗文献到数据湖平台 2) 监控文档处理状态 3) 管理医疗文档分类 4) 处理PDF、Word、Excel等医疗文档格式时使用此技能。支持断点续传、错误重试、状态监控和报告生成。
---

# 医疗文档上传技能

## 概述

本技能提供医疗数据湖平台的完整文档上传解决方案，包括批量上传、状态监控、错误处理和报告生成功能。适用于医疗研究机构、医院信息科、医学图书馆等需要批量处理医疗文献的场景。

## 快速开始

### 1. 环境准备

```bash
# 安装Python依赖
pip install requests

# 设置API密钥环境变量（可选）
export MEDICAL_API_KEY="your_api_key"
```

### 2. 基本使用

#### 使用Python脚本

```bash
# 批量上传文件夹
python scripts/batch_upload.py --folder /path/to/documents --category "临床指南"

# 带项目信息上传
python scripts/batch_upload.py --folder /path/to/documents \
  --category "药品说明书" \
  --project-id "P001" \
  --task-id "T001" \
  --priority "high"
```

#### 使用Shell脚本

```bash
# 简化版上传
chmod +x scripts/upload_folder.sh
./scripts/upload_folder.sh /path/to/documents

# 带参数上传
./scripts/upload_folder.sh -c "临床指南" --project P001 /path/to/documents
```

### 3. 监控状态

```bash
# 监控上传的文档
python scripts/monitor_status.py --report upload_report_*.json

# 指定文档ID监控
python scripts/monitor_status.py --doc-ids DOC-001 DOC-002 DOC-003
```

## 核心功能

### 1. 批量上传

- **支持格式**: PDF、Word、Excel、TXT、MD
- **分类管理**: 临床指南、医学文献、药品说明书等
- **优先级控制**: high/normal/low 三级优先级
- **解析器选择**: auto/pypdf2/mineru2

### 2. 状态监控

- **实时监控**: 定期检查文档处理状态
- **进度跟踪**: 显示处理进度和预计完成时间
- **完成验证**: 验证ES和Iceberg索引状态
- **报告生成**: 生成详细的状态报告

### 3. 错误处理

- **自动重试**: 指数退避重试机制
- **断点续传**: 支持从失败点继续上传
- **错误分类**: 网络错误、API错误、文件错误分类处理
- **详细日志**: 结构化错误日志记录

### 4. 配置管理

- **配置文件**: JSON格式配置文件
- **环境变量**: 支持环境变量覆盖
- **多环境**: 开发、测试、生产环境配置
- **安全存储**: API密钥安全管理

## 详细工作流程

### 步骤1: 准备文档

1. 确保文档为支持格式
2. 按分类组织文件夹
3. 检查文件完整性

### 步骤2: 配置连接

1. 创建配置文件或设置环境变量
2. 验证API连接
3. 测试上传权限

### 步骤3: 批量上传

1. 选择分类和优先级
2. 开始批量上传
3. 保存上传报告

### 步骤4: 监控状态

1. 自动监控处理进度
2. 检查索引完成状态
3. 生成监控报告

### 步骤5: 验证结果

1. 验证搜索功能
2. 检查数据完整性
3. 归档处理记录

## API密钥管理

### 获取API密钥

API密钥存储在医疗数据湖平台的`.env`文件中：

```bash
# 查看API密钥
grep API_KEYS /path/to/kafka/.env
```

### 配置方式

#### 方式1: 配置文件

创建 `config.json`:

```json
{
  "api_base": "http://localhost:48200",
  "api_key": "your_api_key_here",
  "tenant_id": "default"
}
```

#### 方式2: 环境变量

```bash
export MEDICAL_API_KEY="your_api_key"
export MEDICAL_API_BASE="http://localhost:48200"
```

#### 方式3: 命令行参数

```bash
python batch_upload.py --folder /path/to/documents --api-key "your_key"
```

### 安全建议

1. **不要硬编码**: 避免在代码中硬编码API密钥
2. **环境变量优先**: 使用环境变量存储敏感信息
3. **配置文件加密**: 敏感配置文件可加密存储
4. **定期轮换**: 定期更换API密钥

## 脚本说明

### batch_upload.py

**功能**: 批量上传医疗文档
**参数**:

- `--folder`: 要上传的文件夹路径
- `--category`: 文档分类
- `--config`: 配置文件路径
- `--project-id`: 项目ID
- `--task-id`: 任务ID
- `--priority`: 优先级 (high/normal/low)
- `--parser`: 解析器 (auto/pypdf2/mineru2)

### monitor_status.py

**功能**: 监控文档处理状态
**参数**:

- `--doc-ids`: 文档ID列表
- `--report`: 上传报告文件路径
- `--interval`: 检查间隔（秒）
- `--duration`: 监控总时长（秒）

### upload_folder.sh

**功能**: Shell包装脚本，简化上传操作
**特点**:

- 自动检查依赖
- 彩色输出
- 错误处理
- 进度显示

## 配置文件

### 配置模板

见 `assets/config-template.json`，包含：

- API连接配置
- 上传选项
- 重试设置
- 文件扩展名
- 分类定义

### 配置继承

配置按以下优先级应用：

1. 命令行参数
2. 环境变量
3. 配置文件
4. 默认值

## 错误处理

### 常见错误

1. **401 Unauthorized**: API密钥无效
2. **413 Payload Too Large**: 文件过大
3. **422 Validation Error**: 文件格式不支持
4. **500 Internal Error**: 服务器错误

### 处理策略

- **自动重试**: 网络错误自动重试3次
- **错误分类**: 区分可重试和不可重试错误
- **用户反馈**: 提供清晰的错误信息
- **日志记录**: 详细记录错误上下文

## 性能优化

### 上传优化

- **并发控制**: 建议5-10个并发上传
- **分块上传**: 大文件分块上传
- **压缩传输**: 启用GZIP压缩
- **连接复用**: HTTP连接池

### 监控优化

- **批量查询**: 批量检查文档状态
- **缓存结果**: 缓存已完成的文档状态
- **智能轮询**: 根据处理阶段调整检查频率

## 集成示例

### 与Clawdbot集成

```python
# 在Clawdbot技能中调用上传功能
from scripts.batch_upload import MedicalDocUploader

def handle_medical_upload(folder_path, category):
    uploader = MedicalDocUploader()
    report = uploader.upload_folder(folder_path, category)
    return report
```

### 自动化工作流

```bash
# 每日定时上传
0 2 * * * /path/to/medical-doc-upload/scripts/upload_folder.sh /daily/documents

# 监控并发送通知
*/5 * * * * /path/to/medical-doc-upload/scripts/monitor_status.py --report latest_report.json
```

## 参考文档

详细文档请参考：

- [API参考文档](references/api_reference.md) - 完整的API接口说明
- [工作流程指南](references/workflow_guide.md) - 详细的操作步骤
- [错误处理指南](references/error_handling.md) - 错误处理和恢复策略

## 支持与反馈

### 问题排查

1. 检查 `upload.log` 日志文件
2. 验证API连接状态
3. 查看错误报告文件

### 获取帮助

- 查看参考文档中的常见问题
- 检查错误处理指南
- 联系系统管理员

---

**注意**: 使用前请确保已获取有效的API密钥，并正确配置API连接信息。
