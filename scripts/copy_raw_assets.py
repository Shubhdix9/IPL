import os
import shutil

src_candidates = [
    r"C:\Users\SAgar\Downloads",
    os.path.expanduser(r"~\Downloads"),
]

src_dir = next((d for d in src_candidates if os.path.exists(d)), None)
repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
dst_base = os.path.join(repo_root, "client", "public", "assets", "teams")

mapping = {
    "dc": {"source": "dc_source.png", "target_source": "source.png", "hero": "dc_team.jpg", "target_hero": "hero.jpg"},
    "kkr": {"source": "kkr_source.png", "target_source": "source.png", "hero": "kkr_team.jpg", "target_hero": "hero.jpg"},
    "pbks": {"source": "pbks_source.png", "target_source": "source.png", "hero": "pbks_team.jpg", "target_hero": "hero.jpg"},
    "rr": {"source": "rr_source.png", "target_source": "source.png", "hero": "rr_team.jpg", "target_hero": "hero.jpg"},
    "srh": {"source": "srh_source.jpg", "target_source": "source.jpg", "hero": "srh_team.png", "target_hero": "hero.png"},
}

if src_dir and os.path.exists(src_dir):
    for team_id, files in mapping.items():
        team_dir = os.path.join(dst_base, team_id)
        os.makedirs(team_dir, exist_ok=True)

        src_source_path = os.path.join(src_dir, files["source"])
        dst_source_path = os.path.join(team_dir, files["target_source"])
        if os.path.exists(src_source_path):
            shutil.copy2(src_source_path, dst_source_path)

        src_hero_path = os.path.join(src_dir, files["hero"])
        dst_hero_path = os.path.join(team_dir, files["target_hero"])
        if os.path.exists(src_hero_path):
            shutil.copy2(src_hero_path, dst_hero_path)

        print(f"Verified assets for {team_id}: {files['target_source']} and {files['target_hero']}")
else:
    print(f"Source directory not found among {src_candidates}. Using existing files in {dst_base}.")
