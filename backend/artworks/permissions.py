from rest_framework import permissions


class IsArtistOrReadOnly(permissions.BasePermission):
    """Anyone can view. Only logged-in artists (or admin) can add. Only the owner or admin can edit/delete."""

    def has_permission(self, request, view):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        if not user.is_authenticated:
            return False
        if user.is_staff or user.is_superuser:
            return True
        profile = getattr(user, 'profile', None)
        return profile is not None and profile.role == 'artist'

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        user = request.user
        return obj.artist == user or user.is_staff or user.is_superuser