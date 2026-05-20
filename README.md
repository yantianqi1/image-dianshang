# ImageForge 电商生图端

面向用户的静态电商生图前端。用户在浏览器本地填写 newapi 密钥后，页面直接请求 `https://api2.opcl.cloud` 的 OpenAI 兼容接口，后端链路接入 `chatgpt2api` 生图代理。

## 本地运行

```bash
python -m http.server 5173 --bind 127.0.0.1
```

打开：

```text
http://127.0.0.1:5173
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
