# NTU Intercept Wiki

> Data snapshot: v1.0.0 · 2026-07-26  
> These pages document the current game implementation. Values are game-scaled and may change in later versions.

本 Wiki 是源码文档的可导航入口。历史名称用于建立时代语境，性能数值和交战概率均为游戏化参数。

## 项目价值

本项目的重点不是堆叠单位名称，而是让读者能够回答“为什么这枚弹现在看不见、为什么这艘舰没有开火、为什么导引头被干扰”这类问题。每个 Wiki 页面都尽量给出三种信息：

- **机制**：运行时实际执行的状态转移和限制。
- **实体**：平台或武器在场景中的任务、传感器、挂载和损伤边界。
- **证据**：源码入口、验证命令、截图或 ACMI 检查方法。

这使它既能作为观战游戏的规则说明，也能作为扩展新舰、新飞机和新武器时的工程索引。

## 目录

- [机制](MECHANICS/README.md)：航迹、舰队防空、制导、电子战、动力学、毁伤与 AAR。
- [平台](PLATFORMS/README.md)：舰船、战斗机、攻击机和 AEW。
- [武器](WEAPONS/README.md)：空空、空舰和舰空武器。
- [场景](SCENARIOS/README.md)：默认海战和联合空战预设。
- [版本说明](VERSIONING.md)：数据戳和实现边界。

## 阅读规则

Wiki 页面描述的是代码行为，不是现实装备手册。需要确认行为时，以页面中的源码入口和 `npm run verify:*` 命令为准；需要确认实际发射时，必须检查实体事件、弹药和发射点，而不是只看 HUD 文本。

## 一次交战的阅读路径

建议按“[传感器与航迹](MECHANICS/SENSOR_TRACKS.md) -> [多舰防空](MECHANICS/FLEET_AAW.md) -> [分阶段制导](MECHANICS/GUIDANCE.md) -> [电子战](MECHANICS/ELECTRONIC_WARFARE.md) -> [毁伤与 AAR](MECHANICS/DAMAGE_AND_AAR.md)”阅读。它对应从发现、决策、发射、抗干扰到复盘的实际帧管线。
