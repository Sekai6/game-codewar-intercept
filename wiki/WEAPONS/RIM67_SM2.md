# RIM-67 / SM-2

> Data snapshot: v1.0.0 · 2026-07-26

舰载区域防空武器。其有效交战前提是射手舰本舰火控、通道和发射器可用；舰队 cue 或 Link 11/16 不能绕过这些条件。必须从 Mk 10/Mk 41 物理离架后才进入导弹运行时。目录入口：`src/interceptor-data.ts`、`src/ship-defense/launcher-runtime.ts`。

## 舰上资源约束

一次任务会占用对应发射器、交战通道以及可能需要的照射资源。Mk 10 需要装填、抬臂和离轨；Mk 41 需要选择可用单元、开盖、热发射和银行冷却。导弹离舰后，中段解算仍受本舰航迹刷新和照射能力限制。

多舰场景中，AAWC 可以选择 CGN-9 或 CG-57 作为射手，但导弹 owner、弹药扣减和发射坐标必须属于实际射手。验证：`npm run verify:fleet-launch-cycle`、`npm run verify:vls-runtime`。
