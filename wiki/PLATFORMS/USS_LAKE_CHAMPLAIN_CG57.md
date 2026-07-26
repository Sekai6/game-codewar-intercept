# USS Lake Champlain (CG-57)

> Data snapshot: v1.0.0 · 2026-07-26  
> Game implementation values are scaled and may change.

## 身份与目录

CG-57 是独立的 Aegis 防空巡洋舰实体，定义位于 `src/ship-catalog.ts` 与 `src/models/ticonderoga.ts`。模型、传感器、弹药、ECM、CIWS、损伤和发射器状态不与旗舰共享。

## 交战行为

在舰队模式中 CG-57 可由 AAWC 分配任务，但必须用自己的本舰航迹、火控、通道和 Mk 41 单元发射。验证重点是 HUD 的 `USS LAKE CHAMPLAIN / CG-57`、实际发射点和 `blue-cg-57` owner，而不是舰队任务文字。

证据：[cg57-final-frame-14.png](../../cg57-final-frame-14.png)。验证：`npm run verify:cg57`、`npm run verify:fleet-launch-cycle`。
