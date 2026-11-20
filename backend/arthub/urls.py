from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from django.http import HttpResponse
from rest_framework.routers import DefaultRouter

from artworks.views import ArtworkViewSet


def home(request):
    return HttpResponse("""
        <h1>Welcome to Art-Hub!</h1>
        <p>Art-Hub Django Backend is running successfully.</p>
        <p>API: <a href="/api/">Visit API</a></p>
        <p>Admin: <a href="/admin/">Visit Admin</a></p>
    """)


router = DefaultRouter()
router.register('artworks', ArtworkViewSet, basename='artwork')

urlpatterns = [
    path('', home, name='home'),
    path('admin/', admin.site.urls),
    path('api/auth/', include('accounts.urls')),
    path('api/', include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)