# 空中动力学与 AI

> v1.0.0；参数为游戏化缩放，结构与代码一致。

## 计算链
`src/air/flight-dynamics.ts` 每帧积分三维速度：推力减阻力，升力维持爬升，质量随燃油消耗变化；迎角、滚转率、俯仰率和最大过载限制转弯。超过临界迎角会失速，低速恢复需要降低迎角并重新获得能量。

## 推力档位
`idle -> cruise -> military -> afterburner`。加力只对 F-14A、MiG-29A 开放，拥有独立推力增益、燃油倍率、红外倍率和可用秒数；Tu-16K/A-6E 使用各自的非加力包线。AI 在 `src/air/ai/` 根据任务、导弹 TTI、发射区、能量和燃油选择档位；返航省油，紧急脱离才放宽限制。

## 验证
源码：`src/air/catalog.ts`、`src/air/flight-dynamics.ts`、`src/air/ai/`。运行 `npm run verify:advanced-air-aerodynamics` 与 `npm run verify:air-thrust-runtime`。

