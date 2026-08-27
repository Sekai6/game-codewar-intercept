# CEC 协同交战能力

CEC 是独立于 Link 11/Link 16 的测量级协同层。首版仅在 `cec-enabled` 年代注册 Long Beach、CG-57 与 E-2C。

## 机制边界

- 平台共享带时间戳、速度、位置和协方差的测量，而不是复制隐藏真值。
- 融合航迹按年龄、同步质量和协方差降级为 `cue`、`composite` 或 `weapon`。
- 远程测量只能支持本舰火控解算，不能生成导弹、扣减弹药或触发 VLS 动画。
- 舰载 SAM 仍经过本舰航迹、交战队列、火控通道、弹药、实体发射器和物理离舰。

## AIM-54 规则

历史 `AIM-54A/C` 只接受 F-14/AWG-9 发射平台的中段更新。CEC 网络中段更新仅属于未来假想的 `AIM-54X-CEC`，并且只有 `cec-enabled` 年代才会配发。

## 可观测性

HUD、AAR 与 Tacview 记录测量来源、贡献平台、年龄、协方差、火控接受/拒绝原因和中段更新来源。

## 代码入口

`src/cec/measurement-runtime.ts`、`fusion-runtime.ts`、`engagement-support.ts`、`missile-datalink.ts`。
