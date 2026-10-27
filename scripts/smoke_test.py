#!/usr/bin/env python3
"""End-to-end check against a RUNNING server with the REAL embedding model and
LLM. Run it after starting the backend (and after every deploy):

    python scripts/smoke_test.py http://localhost:8000

It prints the retrieval distance for an on-topic and an off-topic question so
you can tune MAX_DISTANCE for the embedding model you actually use.
"""
import sys
import uuid

import httpx

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

print("\nSmoke test finished.")
