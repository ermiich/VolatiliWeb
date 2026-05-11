import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from pathlib import Path

from app.api.router import api_router
from app.config import settings


app = FastAPI(title="VolatiliWeb API", version="0.1.0")
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def enforce_max_request_size(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        max_bytes = settings.max_upload_size_mb * 1024 * 1024
        if int(content_length) > max_bytes:
            return JSONResponse(
                status_code=413,
                content={
                    "error": "file_too_large",
                    "message": "El archivo supera el limite configurado",
                },
            )
    return await call_next(request)


@app.on_event("startup")
async def startup_event() -> None:
    Path(settings.evidence_path).mkdir(parents=True, exist_ok=True)
    Path(settings.symbols_path).mkdir(parents=True, exist_ok=True)


@app.get("/health")
async def health_check() -> dict:
    return {"status": "ok", "version": "0.1.0"}


@app.exception_handler(StarletteHTTPException)
async def http_exception_handler(request: Request, exc: StarletteHTTPException):
    if exc.status_code == 404:
        return JSONResponse(
            status_code=404,
            content={"error": "not_found", "message": "Recurso no encontrado", "detail": None},
        )
    if exc.status_code == 413:
        return JSONResponse(
            status_code=413,
            content={
                "error": "file_too_large",
                "message": "El archivo supera el limite configurado",
            },
        )
    return JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={"error": "validation_error", "message": "Error de validacion", "detail": exc.errors()},
    )


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception at %s", request.url.path)
    return JSONResponse(
        status_code=500,
        content={
            "error": "internal_error",
            "message": "Error interno. Ver logs del servidor.",
        },
    )


app.include_router(api_router, prefix="/api")
