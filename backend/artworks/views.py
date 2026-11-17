from rest_framework import viewsets
from .models import Artwork
from .serializers import ArtworkSerializer
from .permissions import IsArtistOrReadOnly


class ArtworkViewSet(viewsets.ModelViewSet):
    queryset = Artwork.objects.all().order_by('-created_at')
    serializer_class = ArtworkSerializer
    permission_classes = [IsArtistOrReadOnly]

    def perform_create(self, serializer):
        serializer.save(artist=self.request.user)