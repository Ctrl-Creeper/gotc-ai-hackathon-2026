# GOTC 活动评分服务

Python 3.11+ 标准库 HTTP + SQLite 服务，无 pip 依赖。只管理本届活动；首次启动没有队伍、评委、观众、评分或投票数据。

## 启动

在项目根目录运行：

```sh
GOTC_DATA_DIR=/opt/gotc-hackathon/data \
GOTC_BASE_PATH=/gotc \
GOTC_HOST=127.0.0.1 \
GOTC_PORT=5274 \
GOTC_PUBLIC_ORIGIN=https://8.141.114.201 \
python3 server/app.py
```

环境变量均为可选，默认值依次为 `server/data`、`/gotc`、`127.0.0.1`、`5274`、`https://8.141.114.201`。生产必须使用独立、持久化的数据目录，以及非 root 专用服务用户。程序拒绝绑定非 loopback IP。

首次启动在数据目录生成 `admin-access.txt`，包含随机管理码，只创建一次。它不会打印到日志、返回给公开接口或写入仓库。Linux 上数据目录为 0700，管理码文件、数据库为 0600，进程 umask 为 0077。Windows 的 chmod 不替代 ACL，正式部署以 Linux 私有数据目录为准。不要删除或覆盖数据库来更新网页。备份时使用 SQLite backup API 或 `sqlite3 .backup`，避免单独复制正在写入的主数据库文件。

Nginx 应将 `/gotc/` **保留完整路径**代理到 `http://127.0.0.1:5274`，覆盖 `X-Real-IP` 为 `$remote_addr`，保留 Host，使用 HTTPS。服务只接受 Origin 与 `GOTC_PUBLIC_ORIGIN` 完全一致的 POST；不要将 `Origin` 改写成可信值。管理页面为 `/gotc/platform.html#admin`，在浏览器填写管理码。首次进入后台后录入正式队伍、创建评委/观众邀请码，并在活动开始时开放评分。

本地浏览器测试可将 `GOTC_PUBLIC_ORIGIN` 设为 `http://127.0.0.1:5274`。此时 Cookie 不带 Secure；HTTPS 正式地址自动启用 Secure。身份 Cookie 为 HttpOnly、SameSite=Strict，12 小时过期；邀请码和会话令牌的明文均不存入数据库。

组织方可以在私有数据目录放置 `shared-login-codes.json`，用 `admin` 和/或 `judge` 字段配置统一登录码。真实值仅放在该私有文件，不进入 Git 或公开网页。启动时会同步对应角色的密码哈希，使已更改密码账号的旧会话失效，保留账号 ID、评分和投票。若配置了评委统一码且还没有任何评委身份，自动创建“评委01”；后续新建评委身份沿用统一码。多位评委共用登录码时，正确输入登录码后选择自己的身份，各自评分仍分开保存。观众邀请码不受影响。

## API 合同

下列路径前统一加 `/gotc`（或配置的 base path）。JSON 写入使用 `Content-Type: application/json`，携带同源 Origin 和 Cookie。成功返回 200；错误为 `{ "error": "可读错误说明" }`。错误码包括 400 输入错误、401 未登录、403 身份或来源不符、404 不存在、409 状态冲突、413 超过端点请求上限、415 内容类型错误、429 登录限速。

| 方法与路径 | 身份 | 请求及响应 |
|---|---|---|
| GET `/api/board` | 公开 | `{teams,config,updatedAt,serverTime}` |
| POST `/api/login` | 公开 | `{role: "admin"\|"judge"\|"audience"\|"team",code}` → `{ok,role,name}`，设置会话 Cookie |
| GET `/api/session` | 公开 | `{role: null\|"admin"\|"judge"\|"audience"\|"team",name}` |
| POST `/api/logout` | 任意 | `{}` → `{ok}`，删除当前会话 |
| GET `/api/judge` | 评委 | `{teams,myScores,dimensions,scoringOpen,name}` |
| POST `/api/score` | 评委 | `{teamId,scores:[六项数字],feedback,status:"draft"\|"submitted"\|"recused"}` → `{ok,status}` |
| GET `/api/audience` | 观众 | `{teams,votedTeamIds,voteLimit:3,votingOpen,name}` |
| POST `/api/vote` | 观众 | `{teamId}` → `{ok,alreadyVoted}` |
| GET `/api/admin` | 管理员 | `{teams,judges,audience,config,stats}` |
| POST `/api/admin/settings` | 管理员 | `scoringOpen`/`resultsPublished`/`submissionsOpen` 布尔值、`minJudges` 1–50 整数、`submissionDeadline` Unix 毫秒整数或 null，均可单独更新 → `{ok,config}` |
| POST `/api/admin/teams` | 管理员 | `{id?,number,name,project?,track?}` → `{ok,team}` |
| POST `/api/admin/invitations` | 管理员 | `{role:"judge"\|"audience",name}` → `{id,name,code}`，只有创建响应返回明文码 |
| POST `/api/admin/revoke` | 管理员 | `{role:"judge"\|"audience",id}` → `{ok}` |
| GET `/api/admin/export` | 管理员 | UTF-8 BOM CSV 下载，包含队伍、单份评分与反馈；防止表格公式注入 |

