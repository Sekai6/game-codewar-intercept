# NTU Intercept Wiki

[English Wiki](en/README.md) · [在线演示](https://cwi.kisara.info/) · [导弹参数](WEAPONS/MISSILE_PARAMETERS.md)

本 Wiki 记录项目当前真实执行的 3D 冷战海空拦截模拟。真实型号用于历史语境，性能数值经过游戏化缩放；源代码、验证命令和实体事件是机制说明的权威依据。

## 目录

- [机制目录](MECHANICS/README.md)
- [平台目录](PLATFORMS/README.md)
- [武器目录](WEAPONS/README.md)
- [场景目录](SCENARIOS/README.md)
- [音乐与氛围](MUSIC.md)
- [版本说明](VERSIONING.md)

## 当前已实现

- 雷达地平线、RCS 修正、概率探测、测量误差与航迹老化。
- IRST、ESM、被动航迹、EMCON 三态和被动航迹融合。
- Link 11、Link 16 年代层与渐进式断链。
- `cec-enabled` 时代的 Long Beach、CG-57、E-2C 测量级 CEC。
- 合法舰载防空闭环：航迹 → 火控 → 交战队列 → 通道 → 弹药 → VLS/发射架 → 物理离舰。
- F-14、Tu-16K、A-6E、MiG-29、E-2C 与 Tu-126 空中平台。
- AAR/Tacview 遥测、场景 JSON 校验/编译和可复用场景平台。

## 重要边界

历史 AIM-54A/C 只接受 F-14/AWG-9 发射平台中段更新。只有未来/假想的 [AIM-54X CEC](WEAPONS/AIM54X_CEC.md) 才能在 CEC 年代接收网络级中段更新。CEC、Link 11/16、IRST 和 ESM 都不能旁路舰载发射流程。

## 未来路线

反辐射作战与反辐射导弹已具备基础实体回路（独立 emitter、ESM/IRST、SEAD、AGM-45/AGM-88 寻的生命周期）；拖曳诱饵、更完整的 CEC 网络协同和沙盒场景编辑器仍属于后续扩展。
