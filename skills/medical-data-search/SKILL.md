---
name: medical-data-search
description: 医疗数据湖平台的智能搜索技能。当用户需要：1) 搜索医疗文献、病历、影像数据 2) 执行混合检索（关键词+语义） 3) 进行SQL查询 4) 向量相似搜索 5) 获取数据湖统计信息时使用此技能。支持多条件组合搜索、分页查询、聚合统计和结果导出。
---

# 医疗数据搜索技能

## 概述

本技能提供医疗数据湖平台的完整搜索解决方案，包括统一搜索、混合检索、SQL查询、向量搜索等功能。适用于医疗研究人员、临床医生、数据分析师等需要快速检索和分析医疗数据的场景。

## 快速开始

### 1. 环境准备
```bash
# 安装Python依赖
pip install requests pandas

# 设置API密钥环境变量（可选）
export MEDICAL_API_KEY="your_api_key"
```

### 2. 基本使用

#### 统一搜索
```bash
# 搜索医疗文献
python scripts/unified_search.py --query "糖尿病治疗" --data-types document

# 多条件搜索
python scripts/unified_search.py --query "高血压" \
  --category "临床指南" \
  --author "张三" \
  --date-from "2025-01-01" \
  --date-to "2026-12-31"
```

#### 混合检索（关键词+语义）
```bash
# 混合模式搜索
python scripts/hybrid_search.py --query "糖尿病并发症预防" --mode hybrid

# 仅语义搜索
python scripts/hybrid_search.py --query "心血管疾病风险因素" --mode semantic

# 仅关键词搜索
python scripts/hybrid_search.py --query "CT检查报告" --mode keyword
```

#### SQL查询
```bash
# 执行SQL查询
python scripts/sql_query.py --sql "SELECT * FROM iceberg.bronze.ods_documents_parsed LIMIT 10"

# 查询特定表
python scripts/sql_query.py --sql "SELECT title, author, category FROM iceberg.bronze.ods_documents_parsed WHERE category='临床指南'"
```

#### 向量搜索
```bash
# 文本向量化
python scripts/vector_search.py --text "糖尿病胰岛素治疗方案" --action embed

# 相似搜索
python scripts/vector_search.py --query "高血压药物副作用" --top-k 10

# 指定集合搜索
python scripts/vector_search.py --query "CT影像分析" --collection medical_documents
```

## 核心功能

### 1. 统一搜索
- **多数据类型**: 文献、病历、影像数据统一搜索
- **多条件组合**: 支持标题、作者、分类、关键词、日期范围等组合查询
- **分页查询**: 支持分页和排序
- **聚合统计**: 返回分类、科室、检查类型等聚合统计

### 2. 混合检索
- **三种模式**: hybrid（混合）、keyword（关键词）、semantic（语义）
- **智能融合**: 使用RRF算法融合关键词和语义搜索结果
- **相关性排序**: 智能排序返回最相关结果
- **性能优化**: 并行查询，快速响应

### 3. SQL查询
- **联邦查询**: 支持跨数据源JOIN查询
- **数据目录**: 支持多数据目录查询
- **复杂查询**: 支持子查询、窗口函数等高级SQL功能
- **结果导出**: 支持JSON/CSV格式导出

### 4. 向量搜索
- **文本向量化**: 将文本转换为向量表示
- **相似搜索**: 基于向量相似度的语义搜索
- **多集合**: 支持多个向量集合
- **过滤条件**: 支持元数据过滤

### 5. 数据湖查询
- **表结构查询**: 获取数据湖表结构信息
- **快照查询**: 支持Time Travel查询历史版本
- **数据导出**: 支持JSON/CSV格式数据导出
- **统计信息**: 获取表行数、文件数等统计信息

## 详细工作流程

### 步骤1: 确定搜索需求
1. 确定搜索的数据类型（文献/病历/影像）
2. 明确搜索关键词和条件
3. 选择搜索模式（统一/混合/SQL/向量）

### 步骤2: 配置搜索参数
1. 设置API连接信息
2. 配置搜索条件
3. 设置分页和排序参数

