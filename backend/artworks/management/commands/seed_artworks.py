from pathlib import Path

from django.contrib.auth.models import User
from django.core.files import File
from django.core.management.base import BaseCommand, CommandError

from artworks import ai
from artworks.models import Artwork

IMAGE_TYPES = ('.jpg', '.jpeg', '.png', '.webp')


class Command(BaseCommand):
    help = "Load sample artworks from a folder of images (with AI embeddings)."

    def add_arguments(self, parser):
        parser.add_argument('folder', help='Folder that contains the images')
        parser.add_argument('--artist', required=True, help='Username that will own the artworks')

    def handle(self, *args, **options):
        folder = Path(options['folder'])
        if not folder.is_dir():
            raise CommandError(f'Folder not found: {folder}')
        try:
            artist = User.objects.get(username=options['artist'])
        except User.DoesNotExist:
            raise CommandError(f"User '{options['artist']}' does not exist")

        files = sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_TYPES)
        if not files:
            raise CommandError('No images found in that folder')

        added = skipped = 0
        for path in files:
            title = path.stem
            if Artwork.objects.filter(artist=artist, title=title).exists():
                skipped += 1
                continue
            embedding = ai.embed_image(str(path))
            with open(path, 'rb') as f:
                artwork = Artwork(artist=artist, title=title, category='Painting', embedding=embedding)
                artwork.image.save(path.name, File(f), save=True)
            added += 1
            self.stdout.write(f'Added: {title}')

        self.stdout.write(self.style.SUCCESS(f'Done. Added {added}, skipped {skipped} (already there).'))