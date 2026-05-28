from typing import List, Optional
from app.core.config import get_supabase
from app.models import (
    RulebookVersion, RuleEntry,
    RulebookCreateRequest, RulebookDiffResult, RuleDiff,
)


# Fetches rules for a version row and assembles the full typed object.
# Centralised here so every reader function stays DRY.
def _assemble_version(version_row: dict) -> RulebookVersion:
    db = get_supabase()
    rules_res = (
        db.table("rulebook_rules")
        .select("*")
        .eq("version_id", version_row["id"])
        .execute()
    )
    rules = [RuleEntry(**r) for r in rules_res.data]
    return RulebookVersion(**{**version_row, "rules": rules})


# Only one version should be active at any time (enforced on activate).
def get_active_rulebook() -> Optional[RulebookVersion]:
    db = get_supabase()
    res = (
        db.table("rulebook_versions")
        .select("*")
        .eq("is_active", True)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return _assemble_version(res.data[0])


def get_rulebook_by_id(version_id: str) -> Optional[RulebookVersion]:
    db = get_supabase()
    res = (
        db.table("rulebook_versions")
        .select("*")
        .eq("id", version_id)
        .limit(1)
        .execute()
    )
    if not res.data:
        return None
    return _assemble_version(res.data[0])


# Fetches every version + every rule in two queries, then assembles in-memory.
# Replaces a previous N+1 implementation that did one query per version.
def list_rulebook_versions() -> List[RulebookVersion]:
    db = get_supabase()
    versions_res = (
        db.table("rulebook_versions")
        .select("*")
        .order("version", desc=True)
        .execute()
    )
    if not versions_res.data:
        return []

    version_ids = [v["id"] for v in versions_res.data]
    rules_res = (
        db.table("rulebook_rules")
        .select("*")
        .in_("version_id", version_ids)
        .execute()
    )
    rules_by_version: dict = {}
    for r in rules_res.data:
        rules_by_version.setdefault(r["version_id"], []).append(RuleEntry(**r))

    return [
        RulebookVersion(**{**v, "rules": rules_by_version.get(v["id"], [])})
        for v in versions_res.data
    ]


# New version is inactive by default; must be explicitly activated.
def create_rulebook_version(request: RulebookCreateRequest) -> RulebookVersion:
    db = get_supabase()

    existing = (
        db.table("rulebook_versions")
        .select("version")
        .eq("label", request.label)
        .order("version", desc=True)
        .limit(1)
        .execute()
    )
    next_version = (existing.data[0]["version"] + 1) if existing.data else 1

    version_res = db.table("rulebook_versions").insert({
        "version":    next_version,
        "label": request.label,
        "notes":      request.notes,
        "created_by": request.created_by,
        "is_active":  False,
    }).execute()

    version_id = version_res.data[0]["id"]

    rules_res = db.table("rulebook_rules").insert([
        {
            "version_id":    version_id,
            "item_category": r.item_category,
            "rule_key":      r.rule_key,
            "rule_value":    r.rule_value,
            "unit":          r.unit,
            "description":   r.description,
        }
        for r in request.rules
    ]).execute()

    rules = [RuleEntry(**r) for r in rules_res.data]
    return RulebookVersion(**{**version_res.data[0], "rules": rules})


# Deactivates ALL versions first using a non-null UUID as a dummy neq to affect all rows,
# then activates the requested version — ensures exactly one active at a time.
def activate_rulebook(version_id: str) -> RulebookVersion:
    db = get_supabase()

    db.table("rulebook_versions").update({"is_active": False}) \
      .neq("id", "00000000-0000-0000-0000-000000000000").execute()

    res = db.table("rulebook_versions") \
        .update({"is_active": True}) \
        .eq("id", version_id) \
        .execute()

    return _assemble_version(res.data[0])


# Index rules by (category, key) for O(1) comparison.
def diff_rulebook_versions(from_id: str, to_id: str, activated_by: str = None, activated_at=None) -> RulebookDiffResult:
    from_version = get_rulebook_by_id(from_id)
    to_version   = get_rulebook_by_id(to_id)

    from_rules = {(r.item_category, r.rule_key): r for r in from_version.rules}
    to_rules   = {(r.item_category, r.rule_key): r for r in to_version.rules}

    changes: List[RuleDiff] = []

    for key, rule in to_rules.items():
        if key not in from_rules:
            changes.append(RuleDiff(
                rule_key=rule.rule_key, item_category=rule.item_category,
                change_type="added",
                new_value=rule.rule_value, new_unit=rule.unit,
                description=rule.description,
            ))
        elif from_rules[key].rule_value != rule.rule_value or from_rules[key].unit != rule.unit:
            old = from_rules[key]
            changes.append(RuleDiff(
                rule_key=rule.rule_key, item_category=rule.item_category,
                change_type="modified",
                old_value=old.rule_value, new_value=rule.rule_value,
                old_unit=old.unit,        new_unit=rule.unit,
                description=rule.description,
            ))

    for key, rule in from_rules.items():
        if key not in to_rules:
            changes.append(RuleDiff(
                rule_key=rule.rule_key, item_category=rule.item_category,
                change_type="removed",
                old_value=rule.rule_value, old_unit=rule.unit,
                description=rule.description,
            ))

    return RulebookDiffResult(
        from_version=from_version.version,
        to_version=to_version.version,
        from_label=from_version.label,
        label=to_version.label,
        changes=changes,
        total_added=sum(1 for c in changes if c.change_type == "added"),
        total_removed=sum(1 for c in changes if c.change_type == "removed"),
        total_modified=sum(1 for c in changes if c.change_type == "modified"),
        activated_by=activated_by,
        activated_at=activated_at,
    )
