import logging
from typing import List, Dict, Optional
from celery import shared_task
from django.contrib.auth.models import User
from googleapiclient.errors import HttpError
from .gmail_utils import GmailServiceManager, handle_gmail_api_error, retry_gmail_operation
from .models import GoogleOAuthToken
import time

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
        

    def fast_batch_delete_emails(self, message_ids, permanent=False, batch_size=1000):
        """Fast deletion using batchModify (PhotoPurge style)"""
        try:
            service = self.service_manager.get_service()
            if not service:
                return {'error': 'Gmail service not available'}
            
            total_successful = 0
            total_failed = 0
            all_errors = []
            
            # Process in batches of 1000 (batchModify limit)
            for i in range(0, len(message_ids), batch_size):
                batch_ids = message_ids[i:i + batch_size]
                
                try:
                    if permanent:
                        # For permanent deletion, use batchDelete if available
                        # or fall back to individual delete calls
                        for msg_id in batch_ids:
                            service.users().messages().delete(
                                userId='me',
                                id=msg_id   
                            ).execute()
                            time.sleep(0.01)  # Minimal delay
                    else:
                        # Fast trash using batchModify
                        service.users().messages().batchModify(
                            userId='me',
                            body={
                                'ids': batch_ids,
                                'addLabelIds': ['TRASH'],
                                'removeLabelIds': ['INBOX']
                            }
                        ).execute()
                    
                    total_successful += len(batch_ids)
                    logger.info(f"Fast batch {i//batch_size + 1} completed: {len(batch_ids)} emails")
                    
                except HttpError as e:
                    logger.error(f"Fast batch error: {e}")
                    total_failed += len(batch_ids)
                    all_errors.append({
                        'batch': i//batch_size + 1,
                        'error': str(e),
                        'message_count': len(batch_ids)
                    })
                    
                    # Rate limit handling
                    if e.resp.status == 429:
                        time.sleep(2.0)
                
                # Small delay between batches
                time.sleep(0.1)
            
            return {
                'status': 'completed',
                'total': len(message_ids),
                'successful': total_successful,
                'failed': total_failed,
                'errors': all_errors,
                'action': 'permanently_deleted' if permanent else 'moved_to_trash'
            }
            
        except Exception as e:
            logger.error(f"Fast batch delete error: {e}")
            return {'error': {'message': str(e), 'type': 'fast_batch_error'}}
        

    def fast_batch_recover_emails(self, message_ids, batch_size=1000):
        """Fast recovery using batchModify (remove TRASH label)"""
        try:
            service = self.service_manager.get_service()
            if not service:
                return {'error': 'Gmail service not available'}
            
            total_successful = 0
            total_failed = 0
            all_errors = []
            
            # Process in batches of 1000 (batchModify limit)
            for i in range(0, len(message_ids), batch_size):
                batch_ids = message_ids[i:i + batch_size]
                
                try:
                    # Fast recovery using batchModify
                    service.users().messages().batchModify(
                        userId='me',
                        body={
                            'ids': batch_ids,
                            'removeLabelIds': ['TRASH'],
                            'addLabelIds': ['INBOX']  # Move back to inbox
                        }
                    ).execute()
                    
                    total_successful += len(batch_ids)
                    logger.info(f"Fast recovery batch {i//batch_size + 1} completed: {len(batch_ids)} emails")
                    
                except HttpError as e:
                    logger.error(f"Fast recovery batch error: {e}")
                    total_failed += len(batch_ids)
                    all_errors.append({
                        'batch': i//batch_size + 1,
                        'error': str(e),
                        'message_count': len(batch_ids)
                    })
                    
                    # Rate limit handling
                    if e.resp.status == 429:
                        time.sleep(2.0)
                
                # Small delay between batches
                time.sleep(0.1)
            
            return {
                'status': 'completed',
                'total': len(message_ids),
                'successful': total_successful,
                'failed': total_failed,
                'errors': all_errors,
                'action': 'recovered_from_trash'
            }
            
        except Exception as e:
            logger.error(f"Fast batch recover error: {e}")
            return {'error': {'message': str(e), 'type': 'fast_recovery_error'}}
        


    def delete_by_query(self, search_query, max_emails=5000, permanent=False):
        """Delete emails by search query instead of individual IDs"""
        try:
            service = self.service_manager.get_service()
            if not service:
                return {'error': 'Gmail service not available'}
            
            # Step 1: Search for emails matching query
            all_message_ids = []
            page_token = None
            
            while len(all_message_ids) < max_emails:
                try:
                    # Search emails
                    result = service.users().messages().list(
                        userId='me',
                        q=search_query,
                        maxResults=min(500, max_emails - len(all_message_ids)),
                        pageToken=page_token
                    ).execute()
                    
                    messages = result.get('messages', [])
                    if not messages:
                        break
                    
                    # Extract message IDs
                    message_ids = [msg['id'] for msg in messages]
                    all_message_ids.extend(message_ids)
                    
                    page_token = result.get('nextPageToken')
                    if not page_token:
                        break
                        
                except Exception as e:
                    logger.error(f"Search error: {e}")
                    break
            
            logger.info(f"Found {len(all_message_ids)} emails for query: {search_query}")
            
            # Step 2: Delete using fast batch method
            if all_message_ids:
                return self.fast_batch_delete_emails(all_message_ids, permanent)
            else:
                return {
                    'status': 'completed',
                    'total': 0,
                    'successful': 0,
                    'failed': 0,
                    'message': 'No emails found matching the query'
                }
                
        except Exception as e:
            logger.error(f"Delete by query error: {e}")
            return {'error': {'message': str(e), 'type': 'query_delete_error'}}
        


    def recover_by_query(self, search_query, max_emails=5000):
        """Recover emails from trash by search query"""
        try:
            service = self.service_manager.get_service()
            if not service:
                return {'error': 'Gmail service not available'}
            
            # Search in trash
            trash_query = f"in:trash {search_query}"
            
            # Step 1: Search for emails in trash
            all_message_ids = []
            page_token = None
            
            while len(all_message_ids) < max_emails:
                try:
                    result = service.users().messages().list(
                        userId='me',
                        q=trash_query,
                        maxResults=min(500, max_emails - len(all_message_ids)),
                        pageToken=page_token
                    ).execute()
                    
                    messages = result.get('messages', [])
                    if not messages:
                        break
                    
                    message_ids = [msg['id'] for msg in messages]
                    all_message_ids.extend(message_ids)
                    
                    page_token = result.get('nextPageToken')
                    if not page_token:
                        break
                        
                except Exception as e:
                    logger.error(f"Trash search error: {e}")
                    break
            
            logger.info(f"Found {len(all_message_ids)} emails in trash for query: {trash_query}")
            
            # Step 2: Recover using fast batch method
            if all_message_ids:
                return self.fast_batch_recover_emails(all_message_ids)
            else:
                return {
                    'status': 'completed',
                    'total': 0,
                    'successful': 0,
                    'failed': 0,
                    'message': 'No emails found in trash matching the query'
                }
                
        except Exception as e:
            logger.error(f"Recover by query error: {e}")
            return {'error': {'message': str(e), 'type': 'query_recover_error'}}



