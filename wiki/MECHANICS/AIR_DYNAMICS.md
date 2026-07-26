# 空中动力学与 AI

> Data snapshot: v1.0.0 · 2026-07-26

飞行状态使用三维速度积分，并受推力、阻力、动压、迎角、滚转率、最大过载、失速和燃油约束。推力档位为 `idle`、`cruise`、`military`、`afterburner`；加力提高推力与红外特征，同时提高燃油消耗并受持续时间限制。截击可抢占高度/速度，返航偏向节油，紧急脱离才放宽加力。

F-14 具备截击与编队逻辑；Tu-16K/A-6E 采用各自平台限制，不假设有战斗机式加力。源码：[src/air/flight](../../src/air/flight)、[src/air/ai](../../src/air/ai)。验证：`npm run verify:advanced-air-aerodynamics`、`npm run verify:air-thrust-runtime`。
