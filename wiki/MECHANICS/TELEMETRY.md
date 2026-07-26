# 遥测与分析

> v1.0.0 · 2026-07-26

项目当前暴露 **428 个运行时诊断字段**，并将实体快照、离散事件、数据链活动和 Tacview ACMI 导出结合起来。它可以回答“谁看见了目标、谁共享了航迹、谁授权了武器、哪一个发射架真正离架、导引头何时捕获、干扰是否生效”等问题。

核心入口：

- `src/combat-types.ts`：`AarSnapshot`、`AarEvent` 和舰队/数据链快照
- `src/datalink/observability.ts`：节点、航迹、活动、决策观察
- `src/aar/*-recorder.ts`：数据链、舰队、苏联 C2 记录器
- `src/aar/acmi-exporter.ts`：Tacview 对象和时间序列导出
- `src/main.ts`：浏览器 `canvas.dataset.*` 诊断面

遥测分为快照、事件、网络诊断、实体关系和渲染诊断五层。AAR/ACMI 已可用；CSV、JSON、Parquet 和长期数据库尚未实现。详细字段清单、数据流和分析问题见 [中文遥测文档](../../docs/zh/TELEMETRY.md)。
