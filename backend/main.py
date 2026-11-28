from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from api.routers import auth, complaints, admin, staff, notifications, upload
from core.config import settings

app = FastAPI(title="CampusFix API")

cors_origins = settings.cors_origins
allow_credentials = "*" not in cors_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=allow_credentials,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    return response

@app.get("/")
def root():
    return {"message": "Welcome to CampusFix API"}

app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(upload.router, prefix="/api/v1/upload", tags=["upload"])
app.include_router(complaints.router, prefix="/api/v1/complaints/student", tags=["student complaints"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(staff.router, prefix="/api/v1/staff", tags=["staff"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