`teamId` / `id` 是随机字符串，不是队伍显示编号。`number` 是 1–999 整数且不可重复；队名必填，1–80 字；作品名 0–140 字；赛道 0–80 字。更新必须带现有 `id`，保持历史评分与投票关联；不存在的 ID 不会被自动新增。

统一码匹配多位有效评委时，登录先返回 `{selectAccount:true,accounts:[{id,name}]}`，此时不会创建会话。选择身份后，用相同的 `role`、`code` 加 `accountId` 再次提交完成登录。身份选项只在验证了该角色的正确统一码后返回。

公开 `teams` 的每行结构：

```json
{
  "id": "T随机标识", "number": 1, "name": "正式队名",
  "project": "作品名称", "track": "探索方向", "judgeCount": 0,
  "score": null, "rank": null, "audienceVotes": 0
}
```

`config` 包含 `scoringOpen`（默认 false）、`resultsPublished`（默认 true）、`minJudges`（默认 5）、`dimensions`、`updatedAt`、`voteLimit:3`、`audienceIncludedInScore:false`、`maxScore:100`。所有时间戳为 Unix 毫秒。评委 `myScores` 仅返回本人记录：`{teamId,scores,feedback,status}`；回避状态 scores 为空数组。

`judges` 每项为 `{id,name,submittedCount,active}`；`audience` 每项为 `{id,name,active}`；`stats` 包含 `teamCount`、`submittedScores`、`audienceVotes`。后台不返回邀请码哈希或明文。

## 队伍提交 API

| 方法与路径 | 身份 | 请求及响应 |
|---|---|---|
| GET `/api/team` | 队伍 | `{team,submission,window}`，仅绑定队伍 |
| POST `/api/submission` | 队伍 | `{expectedVersion,status:"draft"\|"submitted",materials}` → `{ok,team,submission,window}` |
| POST `/api/admin/team-access` | 管理员 | `{teamId,action:"issue"\|"rotate"\|"revoke"}` → `{ok,teamId,id,active,code?}`；仅发码与重发返回明文 |
| GET `/api/admin/submissions/export` | 管理员 | UTF-8 BOM CSV，一队一行，正式与草稿列明确分开，含版本、时间和未提交修改状态，无凭据 |

队伍以 `role:"team"` 使用独立提交码登录，不使用统一评委码。每队绑定一个账号。`issue` 仅首次创建；存在身份返回 409。`rotate` 保留账号 ID、重发随机码并重新启用；`revoke` 停用，可重复调用。二者立即删除旧会话，已保存材料保留。所有写操作先获得 SQLite 写锁再验证会话，排队中的旧会话不能绕过重发或停用。

`materials` 只接受下列字段，字符串省略时默认为空并去除首尾空白，`confirmed` 省略为 false：

| 字段 | 长度上限 | 正式提交 |
|---|---|---|
| `projectName` | 140 字 | 必填 |
| `summary` | 600 字 | 必填 |
| `codeUrl`, `readmeUrl`, `slidesUrl`, `videoUrl` | 各 1024 UTF-8 字节 | 必填 |
| `license` | 200 字 | 必填，许可证名称或说明 |
| `licenseUrl` | 1024 UTF-8 字节 | 选填 |
| `demoUrl`, `demoInstructions` | 链接 1024 字节、说明 2000 字 | 至少一项 |
| `sourcesAndLimitations` | 2000 字 | 必填 |
| `codeVersion` | 120 字 | 选填 |
| `confirmed` | 严格布尔值 | 必须 true，队伍自查声明 |

只接受无凭据、无空白或控制字符的完整 HTTPS 链接；不抓取外部资源，不自动验证许可、可访问性、页数或视频长度。提交端点最多 32768 字节，其他 JSON 请求仍为 16384 字节；未知字段、错误类型、超长内容为 400，超请求上限为 413。请求不接受 `teamId`，身份与队伍由服务器绑定。

`submission` 为 `{version,draft,submitted,submittedVersion,firstSubmittedAt,submittedAt,updatedAt,hasUnsubmittedChanges}`。初始 version=0，其余快照、正式编号和时间为 null，changes=false。每次成功写入 version 加一，正式提交把当前材料同时保存为草稿与正式快照，submittedVersion 等于新 version。首次提交时间保留；只有正式提交更新 `teams.project`，草稿不会影响公开作品名或评委资料。保存与版本检查处于同一事务，旧 expectedVersion 返回 409，不发生部分更新。

