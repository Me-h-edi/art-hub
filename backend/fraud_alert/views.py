from rest_framework import permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .core import FEATURES, risk_score


class FraudCheckView(APIView):
    """POST the 5 numbers of an account/order, get back a risk score.
    Later this will be called automatically when an order is placed."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        data = {}
        for name in FEATURES:
            try:
                data[name] = float(request.data[name])
            except (KeyError, TypeError, ValueError):
                return Response({'error': f'"{name}" is missing or not a number.'},
                                status=status.HTTP_400_BAD_REQUEST)
        try:
            return Response(risk_score(data))
        except FileNotFoundError as e:
            return Response({'error': str(e)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)