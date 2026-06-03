from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field


class PlanRequest(BaseModel):
    userInput: str
    modelType: str
    isPlannerMode: bool = True
    travelMode: str = "deep"
    refineInstruction: Optional[str] = None
    basePlan: Optional[Dict[str, Any]] = None


class RefineRequest(BaseModel):
    userInput: str
    refineInstruction: str
    basePlan: Dict[str, Any]
    modelType: str
    isPlannerMode: bool = True
    travelMode: str = "deep"


class Location(BaseModel):
    name: str
    lat: float
    lng: float
    city: str
    day: Optional[int] = None
    sequence: Optional[int] = None
    time: Optional[str] = None
    transit_hint: Optional[str] = None
    tags: Optional[List[str]] = None
    address: Optional[str] = None
    rating: Optional[float] = None


class SocialRecommendation(BaseModel):
    platform: Optional[str] = None
    category: Optional[str] = None
    name: str
    description: Optional[str] = None
    tags: Optional[List[str]] = None


class DayPlan(BaseModel):
    day: int
    date: Optional[str] = None
    itinerary: List[Location] = Field(default_factory=list)


class PlanResponse(BaseModel):
    itinerarySummary: str
    dayPlanItinerary: List[DayPlan] = Field(default_factory=list)
    socialRecommendations: List[SocialRecommendation] = Field(default_factory=list)
    evidence: List[Dict[str, Any]] = Field(default_factory=list)
    provider: str = ""
    mcpTrace: List[str] = Field(default_factory=list)
    mcpResults: Optional[List[Dict[str, Any]]] = None
    requestId: str = ""


class HealthResponse(BaseModel):
    ok: bool
    service: str
    city: str


class MetricsResponse(BaseModel):
    totalRequests: int = 0
    planRequests: int = 0
    refineRequests: int = 0
    failedRequests: int = 0
    cacheHits: int = 0
    totalEstimatedCost: float = 0.0
    providerCounts: Dict[str, int] = Field(default_factory=dict)
    lastError: Optional[Dict[str, Any]] = None
    executionLogSize: int = 0
    cacheSize: int = 0
    alertCount: int = 0
    updatedAt: str = ""


class AlertsResponse(BaseModel):
    alerts: List[Dict[str, Any]] = Field(default_factory=list)
    requestId: str = ""


class ReleaseStatusResponse(BaseModel):
    enable_canary: bool = False
    canary_percent: int = 10
    primary_provider: str = ""
    canary_provider: str = ""
    auto_rollback_on_failure: bool = True
    config_file: str = ""
    requestId: str = ""


class FrontendConfig(BaseModel):
    backend_url: str = ""
    tdt_api_key: str = ""
    map_center: List[float] = [30.5728, 104.0668]
    map_zoom: int = 12
    default_map_type: str = "tdt_vec"
    requestId: str = ""


class KnowledgeSearchResponse(BaseModel):
    q: str = ""
    evidence: List[Dict[str, Any]] = Field(default_factory=list)
    requestId: str = ""


class ExecutionLogResponse(BaseModel):
    log: Optional[Dict[str, Any]] = None
    requestId: str = ""
