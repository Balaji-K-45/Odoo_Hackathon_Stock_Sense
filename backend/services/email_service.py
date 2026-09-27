"""SMTP delivery for account security messages."""

from email.message import EmailMessage
import os
import smtplib


def is_configured():
    return bool(
        os.getenv("SMTP_HOST")
        and os.getenv("SMTP_USERNAME")
        and os.getenv("SMTP_PASSWORD")
    )


def send_email(recipient, subject, body):
    host = os.getenv("SMTP_HOST")
    sender = os.getenv("SMTP_USERNAME")
    if not host or not sender or not os.getenv("SMTP_PASSWORD"):
        raise RuntimeError("SMTP configuration is incomplete")

    port = int(os.getenv("SMTP_PORT", "587"))
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() == "true"

    message = EmailMessage()
    message["From"] = sender
    message["To"] = recipient
    message["Subject"] = subject
    message.set_content(body)

    with smtplib.SMTP(host, port, timeout=15) as client:
        if use_tls:
            client.starttls()
        client.login(username, password)
        client.send_message(message)