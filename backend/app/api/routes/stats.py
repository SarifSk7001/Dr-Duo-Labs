"""Statistical power and sample-size calculator.

Uses SciPy (scipy.stats) when available and falls back to a normal-approximation
for environments where SciPy is not installed.

Endpoint:  POST /api/v1/stats/power
"""

from fastapi import APIRouter
from pydantic import BaseModel, Field

router = APIRouter(prefix="/stats", tags=["statistics"])


# ── Pydantic models ───────────────────────────────────────────────────────────

class PowerIn(BaseModel):
    """Input for a two-sample, two-tailed t-test / proportion test."""
    test_type: str = Field(
        default="t_test",
        description="'t_test' (continuous) or 'proportion' (binary outcome)",
    )
    # For t_test: effect size in units of SD (Cohen's d).
    # For proportion: p1 (control) and p2 (treatment).
    effect_size: float | None = Field(
        default=None,
        ge=0.01,
        description="Cohen's d for t-test, or absolute difference |p2-p1| for proportion",
    )
    p1: float | None = Field(default=None, ge=0.01, le=0.99, description="Baseline proportion (proportion test)")
    p2: float | None = Field(default=None, ge=0.01, le=0.99, description="Treatment proportion (proportion test)")
    alpha: float = Field(default=0.05, ge=0.001, le=0.2, description="Significance level (Type I error rate)")
    power: float = Field(default=0.80, ge=0.5, le=0.999, description="Desired statistical power (1 - β)")
    # If n is supplied, we *compute* power instead of sample size.
    n: int | None = Field(default=None, ge=2, description="If provided, calculate achieved power for this n")


class PowerOut(BaseModel):
    test_type: str
    alpha: float
    power_target: float
    effect_size: float
    n_per_group: int | None          # None when computing achieved power from n
    achieved_power: float | None     # None when computing n
    note: str
    scipy_used: bool


# ── Core calculation ──────────────────────────────────────────────────────────

def _solve_scipy(test_type: str, effect_size: float, alpha: float, power: float, n: int | None) -> dict:
    """Use scipy.stats to solve for n or achieved_power."""
    if test_type == "proportion":
        from scipy.stats.power import TTestIndPower  # noqa: not used here
        from scipy.stats import norm
        import math

        # Two-proportion z-test sample-size formula (Fleiss et al.)
        za = norm.ppf(1 - alpha / 2)
        zb = norm.ppf(power)
        p_bar = effect_size / 2 + 0.5  # mid-point of p1, p2 stored via effect_size = |p2 - p1|
        # Fallthrough to normal approximation — scipy doesn't have a direct two-prop solver.
        raise ImportError("use normal approx for proportion")

    from scipy.stats.power import TTestIndPower
    analysis = TTestIndPower()
    if n is None:
        n_f = analysis.solve_power(effect_size=effect_size, alpha=alpha, power=power, alternative="two-sided")
        return {"n_per_group": int(n_f) + 1, "achieved_power": None}
    else:
        pwr = analysis.solve_power(effect_size=effect_size, alpha=alpha, nobs1=n, alternative="two-sided")
        return {"n_per_group": None, "achieved_power": round(float(pwr), 4)}


def _solve_normal_approx(test_type: str, effect_size: float, alpha: float, power: float, n: int | None) -> dict:
    """Normal-approximation fallback (no SciPy required)."""
    import math

    def _norm_ppf(p: float) -> float:
        """Rational approximation (Abramowitz & Stegun 26.2.17)."""
        if p <= 0 or p >= 1:
            return 0.0
        t = math.sqrt(-2 * math.log(min(p, 1 - p)))
        c = (2.515517, 0.802853, 0.010328)
        d = (1.432788, 0.189269, 0.001308)
        return (t - (c[0] + c[1] * t + c[2] * t * t) / (1 + d[0] * t + d[1] * t * t + d[2] * t ** 3)) * (
            1 if p >= 0.5 else -1
        )

    za = _norm_ppf(1 - alpha / 2)
    zb = _norm_ppf(power)

    if n is None:
        n_f = ((za + zb) / effect_size) ** 2 * 2  # two-sample
        return {"n_per_group": int(n_f) + 1, "achieved_power": None}
    else:
        # Achieved power: find power such that za+zb = effect_size * sqrt(n/2)
        stat = effect_size * math.sqrt(n / 2) - za
        # Numeric CDF approximation
        def _norm_cdf(x: float) -> float:
            return 0.5 * (1 + math.erf(x / math.sqrt(2)))

        pwr = _norm_cdf(stat)
        return {"n_per_group": None, "achieved_power": round(pwr, 4)}


@router.post("/power", response_model=PowerOut)
def calculate_power(payload: PowerIn):
    """Calculate required sample size or achieved power.

    * test_type="t_test":     supply effect_size (Cohen's d).
    * test_type="proportion": supply p1 and p2; effect_size = |p2-p1| is derived.

    Supply n to get achieved_power; omit n to get the required n_per_group.
    """
    test_type = payload.test_type
    alpha = payload.alpha
    power_target = payload.power

    # Resolve effect size
    if test_type == "proportion":
        if payload.p1 is None or payload.p2 is None:
            from fastapi import HTTPException
            raise HTTPException(400, "p1 and p2 are required for proportion test")
        effect_size = abs(payload.p2 - payload.p1)
        if effect_size < 0.001:
            from fastapi import HTTPException
            raise HTTPException(400, "p1 and p2 are too close — effect size < 0.001")
    else:
        if payload.effect_size is None:
            from fastapi import HTTPException
            raise HTTPException(400, "effect_size is required for t_test")
        effect_size = payload.effect_size

    # Try SciPy first, fall back to normal approximation
    scipy_used = False
    try:
        result = _solve_scipy(test_type, effect_size, alpha, power_target, payload.n)
        scipy_used = True
    except Exception:
        result = _solve_normal_approx(test_type, effect_size, alpha, power_target, payload.n)

    # Build interpretation note
    if result["n_per_group"] is not None:
        note = (
            f"To detect an effect size of {effect_size:.3f} with α={alpha} and {int(power_target*100)}% power, "
            f"you need approximately {result['n_per_group']} participants per group "
            f"({result['n_per_group'] * 2} total for a two-group design)."
        )
    else:
        note = (
            f"With n={payload.n} per group, effect size {effect_size:.3f}, and α={alpha}, "
            f"the achieved power is {result['achieved_power']:.1%}."
        )

    return PowerOut(
        test_type=test_type,
        alpha=alpha,
        power_target=power_target,
        effect_size=round(effect_size, 4),
        scipy_used=scipy_used,
        note=note,
        **result,
    )
