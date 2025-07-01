import logging
from typing import List, Dict, Optional
from celery import shared_task
from django.contrib.auth.models import User
from googleapiclient.errors import HttpError
from .gmail_utils import GmailServiceManager, handle_gmail_api_error, retry_gmail_operation
from .models import GoogleOAuthToken

logger = logging.getLogger(__name__)

class EmailDeletionManager:
    """Manager for email deletion operations"""
    
    def __init__(self, user):
        self.user = user
        self.service_manager = GmailServiceManager(user)
    
    def delete_single_email(self, message_id, permanent=False):
        """Delete a single email (trash or permanent)"""
        try:
            service = self.service_manager.get_service()
            if not service:
                return {'error': 'Gmail service not available'}
            
            if permanent:
                def delete_operation():
                    return service.users().messages().delete(
                        userId='me', 
                        id=message_id
                    ).execute()
                
                retry_gmail_operation(delete_operation)
                
                logger.info(f"Permanently deleted email {message_id} for user {self.user.username}")
                return {
                    'status': 'success',
                    'message_id': message_id,
                    'action': 'permanently_deleted'
                }
            else:
                def trash_operation():
                    return service.users().messages().trash(
                        userId='me', 
                        id=message_id
                    ).execute()
                
                result = retry_gmail_operation(trash_operation)
                
                logger.info(f"Moved email {message_id} to trash for user {self.user.username}")
                return {
                    'status': 'success',
                    'message_id': message_id,
                    'action': 'moved_to_trash',
                    'result': result
                }
                
        except HttpError as e:
            if e.resp.status == 404:
                return {
                    'status': 'not_found',
                    'message_id': message_id,
                    'error': 'Email not found'
                }
            
            error_info = handle_gmail_api_error(e, "delete email")
            logger.error(f"Delete email error for user {self.user.username}: {error_info}")
            return {'error': error_info}
        except Exception as e:
            logger.error(f"Unexpected delete error for user {self.user.username}: {e}")
            return {'error': {'message': str(e), 'type': 'unknown'}}
    
    def recover_email(self, message_id):
        """Recover email from trash"""
        try:
            service = self.service_manager.get_service()
            if not service:
                return {'error': 'Gmail service not available'}
            
            def untrash_operation():
                return service.users().messages().untrash(
                    userId='me', 
                    id=message_id
                ).execute()
            
            result = retry_gmail_operation(untrash_operation)
            
            logger.info(f"Recovered email {message_id} from trash for user {self.user.username}")
            return {
                'status': 'success',
                'message_id': message_id,
                'action': 'recovered_from_trash',
                'result': result
            }
            
        except HttpError as e:
            if e.resp.status == 404:
                return {
                    'status': 'not_found',
                    'message_id': message_id,
                    'error': 'Email not found in trash'
                }
            
            error_info = handle_gmail_api_error(e, "recover email")
            logger.error(f"Recover email error for user {self.user.username}: {error_info}")
            return {'error': error_info}
        except Exception as e:
            logger.error(f"Unexpected recover error for user {self.user.username}: {e}")
            return {'error': {'message': str(e), 'type': 'unknown'}}

@shared_task(bind=True)
def bulk_delete_emails_task(self, user_id, message_ids, permanent=False, batch_size=100):
    """Celery task for bulk email deletion"""
    try:
        user = User.objects.get(id=user_id)
        deletion_manager = EmailDeletionManager(user)
        
        total_emails = len(message_ids)
        processed = 0
        successful = 0
        failed = 0
        errors = []
        
        # Process in batches
        for i in range(0, total_emails, batch_size):
            batch = message_ids[i:i + batch_size]
            
            for message_id in batch:
                try:
                    result = deletion_manager.delete_single_email(message_id, permanent)
                    
                    if result.get('status') == 'success':
                        successful += 1
                    else:
                        failed += 1
                        errors.append({
                            'message_id': message_id,
                            'error': result.get('error', 'Unknown error')
                        })
                    
                    processed += 1
                    
                    # Update task progress
                    progress = int((processed / total_emails) * 100)
                    self.update_state(
                        state='PROGRESS',
                        meta={
                            'current': processed,
                            'total': total_emails,
                            'progress': progress,
                            'successful': successful,
                            'failed': failed
                        }
                    )
                    
                except Exception as e:
                    failed += 1
                    errors.append({
                        'message_id': message_id,
                        'error': str(e)
                    })
                    processed += 1
            
            # Small delay between batches to respect rate limits
            import time
            time.sleep(0.1)
        
        # Final result
        result = {
            'status': 'completed',
            'total': total_emails,
            'successful': successful,
            'failed': failed,
            'errors': errors[:10],  # Limit error details
            'action': 'permanently_deleted' if permanent else 'moved_to_trash'
        }
        
        logger.info(f"Bulk deletion completed for user {user.username}: {successful}/{total_emails} successful")
        
        return result
        
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for bulk delete task")
        return {'status': 'error', 'message': 'User not found'}
    except Exception as e:
        logger.error(f"Bulk delete task error: {e}")
        return {'status': 'error', 'message': str(e)}

@shared_task(bind=True)
def bulk_recover_emails_task(self, user_id, message_ids, batch_size=100):
    """Celery task for bulk email recovery"""
    try:
        user = User.objects.get(id=user_id)
        deletion_manager = EmailDeletionManager(user)
        
        total_emails = len(message_ids)
        processed = 0
        successful = 0
        failed = 0
        errors = []
        
        # Process in batches
        for i in range(0, total_emails, batch_size):
            batch = message_ids[i:i + batch_size]
            
            for message_id in batch:
                try:
                    result = deletion_manager.recover_email(message_id)
                    
                    if result.get('status') == 'success':
                        successful += 1
                    else:
                        failed += 1
                        errors.append({
                            'message_id': message_id,
                            'error': result.get('error', 'Unknown error')
                        })
                    
                    processed += 1
                    
                    # Update task progress
                    progress = int((processed / total_emails) * 100)
                    self.update_state(
                        state='PROGRESS',
                        meta={
                            'current': processed,
                            'total': total_emails,
                            'progress': progress,
                            'successful': successful,
                            'failed': failed
                        }
                    )
                    
                except Exception as e:
                    failed += 1
                    errors.append({
                        'message_id': message_id,
                        'error': str(e)
                    })
                    processed += 1
            
            # Small delay between batches
            import time
            time.sleep(0.1)
        
        # Final result
        result = {
            'status': 'completed',
            'total': total_emails,
            'successful': successful,
            'failed': failed,
            'errors': errors[:10],
            'action': 'recovered_from_trash'
        }
        
        logger.info(f"Bulk recovery completed for user {user.username}: {successful}/{total_emails} successful")
        
        return result
        
    except User.DoesNotExist:
        logger.error(f"User {user_id} not found for bulk recover task")
        return {'status': 'error', 'message': 'User not found'}
    except Exception as e:
        logger.error(f"Bulk recover task error: {e}")
        return {'status': 'error', 'message': str(e)}    