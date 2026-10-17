import os
import numpy as np
from PIL import Image

def analyze_logo(team, src_path):
    # Load and flood-fill
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
    
    # Trim
    alpha = arr[:, :, 3]
    y_idx, x_idx = np.where(alpha > 0)
    trimmed = arr[y_idx.min():y_idx.max()+1, x_idx.min():x_idx.max()+1]
    th, tw = trimmed.shape[:2]
    print(f"{team.upper()}: trimmed size = {tw} x {th}")
    
    # Let's inspect rows
    # Print density of non-transparent pixels per 10% height
    for i in range(10):
        r1, r2 = int(i * th / 10), int((i + 1) * th / 10)
        sub = trimmed[r1:r2, :, :]
        # Check colors in this slice
        sub_alpha = sub[:, :, 3] > 0
        if np.any(sub_alpha):
            avg_rgb = sub[sub_alpha, :3].mean(axis=0).astype(int)
            print(f"  {i*10}% - {(i+1)*10}%: avg RGB={avg_rgb.tolist()}")

for t, f in [("dc", "source.png"), ("kkr", "source.png"), ("pbks", "source.png"), ("rr", "source.png"), ("srh", "source.jpg")]:
    p = os.path.join(r"C:\Users\SAgar\IPL\client\public\assets\teams", t, f)
    analyze_logo(t, p)
