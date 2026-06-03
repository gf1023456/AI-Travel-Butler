"""
AI Travel Butler - Tools Definitions Module
"""

location_tool = {
    "name": "location",
    "description": "获取特定地点的详细信息",
    "parameters": {
        "type": "object",
        "properties": {
            "name": {"type": "string", "description": "地点名称，例如：故宫博物院"},
            "city": {"type": "string", "description": "该地点所属的城市名称"},
            "description": {"type": "string", "description": "该地点的深度介绍，包含看点、避坑指南和建议游玩时长"},
            "lat": {"type": "number", "description": "该地点的纬度坐标"},
            "lng": {"type": "number", "description": "该地点的经度坐标"},
            "time": {"type": "string", "description": "建议游玩的时间点或时间段"},
            "day": {"type": "integer", "description": "行程的第几天，从 1 开始计数"},
            "sequence": {"type": "integer", "description": "当天行程的先后顺序"},
            "transit_hint": {"type": "string", "description": "到达该地点的详细交通建议"},
            "category": {
                "type": "string",
                "description": "分类",
                "enum": ["SIGHT", "FOOD", "HOTEL", "TRANSIT"]
            }
        },
        "required": ["name", "city", "description", "lat", "lng", "time", "day", "sequence", "transit_hint"]
    }
}

social_recommendation_tool = {
    "name": "get_social_recommendations",
    "description": "获取社交平台热门推荐",
    "parameters": {
        "type": "object",
        "properties": {
            "recommendations": {
                "type": "array",
                "description": "排序后的热门推荐列表（至少5项）",
                "items": {
                    "type": "object",
                    "properties": {
                        "rank": {"type": "integer", "description": "排名 (1-5)"},
                        "title": {"type": "string", "description": "打卡点名称"},
                        "platform": {
                            "type": "string",
                            "description": "推荐来源",
                            "enum": ["xiaohongshu", "douyin", "weibo", "all"]
                        },
                        "hot_score": {"type": "string", "description": "热度分数或人气描述"},
                        "reason": {"type": "string", "description": "推荐理由"},
                        "photo_tips": {"type": "string", "description": "出片机位或拍照技巧"}
                    },
                    "required": ["rank", "title", "platform", "hot_score", "reason"]
                }
            }
        },
        "required": ["recommendations"]
    }
}


tools = {
    "location": location_tool,
    "socialRecommendations": social_recommendation_tool
}
