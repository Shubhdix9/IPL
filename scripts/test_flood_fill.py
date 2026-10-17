import os
from collections import deque
import numpy as np
from PIL import Image

def remove_bg_flood_fill(img_path, threshold=245):
    img = Image.open(img_path).convert("RGBA")
    arr = np.array(img)
    h, w = arr.shape[:2]
    
    # Identify near-white pixels: R, G, B >= threshold or distance from (255,255,255) < (255-threshold)*sqrt(3)
    # For JPG (like SRH), compression artifacts might be around 235-245.
    diff = np.sqrt(np.sum((arr[:, :, :3].astype(float) - 255.0)**2, axis=2))
    # Near white condition
    tol = 35.0 # distance tolerance from pure white
    is_bg_candidate = diff < tol
    
    # BFS flood fill starting from all 4 borders
    visited = np.zeros((h, w), dtype=bool)
    queue = deque()
    
    # Add all border pixels that are candidate background
    for x in range(w):
        if is_bg_candidate[0, x]:
            queue.append((0, x))
            visited[0, x] = True
        if is_bg_candidate[h-1, x]:
            queue.append((h-1, x))
            visited[h-1, x] = True
            
    for y in range(h):
        if is_bg_candidate[y, 0] and not visited[y, 0]:
            queue.append((y, 0))
            visited[y, 0] = True
        if is_bg_candidate[y, w-1] and not visited[y, w-1]:
            queue.append((y, w-1))
            visited[y, w-1] = True
            
    while queue:
        cy, cx = queue.popleft()
        for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and not visited[ny, nx]:
                if is_bg_candidate[ny, nx]:
                    visited[ny, nx] = True
                    queue.append((ny, nx))
                    
    # Only connected background pixels become transparent
    arr[visited, 3] = 0
    
    # Trim transparent borders
    alpha = arr[:, :, 3]
    y_idx, x_idx = np.where(alpha > 0)
    trimmed_arr = arr[y_idx.min():y_idx.max()+1, x_idx.min():x_idx.max()+1]
    
    return Image.fromarray(trimmed_arr)

# Test on DC
test_dc = remove_bg_flood_fill(r"C:\Users\SAgar\IPL\client\public\assets\teams\dc\source.png")
print("DC trimmed size:", test_dc.size)
# Check if white text survived: sample a known white area in DC (center of "CAPITALS")
test_arr = np.array(test_dc)
print("DC internal white pixels preserved:", np.sum((test_arr[:, :, 0] > 240) & (test_arr[:, :, 1] > 240) & (test_arr[:, :, 2] > 240) & (test_arr[:, :, 3] == 255)))
