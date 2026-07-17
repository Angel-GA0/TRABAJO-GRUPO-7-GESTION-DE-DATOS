import time
import urllib.request
import webbrowser

URL = "http://127.0.0.1:8000"
for _ in range(60):
    try:
        with urllib.request.urlopen(f"{URL}/api/health", timeout=1) as response:
            if response.status == 200:
                webbrowser.open(URL)
                break
    except Exception:
        time.sleep(0.5)
