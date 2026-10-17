import os
import re
# pyrefly: ignore[missing-import]
import numpy as np
# pyrefly: ignore[missing-import]
from PIL import Image
# pyrefly: ignore[missing-import]
import vtracer

def generate_outline_svg(emblem_png_path, out_svg_path, upscale=3):
    img = Image.open(emblem_png_path).convert("RGBA")
    w, h = img.size

    # 1. Upscale with Lanczos
    up = img.resize((w * upscale, h * upscale), Image.Resampling.LANCZOS)
    arr = np.array(up)

    # Separate color and alpha
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3]

    # Grayscale
    gray = np.dot(rgb.astype(float), [0.2989, 0.5870, 0.1140])
    gray[alpha < 128] = 0

    # Sobel kernels via numpy
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

    # Alpha boundary edge
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

    total_edges = mag + amag * 0.8
    total_edges[alpha < 64] = 0

    edge_max = np.percentile(total_edges[alpha > 64], 95) if np.any(alpha > 64) else 1.0
    norm_edges = np.clip(total_edges / (edge_max + 1e-5) * 255.0, 0, 255)

    binary = np.full((h * upscale, w * upscale), 255, dtype=np.uint8)
    binary[norm_edges > 65] = 0

    temp_bmp = emblem_png_path.replace(".png", "_binary.png")
    temp_svg = emblem_png_path.replace(".png", "_raw.svg")
    Image.fromarray(binary).save(temp_bmp)

    # Run vtracer with valid arguments
    vtracer.convert_image_to_svg_py(temp_bmp, temp_svg)

    with open(temp_svg, "r", encoding="utf-8") as f:
        svg_content = f.read()

    svg_clean = re.sub(r'fill="#f+[^"]*"', 'fill="none"', svg_content, flags=re.IGNORECASE)
    svg_clean = re.sub(r'fill="white"', 'fill="none"', svg_clean, flags=re.IGNORECASE)
    svg_clean = re.sub(r'fill="#0+[^"]*"', 'fill="none" stroke="currentColor" stroke-width="1.2"', svg_clean, flags=re.IGNORECASE)
    svg_clean = re.sub(r'fill="black"', 'fill="none" stroke="currentColor" stroke-width="1.2"', svg_clean, flags=re.IGNORECASE)

    with open(out_svg_path, "w", encoding="utf-8") as f:
        f.write(svg_clean)

    if os.path.exists(temp_bmp):
        os.remove(temp_bmp)
    if os.path.exists(temp_svg):
        os.remove(temp_svg)

    print(f"Generated {out_svg_path} (size={len(svg_clean)} bytes)")

if __name__ == "__main__":
    repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    base_dir = os.path.join(repo_root, "client", "public", "assets", "teams")
    target_crop = os.path.join(base_dir, "dc", "emblem-crop.png")
    target_out = os.path.join(base_dir, "dc", "emblem-outline.svg")
    if os.path.exists(target_crop):
        generate_outline_svg(target_crop, target_out)
