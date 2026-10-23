"""Load clearly labelled SYNTHETIC sample experiments (software performance domain).

    python -m app.seed             # create demo user + samples
    python -m app.seed --reindex   # recompute all embeddings (after changing embedding mode/model)
"""
import sys

from sqlalchemy import select

from app.core.security import hash_password
from app.db.session import SessionLocal, init_db
from app.models import Experiment, User
from app.services.embedding_service import embed_text, experiment_text

DOMAIN = "software performance"
NOTE = " (Synthetic sample data, not a real study.)"

# title, research question, hypothesis, method, conditions, sample size, outcome, results, limitations
SAMPLES = [
    ("Redis cache in front of product API", "Does response caching reduce p95 latency?",
     "Adding a Redis cache lowers p95 latency of the product endpoint.", "Load test with and without cache, 5 runs each.",
     {"cpu_cores": 4, "concurrent_users": 200, "payload_kb": 20, "warm_cache": True}, 5, "supported",
     "p95 latency fell from 480 ms to 120 ms with a warm cache.", "Cache was pre-warmed; cold-start behaviour not measured."),
    ("Redis cache with cold start", "Does caching help when the cache is cold?",
     "Caching still lowers p95 latency when the cache starts empty.", "Same load test but cache flushed before each run.",
     {"cpu_cores": 4, "concurrent_users": 200, "payload_kb": 20, "warm_cache": False}, 5, "inconclusive",
     "p95 improved in 2 of 5 runs; high variance during the first minute.", "Short test window; run-to-run variance not controlled."),
    ("Connection pool size 10 vs 50", "Does a larger DB connection pool raise throughput?",
     "Increasing the pool from 10 to 50 raises requests per second.", "Benchmark at fixed load, vary pool size.",
     {"cpu_cores": 2, "concurrent_users": 100, "db_max_connections": 100, "network": "same host"}, 3, "contradicted",
     "Throughput did not improve; CPU on the database host was the bottleneck.", "Only one hardware configuration tested."),
    ("gzip compression on JSON responses", "Does gzip reduce page load time?",
     "Enabling gzip reduces total response time for large JSON payloads.", "Compare response times with gzip on/off over simulated 4G.",
     {"cpu_cores": 4, "payload_kb": 500, "network": "4G simulated", "concurrent_users": 50}, 10, "supported",
     "Median response time fell about 40% for 500 KB payloads.", "Benefit shrank for payloads under 10 KB."),
    ("gzip on small payloads", "Does gzip help small responses?",
     "Enabling gzip reduces response time for payloads under 5 KB.", "Compare gzip on/off with 2 KB payloads.",
     {"cpu_cores": 4, "payload_kb": 2, "network": "4G simulated", "concurrent_users": 50}, 10, "contradicted",
     "Response time rose slightly because compression overhead exceeded transfer savings.", "Single compression level tested."),
    ("Async handlers at low concurrency", "Are async handlers faster than sync handlers?",
     "Async request handlers outperform sync handlers.", "Benchmark both implementations at 10 and 500 concurrent users.",
     {"cpu_cores": 4, "concurrent_users": 10, "io_bound": True}, 5, "contradicted",
     "No difference at 10 users; async only pulled ahead at 500 users.", "Handlers were I/O bound; CPU-bound work not tested."),
    ("Database index on orders.customer_id", "Does adding an index speed up order lookups?",
     "An index on customer_id reduces lookup time.", "Time 1,000 lookups before/after index on a 5M-row table.",
     {"table_rows": 5000000, "cpu_cores": 8, "warm_cache": True}, 3, "supported",
     "Lookup time fell from 900 ms to 4 ms.", "Write overhead from the index was not measured."),
    ("MessagePack vs JSON serialization", "Is MessagePack faster than JSON?",
     "MessagePack serializes and parses faster than JSON.", "Microbenchmark on 3 payload shapes.",
     {"cpu_cores": 4, "payload_kb": 50, "language": "Python 3.11"}, 20, "partially supported",
     "Faster for numeric-heavy payloads; roughly equal for string-heavy payloads.", "Library versions differ in optimisation level."),
    ("HTTP/2 vs HTTP/1.1 on an API", "Does HTTP/2 improve API latency?",
     "HTTP/2 lowers API latency under many parallel requests.", "Replay 100 parallel requests on both protocols.",
     {"cpu_cores": 4, "concurrent_users": 100, "network": "WAN simulated", "tls": True}, 4, "inconclusive",
     "Differences were within noise on a low-latency link.", "Only one network profile tested."),
    ("Garbage collector tuning", "Does a larger young generation cut pause times?",
     "Increasing the young generation size reduces GC pause times.", "Run a 30-minute soak test with 3 heap settings.",
     {"cpu_cores": 8, "heap_gb": 8, "concurrent_users": 300, "language": "JVM"}, 3, "contradicted",
     "Pause times increased at the largest setting.", "Allocation pattern of one service only."),
]


def run() -> None:
    init_db()
    db = SessionLocal()
    try:
        if "--reindex" in sys.argv:
            for e in db.scalars(select(Experiment)).all():
                e.embedding = embed_text(experiment_text(e))
            db.commit()
            print("Reindexed all experiments.")
            return
        demo = db.scalar(select(User).where(User.email == "demo@example.com"))
        if not demo:
            demo = User(name="Demo Researcher", email="demo@example.com", password_hash=hash_password("demo12345"))
            db.add(demo)
            db.flush()
        if db.scalar(select(Experiment).where(Experiment.is_sample.is_(True)).limit(1)):
            print("Sample experiments already loaded.")
            db.commit()
            return
        for t, q, h, m, c, n, o, r, lim in SAMPLES:
            e = Experiment(
                title=t, domain=DOMAIN, research_question=q, hypothesis_text=h, methodology=m, conditions=c,
                variables={k: "recorded" for k in c}, sample_size=n, outcome=o, results_summary=r + NOTE,
                limitations=lim, visibility="public", review_status="Published", owner_id=demo.id, is_sample=True,
            )
            e.embedding = embed_text(experiment_text(e))
            db.add(e)
        db.commit()
        print(f"Loaded {len(SAMPLES)} sample experiments. Login: demo@example.com / demo12345")
    finally:
        db.close()


if __name__ == "__main__":
    run()
