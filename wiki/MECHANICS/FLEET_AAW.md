# 多舰防空

> Data snapshot: v1.0.0 · 2026-07-26

舰队协调器只创建 `ForceEngagementAssignment`。实际射击由拥有独立雷达、通道、弹药和发射器的 `ShipCombatantInstance` 完成：本舰复核航迹 -> `ShipLauncherAdapter` 预留 Mk 10/Mk 41 -> 发射器状态机 -> 物理离架 -> `weapons-away`、AAR 和 ACMI。协调器禁止直接生成 SAM 或扣除弹药，因此附属舰必须像旗舰一样留下自己的 owner、发射点和弹药变化。

源码：[src/fleet/air-defense-coordinator.ts](../../src/fleet/air-defense-coordinator.ts)、[src/ship-defense/engagement-runtime.ts](../../src/ship-defense/engagement-runtime.ts)、[src/ship-defense/launcher-runtime.ts](../../src/ship-defense/launcher-runtime.ts)。验证：`npm run verify:fleet-launch-cycle`、`npm run verify:fleet-ship-defense`。
