from pydantic import BaseModel
from typing import Dict, List, Optional

class StaffWorkload(BaseModel):
    staff_id: int
    staff_name: str
    active_complaints: int

class AdminAnalyticsResponse(BaseModel):
    total_complaints: int
    status_distribution: Dict[str, int]
    category_distribution: Dict[str, int]
    average_feedback_rating: Optional[float] = None
    staff_workload: List[StaffWorkload]
