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
from .utils import generate_auth_url, exchange_code_for_tokens, create_gmail_service, revoke_user_tokens
from .models import GoogleOAuthToken
from .serializers import GoogleAuthURLSerializer, GoogleOAuthSerializer

from django.conf import settings
import importlib
from datetime import timedelta, datetime

from .gmail_operations import GmailOperations, build_search_query

# Adding logger for enchanced debugging
import logging
logger = logging.getLogger(__name__)

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

    def get(self, request):
        """Generate Google OAuth2 authorization URL with enhanced error handling"""
        try:
            auth_url, state = generate_auth_url(request.user.id)

            if not auth_url:
                logger.error(f"Failed to generate auth URL for user {request.user.username}")
                return Response({
                    'error': 'Failed to generate authorization URL',
                    'success': False
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
            
            logger.info(f"Generated auth URL for user {request.user.username}")
            return Response({
                'auth_url': auth_url,
                'state': state,
                'message': 'Visit the auth_url to authorize Gmail access',
                'success': True
            })
        
        except Exception as e:
            logger.error(f"Auth URL generation error for user {request.user.username}: {e}")
            return Response({
                'error': f'Authorization setup failed: {str(e)}',
                'success': False
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class GoogleOAuthCallbackView(APIView):
    permission_classes = [AllowAny]

    def get(self, request):
        """Handle Google OAuth2 callback with enhanced validation and Gmail testing"""
        code = request.GET.get('code')
        state = request.GET.get('state')
        error = request.GET.get('error')

        if error:
            logger.warning(f"OAuth authorization denied: {error}")
            return Response({
                'error': f'OAuth authorization denied: {error}',
                'success': False
            }, status=status.HTTP_400_BAD_REQUEST)
        
        if not state or not code:
            logger.warning("OAuth callback missing required parameters")
            return Response({
                'error': 'Missing authorization code or state parameter',
                'success': False
            }, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            # Validate user from state
            try:
                user = User.objects.get(id=int(state))
            except (User.DoesNotExist, ValueError):
                logger.error(f"Invalid state parameter: {state}")
                return Response({
                    'error': 'Invalid authorization state',
                    'success': False
                }, status=status.HTTP_400_BAD_REQUEST)
        
            # Manual token exchange with enhanced error handling
            try:
                token_response = exchange_code_for_tokens(code)
            except Exception as e:
                logger.error(f"Token exchange failed for user {user.username}: {e}")
                return Response({
                    'error': f'Token exchange failed: {str(e)}',
                    'success': False
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Validate required tokens
            if 'access_token' not in token_response:
                logger.error(f"No access token received for user {user.username}")
                return Response({
                    'error': 'Invalid token response from Google',
                    'success': False
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            # Get granted scopes from URL parameter
            granted_scopes_param = request.GET.get('scope', '')
            granted_scopes = granted_scopes_param.split() if granted_scopes_param else []

            # Validate essential scopes
            required_scopes = ['https://www.googleapis.com/auth/gmail.modify']
            missing_scopes = [scope for scope in required_scopes if scope not in granted_scopes]
            
            if missing_scopes:
                logger.warning(f"Missing required scopes for user {user.username}: {missing_scopes}")
                return Response({
                    'error': f'Required Gmail permissions not granted: {missing_scopes}',
                    'success': False,
                    'granted_scopes': granted_scopes
                }, status=status.HTTP_400_BAD_REQUEST)

            # Calculate expiry with timezone awareness
            expiry = None
            if 'expires_in' in token_response:
                from django.utils import timezone
                expiry = timezone.now() + timedelta(seconds=token_response['expires_in'])

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

            # Test Gmail API connection
            try:
                gmail_service = create_gmail_service(user)
                if not gmail_service:
                    logger.error(f"Gmail service creation failed for user {user.username}")
                    return Response({
                        'error': 'Failed to connect to Gmail API. Please try again.',
                        'success': False
                    }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
                # Test with a simple API call
                profile = gmail_service.users().getProfile(userId='me').execute()
                gmail_address = profile.get('emailAddress', 'Unknown')
                
            except Exception as e:
                logger.error(f"Gmail API test failed for user {user.username}: {e}")
                # Don't fail the whole process, just warn
                gmail_address = 'Unable to verify'

            logger.info(f"OAuth setup successful for user {user.username}, Gmail: {gmail_address}")
            
            return Response({
                'message': 'Gmail authorization successful',
                'success': True,
                'token_created': created,
                'granted_scopes': granted_scopes,
                'gmail_address': gmail_address,
                'user_email': user.email
            })
        
        except Exception as e:
            logger.error(f"OAuth callback error for user state {state}: {e}")
            return Response({
                'error': f'Authorization failed: {str(e)}',
                'success': False
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)



class GoogleTokenStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        """Check Google OAuth token status with Gmail connectivity test"""
        try:
            token = GoogleOAuthToken.objects.get(user=request.user)
            
            # Test Gmail connectivity
            try:
                gmail_service = create_gmail_service(request.user)
                is_connected = gmail_service is not None
                
                if is_connected:
                    # Get basic Gmail info
                    profile = gmail_service.users().getProfile(userId='me').execute()
                    gmail_info = {
                        'email_address': profile.get('emailAddress'),
                        'messages_total': profile.get('messagesTotal', 0),
                        'threads_total': profile.get('threadsTotal', 0)
                    }
                else:
                    gmail_info = None
                    
            except Exception as e:
                logger.warning(f"Gmail connectivity test failed for user {request.user.username}: {e}")
                is_connected = False
                gmail_info = None

            return Response({
                'has_token': True,
                'is_expired': token.is_expired(),
                'is_connected': is_connected,
                'scopes': token.scopes,
                'created_at': token.created_at,
                'updated_at': token.updated_at,
                'gmail_info': gmail_info
            })
            
        except GoogleOAuthToken.DoesNotExist:
            return Response({
                'has_token': False,
                'is_expired': None,
                'is_connected': False,
                'scopes': [],
                'message': 'No Gmail authorization found. Please authorize first.',
                'gmail_info': None
            })


class GoogleTokenRevokeView(APIView):
    permission_classes = [IsAuthenticated]
    
    def delete(self, request):
        """Revoke Google OAuth tokens with enhanced error handling"""
        try:
            success = revoke_user_tokens(request.user)
            
            if success:
                logger.info(f"OAuth tokens revoked for user {request.user.username}")
                return Response({
                    'message': 'Gmail authorization revoked successfully',
                    'success': True
                })
            else:
                logger.error(f"Token revocation failed for user {request.user.username}")
                return Response({
                    'error': 'Failed to revoke authorization completely',
                    'success': False,
                    'message': 'Local tokens removed but Google revocation may have failed'
                }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
                
        except Exception as e:
            logger.error(f"Token revocation error for user {request.user.username}: {e}")
            return Response({
                'error': f'Revocation failed: {str(e)}',
                'success': False
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


# Gmail Connectivity Test Views
from .gmail_utils import test_gmail_connectivity, GmailServiceManager

class GmailConnectivityTestView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Test Gmail API connectivity and return detailed status"""
        try:
            connectivity_result = test_gmail_connectivity(request.user)
            
            if connectivity_result['connected']:
                return Response({
                    'status': 'success',
                    'connected': True,
                    'gmail_profile': connectivity_result['profile'],
                    'message': 'Gmail API connection successful'
                })
            else:
                return Response({
                    'status': 'error',
                    'connected': False,
                    'error': connectivity_result['error'],
                    'message': 'Gmail API connection failed'
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            logger.error(f"Gmail connectivity test error for user {request.user.username}: {e}")
            return Response({
                'status': 'error',
                'connected': False,
                'error': str(e),
                'message': 'Connectivity test failed'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request):
        """Force refresh Gmail connection"""
        try:
            manager = GmailServiceManager(request.user)
            service = manager.get_service(force_refresh=True)
            
            if service:
                connectivity_result = test_gmail_connectivity(request.user)
                return Response({
                    'status': 'success',
                    'connected': True,
                    'gmail_profile': connectivity_result['profile'],
                    'message': 'Gmail connection refreshed successfully'
                })
            else:
                return Response({
                    'status': 'error',
                    'connected': False,
                    'error': manager.get_last_error(),
                    'message': 'Failed to refresh Gmail connection'
                }, status=status.HTTP_400_BAD_REQUEST)
                
        except Exception as e:
            return Response({
                'status': 'error',
                'connected': False,
                'error': str(e),
                'message': 'Connection refresh failed'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
        

class GmailEmailListView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """List emails with optional filtering and pagination"""
        try:
            # Get query parameters
            query = request.GET.get('q', '')
            max_results = int(request.GET.get('max_results', 50))
            page_token = request.GET.get('page_token')
            label_ids = request.GET.getlist('label_ids')
            
            # Limit max results
            max_results = min(max_results, 500)
            
            gmail_ops = GmailOperations(request.user)
            result = gmail_ops.list_emails(
                query=query,
                max_results=max_results,
                page_token=page_token,
                label_ids=label_ids if label_ids else None
            )
            
            if 'error' in result:
                return Response(result, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({
                'status': 'success',
                'data': result,
                'pagination': {
                    'current_count': len(result['messages']),
                    'next_page_token': result.get('nextPageToken'),
                    'total_estimate': result.get('resultSizeEstimate', 0)
                }
            })
            
        except ValueError as e:
            return Response({
                'error': 'Invalid parameter format',
                'details': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Email list error for user {request.user.username}: {e}")
            return Response({
                'error': 'Failed to list emails',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GmailEmailMetadataView(APIView):
    permission_classes = [IsAuthenticated]
    
    def post(self, request):
        """Get metadata for specific emails"""
        try:
            message_ids = request.data.get('message_ids', [])
            
            if not message_ids:
                return Response({
                    'error': 'message_ids required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            if len(message_ids) > 1000:
                return Response({
                    'error': 'Too many message IDs (max 1000)'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            gmail_ops = GmailOperations(request.user)
            result = gmail_ops.get_email_metadata(message_ids)
            
            if 'error' in result:
                return Response(result, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({
                'status': 'success',
                'data': result,
                'count': len(result['emails'])
            })
            
        except Exception as e:
            logger.error(f"Email metadata error for user {request.user.username}: {e}")
            return Response({
                'error': 'Failed to get email metadata',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GmailSearchView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Search emails using query string"""
        try:
            query = request.GET.get('q', '')
            max_results = int(request.GET.get('max_results', 100))
            
            if not query:
                return Response({
                    'error': 'Search query (q) parameter required'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            gmail_ops = GmailOperations(request.user)
            result = gmail_ops.search_emails(query, max_results)
            
            if 'error' in result:
                return Response(result, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({
                'status': 'success',
                'data': result
            })
            
        except ValueError as e:
            return Response({
                'error': 'Invalid parameter format',
                'details': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            logger.error(f"Email search error for user {request.user.username}: {e}")
            return Response({
                'error': 'Search failed',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
    
    def post(self, request):
        """Advanced search using filter parameters"""
        try:
            filters = request.data
            
            # Build query from filters
            query = build_search_query(filters)
            max_results = filters.get('max_results', 100)
            
            if not query:
                return Response({
                    'error': 'No valid search filters provided'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            gmail_ops = GmailOperations(request.user)
            result = gmail_ops.search_emails(query, max_results)
            
            if 'error' in result:
                return Response(result, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({
                'status': 'success',
                'data': result,
                'filters_used': filters,
                'generated_query': query
            })
            
        except Exception as e:
            logger.error(f"Advanced search error for user {request.user.username}: {e}")
            return Response({
                'error': 'Advanced search failed',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class GmailLabelsView(APIView):
    permission_classes = [IsAuthenticated]
    
    def get(self, request):
        """Get all Gmail labels"""
        try:
            gmail_ops = GmailOperations(request.user)
            result = gmail_ops.get_labels()
            
            if 'error' in result:
                return Response(result, status=status.HTTP_400_BAD_REQUEST)
            
            return Response({
                'status': 'success',
                'data': result
            })
            
        except Exception as e:
            logger.error(f"Labels error for user {request.user.username}: {e}")
            return Response({
                'error': 'Failed to get labels',
                'details': str(e)
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)