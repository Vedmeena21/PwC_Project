from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from enum import Enum


# pending → processing → flagged | approved | rejected | extraction_failed
# "flagged" means AI recommends reject/review; human hasn't acted yet.
class InvoiceStatus(str, Enum):
    pending           = "pending"
    processing        = "processing"
    approved          = "approved"
    rejected          = "rejected"
    flagged           = "flagged"
    extraction_failed = "extraction_failed"


class Verdict(str, Enum):
    approve      = "approve"
    reject       = "reject"
    needs_review = "needs_review"  # no matching rules found; manual review only


class Confidence(str, Enum):
    high   = "high"    # 3+ checks ran and all consistent
    medium = "medium"  # fewer checks or partial data
    low    = "low"     # almost no data extracted


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


class ExtractedInvoiceData(BaseModel):
    invoice_number:        str
    vendor_name:           str
    vendor_email:          Optional[str] = None
    invoice_date:          Optional[str] = None  # YYYY-MM-DD
    po_reference:          Optional[str] = None
    line_items:            List[LineItemExtracted] = []
    extraction_confidence: str = "medium"
    raw_text_length:       int = 0


class ValidationCheck(BaseModel):
    check_name:     str
    check_label:    str
    passed:         bool
    expected_value: Optional[str] = None
    actual_value:   Optional[str] = None
    message:        str
    severity:       str = "error"  # "error" blocks approval; "warning" does not


class InvoiceRecommendation(BaseModel):
    verdict:       Verdict
    confidence:    Confidence
    summary:       str
    total_checks:  int
    passed_checks: int
    failed_checks: int
    checks:        List[ValidationCheck] = []


class InvoiceSummary(BaseModel):
    id:             str
    invoice_number: str
    vendor_name:    str
    invoice_date:   Optional[str]        = None
    po_reference:   Optional[str]        = None
    status:         InvoiceStatus
    uploaded_at:    datetime
    reviewed_at:    Optional[datetime]   = None
    reviewed_by:    Optional[str]        = None
    verdict:        Optional[Verdict]    = None
    confidence:     Optional[Confidence] = None
    summary:        Optional[str]        = None
    total_checks:   Optional[int]        = None
    passed_checks:  Optional[int]        = None
    failed_checks:  Optional[int]        = None
    rulebook_month: Optional[str]        = None


class ReviewAction(BaseModel):
    action:        str  # "approved" or "rejected"
    reviewer_name: Optional[str] = None  # unused — reviewer identity comes from JWT
    notes:         Optional[str] = None


# One rule = one (item_category, rule_key) pair with a value + optional unit.
class RuleEntry(BaseModel):
    id:            Optional[str] = None  # UUID assigned by Supabase on insert
    item_category: str
    rule_key:      str
    rule_value:    str  # always stored as text; engine parses to numeric when needed
    unit:          Optional[str] = None
    description:   Optional[str] = None


class RulebookVersion(BaseModel):
    id:         Optional[str]      = None
    version:    int                       # auto-incremented per label
    label:      str
    created_at: Optional[datetime] = None
    created_by: Optional[str]      = None
    notes:      Optional[str]      = None
    is_active:  bool               = False  # only one version active at a time
    rules:      List[RuleEntry]    = []


class RulebookCreateRequest(BaseModel):
    label:      str
    notes:      Optional[str] = None
    created_by: Optional[str] = None
    rules:      List[RuleEntry]


class RuleDiff(BaseModel):
    rule_key:      str
    item_category: str
    change_type:   str             # "added" | "removed" | "modified"
    old_value:     Optional[str] = None
    new_value:     Optional[str] = None
    old_unit:      Optional[str] = None
    new_unit:      Optional[str] = None
    description:   Optional[str] = None


class RulebookDiffResult(BaseModel):
    from_version:   int
    to_version:     int
    from_label:     str             # "old" version label — needed so the UI can show both sides of the diff
    label:          str             # "new" / to_version label (kept name for backward compat)
    changes:        List[RuleDiff]
    total_added:    int
    total_removed:  int
    total_modified: int
    activated_by:   Optional[str]      = None
    activated_at:   Optional[datetime] = None
