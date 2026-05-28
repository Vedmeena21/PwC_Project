from typing import List, Optional
from app.models import (
    ExtractedInvoiceData, ValidationCheck,
    InvoiceRecommendation, Verdict, Confidence,
)

# Invoice total may differ from computed total by up to 1%
# (covers rounding in vendor systems and currency formatting).
TOLERANCE = 0.01


def _pct_diff(a: float, b: float) -> float:
    if b == 0:
        return float("inf")
    return abs(a - b) / b


# A mismatch between unit_rate × quantity and total_value almost always means
# a tampered or mis-keyed invoice.
def run_arithmetic_check(item) -> ValidationCheck:
    if item.unit_rate is None or item.quantity is None or item.total_value is None:
        return ValidationCheck(
            check_name="arithmetic_check",
            check_label="Arithmetic Verification",
            passed=False,
            message="Cannot verify — unit rate, quantity, or total value is missing",
            severity="warning",  # warning so missing data doesn't auto-reject
        )

    computed = round(item.unit_rate * item.quantity, 2)
    passed = _pct_diff(computed, item.total_value) <= TOLERANCE

    return ValidationCheck(
        check_name="arithmetic_check",
        check_label="Arithmetic Verification",
        passed=passed,
        expected_value=str(computed),
        actual_value=str(item.total_value),
        message=(
            f"Rate × Qty = {item.unit_rate} × {item.quantity} = {computed} "
            f"matches invoice total {item.total_value}"
            if passed else
            f"Mismatch: {item.unit_rate} × {item.quantity} = {computed} "
            f"but invoice shows {item.total_value}"
        ),
        severity="error",
    )


# Returns None if rulebook has no rate rule for this category (not an error).
def run_rate_check(item, rules: dict) -> Optional[ValidationCheck]:
    # Accept either key name for flexibility in rulebook authoring
    approved_rate = rules.get("approved_rate_per_mt") or rules.get("approved_rate")
    if approved_rate is None or item.unit_rate is None:
        return None

    try:
        approved = float(approved_rate)
    except ValueError:
        return None  # non-numeric rulebook value — skip

    passed = _pct_diff(item.unit_rate, approved) <= TOLERANCE
    unit = rules.get("approved_rate_per_mt_unit") or rules.get("approved_rate_unit", "")

    return ValidationCheck(
        check_name="rate_check",
        check_label="Rate Verification",
        passed=passed,
        expected_value=f"{approved} {unit}".strip(),
        actual_value=f"{item.unit_rate} {item.rate_unit or ''}".strip(),
        message=(
            f"Invoiced rate {item.unit_rate} matches approved rate {approved}"
            if passed else
            f"Rate mismatch: invoiced {item.unit_rate}, approved {approved}"
        ),
        severity="error",
    )


def run_quantity_check(item, rules: dict) -> Optional[ValidationCheck]:
    min_qty = rules.get("min_quantity")
    max_qty = rules.get("max_quantity")

    if (min_qty is None and max_qty is None) or item.quantity is None:
        return None

    try:
        qty = float(item.quantity)
        violations = []
        if min_qty is not None and qty < float(min_qty):
            violations.append(f"below minimum {min_qty}")
        if max_qty is not None and qty > float(max_qty):
            violations.append(f"exceeds maximum {max_qty}")

        passed = len(violations) == 0
        qty_unit = rules.get("quantity_unit", "")
        range_str = f"{min_qty}–{max_qty} {qty_unit}".strip()

        return ValidationCheck(
            check_name="quantity_check",
            check_label="Quantity Verification",
            passed=passed,
            expected_value=range_str,
            actual_value=f"{qty} {item.quantity_unit or ''}".strip(),
            message=(
                f"Quantity {qty} is within allowed range {range_str}"
                if passed else
                f"Quantity {qty} {', '.join(violations)}"
            ),
            severity="error",
        )
    except (ValueError, TypeError):
        return None  # non-numeric rulebook value — skip gracefully


# Support multi-grade allowlists e.g. "IS2062 E250, IS2062 E350"
def run_quality_check(item, rules: dict) -> Optional[ValidationCheck]:
    required = rules.get("required_quality_grade")
    if not required or not item.quality_grade:
        return None

    allowed = [g.strip().upper() for g in required.split(",")]
    actual = item.quality_grade.strip().upper()
    passed = actual in allowed

    return ValidationCheck(
        check_name="quality_check",
        check_label="Quality Grade Verification",
        passed=passed,
        expected_value=" or ".join(allowed),
        actual_value=item.quality_grade,
        message=(
            f"Quality grade {item.quality_grade} meets requirement"
            if passed else
            f"Quality mismatch: {item.quality_grade} invoiced, "
            f"required {' or '.join(allowed)}"
        ),
        severity="error",
    )


def validate_invoice(
    extracted: ExtractedInvoiceData,
    rulebook_rules: List[dict],
) -> InvoiceRecommendation:

    # Build a lookup: {category: {rule_key: value, rule_key_unit: unit}}
    # so checks can do O(1) lookups instead of scanning the list each time.
    rules_by_category: dict = {}
    for rule in rulebook_rules:
        cat = rule["item_category"]
        rules_by_category.setdefault(cat, {})
        rules_by_category[cat][rule["rule_key"]] = rule["rule_value"]
        if rule.get("unit"):
            rules_by_category[cat][f"{rule['rule_key']}_unit"] = rule["unit"]

    all_checks: List[ValidationCheck] = []

    for item in extracted.line_items:
        cat = item.item_category or "other"
        # Fall back to "other" category rules if the specific category has none
        rules = rules_by_category.get(cat) or rules_by_category.get("other") or {}

        all_checks.append(run_arithmetic_check(item))
        for check in [
            run_rate_check(item, rules),
            run_quantity_check(item, rules),
            run_quality_check(item, rules),
        ]:
            if check is not None:
                all_checks.append(check)

    if not all_checks:
        return InvoiceRecommendation(
            verdict=Verdict.needs_review,
            confidence=Confidence.low,
            summary="No line items found or no applicable rules. Manual review required.",
            total_checks=0, passed_checks=0, failed_checks=0, checks=[],
        )

    # Only "error" severity checks block approval.
    error_failures = [c for c in all_checks if c.severity == "error" and not c.passed]
    passed_count   = sum(1 for c in all_checks if c.passed)
    failed_count   = len(all_checks) - passed_count

    if not error_failures:
        verdict    = Verdict.approve
        # High confidence only if we ran 3+ meaningful checks.
        confidence = Confidence.high if len(all_checks) >= 3 else Confidence.medium
        summary    = f"All {len(all_checks)} checks passed. Invoice meets current rulebook criteria."
    elif len(error_failures) == 1:
        verdict    = Verdict.reject
        confidence = Confidence.high
        summary    = f"Failed: {error_failures[0].check_label} — {error_failures[0].message}"
    else:
        verdict    = Verdict.reject
        confidence = Confidence.high
        labels     = ", ".join(c.check_label for c in error_failures)
        summary    = f"{len(error_failures)} checks failed: {labels}"

    return InvoiceRecommendation(
        verdict=verdict,
        confidence=confidence,
        summary=summary,
        total_checks=len(all_checks),
        passed_checks=passed_count,
        failed_checks=failed_count,
        checks=all_checks,
    )
