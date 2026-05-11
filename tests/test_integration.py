"""
Test de integracion para verificar el flujo completo del MVP.

Prerrequisito: El stack Docker Compose debe estar corriendo.
              Colocar un volcado de prueba pequeno (< 500 MB) en tests/fixtures/

Ejecutar con: pytest tests/test_integration.py -v
"""

import time
from pathlib import Path

import pytest

BASE_URL = "http://localhost:8000"
FIXTURE_DUMP = Path(__file__).parent / "fixtures" / "test.mem"


def test_health_check(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json().get("status") == "ok"


def test_create_case(client, state):
    response = client.post("/api/cases", json={"name": "Test Case", "description": "Integration"})
    assert response.status_code == 201
    payload = response.json()
    state["case_id"] = payload["id"]


def test_upload_dump(client, state):
    assert FIXTURE_DUMP.exists()
    with FIXTURE_DUMP.open("rb") as handle:
        response = client.post(
            f"/api/cases/{state['case_id']}/dumps",
            files={"file": (FIXTURE_DUMP.name, handle, "application/octet-stream")},
        )
    assert response.status_code == 201
    payload = response.json()
    state["dump_id"] = payload["id"]
    state["dump_ext"] = FIXTURE_DUMP.suffix


def test_upload_deduplication(client, state):
    with FIXTURE_DUMP.open("rb") as handle:
        response = client.post(
            f"/api/cases/{state['case_id']}/dumps",
            files={"file": (FIXTURE_DUMP.name, handle, "application/octet-stream")},
        )
    assert response.status_code == 200
    assert response.headers.get("X-Deduplicated") == "true"


def test_os_detection_completes(client, state):
    deadline = time.time() + 60
    while time.time() < deadline:
        response = client.get(f"/api/dumps/{state['dump_id']}")
        assert response.status_code == 200
        if response.json().get("status") == "ready":
            return
        time.sleep(3)
    pytest.fail("OS detection did not complete in time")


def test_execute_pslist(client, state):
    response = client.post(
        f"/api/dumps/{state['dump_id']}/execute",
        json={"plugin_name": "windows.pslist.PsList"},
    )
    assert response.status_code == 202
    payload = response.json()
    state["execution_id"] = payload["id"]


def test_pslist_completes(client, state):
    deadline = time.time() + 120
    while time.time() < deadline:
        response = client.get(f"/api/executions/{state['execution_id']}")
        assert response.status_code == 200
        payload = response.json()
        if payload.get("status") == "completed":
            result_data = payload.get("result_data")
            assert isinstance(result_data, list)
            assert result_data
            first_row = result_data[0]
            assert "PID" in first_row
            assert "PPID" in first_row
            assert "ImageFileName" in first_row
            return
        if payload.get("status") == "failed":
            pytest.fail("Plugin execution failed")
        time.sleep(3)
    pytest.fail("Plugin execution did not complete in time")


def test_results_persisted_in_db(client, state):
    response = client.post(
        f"/api/dumps/{state['dump_id']}/execute",
        json={"plugin_name": "windows.pslist.PsList"},
    )
    assert response.status_code in (200, 202)
    assert response.headers.get("X-Cached") == "true"


def test_delete_case_cleans_disk(client, state):
    case_id = state["case_id"]
    dump_id = state["dump_id"]
    dump_ext = state["dump_ext"]

    file_path = Path("/evidence") / case_id / f"{dump_id}{dump_ext}"

    response = client.delete(f"/api/cases/{case_id}")
    assert response.status_code == 204

    assert not file_path.exists()

    response = client.get(f"/api/cases/{case_id}")
    assert response.status_code == 404
