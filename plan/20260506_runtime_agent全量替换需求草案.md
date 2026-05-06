# 20260506 runtime agent 全量替换需求草案

## 目标

将系统中历史上混用的：

- `persona`
- `agent`
- `agentId = personaId`

逐步替换为清晰的 runtime agent 模型。

最终语义：

- `persona`：人格模板
- `runtime_agent`：运行时代理人，身份由 `personaId + departmentId` 唯一确定

## 为什么必须做

当前大量模块默认：

- 一个 `persona` 就是一个 `agent`

这会直接带来结构性问题：

- 同一人格无法以多个岗位独立存在
- 权限、模型、委派关系和记忆归属都容易混层
- `mention`、日志、调度、会话展示很难说清“到底是谁”

## 建议目标模型

建议统一引入：

- `runtimeAgentId`
- `personaId`
- `departmentId`

其中：

- `runtimeAgentId` 是稳定、可重复生成的确定性 ID
- 建议格式预留版本前缀，例如：`ra_v1:{departmentId}:{personaId}`

## 需要覆盖的范围

### 1. 前端

- 聊天工具栏与 `@`
- 会话列表与消息展示
- 配置页部门/人格联动
- 调试日志与运行态可视化

### 2. 后端调度

- 会话激活
- 主助理/秘书判断
- 委派与子任务
- 远程联系人调度

### 3. 持久化

- Conversation 上的 agent 字段
- ChatMessage 上的 speaker/executor 相关字段
- snapshot / archive / message store 元数据

### 4. 工具与记忆

- memory ownership
- tool runtime context
- permission control

## 迁移要求

### 1. 禁止一步到位硬切

必须分阶段：

1. 先补 runtime agent 结构与生成器
2. 再逐个链路切读取侧
3. 最后清理旧字段

### 2. 过渡期禁止语义混名

建议显式区分：

- `personaId`
- `departmentId`
- `runtimeAgentId`
- 必要时保留 `legacyAgentId`

### 3. 向后兼容

旧会话、旧消息、旧归档需要可读取

## 本文档当前用途

这是一份需求与边界草案，不进入本轮实现。

真正实现前需要再补：

- 迁移步骤图
- 数据兼容策略
- 每阶段可回滚点
- 验证矩阵
