from pydantic import BaseModel, Field
from typing import Dict, List, Optional

class StaffWorkload(BaseModel):
    staff_id: int
    staff_name: str
    active_complaints: int
    resolved_complaints: int = 0
    total_assigned: int = 0

class TrendPoint(BaseModel):
    period: str
    submitted: int = 0
    resolved: int = 0

class AdminAnalyticsResponse(BaseModel):
    total_complaints: int
    status_distribution: Dict[str, int]
    category_distribution: Dict[str, int]
    priority_distribution: Dict[str, int] = Field(default_factory=dict)
    average_feedback_rating: Optional[float] = None
    average_resolution_hours: Optional[float] = None
    staff_workload: List[StaffWorkload]
    daily_trend: List[TrendPoint] = Field(default_factory=list)
    weekly_trend: List[TrendPoint] = Field(default_factory=list)
