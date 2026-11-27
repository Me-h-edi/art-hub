from django.db.models import Q
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from . import ai
from .models import Artwork
from .permissions import IsArtistOrReadOnly
from .serializers import ArtworkSerializer

COPY_THRESHOLD = 0.92


class ArtworkViewSet(viewsets.ModelViewSet):
    serializer_class = ArtworkSerializer
    permission_classes = [IsArtistOrReadOnly]

    def get_queryset(self):
        qs = Artwork.objects.all().order_by('-created_at')
        user = self.request.user
        if user.is_authenticated and (user.is_staff or user.is_superuser):
            return qs
        if user.is_authenticated:
            return qs.filter(Q(is_flagged=False) | Q(artist=user))
        return qs.filter(is_flagged=False)

    @action(
        detail=False,
        methods=['post'],
        url_path='predict-category',
        permission_classes=[AllowAny],
        parser_classes=[MultiPartParser, FormParser],
    )
    def predict_category(self, request):
        image_file = request.FILES.get('image')
        if not image_file:
            return Response(
                {'detail': 'No image file provided.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            result = ai.classify_artwork(image_file)
            result['category'] = result['category'].capitalize()
            return Response(result, status=status.HTTP_200_OK)
        except Exception as exc:
            return Response(
                {'detail': f'Classification failed: {str(exc)}'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(
        detail=False,
        methods=['get'],
        url_path='search',
        permission_classes=[AllowAny],
    )
    def search(self, request):
        query = (request.query_params.get('q') or '').strip()
        qs = self.get_queryset()
        if not query:
            return Response(self.get_serializer(qs, many=True).data)

        query_vec = ai.embed_text(query)
        scored = []
        for art in qs:
            if art.embedding:
                score = ai.cosine(query_vec, art.embedding)
                if score >= 0.20:
                    scored.append((score, art))

        scored.sort(key=lambda x: x[0], reverse=True)
        results = []
        for score, art in scored:
            item = self.get_serializer(art).data
            item['match_score'] = round(float(score), 4)
            results.append(item)
        return Response(results)

    def perform_create(self, serializer):
        image_file = self.request.FILES.get('image')
        embedding = None
        best_score, best_match = None, None
        provided_category = (serializer.validated_data.get('category') or '').strip()

        if image_file is not None:
            if not provided_category or provided_category.lower() == 'general':
                try:
                    prediction = ai.classify_artwork(image_file)
                    provided_category = prediction['category'].capitalize()
                except Exception:
                    provided_category = provided_category or 'General'

            image_file.seek(0)
            embedding = ai.embed_image(image_file)
            image_file.seek(0)
            for other in Artwork.objects.filter(embedding__isnull=False):
                score = ai.cosine(embedding, other.embedding)
                if best_score is None or score > best_score:
                    best_score, best_match = score, other

        serializer.save(
            artist=self.request.user,
            category=provided_category or 'General',
            embedding=embedding,
            similarity_score=best_score,
            similar_to=best_match,
            is_flagged=best_score is not None and best_score >= COPY_THRESHOLD,
        )