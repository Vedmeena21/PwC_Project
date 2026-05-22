from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime


# ── Single rule row ───────────────────────────────────────────────────────────
# One rule = one (item_category, rule_key) pair with a value + optional unit.
# e.g. item_category="steel_rod", rule_key="approved_rate_per_mt",
#      rule_value="54500", unit="INR/MT"
class RuleEntry(BaseModel):
    id:            Optional[str] = None   # UUID assigned by Supabase on insert
    item_category: str                    # e.g. "steel_rod", "cement"
    rule_key:      str                    # e.g. "approved_rate_per_mt"
    rule_value:    str                    # always stored as text; engine parses
    unit:          Optional[str] = None   # e.g. "INR/MT", "MT"
    description:   Optional[str] = None  # human note for this rule


# ── Full rulebook version (one version per month) ─────────────────────────────
class RulebookVersion(BaseModel):
    id:         Optional[str]      = None
    version:    int                        # auto-incremented per label
    label: str                             # free text e.g. "May 2025", "Q1 Revision"
    created_at: Optional[datetime] = None
    created_by: Optional[str]      = None
    notes:      Optional[str]      = None
    is_active:  bool               = False  # only one version is active at a time
    rules:      List[RuleEntry]    = []


# ── Request body for creating a new version ───────────────────────────────────
class RulebookCreateRequest(BaseModel):
    label: str
    notes:      Optional[str] = None
    created_by: Optional[str] = None
    rules:      List[RuleEntry]


# ── One change entry in a version diff ───────────────────────────────────────
class RuleDiff(BaseModel):
    rule_key:      str
    item_category: str
    change_type:   str             # "added" | "removed" | "modified"
    old_value:     Optional[str] = None
    new_value:     Optional[str] = None
    old_unit:      Optional[str] = None
    new_unit:      Optional[str] = None
    description:   Optional[str] = None


# ── Full diff result between two versions (sent in email + returned by API) ───
class RulebookDiffResult(BaseModel):
    from_version:    int
    to_version:      int
    label:           str
    changes:         List[RuleDiff]
    total_added:     int
    total_removed:   int
    total_modified:  int
    activated_by:    Optional[str]      = None   # who triggered the activation
    activated_at:    Optional[datetime] = None   # exact UTC timestamp of activation
