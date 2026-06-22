"""
AI Travel Butler - 配置管理
统一管理所有配置
"""

import os
from pathlib import Path
from typing import Optional, Dict, Any
from pydantic import BaseModel
from pydantic_settings import BaseSettings


class ServerSettings(BaseModel):
    host: str = "0.0.0.0"
    port: int = 8787
    request_timeout_ms: int = 240000
    max_retries: int = 3
    public_base_url: str = "https://tonystark-ai.ccwu.cc"
    refine_timeout_ms: int = 300000  # 优化接口专用超时：5分钟


class RagSettings(BaseModel):
    top_k: int = 3
    knowledge_file: str = "knowledge/processed/chunks.jsonl"


class RolloutSettings(BaseModel):
    enable_canary: bool = False
    canary_percent: int = 10
    primary_provider: str = "deepseek"
    canary_provider: str = "dashscope"
    auto_rollback_on_failure: bool = True


class PerformanceSettings(BaseModel):
    cache_ttl_ms: int = 120000
    cost_alert_threshold: float = 2.0
    max_free_plans_per_day: int = 1  # 每日免费次数


class ProviderSettings(BaseModel):
    gemini_api_key: str = ""
    deepseek_api_key: str = "sk-a4383f605b3145e8bc002fec8065eeed"
    zhipu_api_key: str = ""
    dashscope_api_key: str = "sk-1501fc47ce7d466e949bff1a1dba9481"
    mimo_api_key: str = "sk-cyfkjsjqshqxavbo6s1l7yefh1b3f588zcv1oicfufyrykfu"
    default_gemini_model: str = "gemini-2.5-flash"
    default_deepseek_model: str = "deepseek-v4-pro"
    default_zhipu_model: str = "glm-4-flash"
    default_dashscope_model: str = "qwen3.5-397b-a17b"
    default_mimo_model: str = "MiMo-V2.5-Pro"


class ExternalApiSettings(BaseModel):
    amap_api_key: str = "1ac4e414cee2b2d77e6753265c8ba6f0"
    weather_api_key: str = ""
    tdt_api_key: str = "97f9870fb795ba80ef201d6edae71d73"
    pixabay_api_key: str = "55871092-ce4b6588eec534eb37300c1f9"
    serper_api_key: str = "0d140f37f3fad88ad695861df408a63b91394b1d"


class WeChatSettings(BaseModel):
    appid: str = "wx0c96ac321aba9e4a"
    secret: str = "3c38e48ffe8bf2075c4bbc314a770616"


class XhsSettings(BaseModel):
    cookie: str = "abRequestId=aff51df3-3fc7-597b-b16e-f8a7236d5dad; xsecappid=xhs-pc-web; a1=19d0ee53f422iu5bxapq6xa2rsgynmu2iucrm9e4q50000127652; webId=49a43481ab7eed7433e85955ec3ae54a; gid=yjf8dd24D832yjf8dd2qi7jd4JJ372DC0UAKS4AC0JFMkF28vI67J6888yJWK2J8YWd8fqjD; ets=1781780269264; x-rednote-datactry=CN; x-rednote-holderctry=CN; webBuild=6.21.0; loadts=1782024758425; acw_tc=0ad6fb0717820247602948727e5d8c0b89a71d3e745e0e6de4a82f8db93984; websectiga=f47eda31ec99545da40c2f731f0630efd2b0959e1dd10d5fedac3dce0bd1e04d; sec_poison_id=95d88ea7-341b-4f9c-8946-c0a2f78816fa; web_session=040069b864fb418e657803c202384b65fcfab3; id_token=VjEAAL9gz5bRXB/Qj7HNCir5ZmLVFRzklkCMq6Ez4II4s5yxC1ojcGACYRjrUfVdXrWNKHyGCD3UGGHjBsO9B1GXXRTb8H1zCVPt9H47d+Q0KVWd+66QrkRXqgyfs8hvuTqrf5bl"

class DatabaseSettings(BaseModel):
   # host: str = "localhost"
    host: str = "47.108.24.14"
    port: int = 15477
    username: str = "postgres"
    password: str = "postgres123"
   # password: str = "147258"
    name: str = "ai_travel_butler"
    url: str = ""  # 直接指定数据库URL


class Settings(BaseSettings):
    """全局配置"""
    server: ServerSettings = ServerSettings()
    rag: RagSettings = RagSettings()
    rollout: RolloutSettings = RolloutSettings()
    performance: PerformanceSettings = PerformanceSettings()
    providers: ProviderSettings = ProviderSettings()
    external_apis: ExternalApiSettings = ExternalApiSettings()
    wechat: WeChatSettings = WeChatSettings()
    xhs: XhsSettings = XhsSettings()
    database: DatabaseSettings = DatabaseSettings()

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


def load_settings() -> Settings:
    """加载配置"""
    return Settings()


# 全局配置实例
settings = load_settings()