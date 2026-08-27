# 场景平台

场景采用 JSON 数据、TypeScript 校验/编译和运行时三层结构。场景文档只包含纯数据：平台目录 ID、坐标、真北航向、航线、区域、时间线、目标和引导定义。

流程：

`load → normalize → validate → compile → runtime`

非法 ID、重复实体、失效航线或目标引用会在启动前拒绝。旧场景通过 legacy adapter 进入同一运行时；`main.ts` 只负责选择场景、依赖装配、帧循环和 UI 生命周期。

内置场景只读，可导出规范化 JSON 后复制为用户场景。Schema 升级使用显式迁移器，运行时不得修改原始文档。
