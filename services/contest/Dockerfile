# syntax=docker/dockerfile:1
#
# Author : Rajveer Sharma
# Date : 17 Nov 2026
# @ Nxtwave
#
# One image for both processes:
#   API:    the default command (migrate, then Gunicorn on :8000)
#   worker: python -m app.cli worker   (exactly one replica)

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    TZ=Asia/Kolkata \
    APP_ENV=production \
    BIND=0.0.0.0:8000

WORKDIR /srv/contest

# Editable install: migrations and alembic.ini are found next to the app package.
COPY pyproject.toml alembic.ini gunicorn.conf.py ./
COPY app ./app
COPY migrations ./migrations
RUN pip install --no-cache-dir -e ".[prod]" \
 && useradd --system --uid 10001 --home-dir /srv/contest contest

USER contest
EXPOSE 8000
CMD ["sh", "-c", "python -m app.cli init-db && exec gunicorn -c gunicorn.conf.py 'app.api.app:create_app()'"]
