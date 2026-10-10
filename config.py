import os

from dotenv import load_dotenv

load_dotenv()

API_KEY = os.getenv("DEEPSEEK_API_KEY")
BASE_URL = os.getenv("DEEPSEEK_BASE_URL", "https://api.deepseek.com")
MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-flash")

VIDEO_API_BASE_URL = os.getenv("VIDEO_API_BASE_URL", "")
VIDEO_API_TOKEN = os.getenv("VIDEO_API_TOKEN", "")
