from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from typing import Optional, Annotated
from datetime import datetime

NonEmptyStr1000 = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]

class FeedbackCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5, description="Rating from 1 to 5")
    comment: Optional[NonEmptyStr1000] = Field(None, description="Optional comment")

class FeedbackResponse(BaseModel):
    id: int
    complaint_id: int
    student_id: int
    rating: int
    comment: Optional[str] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)
