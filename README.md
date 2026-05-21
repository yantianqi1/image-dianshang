# ImageForge 电商生图端

面向用户的电商生图前端。页面同源请求本项目内置的小后端，小后端负责 newapi 地址池匹配、异步生图任务、SSE 进度、结构化诊断日志，以及 `chatgpt2api` 生图代理调用。

内置地址池：

- `https://iai.iisbo.com/v1`
- `https://ai.iisbo.com/v1`
- `https://api2.opcl.cloud/v1`

首次保存密钥时，后端会尝试地址池的 `/models` 接口。后续请求优先使用已命中的地址；如果该地址请求失败，会继续尝试其他地址并在成功后更新内存记忆。

## 诊断日志

后端会向 stdout 输出 JSON 日志，线上可直接用：

```bash
docker compose logs -f
```

关键字段：

- `traceId`：单次上游请求链路 ID
- `jobId`：生图任务 ID
- `event`：`job_event`、`upstream_http_ok`、`upstream_http_failed` 等
- `endpoint`：命中的 newapi 地址
- `response`：上游返回结构摘要
- `code` / `message`：失败分类和错误信息

如果上游 HTTP 200 但没有图片，任务会明确失败为 `NO_IMAGE_DATA`，日志里会记录响应结构摘要，不会静默兜底。

## 本地运行

```bash
HOST=127.0.0.1 PORT=8080 node server/main.js
```

打开：`http://127.0.0.1:8080`

可选环境变量：

- `IMAGEFORGE_API_KEY`：后端统一持有 newapi key；配置后前端可以不保存 key。
- `IMAGEFORGE_API_ENDPOINTS`：逗号分隔的 newapi 地址池。
- `REQUEST_TIMEOUT_MS`：上游生成请求超时，默认 `300000`。
- `PROBE_TIMEOUT_MS`：地址探测超时，默认 `10000`。

## Docker Compose 部署

```bash
docker compose up -d --build
```

默认访问：

```text
http://服务器IP:5173
```

停止：

```bash
docker compose down
```

## 测试记录

完整功能测试和真实上游 smoke 记录见：

- `功能测试记录.md`
- `dogfood-output/browser-feature-results.json`
- `dogfood-output/api-smoke/results.json`

## 主要能力

- 文字生图
- 商品图生成
- 风格复刻
- 服装基础套图 / 模特试穿
- 图片精修
- 图片编辑
- AI 润色与反推提示词
- 案例专区
- 本地历史记录
