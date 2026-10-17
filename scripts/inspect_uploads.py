import os
# pyrefly: ignore[missing-import]
from PIL import Image

upload_dir = r"C:\Users\SAgar\.gemini\antigravity-ide\brain\c59b6d07-1fdb-4311-913d-3c5948888726\.user_uploaded"

if os.path.exists(upload_dir):
    files = sorted(os.listdir(upload_dir))
    for f in files:
        p = os.path.join(upload_dir, f)
        try:
            with Image.open(p) as img:
                print(f"{f}: format={img.format}, size={img.size}, mode={img.mode}")
        except Exception as e:
            print(f"{f}: not an image ({e})")
else:
    print("upload_dir does not exist")
