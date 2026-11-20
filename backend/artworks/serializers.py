from rest_framework import serializers
from .models import Artwork


class ArtworkSerializer(serializers.ModelSerializer):
    artist_name = serializers.CharField(source='artist.username', read_only=True)

    class Meta:
        model = Artwork
        fields = ['id', 'title', 'description', 'category', 'image',
                  'artist', 'artist_name', 'created_at',
                  'similarity_score', 'similar_to', 'is_flagged']
        read_only_fields = ['artist', 'created_at',
                            'similarity_score', 'similar_to', 'is_flagged']