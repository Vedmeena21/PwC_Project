import json
import resend
from typing import List, Optional

from app.core.config import get_settings
from app.models import RulebookDiffResult
from app.models import InvoiceRecommendation


# ── Shared: fetch notification recipients from DB ─────────────────────────────
# Recipients are stored as a JSON array in app_settings so they can be
# updated via the Settings UI without a redeployment.
def _get_recipients() -> List[str]:
    from app.core.config import get_supabase  # local import avoids circular dep
    db = get_supabase()
    res = (
        db.table("app_settings")
        .select("value")
        .eq("key", "notification_recipients")
        .execute()
    )
    if res.data:
        try:
            return json.loads(res.data[0]["value"])
        except Exception:
            return []
    return []


# ── Shared: verdict display helpers ──────────────────────────────────────────
# Centralised so both email builders use identical colour / label logic.
def _verdict_color(verdict: str) -> str:
    return {"approve": "#16a34a", "reject": "#dc2626", "needs_review": "#d97706"}.get(verdict, "#6b7280")

def _verdict_label(verdict: str) -> str:
    return {"approve": "APPROVED", "reject": "REJECTED", "needs_review": "NEEDS REVIEW"}.get(verdict, verdict.upper())

def _check_icon(passed: bool) -> str:
    return "✅" if passed else "❌"


