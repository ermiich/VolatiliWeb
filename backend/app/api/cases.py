from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_async_session
from app.models.case import Case
from app.models.dump import Dump
from app.schemas.case import CaseCreateRequest, CaseResponse, CaseDetailResponse
from app.core.storage import delete_dump_file


router = APIRouter(prefix="/cases")


@router.get("", response_model=list[CaseResponse])
async def list_cases(session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(select(Case).order_by(Case.created_at.desc()))
    return result.scalars().all()


@router.post("", response_model=CaseResponse, status_code=201)
async def create_case(payload: CaseCreateRequest, session: AsyncSession = Depends(get_async_session)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="El nombre del caso no puede estar vacio")

    new_case = Case(name=name, description=payload.description)
    session.add(new_case)
    await session.commit()
    await session.refresh(new_case)
    return new_case


@router.get("/{case_id}", response_model=CaseDetailResponse)
async def get_case(case_id: str, session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(
        select(Case)
        .where(Case.id == case_id)
        .options(selectinload(Case.dumps).selectinload(Dump.executions))
    )
    case = result.scalar_one_or_none()
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@router.delete("/{case_id}", status_code=204)
async def delete_case(case_id: str, session: AsyncSession = Depends(get_async_session)):
    result = await session.execute(
        select(Case).where(Case.id == case_id).options(selectinload(Case.dumps))
    )
    case = result.scalar_one_or_none()
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")

    for dump in case.dumps:
        delete_dump_file(dump.file_path)

    await session.delete(case)
    await session.commit()
    return None
