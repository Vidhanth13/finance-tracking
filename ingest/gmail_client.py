"""Direct Gmail API access (read-only). No third-party CLI required.

Handles the installed-app OAuth flow, caches the token, and exposes the two
calls the pipeline needs: search (list message ids) and get (full message).
"""
from __future__ import annotations

import base64
from pathlib import Path
from typing import Any

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import build

# Read-only. This tool never sends, deletes, or modifies mail.
SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"]


class GmailClient:
    def __init__(self, client_secret_file: Path, token_file: Path, user: str = "me"):
        self.client_secret_file = Path(client_secret_file)
        self.token_file = Path(token_file)
        self.user = user
        self._service = None

    def _credentials(self) -> Credentials:
        creds: Credentials | None = None
        if self.token_file.exists():
            creds = Credentials.from_authorized_user_file(str(self.token_file), SCOPES)
        if creds and creds.valid:
            return creds
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not self.client_secret_file.exists():
                raise FileNotFoundError(
                    f"OAuth client secret not found: {self.client_secret_file}\n"
                    "Download it from Google Cloud Console (Desktop app) — see README."
                )
            flow = InstalledAppFlow.from_client_secrets_file(
                str(self.client_secret_file), SCOPES
            )
            # Opens a browser once; falls back to console on headless hosts.
            creds = flow.run_local_server(port=0)
        self.token_file.write_text(creds.to_json(), encoding="utf-8")
        return creds

    @property
    def service(self):
        if self._service is None:
            self._service = build(
                "gmail", "v1", credentials=self._credentials(), cache_discovery=False
            )
        return self._service

    def search(self, query: str, max_results: int = 50) -> list[str]:
        """Return message ids matching a Gmail search query."""
        ids: list[str] = []
        req = self.service.users().messages().list(
            userId=self.user, q=query, maxResults=min(max_results, 500)
        )
        while req is not None and len(ids) < max_results:
            resp = req.execute()
            ids.extend(m["id"] for m in resp.get("messages", []))
            req = self.service.users().messages().list_next(req, resp)
        return ids[:max_results]

    def get(self, message_id: str) -> dict[str, Any]:
        """Return one full message resource."""
        return self.service.users().messages().get(
            userId=self.user, id=message_id, format="full"
        ).execute()


def header(message: dict[str, Any], name: str, default: str = "") -> str:
    for h in message.get("payload", {}).get("headers", []) or []:
        if h.get("name", "").lower() == name.lower():
            return h.get("value", default)
    return default


def decode_parts(payload: dict[str, Any], acc: list[str]) -> None:
    """Recursively collect decoded text/html and text/plain bodies."""
    if not payload:
        return
    body = payload.get("body", {}) or {}
    data = body.get("data")
    mime = payload.get("mimeType", "") or ""
    if data and ("text/html" in mime or "text/plain" in mime):
        try:
            acc.append(base64.urlsafe_b64decode(data + "===").decode("utf-8", "replace"))
        except Exception:
            pass
    for p in payload.get("parts", []) or []:
        decode_parts(p, acc)
