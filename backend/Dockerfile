FROM python:3.13-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install --no-install-recommends -y postgresql-client \
    && rm -rf /var/lib/apt/lists/* \
    && pip install --no-cache-dir uv

COPY pyproject.toml ./
RUN uv sync --no-dev

ENV PATH="/app/.venv/bin:${PATH}"

COPY alembic.ini ./
COPY alembic ./alembic
COPY app ./app

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
