# USS Lake Champlain (CG-57)

> Data snapshot: v1.0.0 · 2026-07-26  
> Game implementation values are scaled and may change.

## 身份与目录

CG-57 是独立的 Aegis 防空巡洋舰实体，定义位于 `src/ship-catalog.ts` 与 `src/models/ticonderoga.ts`。模型、传感器、弹药、ECM、CIWS、损伤和发射器状态不与旗舰共享。

## 交战行为

在舰队模式中 CG-57 可由 AAWC 分配任务，但必须用自己的本舰航迹、火控、通道和 Mk 41 单元发射。验证重点是 HUD 的 `USS LAKE CHAMPLAIN / CG-57`、实际发射点和 `blue-cg-57` owner，而不是舰队任务文字。

## 独立系统状态

- 前后 Mk 41 分别维护单元、舱盖、冷却和物理发射点。
- 雷达、火控、ECM、SRBOC、CIWS 和损管健康独立于 CGN-9。
- 编队共享航迹只是 cue；CG-57 必须形成自己的 weapon-quality 复核。
- 被分配任务后仍可能因为通道占用、射程、损伤或弹药拒绝发射。

## 观测重点

近距离镜头应看到正确舰体比例、前后 VLS、导弹垂直离舰和程序转弯。AAR/ACMI 中导弹首次坐标应在对应单元附近，弹药只从 CG-57 自己的 magazine 扣除。这个闭环是多舰系统最重要的工程约束之一。

证据：[CG-57 Ultra 极光作战画面](../../readme-cg57-ultra-aurora.png)。验证：`npm run verify:cg57`、`npm run verify:fleet-launch-cycle`、`npm run verify:ultra-aurora`。
