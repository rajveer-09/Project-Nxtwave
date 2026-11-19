# Author: Rajveer Sharma
# © NxtWave
# Date: 15 October 2026
"""Gunicorn settings for the contest API.

Gunicorn manages the processes (restarts a crashed worker, graceful reloads), and each
worker runs Uvicorn's event loop. Run from modules/contest/backend/ (the Dockerfile does this):

    gunicorn -c gunicorn.conf.py "app.api.app:create_app()"
"""

import multiprocessing
import os

# Only the web app talks to this service. In a container BIND is 0.0.0.0:8000.
bind = os.environ.get("BIND", "127.0.0.1:8000")

# One worker per core (capped): requests are mostly short DB round trips.
workers = int(os.environ.get("WEB_CONCURRENCY", min(multiprocessing.cpu_count(), 4)))
worker_class = "uvicorn_worker.UvicornWorker"  # uses uvloop + httptools when installed

# Each worker opens its own connection pool after forking; never share one across forks.
preload_app = False

timeout = 60            # a worker stuck this long is killed and replaced
graceful_timeout = 20   # finish in-flight requests on reload/stop
keepalive = 5           # the web app's proxy reuses upstream connections

# Restart workers now and then to cap slow memory growth; jitter avoids restarting all at once.
max_requests = 5000
max_requests_jitter = 500

# Trust X-Forwarded-* only from the web app (comma-separated IPs; loopback by default).
forwarded_allow_ips = os.environ.get("FORWARDED_ALLOW_IPS", "127.0.0.1")

# The app logs one JSON line per API request itself (app.requests: route, status,
# duration, database time, query count), so no separate access log.
accesslog = None
errorlog = "-"   # the container runtime collects stdout/stderr
loglevel = "info"
logconfig_dict = {
    "version": 1,
    "disable_existing_loggers": False,
    # lines logged during a request carry its ID: "app.errors [3f9c0a…]: …"
    "filters": {"rid": {"()": "app.request_context.RequestIdFilter"}},
    "formatters": {"plain": {"format": "%(asctime)s %(levelname)s %(name)s%(rid_tag)s: %(message)s"}},
    "handlers": {"stdout": {"class": "logging.StreamHandler", "formatter": "plain", "filters": ["rid"],
                            "stream": "ext://sys.stdout"}},
    "root": {"level": "INFO", "handlers": ["stdout"]},
    # Gunicorn merges this dict into its defaults one level deep, so its own loggers must be
    # listed here: the defaults point them at handlers this "handlers" key replaces.
    "loggers": {
        "gunicorn.error": {"level": "INFO", "handlers": ["stdout"], "propagate": False},
        "gunicorn.access": {"level": "INFO", "handlers": ["stdout"], "propagate": False},
    },
}
