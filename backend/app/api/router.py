from fastapi import APIRouter

from app.api import cases, dumps, plugins


api_router = APIRouter()
api_router.include_router(cases.router, tags=["cases"])
api_router.include_router(dumps.router, tags=["dumps"])
api_router.include_router(plugins.router, tags=["plugins"])
