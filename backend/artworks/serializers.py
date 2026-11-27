from rest_framework import serializers
from .models import Artwork


class ArtworkSerializer(serializers.ModelSerializer):
    artist_name = serializers.CharField(source='artist.username', read_only=True)
    similar_to_title = serializers.SerializerMethodField()

    class Meta:
        model = Artwork
        fields = ['id', 'title', 'description', 'category', 'image',
                  'artist', 'artist_name', 'created_at',
                  'similarity_score', 'similar_to', 'similar_to_title', 'is_flagged']
        read_only_fields = ['artist', 'created_at',
                            'similarity_score', 'similar_to', 'is_flagged']

    def get_similar_to_title(self, obj):
        return obj.similar_to.title if obj.similar_to else None