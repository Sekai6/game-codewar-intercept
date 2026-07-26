# NTU Intercept Wiki

> Data snapshot: v1.0.0 · 2026-07-26  
> These pages document the current game implementation. Values are game-scaled and may change in later versions.

本 Wiki 是源码文档的可导航入口。历史名称用于建立时代语境，性能数值和交战概率均为游戏化参数。

## 目录

- [机制](MECHANICS/README.md)：航迹、舰队防空、制导、电子战、动力学、毁伤与 AAR。
- [平台](PLATFORMS/README.md)：舰船、战斗机、攻击机和 AEW。
- [武器](WEAPONS/README.md)：空空、空舰和舰空武器。
- [场景](SCENARIOS/README.md)：默认海战和联合空战预设。
- [版本说明](VERSIONING.md)：数据戳和实现边界。

## 阅读规则

Wiki 页面描述的是代码行为，不是现实装备手册。需要确认行为时，以页面中的源码入口和 `npm run verify:*` 命令为准；需要确认实际发射时，必须检查实体事件、弹药和发射点，而不是只看 HUD 文本。
