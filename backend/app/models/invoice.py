from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


# ── Status lifecycle ──────────────────────────────────────────────────────────
# pending → processing → flagged | approved | rejected | extraction_failed
# "flagged" means AI recommends reject/review; human hasn't acted yet.
class InvoiceStatus(str, Enum):
    pending           = "pending"
    processing        = "processing"
    approved          = "approved"
    rejected          = "rejected"
    flagged           = "flagged"           # AI flagged; awaiting human decision
    extraction_failed = "extraction_failed" # pdfplumber or Groq failed


# ── AI recommendation verdicts ────────────────────────────────────────────────
class Verdict(str, Enum):
    approve      = "approve"
    reject       = "reject"
    needs_review = "needs_review"  # no matching rules found; manual only


class Confidence(str, Enum):
    high   = "high"    # 3+ checks ran and all consistent
    medium = "medium"  # fewer checks or partial data
    low    = "low"     # almost no data extracted


# ── Extracted line item from PDF ──────────────────────────────────────────────
class LineItemExtracted(BaseModel):
    item_category:   Optional[str]   = None
    description:     Optional[str]   = None
    quantity:        Optional[float] = None
    quantity_unit:   Optional[str]   = None
    unit_rate:       Optional[float] = None
    rate_unit:       Optional[str]   = None
    total_value:     Optional[float] = None
    dimensions:      Optional[dict]  = None  # {length, width, thickness, diameter, unit}
    quality_grade:   Optional[str]   = None
    sequence_number: Optional[int]   = None


# ── Full extraction result returned by Groq ───────────────────────────────────
class ExtractedInvoiceData(BaseModel):
    invoice_number:        str
    vendor_name:           str
    vendor_email:          Optional[str] = None
    invoice_date:          Optional[str] = None  # YYYY-MM-DD
    po_reference:          Optional[str] = None
    line_items:            List[LineItemExtracted] = []
    extraction_confidence: str = "medium"         # reported by the LLM itself
    raw_text_length:       int = 0                # for debug / audit


# ── Single validation check result ───────────────────────────────────────────
class ValidationCheck(BaseModel):
    check_name:     str             # machine key e.g. "arithmetic_check"
    check_label:    str             # human label e.g. "Arithmetic Verification"
    passed:         bool
    expected_value: Optional[str] = None
    actual_value:   Optional[str] = None
    message:        str             # human-readable explanation
    severity:       str = "error"   # "error" blocks approval; "warning" does not


# ── Aggregated recommendation for an invoice ─────────────────────────────────
class InvoiceRecommendation(BaseModel):
    verdict:       Verdict
    confidence:    Confidence
    summary:       str               # one-sentence human-readable conclusion
    total_checks:  int
    passed_checks: int
    failed_checks: int
    checks:        List[ValidationCheck] = []


# ── Flat invoice view (used in list + dashboard) ──────────────────────────────
class InvoiceSummary(BaseModel):
    id:             str
    invoice_number: str
    vendor_name:    str
    invoice_date:   Optional[str]      = None
    po_reference:   Optional[str]      = None
    status:         InvoiceStatus
    uploaded_at:    datetime
    reviewed_at:    Optional[datetime] = None
    reviewed_by:    Optional[str]      = None
    verdict:        Optional[Verdict]  = None
    confidence:     Optional[Confidence] = None
    summary:        Optional[str]      = None
    total_checks:   Optional[int]      = None
    passed_checks:  Optional[int]      = None
    failed_checks:  Optional[int]      = None
    rulebook_month: Optional[str]      = None


# ── Payload for human approve/reject action ───────────────────────────────────
class ReviewAction(BaseModel):
    action:        str             # "approved" or "rejected"
    reviewer_name: str
    notes:         Optional[str] = None
