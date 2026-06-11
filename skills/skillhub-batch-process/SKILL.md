# SkillHub Excel 批量处理技能

将 SkillHub 平台的批量技能包（xlsx + zip）处理为结构化输出 Excel，包括从 zip 提取 SKILL.md 描述、自动领域分类（15 域）、中文描述翻译。

## 前置依赖

```bash
pip install openpyxl
```

## 输入目录结构

```
<SRC_DIR>/
├── 63.xlsx                    # 技能清单（列：序号/slug/名称/提供方/质量检测/安全检测/是否上架/批次/上架日期/备注）
├── 63个技能包/
│   └── 63个技能包/
│       ├── <slug-1>.zip
│       ├── <slug-2>.zip
│       └── ...
```

## 流程

### 1. 读取 xlsx → 提取清单
- 解析 `63.xlsx` 所有行，提取 `slug`、`provider`、`batch`

### 2. 遍历 zip → 提取 SKILL.md
- 按 slug 匹配 zip 文件名
- 从 zip 读取 `SKILL.md`，解析 YAML frontmatter（`---...---`）
- 提取 `name` 和 `description` 字段
- 失败时使用 slug 作为默认 name，空字符串作为 desc

### 3. 领域分类（15 域）

优先级：`slug 手动覆盖 > 关键词匹配（按优先级从高到低）`

| 编码 | 名称 | 典型关键词 |
|------|------|-----------|
| DOMAIN_GENERAL_TOOL | 通用工具 | HTTP、文本处理等兜底 |
| DOMAIN_MARKETING | 市场营销 | seo, keyword, rank, brand |
| DOMAIN_OFFICE_MANAGEMENT | 办公管理 | productivity, project, resume, proposal, schedule, approval |
| DOMAIN_RD_OPS | 研发运维 | deploy, railway, scrape, rssaurus |
| DOMAIN_TERMINAL_MANAGEMENT | 终端管理 | portable tool, cross-device |
| DOMAIN_FINANCIAL_MARKET | 金融市场 | quant, financial, trading, portfolio |
| DOMAIN_INFO_SEARCH | 信息搜索 | search, research, pdf, markdown |
| DOMAIN_DEV_TOOL | 开发者工具 | react, rust, frontend, cli, code review |
| DOMAIN_LIFE_ENTERTAINMENT | 生活娱乐 | self, psychologist, language learning, remind |
| DOMAIN_SECURITY_COMPLIANCE | 安全合规 | audit, vulnerability, owasp |
| DOMAIN_DATA_ANALYSIS | 数据分析 | data analysis, analytics, visualization |
| DOMAIN_MULTIMEDIA_PROCESS | 多媒体处理 | screenshot, poster, video, media generation |
| DOMAIN_AI_INTELLIGENCE | AI智能 | prompt, llm, memory system, rag |
| DOMAIN_INDUSTRY_SPECIFIC | 行业专属 | patent, pubmed, biomedical, academic |
| DOMAIN_OTHER | 其他 | 兜底 |

**关键词匹配规则：**
- ICT004（安全合规）≥ ICT012（通用）> ICT003（开发工具）> ICT001（检索）
- 使用 `wb_match()` 做词边界匹配，避免 `debug` 误配 `debugging`
- slug 级别手动覆盖优先级最高，解决描述含无关关键词的误匹配（如 screenshot 含 "debugging" 但属于多媒体处理）

### 4. 翻译描述为中文
- 预定义 `DESC_CN` 映射表覆盖全部 63 个 slug，每个技能有独立的中文描述
- 含中文的原始描述直接保留
- 其余按 slug 生成标题格式

### 5. 输出 Excel
14 列：`名称 / 描述 / 版本 / 作者 / 类型 / 协议 / 下载量 / 评分 / 来源平台 / 仓库地址 / slug / hasZip / 领域分类编码 / 领域分类名称`

## 使用方法

```bash
# 修改脚本顶部的路径配置
SRC_DIR = r'D:\工作记录\项目资料\skillshub\2000skill\2026-6-11'

# 运行
python process_skills.py
```

## 扩展新技能

1. 在 xlsx 中添加新行（填写 slug 列）
2. 创建 `<slug>.zip` 放入技能包目录
3. 在 `OVERRIDE` 字典添加 slug → domain 映射（如需指定分类）
4. 在 `DESC_CN` 字典添加中文描述（如需中文翻译）
5. 重新运行脚本

## 文件

- `process_skills.py` — 完整执行脚本
- 此 `SKILL.md` — 本文档