@shared_task(bind=True)
def delete_by_query_task(self, user_id, search_query, max_emails=5000, permanent=False):
    """Delete emails by search query with undo tracking"""
    try:
        from .advanced_operations import UndoManager
        user = User.objects.get(id=user_id)
        deletion_manager = EmailDeletionManager(user)
        
        # Create undo point BEFORE deletion
        undo_manager = UndoManager(user)
        undo_data = {
            'type': 'bulk_delete_query',
            'search_query': search_query,
            'max_emails': max_emails,
            'permanent': permanent
        }
        undo_result = undo_manager.create_undo_point(undo_data)
        
        # Execute deletion
        result = deletion_manager.delete_by_query(
            search_query=search_query,
            max_emails=max_emails,
            permanent=permanent
        )
        
        # Add undo_id to result
        if 'error' not in result and 'error' not in undo_result:
            result['undo_id'] = undo_result.get('undo_id')
            result['undo_expires_hours'] = 24
        
        # Track statistics
        if 'error' not in result:
            track_deletion_stats(user_id, result)
        
        return result
        
    except User.DoesNotExist:
        return {'status': 'error', 'message': 'User not found'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}



@shared_task(bind=True) 
def bulk_delete_emails_task(self, user_id, message_ids, permanent=False, batch_size=1000):
    """Fast bulk deletion with undo tracking"""
    try:
        from .advanced_operations import UndoManager
        user = User.objects.get(id=user_id)
        deletion_manager = EmailDeletionManager(user)
        
        # Create undo point BEFORE deletion
        undo_manager = UndoManager(user)
        undo_data = {
            'type': 'bulk_delete',
            'message_ids': message_ids,
            'permanent': permanent
        }
        undo_result = undo_manager.create_undo_point(undo_data)
        
        # Execute deletion
        result = deletion_manager.fast_batch_delete_emails(
            message_ids, 
            permanent=permanent, 
            batch_size=batch_size
        )
        
        # Add undo_id to result
        if 'error' not in result and 'error' not in undo_result:
            result['undo_id'] = undo_result.get('undo_id')
        
        # Track statistics
        if 'error' not in result:
            track_deletion_stats(user_id, result)
        
        return result
        
    except User.DoesNotExist:
        return {'status': 'error', 'message': 'User not found'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}