### 步骤3: 执行搜索
1. 调用相应的搜索接口
2. 处理搜索结果
3. 解析返回数据

### 步骤4: 分析结果
1. 查看搜索结果
2. 分析聚合统计
3. 导出或进一步处理数据

### 步骤5: 优化搜索
1. 根据结果调整搜索条件
2. 尝试不同的搜索模式
3. 保存常用搜索模板

## API密钥管理

### 获取API密钥
API密钥存储在医疗数据湖平台的`.env`文件中：
```bash
# 查看API密钥
grep API_KEYS /path/to/kafka/.env
```

### 配置方式

#### 方式1: 配置文件
创建 `search_config.json`:
```json
{
  "api_base": "http://localhost:48200",
  "api_key": "your_api_key_here",
  "tenant_id": "default",
  "search_options": {
    "default_page_size": 20,
    "timeout": 30,
    "retry_times": 3
  }
}
```

#### 方式2: 环境变量
```bash
export MEDICAL_API_KEY="your_api_key"
export MEDICAL_API_BASE="http://localhost:48200"
export MEDICAL_SEARCH_TIMEOUT=30
```

#### 方式3: 命令行参数
```bash
python unified_search.py --query "糖尿病" --api-key "your_key"
```

## 脚本说明

### unified_search.py
**功能**: 统一医疗数据搜索
**参数**:
- `--query`: 搜索关键词
- `--data-types`: 数据类型（document/patient_record/dicom）
- `--category`: 分类筛选
- `--author`: 作者筛选
- `--date-from`: 开始日期
- `--date-to`: 结束日期
- `--page`: 页码
- `--size`: 每页数量
- `--output`: 输出格式（json/csv/table）

### hybrid_search.py
**功能**: 混合检索（关键词+语义）
**参数**:
- `--query`: 查询文本
- `--mode`: 搜索模式（hybrid/keyword/semantic）
- `--data-types`: 数据类型过滤
- `--top-k`: 返回结果数量
- `--score-threshold`: 相似度阈值

### sql_query.py
**功能**: SQL查询执行
**参数**:
- `--sql`: SQL语句
- `--catalog`: 数据目录（默认iceberg）
- `--output`: 输出格式（json/csv/table）
- `--save`: 保存结果到文件

### vector_search.py
**功能**: 向量搜索和文本向量化
**参数**:
- `--action`: 操作类型（embed/search/status）
- `--text`: 文本内容（embed时使用）
- `--query`: 查询文本（search时使用）
- `--collection`: 向量集合名称
- `--top-k`: 返回结果数量

### data_lake_query.py
**功能**: 数据湖表查询
**参数**:
- `--schema`: 模式名称
- `--table`: 表名称
- `--snapshot-id`: 快照ID（Time Travel）
- `--columns`: 查询列
- `--where`: WHERE条件
- `--export`: 导出格式（json/csv）

## 搜索技巧

### 1. 关键词优化
- **使用引号**: 精确匹配短语 `"糖尿病胰岛素治疗"`
- **布尔操作**: 使用AND/OR组合关键词 `糖尿病 AND 并发症`
- **排除词**: 使用减号排除不相关结果 `糖尿病 -妊娠`
- **通配符**: 使用星号进行模糊匹配 `心*病`

### 2. 条件组合
```bash
# 多条件组合搜索
python unified_search.py \
  --query "高血压" \
  --data-types document \
  --category "临床指南" \
  --author "李四" \
  --date-from "2025-01-01" \
  --date-to "2026-12-31" \
  --keywords "药物治疗,生活方式干预"
```

### 3. 分页和排序
```bash
# 分页查询
python unified_search.py --query "糖尿病" --page 2 --size 50

# 排序查询
python unified_search.py --query "糖尿病" --sort-by date --sort-order desc
```

### 4. 聚合统计
```bash
# 获取聚合统计
python unified_search.py --query "心血管疾病" --include-aggregations

# 输出包含分类统计、科室统计等聚合信息
```

## 高级功能

