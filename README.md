# GOTC 2026 开源 AI 黑客松官网

百格成城 · 让每一个想法，成为未来的一格。

公开活动官网 + 专业评委评分 + 观众选择 + 实时成绩看板 + 组织方后台。

- 官网：https://simonchenjh98.github.io/gotc-ai-hackathon-2026/
- 完整活动平台：https://8.141.114.201/gotc/
- 实时看板：https://8.141.114.201/gotc/platform.html#board
- 评委入口：https://8.141.114.201/gotc/platform.html#judge
- 组织方入口：https://8.141.114.201/gotc/platform.html#admin

GitHub Pages 发布静态活动信息，评分和看板使用独立云服务与 SQLite 数据库。前端零构建依赖，后端仅使用 Python 标准库。

## 本地预览

```sh
python -m http.server 4173 --bind 127.0.0.1
```

此命令只预览公开活动信息。完整平台需要 Python 3.11+：

```powershell
$env:GOTC_DATA_DIR = '.runtime/local-data'
$env:GOTC_PORT = '5274'
$env:GOTC_PUBLIC_ORIGIN = 'http://127.0.0.1:5274'
python -B server/app.py
```

打开 http://127.0.0.1:5274/gotc/ 。首次运行的管理码保存在指定数据目录的 `admin-access.txt`，不要提交或公开。提交到 `main` 后由 GitHub Actions 验证并发布官网；云端发布方式见 [部署说明](deploy/README.md)。

## 维护内容

- `index.html`：公开活动内容与日程。
- `styles.css`：响应式样式。
- `app.js`：日程切换、清单、复制链接与导航。
- `platform.html`、`platform.css`、`platform.js`：评分工作台、后台与实时看板。
- `server/app.py`：身份认证、评分、投票、SQLite 持久化与静态服务。
- `assets/`：活动现有主视觉和报名二维码。
- `downloads/`：日历与作品提交清单。

页面以 2026 年 10 月学校交流版为活动信息基础。评分权重保留完整活动方案的六维 100 分制，公开标注为方案版；现场细则、GOTC 详细场地和最终组织安排以主办方通知为准。旧 9 月活动的观众加分、后台、队伍及学生数据未接入本官网。

## 发布范围

仓库包含平台源码和公开活动素材，不包含聊天记录、报名数据、数据库、管理码、评委邀请码、API 密钥或内部方案文件。作品上传入口尚未接入；作品提交清单可公开查看。

新数据库初始无参赛队伍、无评委、无评分，评分默认关闭。组织方先录入本届队伍并单独发放邀请码，确认现场规则后开启评分。专业评分最多一位小数，已提交评分可以修改后重新提交，草稿不能覆盖正式评分。公开均分默认需要 5 位评委；同分并列，观众选择独立于专业分。看板每 2 秒读取数据，大屏模式每 12 秒轮播 8 支队伍。

## 验证

```sh
node --test tests/platform.test.mjs
python -B scripts/check_site.py
python -B -m unittest discover -s server -p 'test_api.py'
```

接口测试使用隔离的临时数据库，覆盖身份权限、评分门槛、草稿与回避、分数校验、改分、投票、CSV 与同源限制。

代码使用 MIT 许可证；活动主视觉、名称与标识的权利归各自权利人所有，不属于代码许可范围。
