from django.db import models
from django.contrib.auth.models import User


class Artwork(models.Model):
    artist = models.ForeignKey(User, on_delete=models.CASCADE, related_name='artworks')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    category = models.CharField(max_length=100, default='General')
    image = models.ImageField(upload_to='artworks/')
    created_at = models.DateTimeField(auto_now_add=True)

    # AI fields (filled automatically when an artwork is uploaded)
    embedding = models.JSONField(null=True, blank=True, editable=False)
    similarity_score = models.FloatField(null=True, blank=True)
    similar_to = models.ForeignKey('self', null=True, blank=True,
                                   on_delete=models.SET_NULL, related_name='possible_copies')
    is_flagged = models.BooleanField(default=False)

    def __str__(self):
        return self.title