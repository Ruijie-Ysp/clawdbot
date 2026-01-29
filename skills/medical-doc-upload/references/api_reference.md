# 医疗数据湖平台 API 参考文档

## 概述

医疗数据湖平台提供完整的文档管理API，支持文档上传、解析、索引和检索功能。

## API 基础信息

### 基础URL
- **开发环境**: `http://localhost:48200`
- **测试环境**: `http://test-api.example.com`
- **生产环境**: `https://api.example.com`

### 认证方式
- **Header**: `X-API-Key: <your_api_key>`
- **Header**: `X-Tenant-ID: <tenant_id>` (可选，默认: `default`)

### 响应格式
```json
{
  "success": true,
  "code": "SUCCESS",
  "message": "操作成功",
  "data": { ... },
  "timestamp": "2026-01-27T10:30:00.123Z",
  "request_id": "uuid"
}
```

## 核心API端点

### 1. 文档上传
**POST** `/api/v1/documents/upload`

**Content-Type**: `multipart/form-data`

**参数**:
| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `file` | File | 是 | 文档文件 |
| `category` | string | 是 | 文档分类 |
| `title` | string | 否 | 文档标题 |
| `project_id` | string | 否 | 项目ID |
| `task_id` | string | 否 | 任务ID |
| `callback_url` | string | 否 | 回调地址 |
| `priority` | string | 否 | 优先级: high/normal/low |
| `parser` | string | 否 | 解析器: auto/pypdf2/mineru2 |

**响应**:
```json
{
  "data": {
    "doc_id": "DOC-20260127-001",
    "status": "UPLOADED",
    "status_url": "/api/v1/documents/DOC-20260127-001/status"
  }
}
```

### 2. 文档状态查询
**GET** `/api/v1/documents/{doc_id}/status`

**响应**:
```json
{
  "data": {
    "doc_id": "DOC-20260127-001",
    "status": "PARSED",
    "storage": {
      "es_indexed": true,
      "qdrant_indexed": true,
      "iceberg_written": true
    }
  }
}
```

### 3. 文档详情
**GET** `/api/v1/documents/{doc_id}`

### 4. 文档列表
**GET** `/api/v1/documents?page=1&size=20&category=医学文献`

### 5. 文档内容检索
**POST** `/api/v1/documents/{doc_id}/content/search`

## 文档处理状态

### 状态流转
```
UPLOADED → PARSING → PARSED → INDEXING → COMPLETED
```

### 状态说明
- **UPLOADED**: 文件已上传到存储
- **PARSING**: 正在解析文档内容
- **PARSED**: 文档解析完成
- **INDEXING**: 正在建立索引
- **COMPLETED**: 完全处理完成（ES + Iceberg）

## 错误码

| HTTP状态码 | 错误码 | 说明 |
|------------|--------|------|
| 200 | SUCCESS | 成功 |
| 400 | BAD_REQUEST | 请求参数错误 |
| 401 | UNAUTHORIZED | 未授权 |
| 403 | FORBIDDEN | 无权限 |
| 404 | NOT_FOUND | 资源不存在 |
| 422 | VALIDATION_ERROR | 参数验证失败 |
| 500 | INTERNAL_ERROR | 服务器错误 |

## 文件格式支持

### 支持的文件类型
- **PDF文档**: `.pdf`
- **Word文档**: `.doc`, `.docx`
- **Excel文档**: `.xlsx`, `.xls`
- **文本文件**: `.txt`, `.md`

### 文件大小限制
- 默认: 100MB
- 可在配置中调整

## 最佳实践

### 批量上传
1. 使用分类管理文档
2. 设置合适的优先级
3. 使用回调通知处理完成
4. 监控处理状态

### 错误处理
1. 实现重试机制（建议3次）
2. 记录详细的错误日志
3. 提供用户友好的错误信息

### 性能优化
1. 控制并发上传数量（建议5-10个）
2. 使用压缩格式减少传输大小
3. 分批处理大量文件

## 配置示例

### Python客户端配置
```python
config = {
    "api_base": "http://localhost:48200",
    "api_key": "your_api_key",
    "tenant_id": "default",
    "upload_options": {
        "priority": "normal",
        "parser": "auto"
    }
}
```

### Shell环境变量
```bash
export MEDICAL_API_KEY="your_api_key"
export MEDICAL_API_BASE="http://localhost:48200"
```

## 常见问题

### Q: 如何获取API密钥？
A: 查看项目`.env`文件中的`API_KEYS`配置。

### Q: 上传后文档多久可用？
A: 取决于文档大小和复杂度，通常：
- 小文件（<10MB）: 1-2分钟
- 中等文件（10-50MB）: 3-5分钟
- 大文件（>50MB）: 5-10分钟

### Q: 如何检查文档是否完全索引？
A: 检查状态接口中的`storage`字段：
```json
"storage": {
  "es_indexed": true,
  "iceberg_written": true
}
```

### Q: 支持哪些解析器？
A: 
- `auto`: 自动选择最佳解析器
- `pypdf2`: 适用于简单PDF
- `mineru2`: 高级解析器，支持复杂布局

## 相关资源
- [统一API接口规范](../统一API接口规范-v2.md)
- [连接配置速查表](../连接配置速查表.md)
- [OpenAPI规范](../openapi.json)
