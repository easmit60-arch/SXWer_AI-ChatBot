"""
Resource Manager

Validates URLs and deduplicates entries in resources.json using httpx for
async HTTP requests.  Falls back to the standard-library urllib when httpx is
not installed so the service works in minimal environments.

Public functions:
  validate_resources(path)  — check URL reachability, return a report
  update_resources(path)    — deduplicate entries and rewrite the file
"""

import copy
import json
import logging
import os
import urllib.request
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Optional httpx import (async HTTP)
# ---------------------------------------------------------------------------
try:
    import httpx

    HTTPX_AVAILABLE = True
except ImportError:
    HTTPX_AVAILABLE = False

# Path to resources.json relative to this module (one directory up)
_DEFAULT_RESOURCES_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "resources.json")
)

_URL_TIMEOUT = 6.0  # seconds per URL check


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

# Allowed base directory: only paths inside the repository root are permitted.
_REPO_ROOT = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))


def _resolve_path(resources_path: Optional[str]) -> str:
    """
    Resolve ``resources_path`` to an absolute path inside the repository root.

    Raises ValueError if the resolved path would escape the repo directory,
    preventing path traversal from user-supplied input.
    """
    if not resources_path or resources_path == "resources.json":
        return _DEFAULT_RESOURCES_PATH

    # Resolve relative to repo root (not the caller's cwd)
    candidate = os.path.normpath(os.path.join(_REPO_ROOT, resources_path))

    # Enforce that the result stays inside the allowed base directory
    if not candidate.startswith(_REPO_ROOT + os.sep) and candidate != _REPO_ROOT:
        raise ValueError(
            f"Requested path '{resources_path}' resolves outside the allowed "
            "directory. Only paths inside the repository root are permitted."
        )

    return candidate


def _load_json(path: str) -> Dict:
    if not os.path.exists(path):
        raise FileNotFoundError(f"Resources file not found: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: str, data: Dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
        f.write("\n")  # trailing newline for POSIX compliance


async def _check_url_async(url: str) -> bool:
    """Async URL check using httpx."""
    try:
        async with httpx.AsyncClient(
            timeout=_URL_TIMEOUT, follow_redirects=True
        ) as client:
            resp = await client.head(url)
            return resp.status_code < 400
    except Exception:
        return False


def _check_url_sync(url: str) -> bool:
    """Sync URL check using urllib (fallback)."""
    if not url:
        return False
    try:
        req = urllib.request.Request(url, method="HEAD")
        with urllib.request.urlopen(req, timeout=int(_URL_TIMEOUT)) as resp:
            return resp.status < 400
    except Exception:
        return False


async def _check_url(url: str) -> bool:
    if HTTPX_AVAILABLE:
        return await _check_url_async(url)
    return _check_url_sync(url)


def _dedup_organizations(organizations: List[Dict]) -> List[Dict]:
    """
    Remove duplicate organizations.

    Two entries are considered duplicates when they share the same
    (lowercased name, lowercased website URL) pair.  The first occurrence
    is kept and IDs are reassigned sequentially.
    """
    seen: set = set()
    deduped: List[Dict] = []

    for org in organizations:
        key = (
            org.get("name", "").strip().lower(),
            org.get("website", "").strip().lower(),
        )
        if key in seen:
            continue
        seen.add(key)
        org = dict(org)  # shallow copy to avoid mutating original
        org["id"] = len(deduped) + 1
        deduped.append(org)

    return deduped


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

async def validate_resources(
    resources_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Check all organization URLs in resources.json for reachability.

    Returns a report dict with:
      - total         (int)
      - valid         (list of {name, url})
      - unreachable   (list of {name, url})
      - duplicates    (list of {name, url, duplicate_of})
      - checked_path  (str)
    """
    path = _resolve_path(resources_path)
    data = _load_json(path)
    organizations = data.get("organizations", [])

    report: Dict[str, Any] = {
        "total": len(organizations),
        "valid": [],
        "unreachable": [],
        "duplicates": [],
        "checked_path": path,
    }

    seen_urls: Dict[str, str] = {}

    for org in organizations:
        name = org.get("name", "")
        url = org.get("website", "")

        if url and url in seen_urls:
            report["duplicates"].append(
                {"name": name, "url": url, "duplicate_of": seen_urls[url]}
            )
            continue

        if url:
            seen_urls[url] = name

        reachable = await _check_url(url) if url else False
        entry = {"name": name, "url": url}
        if reachable:
            report["valid"].append(entry)
        else:
            report["unreachable"].append(entry)

    return report


async def update_resources(
    resources_path: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Deduplicate resources.json and rewrite it in place.

    Returns a summary dict with:
      - removed_duplicates   (int)
      - total_organizations  (int)
      - path                 (str)
    """
    path = _resolve_path(resources_path)
    data = _load_json(path)
    original_count = len(data.get("organizations", []))

    data["organizations"] = _dedup_organizations(data.get("organizations", []))
    new_count = len(data["organizations"])

    _write_json(path, data)
    logger.info(
        "resources.json updated: %d → %d organizations (%d duplicates removed).",
        original_count,
        new_count,
        original_count - new_count,
    )

    return {
        "removed_duplicates": original_count - new_count,
        "total_organizations": new_count,
        "path": path,
    }
