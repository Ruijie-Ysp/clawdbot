# 批量删除会话功能

## 概述

为会话管理页面添加了批量删除功能,允许用户一次选择并删除多个会话。

## 功能特性

### 1. 会话选择

- 每行会话前添加复选框,可单独选择
- 表格头部添加"全选"复选框,可一键选择/取消所有会话
- 全选复选框支持 indeterminate 状态(部分选中时显示)

### 2. 批量删除按钮

- 当选中会话时,在右上角显示"批量删除(N)"按钮
- 按钮显示当前选中的会话数量
- 未选中任何会话时按钮隐藏

### 3. 删除确认

- 批量删除前会弹出确认对话框
- 确认消息显示要删除的会话数量
- 用户可以取消操作

### 4. 删除过程

- 依次删除所有选中的会话
- 删除包括会话条目和对话记录(transcript)
- 删除完成后自动刷新会话列表
- 删除后清空选中状态

## 代码修改

### 文件变更:

1. **ui/src/ui/controllers/sessions.ts**
   - 添加 `sessionsSelected: Set<string>` 状态字段
   - 添加 `toggleSessionSelection()` 函数 - 切换单个会话选择状态
   - 添加 `toggleAllSessions()` 函数 - 全选/取消全选
   - 添加 `deleteSelectedSessions()` 函数 - 批量删除选中会话
   - 修改 `deleteSession()` 在删除后清理选中状态

2. **ui/src/ui/views/sessions.ts**
   - 更新 `SessionsProps` 类型,添加 `selected`, `onToggleSelect`, `onToggleAll`, `onDeleteSelected` 属性
   - 修改 `renderSessions()` 函数:
     - 添加全选复选框到表格头部
     - 添加批量删除按钮(仅在有选中时显示)
     - 表格头部添加复选框列
   - 修改 `renderRow()` 函数:
     - 添加 `isSelected` 和 `onToggleSelect` 参数
     - 每行添加复选框

3. **ui/src/ui/app-render.ts**
   - 导入新增的控制器函数
   - 在 `renderSessions()` 调用中传入新增的 props

4. **ui/src/ui/app-view-state.ts**
   - 添加 `sessionsSelected: Set<string>` 状态字段

5. **ui/src/ui/app.ts**
   - 初始化 `sessionsSelected = new Set()`

6. **ui/src/ui/i18n/en.ts**
   - 添加翻译:
     - `selectAll`: "Select all"
     - `deleteSelected`: "Delete selected"
     - `confirmDeleteMultiple`: "Delete {count} sessions? ..."

7. **ui/src/ui/i18n/zh-CN.ts**
   - 添加中文翻译:
     - `selectAll`: "全选"
     - `deleteSelected`: "批量删除"
     - `confirmDeleteMultiple`: "删除 {count} 个会话？..."

8. **ui/src/ui/i18n/types.ts**
   - 更新 `Translations` 接口,添加新的翻译键

## 使用方法

1. 访问会话管理页面 (http://localhost:18789/?token=xxx#/sessions)
2. 使用复选框选择要删除的会话:
   - 点击单个复选框选择特定会话
   - 点击表头复选框全选/取消全选
3. 点击右上角的"批量删除(N)"按钮
4. 在确认对话框中确认删除
5. 等待删除完成,页面自动刷新

## 注意事项

- 批量删除操作不可撤销
- 删除会话会同时删除其对话记录(transcript)
- 删除过程中页面会显示加载状态
- 如果删除失败,错误信息会显示在页面上
