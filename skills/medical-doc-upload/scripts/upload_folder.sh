#!/bin/bash
# 医疗文档文件夹上传脚本（Shell包装器）
# 简化批量上传操作，适合命令行快速使用

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 脚本目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PYTHON_SCRIPT="$SCRIPT_DIR/batch_upload.py"

# 帮助信息
show_help() {
    echo -e "${BLUE}医疗文档文件夹上传脚本${NC}"
    echo "用法: $0 [选项] <文件夹路径>"
    echo ""
    echo "选项:"
    echo "  -c, --category <分类>    文档分类（默认: 医学文献）"
    echo "  -p, --project <项目ID>   项目ID"
    echo "  -t, --task <任务ID>      任务ID"
    echo "  --priority <优先级>      优先级: high/normal/low（默认: normal）"
    echo "  --parser <解析器>        解析器: auto/pypdf2/mineru2（默认: auto）"
    echo "  --config <配置文件>      配置文件路径"
    echo "  -h, --help              显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 ~/documents/clinical"
    echo "  $0 -c '临床指南' --project P001 ~/documents/guidelines"
    echo "  $0 --config myconfig.json ~/documents"
    echo ""
    echo "支持的文档格式: .pdf, .doc, .docx, .xlsx, .xls, .txt, .md"
}

# 检查Python和依赖
check_dependencies() {
    # 检查Python
    if ! command -v python3 &> /dev/null; then
        echo -e "${RED}错误: 未找到python3${NC}"
        exit 1
    fi
    
    # 检查requests库
    if ! python3 -c "import requests" 2>/dev/null; then
        echo -e "${YELLOW}警告: requests库未安装，正在安装...${NC}"
        pip3 install requests || {
            echo -e "${RED}错误: 无法安装requests库${NC}"
            exit 1
        }
    fi
    
    # 检查Python脚本
    if [ ! -f "$PYTHON_SCRIPT" ]; then
        echo -e "${RED}错误: 未找到Python脚本: $PYTHON_SCRIPT${NC}"
        exit 1
    fi
}

# 检查文件夹
check_folder() {
    local folder="$1"
    
    if [ ! -d "$folder" ]; then
        echo -e "${RED}错误: 文件夹不存在: $folder${NC}"
        exit 1
    fi
    
    # 检查文件夹是否为空
    if [ -z "$(ls -A "$folder" 2>/dev/null)" ]; then
        echo -e "${YELLOW}警告: 文件夹为空: $folder${NC}"
        exit 0
    fi
    
    # 检查是否有支持的文件
    local has_files=false
    for ext in .pdf .doc .docx .xlsx .xls .txt .md; do
        if find "$folder" -maxdepth 1 -name "*$ext" -o -name "*${ext^^}" | grep -q .; then
            has_files=true
            break
        fi
    done
    
    if [ "$has_files" = false ]; then
        echo -e "${RED}错误: 未找到支持的文档文件${NC}"
        echo "支持的格式: .pdf, .doc, .docx, .xlsx, .xls, .txt, .md"
        exit 1
    fi
}

# 统计文件数量
count_files() {
    local folder="$1"
    local count=0
    
    for ext in .pdf .doc .docx .xlsx .xls .txt .md; do
        count=$((count + $(find "$folder" -maxdepth 1 -name "*$ext" -o -name "*${ext^^}" 2>/dev/null | wc -l)))
    done
    
    echo "$count"
}

# 主函数
main() {
    # 默认参数
    local category="医学文献"
    local project_id=""
    local task_id=""
    local priority="normal"
    local parser="auto"
    local config=""
    local folder=""
    
    # 解析参数
    while [[ $# -gt 0 ]]; do
        case $1 in
            -h|--help)
                show_help
                exit 0
                ;;
            -c|--category)
                category="$2"
                shift 2
                ;;
            -p|--project)
                project_id="$2"
                shift 2
                ;;
            -t|--task)
                task_id="$2"
                shift 2
                ;;
            --priority)
                priority="$2"
                shift 2
                ;;
            --parser)
                parser="$2"
                shift 2
                ;;
            --config)
                config="$2"
                shift 2
                ;;
            -*)
                echo -e "${RED}错误: 未知选项: $1${NC}"
                show_help
                exit 1
                ;;
            *)
                folder="$1"
                shift
                ;;
        esac
    done
    
    # 检查文件夹参数
    if [ -z "$folder" ]; then
        echo -e "${RED}错误: 必须指定文件夹路径${NC}"
        show_help
        exit 1
    fi
    
    # 检查依赖
    check_dependencies
    
    # 检查文件夹
    check_folder "$folder"
    
    # 统计文件
    file_count=$(count_files "$folder")
    echo -e "${GREEN}📁 找到 $file_count 个文档文件${NC}"
    echo -e "${BLUE}分类: $category${NC}"
    echo -e "${BLUE}优先级: $priority${NC}"
    echo -e "${BLUE}解析器: $parser${NC}"
    
    if [ -n "$project_id" ]; then
        echo -e "${BLUE}项目ID: $project_id${NC}"
    fi
    
    if [ -n "$task_id" ]; then
        echo -e "${BLUE}任务ID: $task_id${NC}"
    fi
    
    echo ""
    echo -e "${YELLOW}开始上传...${NC}"
    echo ""
    
    # 构建Python命令
    python_cmd="python3 \"$PYTHON_SCRIPT\" --folder \"$folder\" --category \"$category\" --priority \"$priority\" --parser \"$parser\""
    
    if [ -n "$config" ]; then
        python_cmd="$python_cmd --config \"$config\""
    fi
    
    if [ -n "$project_id" ]; then
        python_cmd="$python_cmd --project-id \"$project_id\""
    fi
    
    if [ -n "$task_id" ]; then
        python_cmd="$python_cmd --task-id \"$task_id\""
    fi
    
    # 执行Python脚本
    eval $python_cmd
    
    # 检查执行结果
    if [ $? -eq 0 ]; then
        echo ""
        echo -e "${GREEN}✅ 上传完成！${NC}"
        
        # 提示监控状态
        echo ""
        echo -e "${YELLOW}提示: 使用以下命令监控处理状态:${NC}"
        echo "  python3 \"$SCRIPT_DIR/monitor_status.py\" --report upload_report_*.json"
    else
        echo ""
        echo -e "${RED}❌ 上传过程中出现错误${NC}"
        exit 1
    fi
}

# 运行主函数
main "$@"
