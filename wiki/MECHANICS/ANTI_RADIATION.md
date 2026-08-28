# 反辐射导弹与 SEAD

首版 ARM 模块提供独立辐射源、ESM 辐射源航迹和两种寻的能力：`AGM-45A Shrike` 只有有限记忆点，`AGM-88A HARM` 支持更长记忆与限定时间重捕获。导弹目标是 `EmitterInstance`，不是直接读取舰船真值。

状态链：`emitter-search → emitter-acquired → terminal-home → memory-track → reacquisition → lost/impact`。雷达关机后 ESM 停止更新；导弹按型号进入记忆或重捕获。诱饵、换源、频段不匹配和过期航迹都可能导致脱靶。

当前已完成数据目录、独立搜索/火控辐射源、ESM/IRST 被动航迹、A-6E SEAD 任务编排、实体挂点发射接入，以及 AGM-45/AGM-88 的记忆/失锁/重捕获状态机。AAR/Tacview 已记录导弹寻的状态、目标 emitter 和辐射源发射启停事件；`verify:arm-runtime`、`verify:arm-sead`、`verify:arm-lifecycle` 与浏览器 SEAD 预设验证均已纳入测试。
