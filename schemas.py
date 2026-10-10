from typing import Any, Dict, List, Literal, Optional

from pydantic import BaseModel, Field, model_validator


DEFAULT_GROWTH_GOAL = "提升账号的稳定涨粉效率"


class QuizAnswerSet(BaseModel):
    session_id: Optional[str] = None
    answers: List[Literal["A", "B", "C", "D"]] = Field(min_length=16, max_length=16)
    desired_content: str = Field(..., min_length=1, max_length=2000)
    growth_goal: str = Field(default=DEFAULT_GROWTH_GOAL, min_length=1, max_length=300)
    target_duration: int = Field(..., ge=15, le=3000)


class PersonaProfile(BaseModel):
    type: str
    label: str
    explanation: Optional[str] = None
    traits: List[str] = Field(default_factory=list)
    desired_content: str
    target_duration: int = Field(ge=15, le=3000)
    growth_goal: str = Field(default=DEFAULT_GROWTH_GOAL, min_length=1, max_length=300)


class TopicItem(BaseModel):
    title: str
    hook: str
    angle: str
    heat: int = Field(ge=0, le=100)
    fit: int = Field(ge=0, le=100)
    growth_potential: int = Field(ge=0, le=100)
    reason: str


class TopicResponse(BaseModel):
    session_id: Optional[str] = None
    topics: List[TopicItem]
    graph_trace: List[str] = Field(default_factory=list)


class ProfileAnalyzeResponse(BaseModel):
    session_id: Optional[str] = None
    profile: PersonaProfile
    positioning: Dict[str, Any]
    graph_trace: List[str] = Field(default_factory=list)


class TopicGenerateRequest(BaseModel):
    session_id: Optional[str] = None
    profile: PersonaProfile
    positioning: Optional[Dict[str, Any]] = None
    previous_rejections: List[Dict[str, Any]] = Field(default_factory=list)
    strategy_memory: Dict[str, Any] = Field(default_factory=dict)


class ScriptGenerateRequest(BaseModel):
    session_id: Optional[str] = None
    profile: PersonaProfile
    selected_topic: Dict[str, Any]


class ScriptResponse(BaseModel):
    session_id: Optional[str] = None
    title: str
    target_duration: int
    hook: str
    summary: str
    cover_text: str
    comment_cta: str
    timeline: List[Dict[str, Any]]
    estimated_voiceover_seconds: float = 0
    voiceover_characters: int = 0
    timing_note: str = "时长为口播估算，实际拍摄可根据停顿和画面调整。"
    graph_trace: List[str] = Field(default_factory=list)


class OperatorGenerateRequest(BaseModel):
    session_id: Optional[str] = None
    profile: PersonaProfile
    selected_topic: Dict[str, Any]


class OperatorResponse(BaseModel):
    session_id: Optional[str] = None
    publish_time: str
    schedule: List[str]
    comment_hooks: List[str]
    interaction_tips: List[str]
    graph_trace: List[str] = Field(default_factory=list)


class ManualMetrics(BaseModel):
    views: int = Field(ge=1, strict=True)
    likes: int = Field(ge=0, strict=True)
    comments: int = Field(ge=0, strict=True)
    shares: int = Field(ge=0, strict=True)
    follows: int = Field(ge=0, strict=True)


class PerformanceFetchRequest(BaseModel):
    session_id: Optional[str] = None
    video_id: Optional[str] = None
    mode: Literal["manual", "mock", "real_api"] = "mock"
    manual_metrics: Optional[ManualMetrics] = None

    @model_validator(mode="after")
    def validate_source(self):
        if self.mode == "manual" and self.manual_metrics is None:
            raise ValueError("手动模式需要填写真实数据。")
        if self.mode == "real_api" and not self.video_id:
            raise ValueError("平台接口模式需要视频 ID。")
        return self


class PerformanceResponse(BaseModel):
    session_id: Optional[str] = None
    source: Literal["manual", "mock", "real_api"]
    views: int = Field(ge=0)
    likes: int = Field(ge=0)
    comments: int = Field(ge=0)
    shares: int = Field(ge=0)
    follows: int = Field(ge=0)
    engagement_rate: float = Field(ge=0)
    graph_trace: List[str] = Field(default_factory=list)


class DiagnosisAnalyzeRequest(BaseModel):
    session_id: Optional[str] = None
    profile: PersonaProfile
    selected_topic: Dict[str, Any]
    performance: Dict[str, Any]
    strategy_memory: Dict[str, Any] = Field(default_factory=dict)


class DiagnosisResponse(BaseModel):
    session_id: Optional[str] = None
    diagnosis: Dict[str, Any]
    strategy: Dict[str, Any]
    graph_trace: List[str] = Field(default_factory=list)
