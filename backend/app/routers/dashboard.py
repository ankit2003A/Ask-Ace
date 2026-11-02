"""A student's own progress, computed from what they have actually done.

Everything here is read-only and scoped to the signed-in user: their
documents, the questions they asked, the tests they took and how each answer
was marked. Nothing is estimated; an empty account gets zeros and empty lists.
"""
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query, Request

from app.deps import get_current_user

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

TREND_LENGTH = 12
RECENT_LENGTH = 6
WEAK_PAGES = 6
ACTIVITY_DAYS = 28
DIFFICULTIES = ("easy", "medium", "hard", "mixed")
KINDS = ("mcq", "truefalse", "short")


def _percent(correct: int, total: int) -> int | None:
    return round(100 * correct / total) if total else None


def _local_day(stamp: str, offset: timedelta) -> date:
    """SQLite stores UTC; the student's day is what their clock says."""
    return (datetime.fromisoformat(stamp).replace(tzinfo=timezone.utc) + offset).date()


def _streak(days: set[date], today: date) -> int:
    """Consecutive active days ending today, or yesterday if today is still open."""
    day = today if today in days else today - timedelta(days=1)
    streak = 0
    while day in days:
        streak += 1
        day -= timedelta(days=1)
    return streak


@router.get("")
def dashboard(
    request: Request,
    user: dict = Depends(get_current_user),
    # Minutes to add to UTC for the student's local time (UTC+5:30 is 330).
    tz_offset: int = Query(0, ge=-840, le=840),
):
    uid = user["id"]
    offset = timedelta(minutes=tz_offset)
    with request.app.state.db.session() as c:
        name = c.execute("SELECT name FROM users WHERE id = ?", (uid,)).fetchone()["name"]
        docs = c.execute(
            "SELECT d.id, d.filename, d.pages, d.created_at, "
            "(SELECT COUNT(*) FROM exams e WHERE e.document_id = d.id) AS tests, "
            "(SELECT MAX(100.0 * a.score / a.total) FROM attempts a JOIN exams e ON e.id = a.exam_id "
            " WHERE e.document_id = d.id AND a.total > 0) AS best "
            "FROM documents d WHERE d.user_id = ? ORDER BY d.id DESC", (uid,)
        ).fetchall()
        asked = c.execute(
            "SELECT created_at FROM messages WHERE user_id = ? AND role = 'user'", (uid,)
        ).fetchall()
        tests = c.execute("SELECT COUNT(*) FROM exams WHERE user_id = ?", (uid,)).fetchone()[0]
        attempts = c.execute(
            "SELECT a.id, a.exam_id, a.score, a.total, a.created_at, e.title, e.difficulty, "
            "d.filename FROM attempts a JOIN exams e ON e.id = a.exam_id "
            "JOIN documents d ON d.id = e.document_id WHERE a.user_id = ? ORDER BY a.id", (uid,)
        ).fetchall()
        by_kind = c.execute(
            "SELECT q.kind, SUM(x.correct) AS correct, COUNT(*) AS total "
            "FROM attempt_answers x JOIN attempts a ON a.id = x.attempt_id "
            "JOIN questions q ON q.id = x.question_id WHERE a.user_id = ? GROUP BY q.kind", (uid,)
        ).fetchall()
        # A page needs revising when a question from it was missed on the most
        # recent attempt at that test: retaking and getting it right clears it.
        weak = c.execute(
            "SELECT d.id AS document_id, d.filename, q.page, COUNT(*) AS misses "
            "FROM attempt_answers x JOIN questions q ON q.id = x.question_id "
            "JOIN exams e ON e.id = q.exam_id JOIN documents d ON d.id = e.document_id "
            "WHERE x.correct = 0 AND q.page IS NOT NULL AND x.attempt_id IN ("
            "  SELECT MAX(id) FROM attempts WHERE user_id = ? GROUP BY exam_id) "
            "GROUP BY d.id, q.page ORDER BY misses DESC, d.id DESC, q.page LIMIT ?",
            (uid, WEAK_PAGES),
        ).fetchall()

    answered = sum(a["total"] for a in attempts)
    correct = sum(a["score"] for a in attempts)
    percents = [_percent(a["score"], a["total"]) for a in attempts if a["total"]]

    by_difficulty = []
    for level in DIFFICULTIES:
        rows = [a for a in attempts if a["difficulty"] == level]
        got, out_of = sum(a["score"] for a in rows), sum(a["total"] for a in rows)
        by_difficulty.append({"difficulty": level, "correct": got, "total": out_of,
                              "percent": _percent(got, out_of)})
    kinds = {r["kind"]: r for r in by_kind}
    by_type = [
        {"kind": k, "correct": kinds[k]["correct"] if k in kinds else 0,
         "total": kinds[k]["total"] if k in kinds else 0,
         "percent": _percent(kinds[k]["correct"], kinds[k]["total"]) if k in kinds else None}
        for k in KINDS
    ]

    def attempt_out(a) -> dict:
        return {"attempt_id": a["id"], "exam_id": a["exam_id"], "title": a["title"],
                "filename": a["filename"], "difficulty": a["difficulty"],
                "score": a["score"], "total": a["total"],
                "percent": _percent(a["score"], a["total"]), "at": a["created_at"]}

    today = (datetime.now(timezone.utc) + offset).date()
    stamps = [r["created_at"] for r in asked] + [a["created_at"] for a in attempts]
    per_day: dict[date, int] = {}
    for stamp in stamps:
        day = _local_day(stamp, offset)
        per_day[day] = per_day.get(day, 0) + 1
    activity = [
        {"date": (today - timedelta(days=n)).isoformat(),
         "count": per_day.get(today - timedelta(days=n), 0)}
        for n in range(ACTIVITY_DAYS - 1, -1, -1)
    ]

    return {
        "name": name,
        "email": user["email"],
        "totals": {
            "documents": len(docs),
            "pages": sum(d["pages"] for d in docs),
            "questions_asked": len(asked),
            "tests": tests,
            "attempts": len(attempts),
            "questions_answered": answered,
            "correct": correct,
            "average_percent": round(sum(percents) / len(percents)) if percents else None,
            "best_percent": max(percents) if percents else None,
        },
        "streak_days": _streak(set(per_day), today),
        "active_today": today in per_day,
        "trend": [attempt_out(a) for a in attempts[-TREND_LENGTH:]],
        "recent": [attempt_out(a) for a in reversed(attempts[-RECENT_LENGTH:])],
        "by_difficulty": by_difficulty,
        "by_type": by_type,
        "weak_pages": [dict(r) for r in weak],
        "documents": [
            {"id": d["id"], "filename": d["filename"], "pages": d["pages"], "tests": d["tests"],
             "best_percent": round(d["best"]) if d["best"] is not None else None,
             "added": d["created_at"]}
            for d in docs
        ],
        "activity": activity,
    }
