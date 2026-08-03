import time
import threading
import sqlite3
import os
from flask import Flask, jsonify, render_template, request
import psutil

app = Flask(__name__)
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bandwidth.db")
MAX_AGE_SECONDS = 86400  # 24 hours

# Downsampling intervals (in seconds) per timeline
DOWNSAMPLE = {
    1: 1,
    5: 1,
    15: 5,
    60: 15,
    360: 60,
    1440: 300,
}


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    conn.execute("""
        CREATE TABLE IF NOT EXISTS bandwidth (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp REAL NOT NULL,
            download_bytes REAL NOT NULL,
            upload_bytes REAL NOT NULL
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_timestamp ON bandwidth(timestamp)")
    conn.commit()
    conn.close()


def prune_old_data():
    conn = get_db()
    cutoff = time.time() - MAX_AGE_SECONDS
    conn.execute("DELETE FROM bandwidth WHERE timestamp < ?", (cutoff,))
    conn.commit()
    conn.close()


# Latest reading for live endpoint
latest_reading = {"download": 0.0, "upload": 0.0, "timestamp": 0.0}
lock = threading.Lock()


def collect_bandwidth():
    """Background thread: sample net_io_counters every 1 second."""
    prev = psutil.net_io_counters()
    prev_time = time.time()
    prune_counter = 0

    while True:
        time.sleep(1)
        curr = psutil.net_io_counters()
        curr_time = time.time()
        dt = curr_time - prev_time

        if dt <= 0:
            prev = curr
            prev_time = curr_time
            continue

        dl = (curr.bytes_recv - prev.bytes_recv) / dt
        ul = (curr.bytes_sent - prev.bytes_sent) / dt

        with lock:
            latest_reading["download"] = dl
            latest_reading["upload"] = ul
            latest_reading["timestamp"] = curr_time

        try:
            conn = get_db()
            conn.execute(
                "INSERT INTO bandwidth (timestamp, download_bytes, upload_bytes) VALUES (?, ?, ?)",
                (curr_time, dl, ul),
            )
            conn.commit()
            conn.close()
        except Exception:
            pass

        prev = curr
        prev_time = curr_time

        # Prune every 60 iterations (~1 minute)
        prune_counter += 1
        if prune_counter >= 60:
            prune_counter = 0
            try:
                prune_old_data()
            except Exception:
                pass


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/live")
def api_live():
    with lock:
        return jsonify(latest_reading)


@app.route("/api/data")
def api_data():
    timeline = request.args.get("timeline", 5, type=int)
    if timeline not in DOWNSAMPLE:
        timeline = 5

    bucket = DOWNSAMPLE[timeline]
    cutoff = time.time() - (timeline * 60)

    conn = get_db()
    if bucket == 1:
        rows = conn.execute(
            "SELECT timestamp, download_bytes, upload_bytes FROM bandwidth WHERE timestamp >= ? ORDER BY timestamp",
            (cutoff,),
        ).fetchall()
        data = [
            {"t": r["timestamp"], "dl": r["download_bytes"], "ul": r["upload_bytes"]}
            for r in rows
        ]
    else:
        # Downsample by averaging within buckets
        rows = conn.execute(
            """
            SELECT
                CAST(timestamp / ? AS INTEGER) * ? AS bucket_t,
                AVG(download_bytes) AS dl,
                AVG(upload_bytes) AS ul
            FROM bandwidth
            WHERE timestamp >= ?
            GROUP BY bucket_t
            ORDER BY bucket_t
            """,
            (bucket, bucket, cutoff),
        ).fetchall()
        data = [{"t": r["bucket_t"], "dl": r["dl"], "ul": r["ul"]} for r in rows]
    conn.close()

    return jsonify(data)


@app.route("/api/summary")
def api_summary():
    timeline = request.args.get("timeline", 5, type=int)
    if timeline not in DOWNSAMPLE:
        timeline = 5

    cutoff = time.time() - (timeline * 60)
    conn = get_db()
    row = conn.execute(
        """
        SELECT
            AVG(download_bytes) AS avg_dl,
            MAX(download_bytes) AS max_dl,
            MIN(download_bytes) AS min_dl,
            SUM(download_bytes) AS total_dl,
            AVG(upload_bytes) AS avg_ul,
            MAX(upload_bytes) AS max_ul,
            MIN(upload_bytes) AS min_ul,
            SUM(upload_bytes) AS total_ul,
            COUNT(*) AS samples
        FROM bandwidth
        WHERE timestamp >= ?
        """,
        (cutoff,),
    ).fetchone()
    conn.close()

    if row["samples"] == 0:
        return jsonify(
            {
                "avg_dl": 0, "max_dl": 0, "min_dl": 0, "total_dl": 0,
                "avg_ul": 0, "max_ul": 0, "min_ul": 0, "total_ul": 0,
                "samples": 0,
            }
        )

    return jsonify(
        {
            "avg_dl": row["avg_dl"] or 0,
            "max_dl": row["max_dl"] or 0,
            "min_dl": row["min_dl"] or 0,
            "total_dl": row["total_dl"] or 0,
            "avg_ul": row["avg_ul"] or 0,
            "max_ul": row["max_ul"] or 0,
            "min_ul": row["min_ul"] or 0,
            "total_ul": row["total_ul"] or 0,
            "samples": row["samples"],
        }
    )


if __name__ == "__main__":
    init_db()
    t = threading.Thread(target=collect_bandwidth, daemon=True)
    t.start()
    print("Bandwidth monitor started. Open http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=False)
