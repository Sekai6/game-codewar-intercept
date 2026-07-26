# 分阶段制导

> v1.0.0；所有目标均通过航迹接口访问，不读取目标真值。

导弹状态为 `boost -> midcourse -> terminal/search -> acquired/lost -> fuze`。中段只能使用发射平台或数据链提供的带质量、误差和时间戳航迹；主动头开机后仍受视场、捕获概率、烧穿和干扰影响。半主动 AIM-7F/R-27R 要求持续照射，AIM-54A 末段主动，AIM-9L/R-73 使用红外特征，Harpoon/KSR-5 复用反舰末端搜索。

转弯上限、剩余速度、航迹陈旧度和交会几何共同决定命中，不存在瞬移或无条件捕获。源码：`src/air/guidance.ts`、`src/air/missile-runtime.ts`、`src/threats/`。验证：`npm run verify:air-guidance`、`npm run verify:anti-ship-guidance`。

