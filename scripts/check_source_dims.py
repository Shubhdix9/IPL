import os
from PIL import Image

base = r"C:\Users\SAgar\IPL\client\public\assets\teams"

for team in ["dc", "kkr", "pbks", "rr", "srh"]:
    source_name = "source.jpg" if team == "srh" else "source.png"
    p = os.path.join(base, team, source_name)
    with Image.open(p) as img:
        print(f"{team}: format={img.format}, size={img.size}")
