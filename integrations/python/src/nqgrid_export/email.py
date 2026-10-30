"""Email a report as an attachment through an injectable sender.

:func:`build_report_email` builds a plain-text ``EmailMessage`` with the file attached; an
:class:`EmailSender` delivers it. :class:`SmtpEmailSender` reads ``NQGRID_SMTP_*`` env vars;
:class:`OutboxEmailSender` writes ``.eml`` files instead (local development, demos). Tests inject a fake.

==========================  ===========================================================
``NQGRID_SMTP_HOST``        SMTP server (required for :meth:`SmtpSettings.from_env`)
``NQGRID_SMTP_PORT``        default 587 (465 with ``ssl``)
``NQGRID_SMTP_SECURITY``    ``starttls`` (default) · ``ssl`` · ``none`` (only for a local relay)
``NQGRID_SMTP_USERNAME``    optional login
``NQGRID_SMTP_PASSWORD``    optional password
``NQGRID_SMTP_FROM``        From address (required)
``NQGRID_SMTP_TIMEOUT``     seconds, default 30
==========================  ===========================================================
"""

from __future__ import annotations

import mimetypes
import os
import re
import smtplib
import ssl
from collections.abc import Collection, Iterable, Mapping, Sequence
from dataclasses import dataclass
from email.message import EmailMessage
from email.utils import formatdate, make_msgid
from pathlib import Path
from typing import Literal, Protocol

_ADDRESS = re.compile(
    r"^[^@\s<>,;\"]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$"
)


class EmailSender(Protocol):
    """Delivers a built message (SMTP, an email API, a queue, …)."""

    def send(self, message: EmailMessage) -> None: ...


def validate_recipients(addresses: Iterable[str], *, allowed_domains: Collection[str] | None = None) -> list[str]:
    """Problems with recipient addresses (``[]`` when fine). ``allowed_domains`` restricts where reports may go."""
    errors: list[str] = []
    allowed = {d.lower().lstrip("@") for d in allowed_domains} if allowed_domains else None
    for i, addr in enumerate(addresses):
        if not isinstance(addr, str) or not _ADDRESS.match(addr):
            errors.append(f"email_to[{i}]: {addr!r} is not a plain email address")
        elif allowed is not None and addr.rsplit("@", 1)[1].lower() not in allowed:
            errors.append(f"email_to[{i}]: {addr!r} is outside the allowed domains ({', '.join(sorted(allowed))})")
    return errors


def _header(value: str, name: str) -> str:
    if "\r" in value or "\n" in value:
        raise ValueError(f"{name} must be a single line")
    return value


def build_report_email(
    *,
    sender: str,
    to: Sequence[str],
    subject: str,
    body: str,
    attachment: bytes,
    filename: str,
    mime_type: str | None = None,
    cc: Sequence[str] = (),
    reply_to: str | None = None,
) -> EmailMessage:
    """Plain-text message with one attachment (type guessed from ``filename`` unless given)."""
    if not to:
        raise ValueError("at least one recipient is required")
    msg = EmailMessage()
    msg["From"] = _header(sender, "sender")
    msg["To"] = ", ".join(_header(a, "recipient") for a in to)
    if cc:
        msg["Cc"] = ", ".join(_header(a, "recipient") for a in cc)
    if reply_to:
        msg["Reply-To"] = _header(reply_to, "reply_to")
    msg["Subject"] = _header(subject, "subject")
    msg["Date"] = formatdate(localtime=False, usegmt=True)
    msg["Message-ID"] = make_msgid(domain=sender.rsplit("@", 1)[-1] if "@" in sender else None)
    msg.set_content(body)
    kind = (mime_type or mimetypes.guess_type(filename)[0] or "application/octet-stream").split(";")[0]
    maintype, _, subtype = kind.partition("/")
    msg.add_attachment(
        attachment, maintype=maintype, subtype=subtype or "octet-stream", filename=_header(filename, "filename")
    )
    return msg


@dataclass(frozen=True)
class SmtpSettings:
    host: str
    sender: str
    port: int = 587
    security: Literal["starttls", "ssl", "none"] = "starttls"
    username: str | None = None
    password: str | None = None
    timeout: float = 30.0

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None, prefix: str = "NQGRID_SMTP_") -> SmtpSettings:
        env = os.environ if environ is None else environ
        host = env.get(f"{prefix}HOST")
        sender = env.get(f"{prefix}FROM")
        if not host or not sender:
            raise ValueError(f"set {prefix}HOST and {prefix}FROM to send email")
        security = env.get(f"{prefix}SECURITY", "starttls").lower()
        if security not in ("starttls", "ssl", "none"):
            raise ValueError(f"{prefix}SECURITY must be starttls, ssl or none")
        default_port = 465 if security == "ssl" else 587
        return cls(
            host=host,
            sender=sender,
            port=int(env.get(f"{prefix}PORT", default_port)),
            security=security,  # type: ignore[arg-type]
            username=env.get(f"{prefix}USERNAME") or None,
            password=env.get(f"{prefix}PASSWORD") or None,
            timeout=float(env.get(f"{prefix}TIMEOUT", 30)),
        )


class SmtpEmailSender:
    """``smtplib`` sender (TLS verified with the system trust store)."""

    def __init__(self, settings: SmtpSettings) -> None:
        self.settings = settings

    @classmethod
    def from_env(cls, environ: Mapping[str, str] | None = None) -> SmtpEmailSender:
        return cls(SmtpSettings.from_env(environ))

    @property
    def sender(self) -> str:
        return self.settings.sender

    def send(self, message: EmailMessage) -> None:
        s = self.settings
        context = ssl.create_default_context()
        smtp: smtplib.SMTP
        if s.security == "ssl":
            smtp = smtplib.SMTP_SSL(s.host, s.port, timeout=s.timeout, context=context)
        else:
            smtp = smtplib.SMTP(s.host, s.port, timeout=s.timeout)
        with smtp:
            if s.security == "starttls":
                smtp.starttls(context=context)
            if s.username:
                smtp.login(s.username, s.password or "")
            smtp.send_message(message)


class OutboxEmailSender:
    """Writes each message to ``<directory>/<n>-<subject>.eml`` instead of sending (dev / demo)."""

    def __init__(self, directory: str | Path) -> None:
        self.directory = Path(directory)
        self.sent: list[Path] = []

    def send(self, message: EmailMessage) -> None:
        self.directory.mkdir(parents=True, exist_ok=True)
        stem = re.sub(r"[^\w.-]+", "_", str(message["Subject"] or "message"))[:60]
        path = self.directory / f"{len(list(self.directory.glob('*.eml'))) + 1:04d}-{stem}.eml"
        path.write_bytes(message.as_bytes())
        self.sent.append(path)
