from django.contrib.auth import authenticate
from rest_framework import permissions, status
from rest_framework.authtoken.models import Token
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import Profile
from .serializers import RegisterSerializer


def get_role(user):
    if user.is_staff or user.is_superuser:
        return 'admin'
    profile = Profile.objects.filter(user=user).first()
    return profile.role if profile else 'buyer'


def auth_response(user):
    token, _ = Token.objects.get_or_create(user=user)
    return {'token': token.key, 'username': user.username, 'role': get_role(user)}


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(auth_response(user), status=status.HTTP_201_CREATED)


class LoginView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        user = authenticate(
            username=request.data.get('username'),
            password=request.data.get('password'),
        )
        if user is None:
            return Response({'error': 'Wrong username or password.'},
                            status=status.HTTP_400_BAD_REQUEST)
        return Response(auth_response(user))


class MeView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        return Response({'username': request.user.username, 'role': get_role(request.user)})