import os
import re
import numpy as np
from PIL import Image, ImageFilter
import vtracer

def make_outline(team_dir):
    crop_path = os.path.join(team_dir, "emblem-crop.png")
    out_svg_path = os.path.join(team_dir, "emblem-outline.svg")
    
    img = Image.open(crop_path).convert("RGBA")
    w, h = img.size
    
    # 1. Upscale 3x Lanczos
    up = img.resize((w * 3, h * 3), Image.Resampling.LANCZOS)
    arr = np.array(up)
    
    # RGB & Alpha
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]
    
    # Convert to grayscale
    gray = np.dot(rgb.astype(float), [0.2989, 0.5870, 0.1140])
    
    # Edge detection using numpy
    pad_gray = np.pad(gray, 1, mode='edge')
    gx = (
        -pad_gray[:-2, :-2] + pad_gray[:-2, 2:]
        -2 * pad_gray[1:-1, :-2] + 2 * pad_gray[1:-1, 2:]
        -pad_gray[2:, :-2] + pad_gray[2:, 2:]
    )
    gy = (
        -pad_gray[:-2, :-2] - 2 * pad_gray[:-2, 1:-1] - pad_gray[:-2, 2:]
        +pad_gray[2:, :-2] + 2 * pad_gray[2:, 1:-1] + pad_gray[2:, 2:]
    )
    mag = np.hypot(gx, gy)
    
    # Alpha edge
    pad_a = np.pad(alpha.astype(float), 1, mode='constant', constant_values=0)
    agx = (
        -pad_a[:-2, :-2] + pad_a[:-2, 2:]
        -2 * pad_a[1:-1, :-2] + 2 * pad_a[1:-1, 2:]
        -pad_a[2:, :-2] + pad_a[2:, 2:]
    )
    agy = (
        -pad_a[:-2, :-2] - 2 * pad_a[:-2, 1:-1] - pad_a[:-2, 2:]
        +pad_a[2:, :-2] + 2 * pad_a[2:, 1:-1] + pad_a[2:, 2:]
    )
    amag = np.hypot(agx, agy)
    
    edges = mag + amag * 0.9
    edges[alpha < 50] = 0
    
    # Thresholding
    thresh = np.percentile(edges[alpha > 50], 75) if np.any(alpha > 50) else 50
    binary = np.full((h * 3, w * 3), 255, dtype=np.uint8)
    binary[edges > thresh] = 0
    
    # Light denoise/dilation for continuous lines
    bin_img = Image.fromarray(binary).filter(ImageFilter.MinFilter(3)) # thin black lines
    
    temp_bmp = os.path.join(team_dir, "temp_edges.png")
    temp_svg = os.path.join(team_dir, "temp_edges.svg")
    bin_img.save(temp_bmp)
    
    # Trace with vtracer
    vtracer.convert_image_to_svg_py(temp_bmp, temp_svg)
    
    with open(temp_svg, "r", encoding="utf-8") as f:
        svg_content = f.read()
        
    # Replace white/black fills
    # The background is white, so paths with fill="#ffffff" or fill="white" should be removed or made none
    # The strokes are black, so they should be fill="none" stroke="currentColor"
    svg_clean = re.sub(r'fill="#f+[^"]*"', 'fill="none"', svg_content, flags=re.IGNORECASE)
    svg_clean = re.sub(r'fill="white"', 'fill="none"', svg_clean, flags=re.IGNORECASE)
    svg_clean = re.sub(r'fill="#0+[^"]*"', 'fill="none" stroke="currentColor" stroke-width="1.2"', svg_clean, flags=re.IGNORECASE)
    svg_clean = re.sub(r'fill="black"', 'fill="none" stroke="currentColor" stroke-width="1.2"', svg_clean, flags=re.IGNORECASE)
    
    # Clean up empty paths or background rectangle
    with open(out_svg_path, "w", encoding="utf-8") as f:
        f.write(svg_clean)
        
    if os.path.exists(temp_bmp): os.remove(temp_bmp)
    if os.path.exists(temp_svg): os.remove(temp_svg)
    print(f"Generated {out_svg_path} (size={len(svg_clean)} bytes)")

base = r"C:\Users\SAgar\IPL\client\public\assets\teams"
for team in ["dc", "kkr", "pbks", "rr", "srh"]:
    make_outline(os.path.join(base, team))
