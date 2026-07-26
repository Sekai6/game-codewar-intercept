# 验证与发布

[返回 README](../../README.md) | [机制手册](SIMULATION.md) | [架构与扩展](ARCHITECTURE.md) | [操作与 AAR](OPERATIONS.md)

## 基础门槛

```bash
npm run build
```

构建执行 TypeScript 检查和 Vite 生产打包。提交前还应运行 `git diff --check`。

## 分域验证

项目脚本较多，应按改动范围选择验证，而不是每次并行运行全部浏览器用例。

| 领域 | 代表命令 |
|---|---|
| 舰队域与编队 | `verify:fleet-domain`, `verify:fleet-runtime` |
| 多舰防空 | `verify:fleet-air-defense`, `verify:fleet-ship-defense`, `verify:fleet-launch-cycle` |
| 联合场景 | `verify:fleet-scene`, `verify:joint-air`, `verify:air-strike-defense` |
| 空战 AI 与动力学 | `verify:air-dynamics`, `verify:advanced-air-flight`, `verify:advanced-air-bvr-runtime` |
| 导引与反制 | `verify:air-guidance`, `verify:anti-ship-guidance`, `verify:air-countermeasures` |
| 数据链 | `verify:link11`, `verify:link16`, `verify:datalink-era-runtime` |
| 苏联 C2 | `verify:soviet-gci-runtime`, `verify:soviet-maritime-runtime`, `verify:soviet-salvo-runtime` |
| AAR/ACMI | `verify:acmi-export`, `verify:fleet-aar`, `verify:datalink-aar` |
| WebGPU Ultra | `verify:webgpu-ultra`, `verify:webgpu-ultra-active` |

完整命令清单以 `package.json` 的 `scripts` 为准。

## 浏览器验证规则

1. 一次只运行一个 Chromium renderer。
2. 使用固定短场景超时。
3. 同时捕获 `console.error` 和 `pageerror`。
4. 对 3D 功能既检查运行时字段，也人工读取截图。
5. 实体发射必须验证 owner、弹药、发射点、导弹对象和画面，不得用 DOM 计数替代。
6. WebGPU 失败时应明确报告 capability/fallback，不能静默伪装成 Ultra 成功。

## v1.0 发布门槛

- [ ] 中文入口与子文档无乱码，内部链接有效。
- [ ] 英文入口与中文结构一致，明确其维护状态。
- [ ] `package.json` 版本更新为 `1.0.0`。
- [ ] 新增 `CHANGELOG.md`，记录 v1.0 功能、边界和已知问题。
- [ ] 生产构建通过。
- [ ] 舰队实体发射、联合空战、AAR/ACMI 和默认单舰回归通过。
- [ ] WebGL 高画质通过；WebGPU Ultra 能力检测和 fallback 通过。
- [ ] 文档中的命令、平台目录和许可证与源码一致。
- [ ] 工作区不包含密钥、参考资料、临时构建或无关截图提交。
- [ ] GitHub `main` 与本地一致，创建签名明确的 `v1.0.0` tag 和 Release Notes。

在上述门槛全部有证据前，不创建 v1.0 标签。

## 当前已知边界

- CEC 尚未实现，Link 11/16 不应被描述为 CEC。
- 航母起降、空中加油、拖曳诱饵和反辐射导弹未实现。
- 性能数值为游戏化缩放，不是现实装备数据库。
- WebGPU Ultra 仍是实验路径，受浏览器、驱动和平台能力限制。
- `main.ts` 仍包含兼容路径和较多装配代码，后续需继续收敛。

