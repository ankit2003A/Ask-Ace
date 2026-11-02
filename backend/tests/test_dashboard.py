from datetime import date, timedelta

from app.routers.dashboard import _streak
from tests.conftest import register
from tests.test_exams import MCQ, create


def attempt(client, auth, exam, answer):
    qid = exam["questions"][0]["id"]
    r = client.post(f"/exams/{exam['id']}/attempt", headers=auth,
                    json={"responses": [{"question_id": qid, "answer": answer}]})
    assert r.status_code == 200


def test_a_new_account_starts_empty(client, auth):
    d = client.get("/dashboard", headers=auth).json()
    assert d["totals"]["attempts"] == 0 and d["totals"]["average_percent"] is None
    assert d["trend"] == [] and d["weak_pages"] == [] and d["recent"] == []
    assert d["streak_days"] == 0 and len(d["activity"]) == 28
    assert all(day["count"] == 0 for day in d["activity"])


def test_a_miss_becomes_a_page_to_revise(client, auth, llm, uploaded):
    exam = create(client, auth, llm, uploaded).json()
    attempt(client, auth, exam, "Store water")

    d = client.get("/dashboard", headers=auth).json()
    assert d["totals"]["attempts"] == 1 and d["totals"]["average_percent"] == 0
    assert d["weak_pages"] == [{"document_id": uploaded["id"], "filename": uploaded["filename"],
                                "page": MCQ["page"], "misses": 1}]
    mcq = next(t for t in d["by_type"] if t["kind"] == "mcq")
    assert (mcq["correct"], mcq["total"], mcq["percent"]) == (0, 1, 0)
    assert d["streak_days"] == 1 and d["active_today"] is True
    assert d["activity"][-1]["count"] == 1


def test_getting_it_right_on_a_retake_clears_the_page(client, auth, llm, uploaded):
    exam = create(client, auth, llm, uploaded).json()
    attempt(client, auth, exam, "Store water")
    attempt(client, auth, exam, MCQ["answer"])

    d = client.get("/dashboard", headers=auth).json()
    assert d["weak_pages"] == []
    assert d["totals"]["average_percent"] == 50 and d["totals"]["best_percent"] == 100
    assert [t["percent"] for t in d["trend"]] == [0, 100]
    assert d["recent"][0]["percent"] == 100  # newest first
    assert d["documents"][0]["best_percent"] == 100 and d["documents"][0]["tests"] == 1
    level = next(x for x in d["by_difficulty"] if x["total"])
    assert (level["correct"], level["total"]) == (1, 2)


def test_each_student_sees_only_their_own_progress(client, auth, llm, uploaded):
    exam = create(client, auth, llm, uploaded).json()
    attempt(client, auth, exam, MCQ["answer"])
    other = register(client, "b@example.com")
    d = client.get("/dashboard", headers=other).json()
    assert d["totals"]["attempts"] == 0 and d["totals"]["documents"] == 0 and d["weak_pages"] == []


def test_the_dashboard_requires_sign_in(client):
    assert client.get("/dashboard").status_code == 401


def test_streak_counts_back_from_today_or_yesterday():
    today = date(2026, 11, 2)
    days = {today - timedelta(days=n) for n in (1, 2, 3)}
    assert _streak(days, today) == 3              # today not studied yet: still a streak
    assert _streak(days | {today}, today) == 4
    assert _streak({today - timedelta(days=2)}, today) == 0
