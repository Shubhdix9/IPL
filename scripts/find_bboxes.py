import os
import numpy as np
from PIL import Image

base = r"C:\Users\SAgar\IPL\client\public\assets\teams"

for team in ["dc", "kkr", "pbks", "rr", "srh"]:
    source_name = "source.jpg" if team == "srh" else "source.png"
    p = os.path.join(base, team, source_name)
    with Image.open(p) as img:
        rgb = np.array(img.convert("RGB"))
        # Non-white mask (threshold < 245 in any channel)
        is_content = (rgb[:, :, 0] < 245) | (rgb[:, :, 1] < 245) | (rgb[:, :, 2] < 245)
        y_indices, x_indices = np.where(is_content)
        min_y, max_y = y_indices.min(), y_indices.max()
        min_x, max_x = x_indices.min(), x_indices.max()
        print(f"{team}: content bbox = x:[{min_x}, {max_x}] (w={max_x-min_x}), y:[{min_y}, {max_y}] (h={max_y-min_y})")
