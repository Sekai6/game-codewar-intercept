# 遥测与作战数据分析

> 文档数据戳：v1.0.0 · 2026-07-26

本项目不仅是一个 3D 观战场景，也是一个可复盘的作战遥测沙盒。模拟器把感知、航迹、数据链、决策、发射、制导、干扰、机动、毁伤和渲染状态持续暴露出来，适合做监视、观测、数据分析、回归验证和画图。

## 当前规模

源码盘点（`src/main.ts`、`src/combat-types.ts`、`src/datalink/`、`src/aar/`）：

| 数据面 | 当前实现 |
|---|---|
| 运行时诊断 | 428 个唯一 `canvas.dataset.*` 字段 |
| AAR 快照 | 13 个顶层域，覆盖舰船、导弹、飞机、诱饵、数据链、舰队和 C2 |
| 运动学 | 每个实体 8 个三维运动字段：位置、姿态、速度、垂直速度 |
| 事件流 | 7 类：sensor、fire、guidance、effect、maneuver、network、system |
| 数据链 | Link 11 / Link 16 节点、航迹、活动、决策和延迟诊断 |
| ACMI | 6 类 Tacview 对象：舰船、导弹、飞机、诱饵、航路点、估计点 |

428 个字段不是单纯的 UI 文本；它们由模拟运行时更新，可用于浏览器自动化验收和回归对比。字段命名集中在 `src/main.ts` 的诊断更新区，AAR 结构定义在 `src/combat-types.ts`。

## 数据流

```text
simulation runtime
  -> fixed-step entity state
  -> AarSnapshot + AarEvent
  -> domain recorders
       -> DatalinkAarRecorder
       -> FleetAarRecorder
       -> SovietC2AarRecorder
  -> AAR review / HUD observers / canvas.dataset diagnostics
  -> Tacview ACMI export
```

## 可分析的数据

### 快照型数据

`AarSnapshot` 保存某一时间点的状态：舰船和飞机的三维运动、导弹阶段、导引关系、航迹质量、诱饵、弹药相关实体、舰队成员和协同交战状态。适合画距离-时间图、高度-速度图、导弹 TTI 曲线、航迹质量衰减和武器阶段时间线。

### 事件型数据

`AarEvent` 记录状态变化而不是每帧复制全部状态，例如探测、授权、物理发射、制导阶段、命中/脱靶、干扰、机动、系统损伤和数据链活动。事件中的 `time/category/text` 可直接用于时间线、事件计数和战损复盘。

### 数据链遥测

`TacticalNetworkObservation` 同时提供节点、共享航迹、网络活动和决策。Link 11 还记录轮询次数、NCS、周期和平均延迟；Link 16 记录排队、发送、交付、容量丢弃、链路丢弃、重复丢弃和平均延迟。因此可以区分“没有发现目标”“发现但没有共享”“共享但过期”“共享后拒绝武器授权”。

### 舰队与 C2

舰队快照包含成员状态、站位误差、本地/网络航迹、任务分配、交战评估和物理发射记录。苏联 C2 快照包含 GCI 指令、海上目标区、舰队命令和齐射计划，可分析信息链与武器链之间的延迟和断点。

### 运行时与渲染诊断

`canvas.dataset.*` 还暴露雷达、VLS/Mk 10、SAM 通道、ECM、SRBOC、飞机 AI、推进档位、环境、海洋、粒子和 WebGPU Ultra 状态。渲染字段用于确认后端、云、海洋 FFT、时域重投影和计算粒子是否实际启用；它们不应被当作战斗真值。

## 导出与验证

- AAR 在运行期间保存在内存中，结束演习后可查看复盘时间线。
- `src/aar/acmi-exporter.ts` 导出 Tacview `.acmi`，保留对象轨迹、父子关系、目标关系、网络估计点和 C2 指令点。
- ACMI 验收必须同时检查实体轨迹、弹药扣减、物理发射点和 `PHYSICAL LAUNCH` 事件，不能只看事件文字。
- 现阶段尚未提供通用 CSV、JSON、Parquet 下载或长期数据库；这些是后续数据工程工作，不属于 v1.0.0 已实现能力。

## 推荐分析问题

1. 雷达首次探测到目标后，航迹质量达到武器授权阈值用了多久？
2. Link 11/16 的排队和传输延迟是否造成了漏防窗口？
3. 从授权到物理离架之间，发射架、弹药和通道是否完整闭环？
4. ECM、箔条或热焰弹影响的是哪一类导引头，烧穿发生在什么距离？
5. 飞机在不同推力档位下的速度、高度、燃油和规避机动是否一致？

## 代码入口

- [AAR 类型](../../src/combat-types.ts)
- [Tacview 导出器](../../src/aar/acmi-exporter.ts)
- [数据链观察接口](../../src/datalink/observability.ts)
- [Link 11/16 诊断类型](../../src/datalink/types.ts)
- [数据链 AAR 记录器](../../src/aar/datalink-recorder.ts)
- [舰队 AAR 记录器](../../src/aar/fleet-recorder.ts)
- [苏联 C2 AAR 记录器](../../src/aar/soviet-c2-recorder.ts)
