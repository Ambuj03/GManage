import logging
import time
from typing import Optional, Dict, Any
from django.conf import settings
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from google.auth.exceptions import RefreshError
from .models import GoogleOAuthToken
from .utils import get_credentials_for_user
from datetime import datetime

logger = logging.getLogger(__name__)

class GmailServiceManager:
    """Manager class for Gmail API service operations"""
    
    def __init__(self, user):
        self.user = user
        self._service = None
        self._last_error = None
    
    def get_service(self, force_refresh=False):
        """Get Gmail service with proper token refresh"""
        # Always get fresh credentials to ensure tokens are current
        credentials = get_credentials_for_user(self.user)
        if not credentials:
            return None
        
        try:
            # Always create fresh service with current credentials
            service = build('gmail', 'v1', credentials=credentials)
            
            # Test with lightweight call
            service.users().getProfile(userId='me').execute()
            
            self._service = service
            return service
            
        except Exception as e:
            logger.error(f"Gmail service creation failed: {e}")
            return None
    
    def _test_connection(self):
        """Test Gmail API connection with minimal call"""
        if not self._service:
            raise Exception("No service available")
        
        # Make a lightweight API call to test connection
        profile = self._service.users().getProfile(userId='me').execute()
        if not profile.get('emailAddress'):
            raise Exception("Invalid Gmail profile response")
    
    def _handle_token_error(self):
        """Handle token-related errors"""
        try:
            # Remove invalid tokens
            GoogleOAuthToken.objects.filter(user=self.user).delete()
            logger.info(f"Removed invalid tokens for user {self.user.username}")
        except Exception as e:
            logger.error(f"Failed to clean up invalid tokens for user {self.user.username}: {e}")
    
    def is_connected(self):
        """Check if Gmail service is connected and working"""
        service = self.get_service()
        return service is not None
    
    def get_last_error(self):
        """Get the last error that occurred"""
        return self._last_error

def create_gmail_service(user):
    """Factory function to create Gmail service for a user"""
    manager = GmailServiceManager(user)
    return manager.get_service()

def test_gmail_connectivity(user):
    """Test Gmail connectivity and return detailed status"""
    try:
        manager = GmailServiceManager(user)
        service = manager.get_service()
        
        if not service:
            return {
                'connected': False,
                'error': manager.get_last_error() or 'Failed to create Gmail service',
                'profile': None
            }
        
        # Get Gmail profile information
        profile = service.users().getProfile(userId='me').execute()
        
        return {
            'connected': True,
            'error': None,
            'profile': {
                'email_address': profile.get('emailAddress'),
                'messages_total': profile.get('messagesTotal', 0),
                'threads_total': profile.get('threadsTotal', 0),
                'history_id': profile.get('historyId')
            }
        }
        
    except Exception as e:
        logger.error(f"Gmail connectivity test failed for user {user.username}: {e}")
        return {
            'connected': False,
            'error': str(e),
            'profile': None
        }

def handle_gmail_api_error(error, operation="Gmail API operation"):
    """Handle Gmail API errors with appropriate responses"""
    if isinstance(error, HttpError):
        error_code = error.resp.status
        error_content = error.content.decode('utf-8') if error.content else 'Unknown error'
        
        if error_code == 401:
            return {
                'error_type': 'authentication',
                'message': 'Gmail authentication expired. Please re-authorize.',
                'code': 401,
                'details': error_content
            }
        elif error_code == 403:
            return {
                'error_type': 'permission',
                'message': 'Insufficient permissions for Gmail operation.',
                'code': 403,
                'details': error_content
            }
        elif error_code == 429:
            return {
                'error_type': 'rate_limit',
                'message': 'Gmail API rate limit exceeded. Please try again later.',
                'code': 429,
                'details': error_content
            }
        elif error_code >= 500:
            return {
                'error_type': 'server_error',
                'message': 'Gmail server error. Please try again later.',
                'code': error_code,
                'details': error_content
            }
        else:
            return {
                'error_type': 'api_error',
                'message': f'Gmail API error during {operation}',
                'code': error_code,
                'details': error_content
            }
    else:
        return {
            'error_type': 'unknown',
            'message': f'Unexpected error during {operation}: {str(error)}',
            'code': 500,
            'details': str(error)
        }

def retry_gmail_operation(func, max_retries=3, delay=1):
    """Retry Gmail operations with exponential backoff"""
    for attempt in range(max_retries):
        try:
            return func()
        except HttpError as e:
            if e.resp.status == 429:  # Rate limit
                if attempt < max_retries - 1:
                    sleep_time = delay * (2 ** attempt)
                    logger.warning(f"Rate limited, retrying in {sleep_time} seconds (attempt {attempt + 1})")
                    time.sleep(sleep_time)
                    continue
            raise
        except Exception as e:
            if attempt < max_retries - 1:
                sleep_time = delay * (2 ** attempt)
                logger.warning(f"Operation failed, retrying in {sleep_time} seconds: {e}")
                time.sleep(sleep_time)
                continue
            raise
    
    raise Exception(f"Operation failed after {max_retries} attempts")

def get_credentials_for_user(user):
    """Unified function for getting and refreshing Google credentials"""
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
        
        # Proactive refresh - refresh if expiring within 5 minutes
        if credentials.expiry:
            time_until_expiry = credentials.expiry - datetime.utcnow()
            should_refresh = time_until_expiry.total_seconds() < 300  # 5 minutes
        else:
            should_refresh = credentials.expired
        
        if should_refresh and credentials.refresh_token:
            try:
                logger.info(f"Refreshing token for user {user.username}")
                credentials.refresh(Request())
                
                # Update database
                token.access_token = credentials.token
                token.expiry = credentials.expiry
                token.save()
                
                logger.info(f"Token refreshed successfully for user {user.username}")
                
            except RefreshError as e:
                # Only delete tokens if refresh token is actually invalid
                if 'invalid_grant' in str(e).lower():
                    logger.error(f"Refresh token invalid, deleting for user {user.username}")
                    token.delete()
                    return None
                else:
                    # For other errors, log but don't delete tokens
                    logger.warning(f"Token refresh failed temporarily: {e}")
                    # Continue with existing credentials
        
        return credentials
        
    except GoogleOAuthToken.DoesNotExist:
        return None
    except Exception as e:
        logger.error(f"Error getting credentials: {e}")
        return None