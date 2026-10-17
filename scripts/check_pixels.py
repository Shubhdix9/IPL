import os
# pyrefly: ignore[missing-import]
from PIL import Image

upload_dir = r"C:\Users\SAgar\.gemini\antigravity-ide\brain\c59b6d07-1fdb-4311-913d-3c5948888726\.user_uploaded"

if os.path.exists(upload_dir):
    for f in sorted(os.listdir(upload_dir)):
        p = os.path.join(upload_dir, f)
        try:
            with Image.open(p) as img:
                rgb = img.convert("RGB")
                w, h = rgb.size
                top_left = rgb.getpixel((min(10, w - 1), min(10, h - 1)))
                center = rgb.getpixel((w // 2, h // 2))
                print(f"{f}: size={w}x{h}, top_left={top_left}, center={center}")
        except Exception as e:
            print(f"{f}: {e}")
else:
    print(f"Directory {upload_dir} not found.")
