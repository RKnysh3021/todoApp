from collections.abc import Generator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.database import Base
from app.main import app, db_session


SQLALCHEMY_DATABASE_URL = "sqlite:///./test_todo.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_db() -> Generator[Session, None, None]:
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(autouse=True)
def reset_database() -> Generator[None, None, None]:
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    app.dependency_overrides[db_session] = override_db
    yield
    app.dependency_overrides.clear()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    with TestClient(app) as test_client:
        yield test_client


def test_healthcheck(client: TestClient) -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_index_returns_html(client: TestClient) -> None:
    response = client.get("/")

    assert response.status_code == 200
    assert "text/html" in response.headers["content-type"]
    assert "TODO App" in response.text


def test_list_tasks_is_empty_initially(client: TestClient) -> None:
    response = client.get("/tasks/")

    assert response.status_code == 200
    assert response.json() == []


def test_task_crud_flow(client: TestClient) -> None:
    create_response = client.post(
        "/tasks/",
        json={"title": "Купить молоко", "description": "В магазине у дома"},
    )

    assert create_response.status_code == 201
    created_task = create_response.json()
    task_id = created_task["id"]
    assert created_task["title"] == "Купить молоко"
    assert created_task["description"] == "В магазине у дома"
    assert created_task["is_completed"] is False

    list_response = client.get("/tasks/")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    get_response = client.get(f"/tasks/{task_id}")
    assert get_response.status_code == 200
    assert get_response.json()["id"] == task_id

    update_response = client.put(
        f"/tasks/{task_id}",
        json={"title": "Купить хлеб", "is_completed": True},
    )
    assert update_response.status_code == 200
    updated_task = update_response.json()
    assert updated_task["title"] == "Купить хлеб"
    assert updated_task["is_completed"] is True

    delete_response = client.delete(f"/tasks/{task_id}")
    assert delete_response.status_code == 204

    not_found_response = client.get(f"/tasks/{task_id}")
    assert not_found_response.status_code == 404
    assert not_found_response.json() == {"detail": "Task not found"}


def test_create_task_requires_title(client: TestClient) -> None:
    response = client.post("/tasks/", json={"description": "Без названия"})

    assert response.status_code == 422


def test_get_missing_task_returns_404(client: TestClient) -> None:
    response = client.get("/tasks/999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found"}


def test_update_missing_task_returns_404(client: TestClient) -> None:
    response = client.put("/tasks/999", json={"title": "Новая задача"})

    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found"}


def test_delete_missing_task_returns_404(client: TestClient) -> None:
    response = client.delete("/tasks/999")

    assert response.status_code == 404
    assert response.json() == {"detail": "Task not found"}
