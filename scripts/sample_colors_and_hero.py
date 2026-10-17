import os
import numpy as np
from PIL import Image

base = r"C:\Users\SAgar\IPL\client\public\assets\teams"

teams = {
    "dc": {
        "name": "Delhi Capitals",
        "slogan": "Roar Macha",
        "starting": {
            "primary": "#17479E",
            "secondary": "#EF1B23",
            "tertiary": "#F7B500",
            "accentUi": "#4A8DF0",
            "heroFocus": "50% 25%"
        },
        "hero_file": "hero.jpg",
        "logo_file": "logo-full.png",
        # Jersey sampling region: center/lower area where players' blue jerseys are dominant
        "jersey_box": (0.2, 0.35, 0.8, 0.85)
    },
    "kkr": {
        "name": "Kolkata Knight Riders",
        "slogan": "Korbo Lorbo Jeetbo Re",
        "starting": {
            "primary": "#3A225D",
            "secondary": "#E5B93C",
            "tertiary": "#7B4FC9",
            "accentUi": "#E3BD3F",
            "heroFocus": "50% 28%"
        },
        "hero_file": "hero.jpg",
        "logo_file": "logo-full.png",
        "jersey_box": (0.1, 0.3, 0.9, 0.85)
    },
    "pbks": {
        "name": "Punjab Kings",
        "slogan": "Sadda Punjab",
        "starting": {
            "primary": "#D81F2A",
            "secondary": "#C9A36B",
            "tertiary": "#3F5BA9",
            "accentUi": "#F0343B",
            "heroFocus": "50% 28%"
        },
        "hero_file": "hero.jpg",
        "logo_file": "logo-full.png",
        "jersey_box": (0.15, 0.35, 0.85, 0.8)
    },
    "rr": {
        "name": "Rajasthan Royals",
        "slogan": "Halla Bol",
        "starting": {
            "primary": "#EA1A85",
            "secondary": "#1E2B68", # Prompt note: "secondary = royal blue SAMPLED from jersey upper panel... a deep indigo, darker than #254AA5"
            "tertiary": "#F5B7D6",
            "accentUi": "#FF4DA6",
            "heroFocus": "50% 22%"
        },
        "hero_file": "hero.jpg",
        "logo_file": "logo-full.png",
        "jersey_box": (0.1, 0.25, 0.9, 0.85)
    },
    "srh": {
        "name": "Sunrisers Hyderabad",
        "slogan": "Orange Army",
        "starting": {
            "primary": "#F26522",
            "secondary": "#C8202B",
            "tertiary": "#FDB913",
            "accentUi": "#FF8A3D",
            "heroFocus": "50% 30%"
        },
        "hero_file": "hero.png",
        "logo_file": "logo-full.png",
        "jersey_box": (0.1, 0.25, 0.9, 0.85)
    }
}

def rgb_to_hex(r, g, b):
    return f"#{int(r):02X}{int(g):02X}{int(b):02X}"

def hex_to_rgb(hex_str):
    hex_str = hex_str.lstrip('#')
    return [int(hex_str[i:i+2], 16) for i in (0, 2, 4)]

def relative_luminance(rgb):
    # sRGB to linear
    s = [c / 255.0 for c in rgb]
    lum = [c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4 for c in s]
    return 0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2]

def contrast_ratio(rgb1, rgb2):
    l1 = relative_luminance(rgb1)
    l2 = relative_luminance(rgb2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)

bg_page = hex_to_rgb("#050B16") # dark background
bg_card = hex_to_rgb("#10151D") # card background

results = {}

