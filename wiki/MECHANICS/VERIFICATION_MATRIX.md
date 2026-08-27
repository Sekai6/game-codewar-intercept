# 验证矩阵

| 领域 | 入口 | 验证重点 |
|---|---|---|
| 构建与 Schema | `npm run build` / `npm run verify:scenario-system` | 类型、场景校验、导入编译 |
| CEC | `npm run verify:cec-runtime` / `verify:cec-engagement` | 测量融合、火控门控、不可旁路 |
| 舰队发射 | `npm run verify:fleet-launch-cycle` / `verify:vls-runtime` | 实体舰、发射架、弹药、物理离舰 |
| 空战 | `verify-air-intercept` / `verify-advanced-air-bvr-runtime` | Phoenix、Sparrow、红外末制导 |
| 数据链 | `verify-datalink-era` / `verify-link16-runtime` | 年代能力与断链退化 |
| ACMI | `verify-acmi-export` | 实体轨迹、事件和诊断属性 |

浏览器验证要求单 renderer、固定短场景和严格串行；完整长场景与多种子测试仅在本地执行。
