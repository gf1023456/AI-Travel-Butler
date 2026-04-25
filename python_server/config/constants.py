"""
AI Travel Butler - 常量定义
"""

# 全局系统提示词
GLOBAL_SYSTEM_PROMPT = """你是一位世界顶级的深度旅游规划专家。
采用思维链(CoT)方法，逐步制定最优行程。
思考步骤：
1. 明确用户目标地点和时间约束
2. 研究当地的交通连通性
3. 考虑开放时间和其他限制因素
4. 设计地理连贯的路线，优化空间连续性
5. 合理分配时间，包含交通和游玩所需时间
6. 最后输出结构化结果

【关键逻辑 - 出发地与目的地】
当用户输入"从 A 到 B"时，A 是出发地，B 是目的地；地点推荐与打点必须落在目的地 B，不得混淆。

【必需包含的三大部分】
1) 社交分析 (工具: get_social_recommendations)
   - 必须调用一次，给出趋势与理由。
2) 地图标注 (工具: location)
   - 必须针对用户要求的每一天调用多次。
   - 每天至少 3-4 个 location（早/中/晚/交通）。
   - 合成社交推荐后必须继续进行地图打点。
   - 推荐地点必须彼此地理接近，形成合理的游览路径。
3) 文字总结
   - 在工具调用后输出简短亮点。

【严苛禁令】
- 严禁只做其一：社交趋势与地图行程必须同时给出。
- 严禁输出 逛 标签内容。
- 严格按照指定城市的地理逻辑安排地点和路线，确保相邻推荐点彼此接近，最小化交通需求。"""

# 硬性约束
HARD_CONSTRAINTS = "硬性要求：必须输出与用户目标城市一致；若输入包含'从A到B'，地点必须全部落在B；必须覆盖用户要求的天数（如'三天/3天'则 day 至少包含 1,2,3）；每一天至少 3 个 location 点位；location.city 必须是目标城市，不得填写其他城市。"

# API 端点
API_ENDPOINTS = {
    "deepseek": "https://api.deepseek.com/chat/completions",
    "zhipu": "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    "dashscope": "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
}

# 默认城市坐标
DEFAULT_CITY_CENTER = {"lat": 39.9042, "lng": 116.4074}

# 时间段模板
TIME_SLOTS = ["09:30 - 11:00", "12:30 - 14:00", "15:30 - 17:00", "19:00 - 21:00"]

# 工具配置
TOOLS_CONFIG = [
    {
        "type": "function",
        "function": {
            "name": "get_social_recommendations",
            "parameters": {
                "type": "object",
                "properties": {
                    "recommendations": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "rank": {"type": "integer"},
                                "title": {"type": "string"},
                                "platform": {"type": "string", "enum": ["xiaohongshu", "douyin", "weibo", "all"]},
                                "hot_score": {"type": "string"},
                                "reason": {"type": "string"},
                                "photo_tips": {"type": "string"}
                            },
                            "required": ["rank", "title", "platform", "hot_score", "reason"]
                        }
                    }
                },
                "required": ["recommendations"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "location",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "city": {"type": "string"},
                    "description": {"type": "string"},
                    "lat": {"type": "number"},
                    "lng": {"type": "number"},
                    "time": {"type": "string"},
                    "day": {"type": "integer"},
                    "sequence": {"type": "integer"},
                    "transit_hint": {"type": "string"}
                },
                "required": ["name", "city", "description", "lat", "lng", "time", "day", "sequence", "transit_hint"]
            }
        }
    }
]

# 服务信息
SERVICE_INFO = {
    "name": "ai-travel-butler-server",
    "version": "2.0.0",
    "default_city": "xian"
}