FROM python:3.11-slim

ENV POETRY_VERSION=1.8.3
RUN pip install --no-cache-dir poetry==${POETRY_VERSION}
WORKDIR /app
COPY pyproject.toml ./
COPY etl ./etl
RUN poetry config virtualenvs.create false \
    && poetry install --no-interaction --no-ansi --only main
CMD ["etl", "--help"]
