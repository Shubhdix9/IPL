import os
import numpy as np
from PIL import Image

def get_trimmed_logo(src_path, team):
    img = Image.open(src_path).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]
    
    diff = np.sqrt(np.sum((arr[:, :, :3].astype(float) - 255.0)**2, axis=2))
    tol = 35.0 if team != "srh" else 45.0
    is_bg = diff < tol
    
    visited = np.zeros((h, w), dtype=bool)
    from collections import deque
    q = deque()
    for x in range(w):
        if is_bg[0, x]: q.append((0, x)); visited[0, x] = True
        if is_bg[h-1, x]: q.append((h-1, x)); visited[h-1, x] = True
    for y in range(h):
        if is_bg[y, 0] and not visited[y, 0]: q.append((y, 0)); visited[y, 0] = True
        if is_bg[y, w-1] and not visited[y, w-1]: q.append((y, w-1)); visited[y, w-1] = True
    while q:
        cy, cx = q.popleft()
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx] and is_bg[ny, nx]:
                visited[ny, nx] = True
                q.append((ny, nx))
    arr[visited, 3] = 0
    
    alpha = arr[:, :, 3]
    y_idx, x_idx = np.where(alpha > 0)
    trimmed = arr[y_idx.min():y_idx.max()+1, x_idx.min():x_idx.max()+1]
    return Image.fromarray(trimmed)

# Save trimmed logo-full for each team
base = r"C:\Users\SAgar\IPL\client\public\assets\teams"
for team in ["dc", "kkr", "pbks", "rr", "srh"]:
    src_file = "source.jpg" if team == "srh" else "source.png"
    p = os.path.join(base, team, src_file)
    logo_full = get_trimmed_logo(p, team)
    out_p = os.path.join(base, team, "logo-full.png")
    logo_full.save(out_p, "PNG")
    print(f"Saved {team} logo-full.png: size={logo_full.size}")
