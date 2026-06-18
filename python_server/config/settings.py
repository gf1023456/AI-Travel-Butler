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
    amap_api_key: str = ""
    weather_api_key: str = ""
    tdt_api_key: str = "97f9870fb795ba80ef201d6edae71d73"
    pixabay_api_key: str = "55871092-ce4b6588eec534eb37300c1f9"
    serper_api_key: str = "0d140f37f3fad88ad695861df408a63b91394b1d"


class WeChatSettings(BaseModel):
    appid: str = "wx0c96ac321aba9e4a"
    secret: str = "3c38e48ffe8bf2075c4bbc314a770616"


class XhsSettings(BaseModel):
    cookie: str = "abRequestId=0f92185b-1213-5ce1-92b7-26cc493997ba; a1=19cadaf304dzgdwcgew4uwfrgqlk9m0ehmx6036dx50000208982; webId=3554cd13845969a25bf33dc7661ef98a; gid=yjS0f0iqfdxyyjS0f0iq86qK4fukfESkdE47CfCEiFkA1K28Tj68d8888J8YjYJ8qJDd8Siy; ets=1781748835555; webBuild=6.20.2; unread={%22ub%22:%226a0d32d1000000000803f2fe%22%2C%22ue%22:%226a0923900000000036018ed5%22%2C%22uc%22:30}; web_session=040069b864fb418e6578cd2906384bb1683585; id_token=VjEAAKGfOdJuo3coJyoQso72UJ/G0A/mNl4mQQIIwtq0V0ATG9MnWhlxDR7JAcFxzFcAD7PPyapnPNCa0EFE/tUBZt5qFFkseLNi7Jg9JmJIETqfP97VcjJWRoAjZv1eYLAHbzEt; x-rednote-datactry=CN; x-rednote-holderctry=CN; acw_tc=0a0b121217817529575244794e0a2f32984ecc73837a4620d92be11ba2f7b2; customer-sso-sid=68c517652572050125766657rdu6xuklwgndqj5m; x-user-id-ad-market.xiaohongshu.com=6910b809000000003700352e; customerClientId=329193766973764; access-token-ad-market.xiaohongshu.com=customer.ad_market.AT-68c517652572050125783042aanffzhxztdkaur6; websectiga=984412fef754c018e472127b8effd174be8a5d51061c991aadd200c69a2801d6; sec_poison_id=888607b7-6321-4bba-8728-c0026279013b; xsecappid=xhs-pc-web; loadts=1781753370176"


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