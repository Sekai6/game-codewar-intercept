# F-14A Tomcat

> Data snapshot: v1.0.0 · 2026-07-26

双机 CAP/截击平台。可携带 AIM-54A、AIM-7F 和 AIM-9L，拥有三维飞行、编队、雷达航迹、加力和导弹告警机动。目录入口：`src/air/catalog.ts`；模型验证：`verification-aircraft-f-14a-ultra.png`。

## 战术行为

F-14 的 AI 先利用雷达/AEW 航迹判断目标身份、距离和威胁，再根据能量与发射区选择 Phoenix、Sparrow 或 Sidewinder。远程截击可用加力抢占高度和速度，但会增加燃油消耗和红外特征；返航优先节油，导弹 TTI 很短时转入防御机动并投放合适诱饵。

机动意图不会直接修改航向。飞行指令经过滚转率、迎角、动压、过载和失速保护，因此 Tacview 中应表现为连续曲线而不是直角折线。可变后掠翼和尾焰由飞行状态驱动，而不是单纯按镜头速度播放。

验证：`npm run verify:advanced-air-bvr-runtime`、`npm run verify:advanced-air-threat-runtime`、`npm run verify:air-turn-kinematics`。