`window` 为 `{submissionsOpen,submissionDeadline,canEdit,serverTime}`。默认关闭、截止 null；非空截止为 0–253402300799999 的整数 Unix 毫秒时间戳，布尔值不接受。写入要求开放且服务器时间严格早于截止；到点为只读，时间和开关独立于评分。后台以北京时间输入；补交通过管理员延长截止并重新开放。建议先关闭提交再评审，已有评分不与材料版本绑定。快照保存字段和链接，外链内容仍可能改变。

`GET /api/admin` 保留原合同并新增 `submissions:[{teamId,access:null|{id,active},submission}]`，含每支队伍和两份快照。`GET /api/judge` 新增 `submissions:[{teamId,materials,version,firstSubmittedAt,submittedAt}]`，仅正式材料，不含草稿、草稿更新时间或凭据。公开看板和观众响应不返回项目材料。没有提交材料的队伍仍可按现场演示评分。原评分 CSV 格式与文件名不变。

旧版数据库会先经 SQLite backup API 备份到私有数据目录的 `before-team-*.sqlite3`，再事务重建 `accounts` 的角色约束；保留账号 ID、密码哈希、会话、评分、投票、队伍和审计，通过外键检查后提交，失败回滚并停止启动。重复启动跳过已完成迁移。升级前仍建议进行常规备份，保留整个持久化目录；备份不会被静态服务公开。

## 评分语义

六维依次为：

1. `problem` 问题价值与理解，20 分。
2. `ai` 方案与AI使用，20 分。
3. `prototype` 原型完成度，20 分。
4. `testing` 测试与改进，15 分。
5. `opensource` 开源与责任，15 分。
6. `teamwork` 团队协作与表达，10 分。

评分必须填齐六项数字，范围受各项上限约束，最小步长 0.1；拒绝布尔值、字符串、NaN、Infinity 和多余小数位。反馈选填，最多 2000 字。所有评分修改都必须在评分开放时进行。草稿和回避不计入均分；提交后可直接修改并重新正式提交。**已提交记录不能被草稿覆盖**，返回 409 并保留原成绩。提交后可以明确回避；回避后可以恢复草稿或正式提交。

达到最少不同专业评委数且成绩已公开，才返回专业平均分和排名。平均分涵盖全部有效提交，不去最高最低，公开保留两位小数；相同显示分数并列，采用 1、1、3 排名。公开接口只展示聚合值，不展示评委身份、反馈或单份分数。后台可查看达到人数门槛的分数，即使尚未向公众发布。

观众每个邀请码最多支持 3 个不同队伍，每队限一票，重复请求幂等；并发请求受事务保护。观众票单独统计，**不加入专业分，不计入评委人数门槛**。投票与专业评分同时开放/关闭，提交后不能撤回。

停用邀请会立即废除该账号的全部会话、阻止后续登录；**既有正式评分和观众票保留且继续计入**。系统保留基础审计记录，不在审计中保存邀请码、会话令牌或评分反馈正文。

## 安全与静态资源

生产仅 loopback + Nginx。静态根目录为项目根，但只允许 `index.html`、`styles.css`、`app.js`、`platform.html`、`platform.js`、`platform.css`、`favicon.svg`、`assets/` 中的图片/字体、`downloads/` 中的 txt/ics。服务拒绝隐藏文件、路径穿越、越界符号链接和目录列表；不会公开 `server/`、文档、数据库或凭据。

接口禁止跨域写入，JSON 上限为提交材料端点 32KB、其余端点 16KB，登录按真实来源 IP/身份限速为每分钟 20 次，另有每身份每分钟 400 次全局上限。Nginx 必须覆盖可信代理 IP 头。CSP 仅允许本站脚本、样式、字体和请求，不允许内联脚本、外部框架或嵌入页面。所有响应禁用缓存。

## 验证

从项目根目录执行：

```sh
python3 -B -m unittest discover -s server -p 'test_*.py' -v
python3 -m py_compile server/app.py server/test_api.py
```

测试启动真实本地 HTTP 服务，使用各自独立的临时数据库并清理，不写入生产。覆盖：空初始状态、管理码不落入数据库、身份隔离、Cookie、安全头、同源检查、登录限速、输入校验、16KB 上限、静态白名单与穿越保护、草稿/提交/回避、5 位门槛、算术均分、改分、提交不降为草稿、关闭评分、成绩发布开关、观众三票并发限制与幂等、票数独立、停用保留历史、同分排名、CSV 公式注入保护及审计。
