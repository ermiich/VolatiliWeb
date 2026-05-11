import pytest
import httpx

BASE_URL = "http://localhost:8000"


@pytest.fixture(scope="session")
def client():
    with httpx.Client(base_url=BASE_URL, timeout=600.0) as httpx_client:
        yield httpx_client


@pytest.fixture(scope="session")
def state():
    return {
        "case_id": None,
        "dump_id": None,
        "execution_id": None,
        "dump_ext": None,
    }
