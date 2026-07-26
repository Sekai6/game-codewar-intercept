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

## 平台与武器参数

| 类别 | 游戏定义 |
|---|---|
| 航速 / 转向 | 最大 32.5 kn，巡航 22，巡逻 12；加速 1.75 kn/s，减速 1.25，转向 1.8°/s |
| 战术机动 | 决策周期 1 s，距外环 560，容差 60；RCS 10.5，显著高度 32 m |
| 主雷达 | AN/SPY-1B：相控阵，范围 820，刷新 0.42 s，精度 1.12；四面阵可独立受损 |
| 远搜雷达 | AN/SPS-49：机械扫描，范围 1100，刷新 1.05 s，精度 0.75 |
| 火控 / 通道 | AN/SPG-62；6 个防空通道、4 个照射器 |
| SAM | SM-2MR ×48、SM-2ER ×32；前后 Mk 41，64 格目录，序列间隔 0.5 s |
| 反舰 | RGM-84 ×8；范围 35-720，质量 0.58，最大年龄 4 s，齐射 2-4 |
| 近防 | 前后 Phalanx，1800 发；范围 15，冷却 0.55 s，基础/上限 PK 0.46/0.72 |
| 电子战 | AN/SLQ-32 0.64，烧穿 70；SRBOC 12 发，冷却 2.2 s |

Mk 41 每个单元维护 `ready/opening/launching/closing/spent/disabled`，并记录前后库、最近单元、最小发射间隔、损伤隔离和 trapped rounds。AN/SPY-1B 四面阵损伤会按威胁方位降低搜索能力，而不是只减一个全局雷达血量。

模型使用 172.8 m 长、16.8 m 宽的现实比例基准，经 2.25 m/世界单位缩放；包含折线舰体、艏艉收窄、四面 SPY-1、SPG-62、前后 VLS、机库、CIWS、SLQ-32 和多级 LOD。

源码：`src/models/ticonderoga.ts`、`src/fleet/`、`src/ships/`、`src/ship-defense/`。
