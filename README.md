# TODO API

Простое REST API для управления задачами на FastAPI и SQLAlchemy.

## Запуск локально

1. Создайте виртуальное окружение.
2. Установите зависимости:

```bash
pip install -r requirements.txt
```

3. При необходимости создайте `.env` на основе `.env.example`.
4. Запустите приложение:

```bash
uvicorn app.main:app --reload
```

По умолчанию используется SQLite-файл `todo.db`, а для Docker/PostgreSQL можно передать `DATABASE_URL`.

## Доступные эндпоинты

- `GET /health`
- `POST /tasks/`
- `GET /tasks/`
- `GET /tasks/{task_id}`
- `PUT /tasks/{task_id}`
- `DELETE /tasks/{task_id}`
