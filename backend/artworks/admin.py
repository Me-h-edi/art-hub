from django.contrib import admin
from .models import Artwork


@admin.register(Artwork)
class ArtworkAdmin(admin.ModelAdmin):
    list_display = ('title', 'artist', 'is_flagged', 'similarity_score', 'similar_to', 'created_at')
    list_filter = ('is_flagged',)
