# Weftbase

PocketBase 与 Refine 组成的后台。

- `server`：接口和数据，http://127.0.0.1:8090
- `web`：管理界面，http://127.0.0.1:5173

## 开发

需要 Go、[air](https://github.com/air-verse/air)、pnpm。

```bash
make dev
```

PocketBase 后台和管理界面使用同一账号：`admin` / `weftbase-admin`。

## 构建

```bash
make build
cd server && ../bin/weftbase serve --http 127.0.0.1:8090
```
