import json
import random
import urllib.error
import urllib.parse
import urllib.request

from config import VIDEO_API_BASE_URL, VIDEO_API_TOKEN
from schemas import ManualMetrics


def _random_metrics():
    views = random.randint(3000, 10000)
    likes = random.randint(200, 1000)
    comments = random.randint(50, 300)
    shares = random.randint(20, 200)
    follows = random.randint(10, 120)

    return {
        "source": "mock",
        "views": views,
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "follows": follows,
        "engagement_rate": round((likes + comments + shares) / max(views, 1), 4),
    }


def _manual_metrics(metrics):
    if not metrics:
        return None
    metrics = ManualMetrics.model_validate(metrics).model_dump()

    views = int(metrics.get("views", 0))
    likes = int(metrics.get("likes", 0))
    comments = int(metrics.get("comments", 0))
    shares = int(metrics.get("shares", 0))
    follows = int(metrics.get("follows", 0))

    return {
        "source": "manual",
        "views": views,
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "follows": follows,
        "engagement_rate": round((likes + comments + shares) / max(views, 1), 4),
    }


def _fetch_real_metrics(video_id):
    if not VIDEO_API_BASE_URL or not VIDEO_API_TOKEN or not video_id:
        return None

    query = urllib.parse.urlencode({"video_id": video_id})
    url = f"{VIDEO_API_BASE_URL.rstrip('/')}/metrics?{query}"
    request = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {VIDEO_API_TOKEN}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(request, timeout=5) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError):
        return None

    if not isinstance(payload, dict):
        return None
    metrics = payload.get("data", payload)
    if not isinstance(metrics, dict):
        return None

    required = ["views", "likes", "comments"]
    if not all(key in metrics for key in required):
        return None
    try:
        metrics = ManualMetrics.model_validate({key: metrics.get(key, 0) for key in ("views", "likes", "comments", "shares", "follows")}).model_dump()
    except ValueError:
        return None

    views = int(metrics.get("views", 0))
    likes = int(metrics.get("likes", 0))
    comments = int(metrics.get("comments", 0))
    shares = int(metrics.get("shares", 0))
    follows = int(metrics.get("follows", 0))

    return {
        "source": "real_api",
        "views": views,
        "likes": likes,
        "comments": comments,
        "shares": shares,
        "follows": follows,
        "engagement_rate": round((likes + comments + shares) / max(views, 1), 4),
    }


def evaluate(video_id=None, mode="mock", manual_metrics=None):
    if mode == "manual":
        metrics = _manual_metrics(manual_metrics)
        if metrics:
            return metrics

    if mode == "mock":
        return _random_metrics()

    real_metrics = _fetch_real_metrics(video_id)
    if real_metrics:
        return real_metrics
    return _random_metrics()
