# NTU Intercept

> 文档数据戳：v1.0.0 · 2026-07-26<br>
> 本页描述 v1.0.0 当前实现；后续版本可能调整机制、画面和单位数据。

[在线演示](https://cwi.kisara.info) · [GitHub 仓库](https://github.com/Sekai6/game-coldwar-intercept) · `v1.0.0`

![USS Lake Champlain CG-57 Ultra aurora combat validation](readme-cg57-ultra-aurora.png)

*WebGPU Ultra 极光环境下的 USS Lake Champlain (CG-57) 作战验证画面。画面是项目内测试证据，不代表现实装备性能。*

NTU Intercept 是一个基于 TypeScript、Three.js 与 Vite 的冷战海空联合交战沙盘。项目使用真实舰船、飞机、雷达和武器名称建立时代背景，但所有性能参数均经过游戏化缩放，不应作为工程、训练或现实装备能力资料。

## 为什么这个项目值得看

它不是把导弹画成一条直线、把“进入射程”当成命中的展示程序，而是把一次交战拆成可以检查的因果链：目标先被传感器以误差探测，航迹经过老化和数据链延迟，火控再判断是否达到武器级质量，舰艇最后通过自己的发射器、弹药和物理挂点完成离舰。任何一步失败，画面和 AAR 都应留下可解释的结果。

项目的核心闪光点有三处：

1. **真实的观测边界**：雷达地平线、RCS、扫描刷新、测量误差、ECM 和诱饵会改变“什么时候知道”，而不是只改变一个命中率数字。
2. **不可旁路的实体交战**：舰队协调器只分配任务；每艘舰独立验证本舰航迹、火控、通道、弹药和 Mk 10/Mk 41 状态机，只有物理离架才算 `weapons-away`。
3. **可复盘的联合战斗**：舰船、飞机、导弹和诱饵都能进入 AAR/Tacview，能从 owner、发射点、航迹和时间线核对“谁真的发射了什么”。

从[联合空战 Wiki](wiki/SCENARIOS/JOINT_AIR.md)或[多舰防空机制](wiki/MECHANICS/FLEET_AAW.md)开始，可以快速看到这些机制如何串起来。

[English](README_EN.md) | [机制手册](docs/zh/SIMULATION.md) | [架构与扩展](docs/zh/ARCHITECTURE.md) | [操作与 AAR](docs/zh/OPERATIONS.md) | [验证与发布](docs/zh/VERIFICATION.md) | [Wiki](wiki/README.md)

![舰队实体发射验证](verification-fleet-launch-cycle.png)

## 当前能力

- 独立舰艇实体：USS Long Beach (CGN-9)、USS Lake Champlain (CG-57) 与 Moskva。
- 独立空中实体：F-14A、A-6E、Tu-16K、MiG-29A、E-2C 与 Tu-126。
- 舰空、空空与空舰武器的三维运动、动力段、转弯限制和分阶段制导。
- 雷达地平线、RCS 距离修正、扫描周期、测量误差、航迹老化和武器级授权。
- NTU 年代 Link 11、可选 Link 16 年代层、苏联 GCI 与海上目标指示模型。
- ECM、烧穿距离、箔条、热焰弹、SRBOC、CIWS 与系统毁伤。
- 多舰编队、OTC/AAWC/ASuWC、独立弹药和本舰发射器闭环。
- 高级飞行 AI、空气动力学包线、推力档位、燃油与损伤管理。
- WebGL 高画质和实验性 WebGPU Ultra 渲染路径。
- AAR 与 Tacview ACMI 导出。

## 真实性边界

项目追求机制上的因果关系，而不是复刻保密或不可验证的装备性能。以下约束是当前实现的核心：

1. 武器在导引头捕获前只使用观测航迹或数据链更新，不直接读取目标真值。
2. Link 11/16 提示本身不自动授予舰载武器开火权。
3. 舰队协调器只能分配任务，不能扣弹、占用发射器或生成导弹。
4. 舰载 SAM 必须经过本舰火控、弹药、通道和 Mk 10/Mk 41 状态机后物理离架。
5. 只有物理离架后才记录 `weapons-away`，并进入 AAR 与 ACMI。
6. 每艘舰、每架飞机、每枚导弹和每个诱饵都是独立实体。

详细管线见[机制手册](docs/zh/SIMULATION.md)。

## 快速开始

要求 Node.js 20.19+ 或 22.12+。

```bash
npm install
npm run dev
```

默认地址：`http://127.0.0.1:5173/`

生产构建：

```bash
npm run build
```

## 推荐入口

| 目标 | 文档 |
|---|---|
| 理解每帧 OODA、传感器、制导和毁伤 | [机制手册](docs/zh/SIMULATION.md) |
| 了解目录、所有权边界和新增平台流程 | [架构与扩展](docs/zh/ARCHITECTURE.md) |
| 查看控制、镜头、场景和 Tacview 导出 | [操作与 AAR](docs/zh/OPERATIONS.md) |
| 运行测试或准备发布 | [验证与发布](docs/zh/VERIFICATION.md) |
| 阅读现有英文源码级架构说明 | [ARCHITECTURE.md](ARCHITECTURE.md) |
| WebGPU Ultra 状态和限制 | [WEBGPU_ULTRA.md](docs/WEBGPU_ULTRA.md) |
| v1.0 功能、边界与证据 | [CHANGELOG.md](CHANGELOG.md) |
| 按机制、平台、武器阅读 | [项目 Wiki](wiki/README.md) |

## 源码地图

```text
src/
  air/             空中平台、飞行动力学、AI、传感器、武器与 AEW
  fleet/           舰队、编队、Link 11、指挥与任务分配
  ships/           独立舰艇运行时、传感器、武器、ECM、CIWS 与毁伤
  ship-defense/    通用舰载交战、目标、发射器和视觉运行时
  datalink/        Link 11、Link 16、年代配置与可观测性
  soviet-c2/       苏联 GCI、海上目标指示和齐射协调
  threats/         反舰导弹目录及模型
  scenarios/       场景数据
  aar/             AAR、ACMI 记录与下载
  visual/          海洋、大气、云、光照及 WebGPU 实验路径
  models/          程序化舰船、飞机和武器模型
  main.ts          场景装配、帧循环、UI 与兼容桥接
scripts/           逻辑、浏览器、截图和回归验证
```

## 项目状态

当前发布为 `v1.0.0`。发布功能、边界和验证证据见 [CHANGELOG.md](CHANGELOG.md)。

## 许可

项目使用 [PolyForm Noncommercial License 1.0.0](LICENSE)，允许学习、研究和非商业用途，禁止未经许可的商业使用。
