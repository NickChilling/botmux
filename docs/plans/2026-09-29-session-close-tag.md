# 会话群关闭后切换消息分组

在专属会话群成功执行 `/close` 后，将该群加入配置的关闭分组，再移除原有自动分组关联。复用用户授权和现有标签服务，保留群聊与会话历史。配置留空时维持现状。

```mermaid
flowchart LR
  A[/close] --> B{正常关闭成功?}
  B -->|否| C[保留原分组]
  B -->|是| D{会话群且配置 closedName?}
  D -->|是| E[等待建群打标完成]
  E --> F[按授权用户查找或创建关闭分组]
  F --> G[加入关闭分组]
  G -->|成功| H[移除原分组关联]
  G -->|失败| C
```

## 涉及功能与文件

- `src/services/feed-group-tagger.ts`：关闭分组切换与建群打标顺序。
- `src/services/session-groups-store.ts`：记录该群实际加入的自动分组 ID。
- `src/core/command-handler.ts`：只在 `/close` 正常关闭后调用（关闭卡按钮共用此路径）。
- `src/bot-registry.ts`、`src/core/dashboard-ipc-server.ts`、Dashboard 标签设置：新增 `sessionGroup.tag.closedName`，可保存/清空。
- 服务、IPC、命令路由和界面回归测试；中英文用户文档。

## 边界

- 仅 `feed-group`；不改变 `chat-tag`、`off`、普通群、话题、adopt、后台清理、崩溃或 `/stop`。
- 只处理建群对应用户、当前群和自动分组关系，不删除分组，不批量改其它群。
- 原分组与关闭分组 ID 相同则不移除；添加失败时不移除原关联。
- 标签失败不回滚关闭结果，单独告知；保持有界请求。
- 不自动回迁恢复会话、不增加定时扫描、不触发发布或替换正在运行的 daemon。

## 验收

- 正常关闭与配置热更新；配置为空/非法/清空；重复调用；新旧分组相同。
- 添加失败/部分失败、移除失败、缺授权、旧会话无分组记录。
- 建群异步打标完成后再迁移；关闭拒绝/残留/普通群不迁移。
- 相关 Vitest、TypeScript 和构建通过；记录尚未进行的真实飞书验证。

## 验证结果（2026-09-29）

- `npm exec --yes --package=bun@1.4.2 -- bun run build`：通过，包括 TypeScript、脚本/测试 mock 类型检查、Dashboard 构建和资源审计。
- 以下回归共 14 个文件、568 个测试通过：

```bash
./node_modules/.bin/vitest run --project unit \
  test/feed-group-close.test.ts \
  test/feed-group-tagger-default-name.test.ts \
  test/feed-group-tagger-self-heal.test.ts \
  test/session-groups-store.test.ts \
  test/command-handler.test.ts \
  test/ipc-session-group-tag-config-route.test.ts \
  test/dashboard-session-group-closed-tag.test.ts \
  test/dashboard-session-group-tag-repair.test.ts \
  test/dashboard-bot-defaults-refresh-race.test.ts \
  test/command-retry.test.ts \
  test/mention-mode-command.test.ts \
  test/session-group-birth-quota.test.ts \
  test/session-group-birth-workingdir.test.ts \
  test/session-group-birth-forward-seed.test.ts
```

- ego-lite：在隔离预览中加载实际 `SessionGroupTagRow`，验证关闭标签输入、失焦保存、刷新回显；后端为本地配置 fixture，未修改运行中 daemon 配置。
- 飞书移除关联接口已按 lark-cli schema/路由核对：`POST /open-apis/im/v1/groups/{feed_group_id}/batch_remove_item`。
- `git diff --check`：通过。
- 尚未进行真实飞书标签迁移、线上 `/close` 联调、Linux 实机验证；未部署或重启运行中的 daemon。共用关闭路径增加的是有条件的标签通知，不更改 CLI、PTY/tmux、远端后端的关闭实现；拒绝关闭和残留路径由回归测试覆盖。

![关闭后标签名设置（隔离预览）](../assets/session-close-tag/settings.png)
