# 架构与扩展

> 文档数据戳：v1.0.0 · 2026-07-26<br>
> 本页描述 v1.0.0 当前实现；后续版本可能变更。

[返回 README](../../README.md) | [机制手册](SIMULATION.md) | [操作与 AAR](OPERATIONS.md) | [验证与发布](VERIFICATION.md)

## 所有权原则

1. 实体拥有自己的状态。舰艇弹药、通道、发射器、传感器和毁伤不得存放在舰队全局计数器中。
2. 协调器只输出意图或任务。它不能直接生成武器、扣弹或播放实体动画。
3. 视觉层只消费运行时状态。视觉事件不能反向证明或授权命中、发射和毁伤。
4. AAR/ACMI 记录真实运行时事件。导出器不得补造缺失的交战行为。
5. 平台差异优先放入目录定义。`main.ts` 不应按具体舰名、飞机名或武器 ID 实现行为分支。

## 模块边界

| 模块 | 责任 |
|---|---|
| `src/air/` | 空中目录、实例、传感器、OODA、动力学、制导、AEW 和反制 |
| `src/fleet/` | 舰队实例、编队、Link 11、指挥角色、任务协调和观察层 |
| `src/ships/` | 单舰传感器、武器执行、发射适配、ECM、CIWS 和损管 |
| `src/ship-defense/` | 舰载防空共享目标、交战、发射器和视觉状态机 |
| `src/datalink/` | 数据链协议、年代和诊断，不拥有武器权限 |
| `src/soviet-c2/` | 苏联指挥控制和目标指示，不复用 NATO 数据链语义 |
| `src/threats/` | 来袭武器目录、模型和飞行参数 |
| `src/platforms/` | 敌方水面平台目录与运行时 |
| `src/scenarios/` | 初始实体、位置、弹药、参数和功能开关 |
| `src/aar/` | 采样、事件、ACMI 映射和下载 |
| `src/visual/` | 渲染能力，不拥有战斗真值 |

英文源码级说明见 [ARCHITECTURE.md](../../ARCHITECTURE.md)。

## 关键类型

| 类型 | 所有者 | 用途 |
|---|---|---|
| `CombatEntity` / `TargetableEntity` | 实体运行时 | 阵营、位置、速度、RCS、存活和损伤契约 |
| `AirPlatformDefinition` / `AirPlatformInstance` | `src/air/` | 空机目录数据与单机状态 |
| `NavalForceRuntime` | `src/fleet/` | 编队态势、角色和任务协调 |
| `ForceEngagementAssignment` | `src/fleet/` | 交战意图，不是发射事件 |
| `ShipLauncherAdapter` | `src/ships/` | 将舰队任务接入本舰发射器 |
| `DefenseTarget` | `src/ship-defense/` | 舰空防御的统一目标引用 |

依赖方向应保持 `scenario -> runtime -> observation -> decision -> local executor -> event -> visual/AAR`。视觉、导出和舰队协调器都不能反向生成实体行为。

## 集成方向

```text
catalog/scenario -> entity runtime -> observation/track -> decision/order
                 -> local executor -> physical event -> visuals + AAR
```

反向调用必须谨慎。尤其禁止 `fleet -> spawn SAM`、`visual -> apply hit`、`exporter -> synthesize launch`。

## 新增舰艇

1. 在舰艇目录声明平台、传感器、发射器、弹药、ECM、CIWS 和系统布局。
2. 在 `src/models/` 提供程序化模型，并将挂点通过统一 `userData` 契约暴露。
3. 通过 `createShipCombatant` 创建独立实例。
4. 在 `src/fleet/scenarios.ts` 或场景目录引用定义，不在 `main.ts` 添加舰名分支。
5. 验证独立模型、弹药、航迹、毁伤、发射原点和 AAR owner。

## 新增空中平台

1. 在 `src/air/catalog.ts` 声明空气动力、传感器、挂载、武器、ECM 和任务条令。
2. 在 `src/air/models.ts` 添加模型生成器与挂点。
3. 在 `src/air/scenarios.ts` 添加出生与任务订单。
4. 复用 OODA、飞行指令和通用武器运行时；避免按机型 ID 分支。
5. 增加动力学、挂点、制导、毁伤和浏览器运行时验证。

## 新增武器

目录数据应包含目标类别、动力段、速度/高度包线、转弯限制、导引阶段、导引头、引信、战斗部和反干扰参数。运行时只能按能力字段选择行为；只有真正无法数据化的物理类别才允许新增策略实现。

## 场景数据

初始位置、阵营、弹药、编队、任务、交战参数和功能开关属于场景层。`validateNavalForceScenario()` 会拒绝空场景、重复实体 ID、缺失定义、重复指挥角色或缺少 OTC 的舰队。

## main.ts 收敛目标

`main.ts` 当前仍包含兼容单舰路径、UI 和部分装配代码。新增功能不得继续扩大具体平台硬编码。重构优先级是：

1. 将场景数据继续移入 `src/scenarios/`。
2. 将跨域适配放入命名 bridge/integration 模块。
3. 让 `main.ts` 最终只承担依赖装配、固定帧调度、输入和 UI 映射。

新增单位应优先增加目录定义和场景数据，随后补充逻辑、模型、AAR 和验证。可导航的当前实体说明见 [Wiki 平台](../../wiki/PLATFORMS/README.md) 与 [Wiki 武器](../../wiki/WEAPONS/README.md)。
