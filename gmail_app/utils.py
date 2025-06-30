import json
from google_auth_oauthlib.flow import Flow
from django.conf import settings 
from .models import GoogleOAuthToken
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import requests

# Adding logger for enchanced debugging
import logging
logger = logging.getLogger(__name__)


"""Create Google OAuth2 flow"""
def get_google_auth_flow():

    try:
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.GOOGLE_OAUTH2_CLIENT_ID,
                    "client_secret": settings.GOOGLE_OAUTH2_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                    "redirect_uris": [settings.GOOGLE_OAUTH2_REDIRECT_URI]
                }
            },
            scopes=settings.GMAIL_SCOPES

        )
        flow.redirect_uri = settings.GOOGLE_OAUTH2_REDIRECT_URI
        return flow
    except Exception as e:
        logger.error(f'Failed to create OAuth flow : {e}')
        return None


"""Generate Google OAuth2 authorization URL"""
def generate_auth_url(user_id):
    flow = get_google_auth_flow()

    if not flow:
        return None, None

    try:
        auth_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            state=str(user_id),
            prompt='consent'  # Force consent to get refresh token
        )
        return auth_url, state
    except Exception as e:
        logger.error(f"Failed to generate auth URL: {e}")
        return None, None


def exchange_code_for_tokens(code):
    """Manually exchange authorization code for OAuth tokens"""
    token_url = 'https://oauth2.googleapis.com/token'
    
    token_data = {
        'client_id': settings.GOOGLE_OAUTH2_CLIENT_ID,
        'client_secret': settings.GOOGLE_OAUTH2_CLIENT_SECRET,
        'code': code,
        'grant_type': 'authorization_code',
        'redirect_uri': settings.GOOGLE_OAUTH2_REDIRECT_URI
    }
    
    response = requests.post(token_url, data=token_data)
    
    if response.status_code != 200:
        raise Exception(f'Token exchange failed: {response.text}')
    
    return response.json()


"""Get valid Google credentials for a user"""
def get_credentials_for_user(user):
    try:
        token = GoogleOAuthToken.objects.get(user=user)

        credentials = Credentials(
            token=token.access_token,
            refresh_token=token.refresh_token,
            token_uri=token.token_uri,
            client_id=token.client_id,
            client_secret=token.client_secret,
            scopes=token.scopes
        )

        # Refresh token if expired
        if credentials.expired and credentials.refresh_token:
            try:
                credentials.refresh(Request())
                
                # Update stored token
                token.access_token = credentials.token
                if credentials.expiry:
                    token.expiry = credentials.expiry
                token.save()
                
                logger.info(f"Token refreshed for user {user.username}")
                
            except Exception as e:
                logger.error(f"Token refresh failed for user {user.username}: {e}")
                return None
        
        return credentials
    
    except GoogleOAuthToken.DoesNotExist:
        logger.warning(f"No OAuth token found for user {user.username}")
        return None
    except Exception as e:
        logger.error(f"Error getting credentials for user {user.username}: {e}")
        return None
    


"""Create Gmail API service for a user"""
def create_gmail_service(user):
    credentials = get_credentials_for_user(user)
    if not credentials:
        return None
    
    # return build('gmail', 'v1', credentials=credentials)

    try:
        service = build('gmail', 'v1', credentials=credentials)
        # Test the connection
        service.users().getProfile(userId='me').execute()
        return service
    except HttpError as e:
        logger.error(f"Gmail API error for user {user.username}: {e}")
        return None
    except Exception as e:
        logger.error(f"Failed to create Gmail service for user {user.username}: {e}")
        return None
    
    
"""Revoke and delete user's OAuth tokens"""
def revoke_user_tokens(user):
    try:
        credentials = get_credentials_for_user(user)
        if credentials:
            # Revoke token with Google
            revoke_url = f"https://oauth2.googleapis.com/revoke?token={credentials.token}"
            import requests
            requests.post(revoke_url)
        
        # Delete from database
        GoogleOAuthToken.objects.filter(user=user).delete()
        logger.info(f"OAuth tokens revoked for user {user.username}")
        return True
    except Exception as e:
        logger.error(f"Failed to revoke tokens for user {user.username}: {e}")
        return False
                                                              