def track_deletion_stats(user_id, deletion_result):
    """Track deletion statistics"""
    try:
        from django.core.cache import cache
        
        # Get current stats
        cache_key = f"deletion_stats_{user_id}_30"
        stats = cache.get(cache_key, {
            'total_deleted': 0,
            'storage_saved_mb': 0,
            'deletion_sessions': 0,
            'most_deleted_category': 'promotions',
            'avg_emails_per_session': 0
        })
        
        # Update stats
        successful = deletion_result.get('successful', 0)
        stats['total_deleted'] += successful
        stats['deletion_sessions'] += 1
        stats['avg_emails_per_session'] = stats['total_deleted'] / stats['deletion_sessions']
        
        # Estimate storage saved (rough calculation)
        # Average email size ~50KB
        storage_saved_kb = successful * 50
        stats['storage_saved_mb'] += round(storage_saved_kb / 1024, 2)
        
        # Save updated stats
        cache.set(cache_key, stats, 86400 * 30)  # Cache for 30 days
        
        logger.info(f"Updated deletion stats for user {user_id}: +{successful} emails")
        
    except Exception as e:
        logger.error(f"Failed to track deletion stats: {e}")




@shared_task(bind=True)
def bulk_recover_emails_task(self, user_id, message_ids, batch_size=1000):
    """Fast bulk recovery using batchModify"""
    try:
        user = User.objects.get(id=user_id)
        deletion_manager = EmailDeletionManager(user)
        
        # Use the fast batch recovery method
        result = deletion_manager.fast_batch_recover_emails(
            message_ids, 
            batch_size=batch_size
        )
        
        return result
        
    except User.DoesNotExist:
        return {'status': 'error', 'message': 'User not found'}
    except Exception as e:
        logger.error(f"Bulk recover task error: {e}")
        return {'status': 'error', 'message': str(e)}
    


@shared_task(bind=True)
def recover_by_query_task(self, user_id, search_query, max_emails=5000):
    """Recover emails by search query"""
    try:
        user = User.objects.get(id=user_id)
        deletion_manager = EmailDeletionManager(user)
        
        result = deletion_manager.recover_by_query(
            search_query=search_query,
            max_emails=max_emails
        )
        
        return result
        
    except User.DoesNotExist:
        return {'status': 'error', 'message': 'User not found'}
    except Exception as e:
        return {'status': 'error', 'message': str(e)}