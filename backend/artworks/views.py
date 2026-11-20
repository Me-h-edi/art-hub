from django.db.models import Q
from rest_framework import viewsets

from . import ai
from .models import Artwork
from .permissions import IsArtistOrReadOnly
from .serializers import ArtworkSerializer

# Similarity at or above this value means "possible copy" (needs admin review).
COPY_THRESHOLD = 0.92


class ArtworkViewSet(viewsets.ModelViewSet):
    serializer_class = ArtworkSerializer
    permission_classes = [IsArtistOrReadOnly]

    def get_queryset(self):
        qs = Artwork.objects.all().order_by('-created_at')
        user = self.request.user
        if user.is_authenticated and (user.is_staff or user.is_superuser):
            return qs
        # Flagged artworks are hidden from the public. Only the owner can see them.
        if user.is_authenticated:
            return qs.filter(Q(is_flagged=False) | Q(artist=user))
        return qs.filter(is_flagged=False)

    def perform_create(self, serializer):
        image_file = self.request.FILES.get('image')
        embedding = None
        best_score, best_match = None, None

        if image_file is not None:
            embedding = ai.embed_image(image_file)
            image_file.seek(0)
            for other in Artwork.objects.filter(embedding__isnull=False):
                score = ai.cosine(embedding, other.embedding)
                if best_score is None or score > best_score:
                    best_score, best_match = score, other

        serializer.save(
            artist=self.request.user,
            embedding=embedding,
            similarity_score=best_score,
            similar_to=best_match,
            is_flagged=best_score is not None and best_score >= COPY_THRESHOLD,
        )