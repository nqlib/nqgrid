"""Report emails: message building, recipient checks, SMTP settings. Never sends real email."""

from __future__ import annotations

from email import message_from_bytes, policy
from email.message import EmailMessage
from pathlib import Path

import pytest

from nqgrid_export.email import OutboxEmailSender, SmtpSettings, build_report_email, validate_recipients


def test_builds_a_message_with_the_attachment() -> None:
    msg = build_report_email(
        sender="reports@secolab.example",
        to=["a@secolab.example", "b@secolab.example"],
        cc=["c@secolab.example"],
        subject="FY26 Sales Plan (PDF)",
        body="See attached.",
        attachment=b"%PDF-1.4 test",
        filename="planning-fy26.pdf",
    )
    assert msg["To"] == "a@secolab.example, b@secolab.example"
    assert msg["Cc"] == "c@secolab.example"
    assert msg["Message-ID"].endswith("@secolab.example>")
    parsed = message_from_bytes(msg.as_bytes(), policy=policy.default)
    assert isinstance(parsed, EmailMessage)
    body = parsed.get_body(("plain",))
    assert body is not None and body.get_content().strip() == "See attached."
    (attachment,) = list(parsed.iter_attachments())
    assert attachment.get_content_type() == "application/pdf"
    assert attachment.get_filename() == "planning-fy26.pdf"
    assert attachment.get_content() == b"%PDF-1.4 test"


def test_xlsx_mime_type_and_header_injection() -> None:
    msg = build_report_email(
        sender="r@x.example", to=["a@x.example"], subject="s", body="b", attachment=b"PK", filename="r.xlsx"
    )
    (att,) = list(msg.iter_attachments())
    assert att.get_content_type() == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    with pytest.raises(ValueError, match="single line"):
        build_report_email(
            sender="r@x.example",
            to=["a@x.example"],
            subject="hi\nBcc: evil@x.example",
            body="",
            attachment=b"",
            filename="r.pdf",
        )
    with pytest.raises(ValueError, match="recipient"):
        build_report_email(sender="r@x.example", to=[], subject="s", body="", attachment=b"", filename="r.pdf")


def test_validate_recipients() -> None:
    assert validate_recipients(["ana@secolab.example"]) == []
    assert validate_recipients(["Ana <ana@x.example>", "no-at", "a@b"]) == [
        "email_to[0]: 'Ana <ana@x.example>' is not a plain email address",
        "email_to[1]: 'no-at' is not a plain email address",
        "email_to[2]: 'a@b' is not a plain email address",
    ]
    assert validate_recipients(["a@Secolab.example", "b@gmail.com"], allowed_domains=["secolab.example"]) == [
        "email_to[1]: 'b@gmail.com' is outside the allowed domains (secolab.example)"
    ]


def test_smtp_settings_from_env() -> None:
    env = {
        "NQGRID_SMTP_HOST": "smtp.example",
        "NQGRID_SMTP_FROM": "r@x.example",
        "NQGRID_SMTP_SECURITY": "ssl",
        "NQGRID_SMTP_USERNAME": "u",
    }
    s = SmtpSettings.from_env(env)
    assert (s.host, s.port, s.security, s.username, s.password) == ("smtp.example", 465, "ssl", "u", None)
    assert SmtpSettings.from_env({**env, "NQGRID_SMTP_SECURITY": "starttls", "NQGRID_SMTP_PORT": "2525"}).port == 2525
    with pytest.raises(ValueError, match="NQGRID_SMTP_HOST"):
        SmtpSettings.from_env({})
    with pytest.raises(ValueError, match="SECURITY"):
        SmtpSettings.from_env({**env, "NQGRID_SMTP_SECURITY": "tls13"})


def test_outbox_sender_writes_eml(tmp_path: Path) -> None:
    sender = OutboxEmailSender(tmp_path / "outbox")
    msg = build_report_email(
        sender="r@x.example", to=["a@x.example"], subject="FY26 / Plan", body="b", attachment=b"x", filename="r.pdf"
    )
    sender.send(msg)
    sender.send(msg)
    assert [p.name for p in sender.sent] == ["0001-FY26_Plan.eml", "0002-FY26_Plan.eml"]
    assert b"Subject: FY26 / Plan" in sender.sent[0].read_bytes()
