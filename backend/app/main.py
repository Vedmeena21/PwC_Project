from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import invoices, rulebook, settings, auth

app = FastAPI(
    title="Invoice Approval System",
    description="Automated invoice parsing, validation, and approval recommendation engine",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# No cookies or auth headers cross origins, so credentials are off.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# All routes are prefixed with /api so the Vite proxy can forward them cleanly.
app.include_router(auth.router,     prefix="/api")
app.include_router(invoices.router, prefix="/api")
app.include_router(rulebook.router, prefix="/api")
app.include_router(settings.router, prefix="/api")


# Pinged by UptimeRobot every 5 minutes to keep the Render free instance warm.
@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/")
async def root():
    return {"message": "Invoice Approval System API", "version": "1.0.0", "docs": "/docs"}
