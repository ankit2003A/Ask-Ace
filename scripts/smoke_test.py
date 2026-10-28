#!/usr/bin/env python3
"""End-to-end check against a RUNNING server with the REAL embedding model and
LLM. Run it after starting the backend (and after every deploy):

    python scripts/smoke_test.py http://localhost:8000

It prints the retrieval distance for an on-topic and an off-topic question so
you can tune MAX_DISTANCE for the embedding model you actually use, then
generates a practice test from the same document and marks an attempt.
"""
import sys
import uuid

import httpx

# Answers can contain characters the Windows console codepage cannot encode.
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8000").rstrip("/")

TEXT = ("Photosynthesis is the process plants use to convert light energy into chemical energy. "
        "It takes place inside chloroplasts, where chlorophyll absorbs sunlight. "
        "The process consumes carbon dioxide and water and releases oxygen.")


def tiny_pdf(text: str) -> bytes:
    """Hand-built one-page PDF so this script needs no extra libraries."""
    stream = f"BT /F1 11 Tf 40 760 Td ({text.replace('(', '[').replace(')', ']')}) Tj ET".encode()
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R "
        b"/Resources << /Font << /F1 5 0 R >> >> >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out, offsets = b"%PDF-1.4\n", []
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n".encode() + body + b"\nendobj\n"
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n0000000000 65535 f \n".encode()
    out += b"".join(f"{o:010d} 00000 n \n".encode() for o in offsets)
    out += f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF".encode()
    return out


def check(ok: bool, label: str) -> None:
    print(("PASS  " if ok else "FAIL  ") + label)
    if not ok:
        sys.exit(1)


with httpx.Client(base_url=BASE, timeout=120) as c:
    check(c.get("/health").status_code == 200, "server is healthy")

    email = f"smoke-{uuid.uuid4().hex[:8]}@example.com"
    r = c.post("/auth/register", json={"email": email, "password": "smoke-test-pw"})
    check(r.status_code == 201, "register")
    c.headers["Authorization"] = f"Bearer {r.json()['access_token']}"

    r = c.post("/documents", files={"file": ("photosynthesis.pdf", tiny_pdf(TEXT), "application/pdf")})
    check(r.status_code == 201, f"upload + index (real embeddings): {r.text[:80]}")

    r = c.post("/ask", json={"question": "Where does photosynthesis take place?"})
    check(r.status_code == 200, f"ask on-topic: HTTP {r.status_code} {r.text[:120] if r.status_code != 200 else ''}")
    body = r.json()
    print("  answer :", body["answer"])
    print("  sources:", [(s["filename"], s["page"], s["distance"]) for s in body["sources"]])
    check(len(body["sources"]) > 0, "on-topic question returns cited sources")

    r = c.post("/ask", json={"question": "What is the capital of Australia?"})
    check(r.status_code == 200, "ask off-topic")
    off = r.json()
    print("  answer :", off["answer"])
    print("  sources:", [(s["filename"], s["page"], s["distance"]) for s in off["sources"]])
    if off["sources"]:
        print("  NOTE: off-topic text passed the distance filter. Lower MAX_DISTANCE below the "
              "off-topic distance above and above the on-topic one, then re-run.")

    doc_id = c.get("/documents").json()[0]["id"]
    r = c.post("/exams", json={"document_id": doc_id, "count": 5,
                               "question_type": "mcq", "difficulty": "medium"},
               timeout=240)
    check(r.status_code == 201, f"generate a test (real LLM): HTTP {r.status_code} {r.text[:200]}")
    exam = r.json()
    print(f"  asked for {exam['requested']}, kept {len(exam['questions'])}, "
          f"discarded {exam['discarded']}, capped by document: {exam['limited_by_document']}")
    for q in exam["questions"]:
        print(f"  [{q['position'] + 1}] {q['prompt']}")
        for option in q["options"] or []:
            print("       -", option)

    leaked = any(k in q for q in exam["questions"] for k in ("answer", "explanation"))
    check(not leaked, "the answer key is not sent to the client")
    check(all(q["options"] for q in exam["questions"]), "every mcq came back with options")

    # Answer with the first option throughout: the point is that marking works,
    # not that the guesses are right.
    responses = [{"question_id": q["id"], "answer": (q["options"] or [""])[0]}
                 for q in exam["questions"]]
    r = c.post(f"/exams/{exam['id']}/attempt", json={"responses": responses})
    check(r.status_code == 200, "submit an attempt")
    graded = r.json()
    print(f"  scored {graded['score']}/{graded['total']}")
    for res in graded["results"]:
        print(f"  {'OK' if res['correct'] else 'XX'} [{res['position'] + 1}] "
              f"key={res['correct_answer']!r} page={res['page']}")
    check(graded["total"] == len(exam["questions"]), "every question was marked")
    check(all(res["correct_answer"] for res in graded["results"]),
          "the key comes back with the marked result")
    check(all(res["page"] for res in graded["results"]),
          "every question cites a page to revise")

    check(c.delete(f"/exams/{exam['id']}").status_code == 204, "delete the test")

print("\nSmoke test finished.")
