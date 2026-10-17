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
                w, h = img.size
                crop = img.crop((w // 4, h // 4, 3 * w // 4, 3 * h // 4)).convert("RGB")
                avg_color = tuple(int(x) for x in crop.resize((1, 1)).getpixel((0, 0)))
                print(f"{f}: size={img.size}, format={img.format}, center_avg_rgb={avg_color}")
        except Exception as e:
            print(f"{f}: error opening image ({e})")
else:
    print(f"Directory {upload_dir} does not exist.")
