"""Production entry point: the API and the built React app from one server.

The API moves under /api because the app's own pages share paths with it:
a browser opening /documents must get the page, not the JSON list. Serving
both from one origin also means no CORS setup and a single URL to deploy.
Local development is unchanged: it runs app.main on its own.
"""
from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse

from app.main import app_factory


def site_factory() -> FastAPI:  # uvicorn --factory app.site:site_factory
    api = app_factory()
    dist = Path(api.state.settings.frontend_dir).resolve()
    if not (dist / "index.html").is_file():
        raise RuntimeError(f"No built frontend at {dist}; run `npm run build` in frontend/.")

    site = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)
    site.mount("/api", api)

    @site.get("/{path:path}", include_in_schema=False)
    def frontend(path: str):
        file = (dist / path).resolve()
        # Real files (hashed JS/CSS, favicon) as-is; every other path is a
        # client-side route, so it gets index.html and React Router takes over.
        if path and file.is_file() and file.is_relative_to(dist):
            return FileResponse(file)
        return FileResponse(dist / "index.html")

    return site