# ── Shared: HTML email shell ──────────────────────────────────────────────────
# Wraps any inner HTML in the standard email shell (background, card, font).
def _email_shell(inner_html: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        {inner_html}
      </table>
    </td></tr>
  </table>
</body>
</html>"""


# ── Shared: dark header block ─────────────────────────────────────────────────
def _header_block(eyebrow: str, title: str) -> str:
    return f"""
    <tr>
      <td style="background:#0f172a;padding:24px 32px;">
        <p style="margin:0;color:#94a3b8;font-size:12px;letter-spacing:1px;text-transform:uppercase;">{eyebrow}</p>
        <h1 style="margin:8px 0 0;color:#ffffff;font-size:20px;font-weight:600;">{title}</h1>
      </td>
    </tr>"""


# ── Shared: standard footer ───────────────────────────────────────────────────
def _footer_block(note: str) -> str:
    return f"""
    <tr>
      <td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;">
        <p style="margin:0;font-size:12px;color:#94a3b8;">{note}</p>
      </td>
    </tr>"""


# ── Shared: send via Resend ───────────────────────────────────────────────────
# Returns True on success, False on any exception (non-blocking — email
# failure should never crash the invoice processing pipeline).
def _send(subject: str, html: str, recipients: List[str]) -> bool:
    settings = get_settings()
    resend.api_key = settings.resend_api_key
    try:
        resend.Emails.send({
            "from": f"{settings.resend_from_name} <{settings.resend_from_email}>",
            "to": recipients,
            "subject": subject,
            "html": html,
        })
        return True
    except Exception:
        return False


# ── Email 1: Invoice flagged ──────────────────────────────────────────────────
# Sent when an invoice fails one or more validation checks.
# Includes a per-check breakdown table and a direct link to the review page.
def send_invoice_flagged_email(
    invoice_number: str,
    vendor_name: str,
    recommendation: InvoiceRecommendation,
    invoice_id: str,
    frontend_url: str,
) -> bool:
    settings  = get_settings()
    recipients = _get_recipients()
    if not recipients:
        return False  # no recipients configured — skip silently

    color   = _verdict_color(recommendation.verdict)
    label   = _verdict_label(recommendation.verdict)
    review_url = f"{settings.frontend_url}/invoices/{invoice_id}"

    # Build one table row per validation check
    checks_html = "".join([
        f"""<tr>
              <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:14px;">
                {_check_icon(c.passed)} {c.check_label}
              </td>
              <td style="padding:10px 16px;border-bottom:1px solid #f1f5f9;font-size:13px;color:#64748b;">
                {c.message}
              </td>
            </tr>"""
        for c in recommendation.checks
    ])

    inner = f"""
    {_header_block("Invoice Approval System", "Invoice Review Required")}
    <tr>
      <td style="background:{color};padding:16px 32px;">
        <p style="margin:0;color:#ffffff;font-size:16px;font-weight:700;">{label}</p>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">{recommendation.summary}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:8px;padding:16px;">
          <tr>
            <td style="font-size:13px;color:#64748b;padding:4px 0;">Invoice Number</td>
            <td style="font-size:13px;color:#0f172a;font-weight:600;text-align:right;">{invoice_number}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#64748b;padding:4px 0;">Vendor</td>
            <td style="font-size:13px;color:#0f172a;font-weight:600;text-align:right;">{vendor_name}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#64748b;padding:4px 0;">Checks</td>
            <td style="font-size:13px;color:#0f172a;font-weight:600;text-align:right;">
              {recommendation.passed_checks}/{recommendation.total_checks} passed
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px 0;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#374151;text-transform:uppercase;letter-spacing:0.5px;">
          Validation Results
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          {checks_html}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:32px;">
        <a href="{review_url}"
           style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;
                  padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
          Review Invoice →
        </a>
      </td>
    </tr>
    {_footer_block("This is an automated notification. Final approval rests with the human reviewer.")}
    """

    return _send(
        subject=f"[{label}] Invoice {invoice_number} — {vendor_name}",
        html=_email_shell(inner),
        recipients=recipients,
    )


# ── Email 2: Rulebook updated ─────────────────────────────────────────────────
# Sent when a new rulebook version is activated.
# Shows a colour-coded diff table (added / modified / removed).
def send_rulebook_updated_email(diff: RulebookDiffResult) -> bool:
    settings   = get_settings()
    recipients = _get_recipients()
    if not recipients:
        return False

    # Visual config per change type
    TYPE_CFG = {
        "added":    {"color": "#16a34a", "bg": "#f0fdf4", "label": "NEW"},
        "removed":  {"color": "#dc2626", "bg": "#fef2f2", "label": "REMOVED"},
        "modified": {"color": "#d97706", "bg": "#fffbeb", "label": "CHANGED"},
    }

    def _value_cell(c) -> str:
        """Render old→new for modified, just value for added/removed."""
        if c.change_type == "modified":
            return (
                f'<span style="text-decoration:line-through;color:#dc2626;">'
                f'{c.old_value} {c.old_unit or ""}</span> → '
                f'<span style="color:#16a34a;font-weight:600;">'
                f'{c.new_value} {c.new_unit or ""}</span>'
            )
        val = c.new_value or c.old_value
        unit = c.new_unit or c.old_unit or ""
        return f"{val} {unit}"

    changes_html = "".join([
        f"""<tr style="background:{TYPE_CFG[c.change_type]['bg']};">
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;">
                <span style="display:inline-block;background:{TYPE_CFG[c.change_type]['color']};
                  color:#fff;font-size:10px;font-weight:700;padding:2px 8px;
                  border-radius:4px;letter-spacing:0.5px;">
                  {TYPE_CFG[c.change_type]['label']}
                </span>
                <span style="margin-left:8px;font-size:13px;font-weight:600;color:#0f172a;">
                  {c.item_category.replace('_',' ').title()} — {c.rule_key.replace('_',' ').title()}
                </span>
              </td>
              <td style="padding:12px 16px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">
                {_value_cell(c)}
              </td>
            </tr>"""
        for c in diff.changes
    ])

    # Format activation metadata for display
    activated_by  = diff.activated_by or "System"
    activated_at  = (
        diff.activated_at.strftime("%d %b %Y at %I:%M %p UTC")
        if diff.activated_at else "—"
    )

    inner = f"""
    {_header_block("Invoice Approval System", f"Rulebook Updated — {diff.label}")}
    <tr>
      <td style="background:#0ea5e9;padding:16px 32px;">
        <p style="margin:0;color:#ffffff;font-size:14px;">
          {diff.from_label} v{diff.from_version} → {diff.label} v{diff.to_version} &nbsp;·&nbsp;
          <strong>{diff.total_added}</strong> added &nbsp;·&nbsp;
          <strong>{diff.total_modified}</strong> changed &nbsp;·&nbsp;
          <strong>{diff.total_removed}</strong> removed
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px 12px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px;">
          <tr>
            <td style="font-size:12px;color:#64748b;padding:4px 12px;">
              <strong style="color:#0f172a;">Activated by:</strong> {activated_by}
            </td>
            <td style="font-size:12px;color:#64748b;padding:4px 12px;">
              <strong style="color:#0f172a;">Date &amp; Time:</strong> {activated_at}
            </td>
            <td style="font-size:12px;color:#64748b;padding:4px 12px;">
              <strong style="color:#0f172a;">Rulebook:</strong> {diff.label} · v{diff.to_version}
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 32px 24px;">
        <p style="margin:0 0 12px;font-size:13px;font-weight:600;color:#374151;
                  text-transform:uppercase;letter-spacing:0.5px;">What Changed</p>
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          {changes_html if changes_html else
           '<tr><td style="padding:16px;color:#94a3b8;text-align:center;">No changes detected</td></tr>'}
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 32px;">
        <p style="margin:0 0 12px;font-size:13px;color:#64748b;">
          All new invoices will now be validated against <strong>{diff.label} v{diff.to_version}</strong>.
          Invoices processed before this change are unaffected.
        </p>
        <a href="{settings.frontend_url}/rulebook"
           style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;
                  padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
          View Rulebook →
        </a>
      </td>
    </tr>
    {_footer_block("Automated notification from Invoice Approval System.")}
    """

    return _send(
        subject=f"📋 Rulebook Updated — {diff.label} v{diff.to_version} · Activated by {activated_by}",
        html=_email_shell(inner),
        recipients=recipients,
    )


# ── Email 3: New user signup awaiting approval ────────────────────────────────
# Sent to the admin email when a new user submits the signup form.
# Admin reviews and approves / rejects from the Manage Users page.
def send_signup_request_email(
    new_user_email: str,
    new_user_name:  str,
    signup_note:    Optional[str],
) -> bool:
    settings = get_settings()
    if not settings.admin_email:
        return False

    note_block = ""
    if signup_note:
        note_block = f"""
        <tr>
          <td style="padding:0 32px 16px;">
            <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#374151;
                      text-transform:uppercase;letter-spacing:0.5px;">Note from applicant</p>
            <div style="background:#fffbeb;border-left:3px solid #d97706;
                        padding:12px 16px;border-radius:4px;font-size:13px;color:#334155;
                        font-style:italic;">
              "{signup_note}"
            </div>
          </td>
        </tr>"""
    else:
        note_block = """
        <tr>
          <td style="padding:0 32px 16px;">
            <p style="margin:0;font-size:13px;color:#94a3b8;font-style:italic;">
              No note provided.
            </p>
          </td>
        </tr>"""

    inner = f"""
    {_header_block("Invoice Approval System", "New Access Request")}
    <tr>
      <td style="background:#EB8C00;padding:16px 32px;">
        <p style="margin:0;color:#ffffff;font-size:15px;font-weight:700;">
          {new_user_name} ({new_user_email}) has requested access
        </p>
      </td>
    </tr>
    <tr>
      <td style="padding:24px 32px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="font-size:13px;color:#64748b;padding:12px 16px;width:40%;">Full Name</td>
            <td style="font-size:13px;color:#0f172a;font-weight:600;padding:12px 16px;">
              {new_user_name}
            </td>
          </tr>
          <tr style="border-bottom:1px solid #e2e8f0;">
            <td style="font-size:13px;color:#64748b;padding:12px 16px;">Email Address</td>
            <td style="font-size:13px;color:#0f172a;font-weight:600;padding:12px 16px;">
              {new_user_email}
            </td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#64748b;padding:12px 16px;">Account Status</td>
            <td style="padding:12px 16px;">
              <span style="display:inline-block;background:#fef3c7;color:#92400e;
                           font-size:11px;font-weight:700;padding:2px 10px;
                           border-radius:20px;letter-spacing:0.3px;">PENDING APPROVAL</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
    <tr>
      <td style="padding:0 32px 8px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#374151;
                  text-transform:uppercase;letter-spacing:0.5px;">Note from applicant</p>
      </td>
    </tr>
    {note_block}
    <tr>
      <td style="padding:8px 32px 32px;">
        <p style="margin:0 0 16px;font-size:13px;color:#64748b;line-height:1.6;">
          Log in to the Invoice Approval System to approve or reject this request.
          The applicant will not be able to access the system until you take action.
        </p>
        <a href="{settings.frontend_url}/manage"
           style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;
                  padding:12px 28px;border-radius:8px;font-size:14px;font-weight:600;">
          Review in Manage Users
        </a>
      </td>
    </tr>
    {_footer_block("This applicant cannot log in until you approve them. Do not reply to this email.")}
    """

    return _send(
        subject=f"Access Request: {new_user_name} ({new_user_email})",
        html=_email_shell(inner),
        recipients=[settings.admin_email],
    )
