from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated


class HealthCheckView(APIView):
    permission_classes = [AllowAny]
    
    def get(self, request):
        data = {
            'status': 'success',
            'message': 'Gmail Purge API is running!',
            'version': '1.0.0'
        }
        return Response(data, status=status.HTTP_200_OK)
    
class ProfileView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'user_id' : request.user.id,
            'username' : request.user.username,
            'email' : request.user.email,
        })
    
