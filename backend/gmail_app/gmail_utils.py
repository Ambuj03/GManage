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

logger = logging.getLogger(__name__)

class GmailServiceManager:
    """Manager class for Gmail API service operations"""
    
    def __init__(self, user):
        self.user = user
        self._service = None
        self._last_error = None
    
    def get_service(self, force_refresh=False):
        """Get Gmail service with automatic token refresh"""
        if self._service and not force_refresh:
            return self._service
        
        try:
            credentials = get_credentials_for_user(self.user)
            if not credentials:
                logger.error(f"No valid credentials for user {self.user.username}")
                return None
            
            # Build Gmail service
            self._service = build('gmail', 'v1', credentials=credentials)
            
            # Test connection with a lightweight call
            self._test_connection()
            
            logger.info(f"Gmail service created successfully for user {self.user.username}")
            return self._service
            
        except RefreshError as e:
            logger.error(f"Token refresh failed for user {self.user.username}: {e}")
            self._handle_token_error()
            return None
        except HttpError as e:
            logger.error(f"Gmail API error for user {self.user.username}: {e}")
            self._last_error = str(e)
            return None
        except Exception as e:
            logger.error(f"Unexpected error creating Gmail service for user {self.user.username}: {e}")
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

        # Enhanced token refresh with better error handling
        if credentials.expired and credentials.refresh_token:
            try:
                logger.info(f"Refreshing expired token for user {user.username}")
                credentials.refresh(Request())
                
                # Update stored token
                token.access_token = credentials.token
                if credentials.expiry:
                    token.expiry = credentials.expiry
                token.save()
                
                logger.info(f"Token refreshed successfully for user {user.username}")
                
            except RefreshError as e:
                # Only handle actual auth failures (invalid refresh token)
                if 'invalid_grant' in str(e) or 'refresh_token' in str(e).lower():
                    logger.error(f"Refresh token invalid for user {user.username}: {e}")
                    # Delete invalid tokens
                    token.delete()
                    return None
                else:
                    # Temporary network/server error - retry later
                    logger.warning(f"Temporary refresh error for user {user.username}: {e}")
                    # Return current credentials - may still work for a short time
                    return credentials
                    
            except Exception as e:
                # Network or other temporary errors
                logger.warning(f"Token refresh failed (temporary) for user {user.username}: {e}")
                # Return current credentials - may still work
                return credentials
        
        return credentials
    
    except GoogleOAuthToken.DoesNotExist:
        logger.warning(f"No OAuth token found for user {user.username}")
        return None
    except Exception as e:
        logger.error(f"Error getting credentials for user {user.username}: {e}")
        return None