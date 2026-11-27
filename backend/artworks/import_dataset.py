import os
import sys
from pathlib import Path
import django

# Setup Django environment
BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.append(str(BASE_DIR))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'arthub.settings')
django.setup()

from django.contrib.auth import get_user_model
from django.core.files import File
from artworks.models import Artwork
from artworks import ai

User = get_user_model()


def bulk_import(dataset_dir, limit=1000):
    dataset_path = Path(dataset_dir)
    if not dataset_path.exists():
        print(f"❌ Folder not found: {dataset_path}")
        return

    artist, _ = User.objects.get_or_create(username='admin')

    valid_exts = {'.jpg', '.jpeg', '.png', '.webp'}
    image_files = [
        p for p in dataset_path.rglob('*')
        if p.is_file() and p.suffix.lower() in valid_exts
    ]

    print(f"📂 Found {len(image_files)} total images. Importing up to {limit}...")

    imported = 0
    for img_path in image_files:
        if imported >= limit:
            break

        # Detect category from parent folder name (e.g., painting, sculpture, drawings)
        parent_name = img_path.parent.name.capitalize()
        category = parent_name if parent_name.lower() in {
            'painting', 'sculpture', 'drawings', 'engraving', 'iconography'
        } else 'Painting'

        title = img_path.stem.replace('_', ' ').replace('-', ' ').title()[:120]

        if Artwork.objects.filter(title=title).exists():
            continue

        try:
            embedding = ai.embed_image(img_path)
            with open(img_path, 'rb') as f:
                art = Artwork(
                    artist=artist,
                    title=title,
                    category=category,
                    embedding=embedding,
                    is_flagged=False,
                )
                art.image.save(img_path.name, File(f), save=True)

            imported += 1
            if imported % 25 == 0:
                print(f"✅ Imported {imported}/{limit} artworks with CLIP embeddings...")
        except Exception as e:
            print(f"⚠️ Skipped {img_path.name}: {e}")

    print(f"\n🎉 Done! Successfully indexed {imported} new artworks into Art-Hub.")


if __name__ == '__main__':
    DATASET_FOLDER = r"C:\Users\USER\Downloads\archive (1)"
    bulk_import(DATASET_FOLDER, limit=1000)