# 舰队防空

舰队防空先由各舰传感器生成航迹，再经数据链/编队图融合，随后由本舰授权的交战队列选择目标、武器和火控通道。合法发射顺序是：通道与弹药检查 -> 发射架排队 -> 舱门/双臂动作 -> 导弹实体离舰 -> 弹药扣减与事件记录；禁止 `SHIP SAM AUTO LAUNCH` 旁路。

舰船是独立实体，均复用同一 launcher runtime；Mk 10/Mk 41 单元、装填状态和动画来源于舰自身。源码：`src/ship-defense/`、`src/air/ship-defense-bridge.ts`、`src/main.ts`。验收以发射事件、导弹出生位置和 Tacview ACMI 对象三者一致为准。