for team_id, conf in teams.items():
    team_dir = os.path.join(base, team_id)
    hero_p = os.path.join(team_dir, conf["hero_file"])
    logo_p = os.path.join(team_dir, conf["logo_file"])
    
    # 1. Sample jersey color from hero photo
    hero_img = Image.open(hero_p).convert("RGB")
    hw, hh = hero_img.size
    box = conf["jersey_box"]
    crop_rect = (int(box[0]*hw), int(box[1]*hh), int(box[2]*hw), int(box[3]*hh))
    jersey_crop = np.array(hero_img.crop(crop_rect))
    
    # Sample based on team's known chromatic jersey signature
    if team_id == "dc":
        # Blue jersey: B > R and B > G
        mask = (jersey_crop[:, :, 2] > jersey_crop[:, :, 0] + 30) & (jersey_crop[:, :, 2] > 70)
        sampled_primary = np.median(jersey_crop[mask], axis=0) if np.any(mask) else np.median(jersey_crop.reshape(-1, 3), axis=0)
    elif team_id == "kkr":
        # Purple jersey: R > 40, G < 60, B > 60
        mask = (jersey_crop[:, :, 0] > 40) & (jersey_crop[:, :, 2] > 50) & (jersey_crop[:, :, 1] < jersey_crop[:, :, 0])
        sampled_primary = np.median(jersey_crop[mask], axis=0) if np.any(mask) else np.median(jersey_crop.reshape(-1, 3), axis=0)
    elif team_id == "pbks":
        # Red jersey: R > G + 40 and R > B + 40
        mask = (jersey_crop[:, :, 0] > jersey_crop[:, :, 1] + 50) & (jersey_crop[:, :, 0] > jersey_crop[:, :, 2] + 50)
        sampled_primary = np.median(jersey_crop[mask], axis=0) if np.any(mask) else np.median(jersey_crop.reshape(-1, 3), axis=0)
    elif team_id == "rr":
        # RR: Primary is Pink #EA1A85 from logo. Secondary is royal blue sampled from upper panel in hero photo!
        mask_blue = (jersey_crop[:, :, 2] > jersey_crop[:, :, 0] + 15) & (jersey_crop[:, :, 2] > jersey_crop[:, :, 1] + 15) & (jersey_crop[:, :, 2] > 60)
        sampled_secondary = np.median(jersey_crop[mask_blue], axis=0) if np.any(mask_blue) else [26, 38, 92]
        sampled_primary = hex_to_rgb("#EA1A85")
    elif team_id == "srh":
        # Orange jersey: R > 180, G in 60-140, B < 60
        mask = (jersey_crop[:, :, 0] > 160) & (jersey_crop[:, :, 1] > 50) & (jersey_crop[:, :, 2] < 70)
        sampled_primary = np.median(jersey_crop[mask], axis=0) if np.any(mask) else np.median(jersey_crop.reshape(-1, 3), axis=0)
        
    primary_hex = rgb_to_hex(*sampled_primary)
    
    # Sample secondary and tertiary from logo
    logo_img = Image.open(logo_p).convert("RGBA")
    logo_arr = np.array(logo_img)
    logo_rgb = logo_arr[logo_arr[:, :, 3] > 128, :3]
    
    if team_id == "dc":
        # Secondary: Red tiger/stripe in logo (R > 180, G < 60, B < 60)
        mask_sec = (logo_rgb[:, 0] > 180) & (logo_rgb[:, 1] < 60) & (logo_rgb[:, 2] < 60)
        sec_rgb = np.median(logo_rgb[mask_sec], axis=0) if np.any(mask_sec) else hex_to_rgb("#EF1B23")
        # Tertiary: Gold/yellow shield border (R > 200, G in 150-200, B < 60)
        mask_tert = (logo_rgb[:, 0] > 200) & (logo_rgb[:, 1] > 140) & (logo_rgb[:, 2] < 60)
        tert_rgb = np.median(logo_rgb[mask_tert], axis=0) if np.any(mask_tert) else hex_to_rgb("#F7B500")
        accent_ui = "#4A8DF0"
    elif team_id == "kkr":
        # Secondary: Gold from logo text/flame
        mask_sec = (logo_rgb[:, 0] > 200) & (logo_rgb[:, 1] > 160) & (logo_rgb[:, 2] < 80)
        sec_rgb = np.median(logo_rgb[mask_sec], axis=0) if np.any(mask_sec) else hex_to_rgb("#E5B93C")
        tert_rgb = hex_to_rgb("#7B4FC9") # lifted purple
        accent_ui = "#E5B93C"
    elif team_id == "pbks":
        # Secondary: champagne gold from lion mane
        mask_sec = (logo_rgb[:, 0] > 180) & (logo_rgb[:, 1] > 140) & (logo_rgb[:, 2] < 120)
        sec_rgb = np.median(logo_rgb[mask_sec], axis=0) if np.any(mask_sec) else hex_to_rgb("#C9A36B")
        # Tertiary: dark navy blue from trousers / logo border
        tert_rgb = hex_to_rgb("#3F5BA9")
        accent_ui = "#F53B47"
    elif team_id == "rr":
        sec_rgb = sampled_secondary
        tert_rgb = hex_to_rgb("#F5B7D6") # soft pink
        accent_ui = "#FF4DA6"
    elif team_id == "srh":
        # Secondary: deep red from logo
        mask_sec = (logo_rgb[:, 0] > 160) & (logo_rgb[:, 1] < 50) & (logo_rgb[:, 2] < 50)
        sec_rgb = np.median(logo_rgb[mask_sec], axis=0) if np.any(mask_sec) else hex_to_rgb("#C8202B")
        # Tertiary: yellow sun
        mask_tert = (logo_rgb[:, 0] > 220) & (logo_rgb[:, 1] > 160) & (logo_rgb[:, 2] < 50)
        tert_rgb = np.median(logo_rgb[mask_tert], axis=0) if np.any(mask_tert) else hex_to_rgb("#FDB913")
        accent_ui = "#FF8A3D"
        
    secondary_hex = rgb_to_hex(*sec_rgb)
    tertiary_hex = rgb_to_hex(*tert_rgb)
    
    # Calculate contrast ratios
    cr_accent = contrast_ratio(hex_to_rgb(accent_ui), bg_page)
    cr_strip_prim = contrast_ratio(hex_to_rgb(primary_hex), bg_card)
    cr_strip_sec = contrast_ratio(hex_to_rgb(secondary_hex), bg_card)
    cr_strip_tert = contrast_ratio(hex_to_rgb(tertiary_hex), bg_card)
    
    # Lifted strip variants where brand colors < 3:1 against card background
    lifted_primary = primary_hex
    if cr_strip_prim < 3.0:
        # Lift color towards white until >= 3:1
        rgb_cur = np.array(hex_to_rgb(primary_hex), dtype=float)
        while contrast_ratio(rgb_cur.astype(int), bg_card) < 3.0 and np.max(rgb_cur) < 255:
            rgb_cur = np.clip(rgb_cur + 5, 0, 255)
        lifted_primary = rgb_to_hex(*rgb_cur.astype(int))
        
    lifted_secondary = secondary_hex
    if cr_strip_sec < 3.0:
        rgb_cur = np.array(hex_to_rgb(secondary_hex), dtype=float)
        while contrast_ratio(rgb_cur.astype(int), bg_card) < 3.0 and np.max(rgb_cur) < 255:
            rgb_cur = np.clip(rgb_cur + 5, 0, 255)
        lifted_secondary = rgb_to_hex(*rgb_cur.astype(int))

    lifted_tertiary = tertiary_hex
    if cr_strip_tert < 3.0:
        rgb_cur = np.array(hex_to_rgb(tertiary_hex), dtype=float)
        while contrast_ratio(rgb_cur.astype(int), bg_card) < 3.0 and np.max(rgb_cur) < 255:
            rgb_cur = np.clip(rgb_cur + 5, 0, 255)
        lifted_tertiary = rgb_to_hex(*rgb_cur.astype(int))
        
    results[team_id] = {
        "name": conf["name"],
        "slogan": conf["slogan"],
        "heroFocus": conf["starting"]["heroFocus"],
        "starting": conf["starting"],
        "sampled": {
            "primary": primary_hex,
            "secondary": secondary_hex,
            "tertiary": tertiary_hex,
            "accentUi": accentUi if 'accentUi' in locals() else accent_ui,
            "liftedStrips": {
                "primary": lifted_primary,
                "secondary": lifted_secondary,
                "tertiary": lifted_tertiary
            }
        },
        "contrast": {
            "accentUi_vs_page": round(cr_accent, 2),
            "primary_vs_card": round(cr_strip_prim, 2),
            "secondary_vs_card": round(cr_strip_sec, 2),
            "tertiary_vs_card": round(cr_strip_tert, 2),
            "liftedPrimary_vs_card": round(contrast_ratio(hex_to_rgb(lifted_primary), bg_card), 2),
            "liftedSecondary_vs_card": round(contrast_ratio(hex_to_rgb(lifted_secondary), bg_card), 2)
        }
    }
    
    # 2. Export optimized hero.webp (quality 80)
    # Add slight film grain for KKR (613px) and RR (738px)
    hero_out = hero_img.copy()
    if team_id in ["kkr", "rr"]:
        # Add very subtle noise overlay so softness is masked
        arr_h = np.array(hero_out, dtype=float)
        noise = np.random.normal(0, 3.5, arr_h.shape) # subtle 3.5 stddev noise
        arr_h = np.clip(arr_h + noise, 0, 255).astype(np.uint8)
        hero_out = Image.fromarray(arr_h)
        
    hero_webp_path = os.path.join(team_dir, "hero.webp")
    hero_out.save(hero_webp_path, "WEBP", quality=80)
    print(f"Exported {team_id} hero.webp (size={hero_out.size}, saved={os.path.getsize(hero_webp_path)} bytes)")

import json
print("\nCOLOR SAMPLING AND CONTRAST RESULTS:")
print(json.dumps(results, indent=2))
with open(os.path.join(base, "sampled_colors.json"), "w") as f:
    json.dump(results, f, indent=2)
