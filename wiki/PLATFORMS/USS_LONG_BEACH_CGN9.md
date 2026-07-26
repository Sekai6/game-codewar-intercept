# USS Long Beach (CGN-9)

> Data snapshot: v1.0.0 · 2026-07-26

NTU 时代核动力导弹巡洋舰，当前作为默认单舰/旗舰基准实体。模型和发射器来自 `src/models/long-beach.ts`；实际 SAM 仍必须经过本舰火控与 Mk 10/Mk 41 状态机。不要把旗舰逻辑误写成舰队全局逻辑。

## 平台与武器参数

| 类别 | 游戏定义 |
|---|---|
| 航速 / 转向 | 最大 30 kn，巡航 20，巡逻 10；加速 1.5 kn/s，减速 1.1，转向 1.6°/s |
| 战术机动 | 决策周期 1 s，距外环 520，容差 65；RCS 12，雷达显著高度 34 m |
| 雷达/火控 | AN/SPS-48E、AN/SPS-49、AN/SPG-55；3 个防空通道、2 个照射器 |
| SAM | RIM-67 ×6、SM-2MR ×12、SM-2ER ×8 |
| Mk 10 | 前/后双臂发射架；方位 55°/s、俯仰 25°/s、装填 1.8 s |
| 反舰 | RGM-84 ×8；范围 35-680，航迹质量 0.62，最大年龄 4 s，齐射 2-4 |
| 近防 | 前/后 CIWS，1200 发；范围 15，60 发点射，冷却 0.6 s，基础/上限 PK 0.44/0.70 |
| 电子战 | ECM 0.62，烧穿 72；SRBOC 12 发，冷却 2.4 s，诱饵寿命 14 s |

## 实体闭环与毁伤

舰队任务只进入本舰待处理队列。本舰必须建立有机航迹、占用通道/照射器、扣除自己的弹药，再让 Mk 10 经 `ready → slewing → firing → returning → loading` 完成离架。反舰 Harpoon 同样需要航迹年龄、质量、火控延迟、发射间隔和到达窗口。

舰体按舰艏、前部、中部、后部和舰艉映射命中位置；AN/SPS-48E、SPS-49、SPG-55、前后 Mk 10、CIWS、SLQ-32、SRBOC 与推进可独立受损。AAR/ACMI 应同时出现本舰 ID、发射架、发射点、弹药变化、导弹对象和 `PHYSICAL LAUNCH`。

源码：`src/ship-catalog.ts`、`src/models/long-beach.ts`、`src/ships/`、`src/ship-defense/`。
