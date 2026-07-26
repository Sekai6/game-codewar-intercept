# 多舰防空

> Data snapshot: v1.0.0 · 2026-07-26

舰队协调器只创建 `ForceEngagementAssignment`。实际射击由拥有独立雷达、通道、弹药和发射器的 `ShipCombatantInstance` 完成：本舰复核航迹 -> `ShipLauncherAdapter` 预留 Mk 10/Mk 41 -> 发射器状态机 -> 物理离架 -> `weapons-away`、AAR 和 ACMI。协调器禁止直接生成 SAM 或扣除弹药，因此附属舰必须像旗舰一样留下自己的 owner、发射点和弹药变化。

源码：[src/fleet/air-defense-coordinator.ts](../../src/fleet/air-defense-coordinator.ts)、[src/ship-defense/engagement-runtime.ts](../../src/ship-defense/engagement-runtime.ts)、[src/ship-defense/launcher-runtime.ts](../../src/ship-defense/launcher-runtime.ts)。验证：`npm run verify:fleet-launch-cycle`、`npm run verify:fleet-ship-defense`。

## 为什么这很重要

舰队态势图中“CG-57 已分配任务”不等于 CG-57 已发射。附属舰可能因为本舰雷达未刷新、火控受损、交战通道已满、弹药不足、目标超出本舰包线或发射器冷却而拒绝任务。拒绝是可解释的状态，不应由视觉层补一枚导弹来掩盖。

## 交战状态

| 状态 | 含义 | 可否计入发射 |
|---|---|---|
| `assigned` | AAWC 分配意图 | 否 |
| `accepted` | 射手通过本舰条件检查并预留资源 | 否 |
| `launching` | 发射器开盖、装填或抬升 | 否 |
| `weapons-away` | 导弹从物理挂点离架 | 是 |
| `assessing` | 等待末制导、近炸或脱靶结果 | 已发射 |
| `resolved` / `leaker` | 目标被处理或穿透防线 | 已发射 |
