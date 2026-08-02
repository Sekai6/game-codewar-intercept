# NTU Intercept

## v1.21 开发分支：全频带阻塞干扰

新增版本化JSON场景平台、场景导入导出、开场作战简报、三档动态引导、确定性空间天气、Link 11/16传播退化、平台失联条令和“极夜断链”联合场景。场景数据与运行时执行彻底分离，为后续剧情场景和沙盒场景编辑器保留统一格式。详见[场景平台文档](docs/zh/SCENARIO_SYSTEM.md)。

**冷战海空联合交战与导弹拦截 3D 沙盘。** 从雷达探测、航迹质量、数据链和火控授权，到实体发射器、分阶段制导、电子战、毁伤与 AAR，整条交战链都可以观察和复核。

> 文档数据戳：v1.20.0 · 2026-08-02<br>
> 本页描述 v1.20.0 当前实现；后续版本可能调整机制、画面和单位数据。

## 在线演示

### [▶ 立即运行 NTU Intercept](https://cwi.kisara.info)

无需安装。推荐使用桌面版 Edge 或 Chrome；首次加载及着色器编译可能需要数秒。性能有限时使用 High 画质，WebGPU Ultra、计算云和 FFT 海洋属于实验性高负载功能。

[English](README_EN.md) · [中文 Wiki](wiki/README.md) · [English Wiki](wiki/en/README.md) · [V1.20 Release](https://github.com/Sekai6/game-coldwar-intercept/releases/tag/v1.20.0) · [变更清单](CHANGELOG.md)

![USS Lake Champlain CG-57 Ultra aurora combat validation](readme-cg57-ultra-aurora.png)

*WebGPU Ultra 极光环境下的 USS Lake Champlain (CG-57) 作战验证画面。画面是项目内测试证据，不代表现实装备性能。*

NTU Intercept 是一个基于 TypeScript、Three.js 与 Vite 的冷战海空联合交战沙盘。项目使用真实舰船、飞机、雷达和武器名称建立时代背景，但所有性能参数均经过游戏化缩放，不应作为工程、训练或现实装备能力资料。

### 进入演示后看什么

1. 等待搜索雷达建立带误差的来袭目标航迹，观察质量、年龄和不确定度变化。
2. 开启 `NAVAL FORCE` 后观察舰队共享提示，但每艘舰仍须用本舰火控完成武器授权。
3. 用数字键、`L` 和 `C` 切换舰船、飞机、导弹、发射舰与电影镜头，确认 Mk 10/Mk 41 物理离架。
4. 结束演习后进入 AAR，核对事件时间线、实体轨迹、发射所有权，并可导出 Tacview ACMI。

## 为什么这个项目值得看

它不是把导弹画成一条直线、把“进入射程”当成命中的展示程序，而是把一次交战拆成可以检查的因果链：目标先被传感器以误差探测，航迹经过老化和数据链延迟，火控再判断是否达到武器级质量，舰艇最后通过自己的发射器、弹药和物理挂点完成离舰。任何一步失败，画面和 AAR 都应留下可解释的结果。

项目的核心闪光点有三处：

1. **真实的观测边界**：雷达地平线、RCS、扫描刷新、测量误差、ECM 和诱饵会改变“什么时候知道”，而不是只改变一个命中率数字。
2. **不可旁路的实体交战**：舰队协调器只分配任务；每艘舰独立验证本舰航迹、火控、通道、弹药和 Mk 10/Mk 41 状态机，只有物理离架才算 `weapons-away`。
3. **可复盘的联合战斗**：舰船、飞机、导弹和诱饵都能进入 AAR/Tacview，能从 owner、发射点、航迹和时间线核对“谁真的发射了什么”。

从[联合空战 Wiki](wiki/SCENARIOS/JOINT_AIR.md)或[多舰防空机制](wiki/MECHANICS/FLEET_AAW.md)开始，可以快速看到这些机制如何串起来。

[English](README_EN.md) | [机制手册](docs/zh/SIMULATION.md) | [架构与扩展](docs/zh/ARCHITECTURE.md) | [操作与 AAR](docs/zh/OPERATIONS.md) | [验证与发布](docs/zh/VERIFICATION.md) | [Wiki](wiki/README.md)

## v1.20.0 水面舰艇资产升级

v1.20.0 对 USS Long Beach (CGN-9)、USS Lake Champlain (CG-57) 与 Project 1164/Slava 三型程序化舰艇进行第二轮建模和 LOD 升级。调整以真实舰长、舰宽、上层建筑布局和武器/传感器相对位置为视觉依据，但不改变游戏化性能参数，也不绕开发射器、弹药与本舰火控回路。

- Long Beach 恢复约 `9.86:1` 的真实长宽比，降低过高的垂直尺度，并重做 NTU 舰艏双 Mk 10、舰艉飞行甲板、Mk 143 ABL、SPS-48/SPS-49 与 SPG-55 轮廓。
- CG-57 分离前后 AEGIS 上层建筑、机库和设备甲板，重做 SPY-1、SPG-62、双格构桅、矩形排气与 Mk 41/Mk 45 比例。
- Project 1164 增加阶梯舰桥、每舷四组双联 P-500、S-300F 区域、Top Dome、Top Steer/Top Pair、AK-130、Osa、RBU、AK-630 和舰艉航空区。
- 三舰启用画质感知 LOD。Standard 画质保留平台识别轮廓；Long Beach 舰岛冠部/窗带不会消失，CG-57 前后 Mk 41 也有与真实发射实体同坐标的视觉代理。

新增独立水面资产画廊，以单个 Chromium renderer 串行生成 18 张 Ultra/High/Standard 固定视角截图，并报告可见尺寸和三角面。低模代理只承担显示，不拥有弹药、单元、挂点或发射权限；运行时验证仍要求 CG-57 从本舰真实 Mk 41 单元完成物理离架。

## 实机验证画面

![舰队实体发射验证](verification-fleet-launch-cycle.png)

*多舰防空实体发射验证：附属舰必须通过自己的航迹、弹药、发射单元和物理离架流程，不能由旗舰或舰队协调器旁路生成导弹。*

## 当前能力

| 状态 | 能力 |
|---|---|
| **Stable** | 核心模拟回路、雷达航迹、舰载防空、实体发射器、ECM/诱饵、AAR 与 ACMI |
| **Optional** | 多舰编队、联合空战、AEW/GCI、Link 11 与年代限制下的 Link 16 |
| **Experimental** | WebGPU Ultra、计算体积云、FFT 海洋、计算粒子与时域重建 |

- 独立舰艇实体：USS Long Beach (CGN-9)、USS Lake Champlain (CG-57) 与 Moskva。
- 独立空中实体：F-14A、A-6E、Tu-16K、MiG-29A、E-2C 与 Tu-126。
- 六型空中资产采用统一 2 米/单位视觉尺度与独立 Ultra/High/Low 程序化几何。
- 舰空、空空与空舰武器的三维运动、动力段、转弯限制和分阶段制导。
- 雷达地平线、RCS 距离修正、扫描周期、测量误差、航迹老化和武器级授权。
- NTU 年代 Link 11、可选 Link 16 年代层、苏联 GCI 与海上目标指示模型。
- ECM、烧穿距离、箔条、热焰弹、SRBOC、CIWS 与系统毁伤。
- 多舰编队、OTC/AAWC/ASuWC、独立弹药和本舰发射器闭环。
- 高级飞行 AI、空气动力学包线、推力档位、燃油与损伤管理。
- WebGL 高画质和实验性 WebGPU Ultra 渲染路径。
- AAR 与 Tacview ACMI 导出。

## 遥测与数据分析

项目当前暴露 **428 个运行时诊断字段**，并记录固定步长 AAR 快照、七类事件流、Link 11/16 传输诊断、舰队/C2 状态和 Tacview 对象。它们可用于监视、回归验证、航迹/能量曲线分析和外部绘图。完整数据域与边界见[遥测与分析](docs/zh/TELEMETRY.md)。

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
| 立即试玩并了解镜头、控制和 AAR | [在线演示](https://cwi.kisara.info) · [操作指南](docs/zh/OPERATIONS.md) |
| 理解 OODA、传感器、制导、电子战和毁伤 | [机制手册](docs/zh/SIMULATION.md) · [机制 Wiki](wiki/MECHANICS/README.md) |
| 查看舰船、飞机和每型导弹参数 | [平台目录](wiki/PLATFORMS/README.md) · [导弹参数总表](wiki/WEAPONS/MISSILE_PARAMETERS.md) |
| 研究遥测、AAR 和 Tacview 数据 | [遥测与分析](docs/zh/TELEMETRY.md) · [AAR 机制](wiki/MECHANICS/DAMAGE_AND_AAR.md) |
| 开发新平台或理解所有权边界 | [架构与扩展](docs/zh/ARCHITECTURE.md) · [ARCHITECTURE.md](ARCHITECTURE.md) |
| 运行回归测试或准备发布 | [验证与发布](docs/zh/VERIFICATION.md) · [CHANGELOG](CHANGELOG.md) |
| 了解 WebGPU Ultra 状态和限制 | [WEBGPU_ULTRA.md](docs/WEBGPU_ULTRA.md) |

## 源码地图

```text
src/
  air/             空中平台、飞行动力学、AI、传感器、武器、AEW 与模型资产
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

当前版本线为 `v1.20.0`，网页 HUD 显示 `V1.20`。发布功能、边界和验证证据见 [CHANGELOG.md](CHANGELOG.md)。

## 许可

项目使用 [PolyForm Noncommercial License 1.0.0](LICENSE)，允许学习、研究和非商业用途，禁止未经许可的商业使用。