### 1. 批量搜索
```python
# 批量执行多个搜索
from scripts.search_client import MedicalSearchClient

client = MedicalSearchClient()
queries = [
    {"query": "糖尿病治疗", "data_types": ["document"]},
    {"query": "高血压诊断", "data_types": ["patient_record"]},
    {"query": "CT检查", "data_types": ["dicom"]}
]

results = client.batch_search(queries)
```

### 2. 搜索历史
```python
# 保存和加载搜索历史
client.save_search_history("糖尿病治疗指南搜索", search_params, results)
history = client.load_search_history()
```

### 3. 搜索结果分析
```python
# 分析搜索结果
analysis = client.analyze_results(results)
print(f"总结果数: {analysis['total']}")
print(f"分类分布: {analysis['category_distribution']}")
print(f)时间分布: {analysis['time_distribution']}")
```

### 4. 搜索模板
```python
# 创建搜索模板
template = {
    "name": "临床指南搜索",
    "params": {
        "data_types": ["document"],
        "category": "临床指南",
        "sort_by": "date",
        "sort_order": "desc"
    }
}

client.save_search_template(template)
```

## 性能优化

### 1. 搜索优化
- **缓存结果**: 缓存常用搜索结果
- **预加载**: 预加载常用数据
- **并行查询**: 并行执行多个搜索条件
- **增量查询**: 增量获取分页结果

### 2. 网络优化
- **连接复用**: 使用HTTP连接池
- **压缩传输**: 启用GZIP压缩
- **超时设置**: 合理设置超时时间
- **重试机制**: 自动重试失败请求

### 3. 内存优化
- **流式处理**: 流式处理大量结果
- **分块加载**: 分块加载和显示结果
- **内存缓存**: 智能内存缓存策略
- **垃圾回收**: 及时释放内存

## 集成示例

### 与Clawdbot集成
```python
# 在Clawdbot技能中调用搜索功能
from scripts.search_client import MedicalSearchClient

def handle_medical_search(query, data_types=None):
    client = MedicalSearchClient()
    results = client.unified_search(query, data_types=data_types)
    return results
```

### 自动化工作流
```bash
# 定时执行搜索
0 8 * * * python scripts/unified_search.py --query "最新临床指南" --output csv --save daily_guidelines.csv

# 监控搜索性能
*/30 * * * * python scripts/search_monitor.py --check-performance
```

### 与文档上传技能集成
```python
# 上传后自动搜索验证
from scripts.batch_upload import MedicalDocUploader
from scripts.search_client import MedicalSearchClient

def upload_and_verify(folder_path, category):
    # 上传文档
    uploader = MedicalDocUploader()
    report = uploader.upload_folder(folder_path, category)
    
    # 搜索验证
    client = MedicalSearchClient()
    for doc in report['successful']:
        results = client.search_document_content(doc['doc_id'], doc['title'])
        print(f"验证结果: {doc['title']} - {len(results)} 个匹配")
    
    return report
```

## 错误处理

### 常见错误
1. **400 Bad Request**: 搜索参数错误
2. **401 Unauthorized**: API密钥无效
3. **404 Not Found**: 搜索接口不存在
4. **429 Too Many Requests**: 请求频率过高
5. **500 Internal Error**: 服务器错误

### 处理策略
- **参数验证**: 验证搜索参数有效性
- **自动重试**: 网络错误自动重试
- **降级策略**: 主搜索失败时使用备用搜索
- **用户反馈**: 提供清晰的错误信息

## 参考文档

详细文档请参考：
- [API参考文档](references/api_reference.md) - 完整的搜索API接口说明
- [搜索语法指南](references/search_syntax.md) - 搜索语法和技巧
- [性能优化指南](references/performance_guide.md) - 搜索性能优化策略
- [集成示例](references/integration_examples.md) - 与其他系统集成示例

## 支持与反馈

### 问题排查
1. 检查搜索参数是否正确
2. 验证API连接状态
3. 查看搜索日志文件
4. 测试简单搜索确认服务正常

### 获取帮助
- 查看参考文档中的常见问题
- 检查错误处理指南
- 联系系统管理员
- 提供搜索查询和错误信息以便诊断

---

**注意**: 使用前请确保已获取有效的API密钥，并正确配置API连接信息。建议先进行简单搜索测试确认服务正常。
