# 数据链年代与能力边界

| Era ID | Link 11 | Link 16 | CEC | 典型用途 |
|---|---:|---:|---:|---|
| `ntu-baseline` | US 舰船 | 否 | 否 | NTU/TADIL-A 舰队态势共享 |
| `jtids-transition` | US 舰船 | 部分空中平台 | 否 | 过渡期 JTIDS |
| `link16-modernized` | 否 | US 舰船与空中平台 | 否 | 游戏化 Link 16 网络 |
| `cec-enabled` | 否 | 是 | 是 | 未来/假想测量级 CEC |

Link 11/16 传输的是航迹报告；CEC 传输的是带时间戳与协方差的测量。数据链 cue 不能直接授权武器。CEC 也不能跳过本舰火控、交战队列、通道、弹药和实体发射器。

切换年代会重建场景运行时，但不会修改原始 JSON。苏联平台不能注册 CEC，也不会产生 Link 16 活动。
