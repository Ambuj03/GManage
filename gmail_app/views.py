from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework import generics

from .serializers import UserRegistrationSerializer, UserSerializer, UserLoginSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from rest_framework_simplejwt.views import TokenRefreshView
from rest_framework_simplejwt.exceptions import TokenError

# Importing OAuth related things
from django.contrib.auth.models import User
from django.shortcuts import redirect
from .utils import generate_auth_url, exchange_code_for_tokens
from .models import GoogleOAuthToken
from .serializers import GoogleAuthURLSerializer, GoogleOAuthSerializer

from django.conf import settings
import importlib
from datetime import timedelta, datetime

class UserLoginView(APIView):
    permission_classes = [AllowAny]
    
    def post(self, request):
        serializer = UserLoginSerializer(data = request.data)
        if serializer.is_valid():
            user = serializer.validated_data['user']
            refresh = RefreshToken.for_user(user)

            return Response({
                'message' : 'Login Succesful',
                'user' : UserSerializer(user).data,
                'tokens' : {
                    'refresh' : str(refresh),
                    'access' : str(refresh.access_token)
                }
            }, status=status.HTTP_200_OK)
        
        return Response(serializer.errors, status = status.HTTP_400_BAD_REQUEST)
    

class UserLogoutView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        try:
            refresh_token = request.data.get('refresh')
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
                
            return Response({
                'message': 'Logout successful'
            }, status=status.HTTP_200_OK)
        except TokenError:
            return Response({
                'error': 'Invalid token'
            }, status=status.HTTP_400_BAD_REQUEST)
        
    
class UserRegistrationView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]
    
    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data = request.data)
        serializer.is_valid(raise_exception = True)
        user = serializer.save()

        #Generatng jwt token so that user wouldnt have to login after registering
        refresh = RefreshToken.for_user(user)

        return Response({
            'message' : 'User created successfully',
            'user' : UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        }, status=status.HTTP_201_CREATED)


class ProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]
    
    def get_object(self):
        return self.request.user
    

# Creating OAuth related views
class GoogleAuthURLView(APIView):
    permission_classes = [IsAuthenticated]

    """Generate Google OAuth2 authorization URL"""
    def get(self, request):

        # import gmail_purge_backend.settings
        # importlib.reload(gmail_purge_backend.settings)
        
        # # Test what's actually loaded
        # from django.conf import settings
        # print("Current CLIENT_ID:", settings.GOOGLE_OAUTH2_CLIENT_ID)

        auth_url, state = generate_auth_url(request.user.id)

        serializer = GoogleAuthURLSerializer({
            'auth_url' : auth_url,
            'state' : state
        })

        return Response(serializer.data)
    


class GoogleOAuthCallbackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        code = request.GET.get('code')
        state = request.GET.get('state')
        error = request.GET.get('error')

        if error:
            return Response({
                'error': f'OAuth error: {error}'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not state or not code:
            return Response({
                'error': 'Missing authorization code or state'
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Get user from state
            user = User.objects.get(id=int(state))

            # Manual token exchange
            token_response = exchange_code_for_tokens(code)

            # Get granted scopes from URL parameter
            granted_scopes_param = request.GET.get('scope', '')
            granted_scopes = granted_scopes_param.split() if granted_scopes_param else []

            # Calculate expiry
            expiry = None
            if 'expires_in' in token_response:
                expiry = datetime.utcnow() + timedelta(seconds=token_response['expires_in'])

            # Save tokens to database
            token, created = GoogleOAuthToken.objects.update_or_create(
                user=user,
                defaults={
                    'access_token': token_response['access_token'],
                    'refresh_token': token_response.get('refresh_token'),
                    'token_uri': 'https://oauth2.googleapis.com/token',
                    'client_id': settings.GOOGLE_OAUTH2_CLIENT_ID,
                    'client_secret': settings.GOOGLE_OAUTH2_CLIENT_SECRET,
                    'scopes': granted_scopes,
                    'expiry': expiry
                }
            )

            return Response({
                'message': 'Google OAuth setup successful',
                'token_created': created,
                'granted_scopes': granted_scopes
            })
        
        except User.DoesNotExist:
            return Response({
                'error': 'Invalid user state'
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'error': f'OAuth callback error: {str(e)}'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class GoogleTokenStatusView(APIView):
    permission_classes = [IsAuthenticated]

    """Check Google OAuth token status"""
    def get(self, request):
        try:
            token = GoogleOAuthToken.objects.get(user = request.user)
            serializer = GoogleOAuthSerializer(token)

            return Response({
                'has_token' : True,
                'is_expired' : token.is_expired(),
                'token_info' : serializer.data  
            })
        except GoogleOAuthToken.DoesNotExist:
            return Response({
                'has_token': False,
                'is_expired': None,
                'token_info': None
            })
