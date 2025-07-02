import logging
import json
from datetime import datetime, timedelta
from django.utils import timezone
from celery import shared_task
from django.contrib.auth.models import User
from django.core.cache import cache
from .gmail_utils import GmailServiceManager
from .email_operations import EmailDeletionManager



logger = logging.getLogger(__name__)

class EmailPreviewManager:
    """Manager for email preview functionality"""
    
    def __init__(self, user):
        self.user = user
        self.service_manager = GmailServiceManager(user)
    
    def preview_deletion_query(self, search_query, sample_size=20):
        """Preview emails that would be deleted by a query"""
        try:
            service = self.service_manager.get_service()
            if not service:
                return {'error': 'Gmail service not available'}
            
            # Get total count
            count_result = service.users().messages().list(
                userId='me',
                q=search_query,
                maxResults=1
            ).execute()
            
            total_count = count_result.get('resultSizeEstimate', 0)
            
            # Get sample emails for preview
            preview_result = service.users().messages().list(
                userId='me',
                q=search_query,
                maxResults=sample_size
            ).execute()
            
            messages = preview_result.get('messages', [])
            
            # Get metadata for preview emails
            preview_emails = []
            for msg in messages[:sample_size]:
                try:
                    message = service.users().messages().get(
                        userId='me',
                        id=msg['id'],
                        format='metadata',
                        metadataHeaders=['From', 'To', 'Subject', 'Date']
                    ).execute()
                    
                    headers = {h['name']: h['value'] for h in message.get('payload', {}).get('headers', [])}
                    
                    preview_emails.append({
                        'id': message['id'],
                        'from': headers.get('From', 'Unknown'),
                        'subject': headers.get('Subject', 'No Subject'),
                        'date': headers.get('Date', 'Unknown'),
                        'snippet': message.get('snippet', '')[:100] + '...',
                        'size_estimate': message.get('sizeEstimate', 0)
                    })
                    
                except Exception as e:
                    logger.warning(f"Failed to get preview for message {msg['id']}: {e}")
                    continue
            
            # Calculate estimated storage savings
            total_size_estimate = sum([email['size_estimate'] for email in preview_emails])
            avg_size = total_size_estimate / len(preview_emails) if preview_emails else 0
            estimated_total_size = avg_size * total_count
            
            return {
                'total_count': total_count,
                'preview_emails': preview_emails,
                'sample_size': len(preview_emails),
                'estimated_storage_mb': round(estimated_total_size / (1024 * 1024), 2),
                'search_query': search_query
            }
            
        except Exception as e:
            logger.error(f"Preview error for user {self.user.username}: {e}")
            return {'error': {'message': str(e), 'type': 'preview_error'}}
    
    def get_deletion_statistics(self, days_back=30):
        """Get deletion statistics for user"""
        try:
            # Get stats from cache/database
            cache_key = f"deletion_stats_{self.user.id}_{days_back}"
            stats = cache.get(cache_key)
            
            if not stats:
                # Calculate stats (implement based on your logging system)
                stats = {
                    'total_deleted': 0,
                    'storage_saved_mb': 0,
                    'deletion_sessions': 0,
                    'most_deleted_category': 'promotions',
                    'avg_emails_per_session': 0
                }
                cache.set(cache_key, stats, 3600)  # Cache for 1 hour
            
            return stats
            
        except Exception as e:
            logger.error(f"Stats error for user {self.user.username}: {e}")
            return {'error': str(e)}

class SmartDeletionRules:
    """Manager for automated deletion rules"""
    
    def __init__(self, user):
        self.user = user
        self.deletion_manager = EmailDeletionManager(user)
    
    def create_deletion_rule(self, rule_config):
        """Create a smart deletion rule"""
        try:
            # Validate rule config
            required_fields = ['name', 'query', 'schedule_days', 'enabled']
            if not all(field in rule_config for field in required_fields):
                return {'error': 'Missing required rule fields'}
            
            # Store rule in cache/database
            rule_id = f"rule_{self.user.id}_{len(self.get_user_rules())}"
            rule_data = {
                'id': rule_id,
                'user_id': self.user.id,
                'name': rule_config['name'],
                'query': rule_config['query'],
                'schedule_days': rule_config['schedule_days'],
                'enabled': rule_config['enabled'],
                'created_at': timezone.now().isoformat(),
                'last_run': None,
                'total_deleted': 0
            }
            
            # Store in cache (in production, use database)
            cache_key = f"deletion_rules_{self.user.id}"
            user_rules = cache.get(cache_key, [])
            user_rules.append(rule_data)
            cache.set(cache_key, user_rules, 86400)  # Cache for 24 hours
            
            logger.info(f"Created deletion rule {rule_id} for user {self.user.username}")
            return {'status': 'created', 'rule': rule_data}
            
        except Exception as e:
            logger.error(f"Rule creation error: {e}")
            return {'error': str(e)}
    
    def get_user_rules(self):
        """Get all deletion rules for user"""
        try:
            cache_key = f"deletion_rules_{self.user.id}"
            return cache.get(cache_key, [])
        except Exception as e:
            logger.error(f"Get rules error: {e}")
            return []
    
    def execute_rule(self, rule_id):
        """Execute a specific deletion rule"""
        try:
            rules = self.get_user_rules()
            rule = next((r for r in rules if r['id'] == rule_id), None)
            
            if not rule:
                return {'error': 'Rule not found'}
            
            if not rule['enabled']:
                return {'error': 'Rule is disabled'}
            
            # Execute deletion
            result = self.deletion_manager.delete_by_query(
                search_query=rule['query'],
                max_emails=5000,
                permanent=False
            )
            
            if 'error' not in result:
                # Update rule statistics
                rule['last_run'] = timezone.now().isoformat()
                rule['total_deleted'] += result.get('successful', 0)
                
                # Update cache
                cache_key = f"deletion_rules_{self.user.id}"
                updated_rules = [r if r['id'] != rule_id else rule for r in rules]
                cache.set(cache_key, updated_rules, 86400)
            
            return result
            
        except Exception as e:
            logger.error(f"Rule execution error: {e}")
            return {'error': str(e)}

class UndoManager:
    """Manager for undo functionality"""
    
    def __init__(self, user):
        self.user = user
        self.deletion_manager = EmailDeletionManager(user)
    
    def create_undo_point(self, operation_data):
        """Create an undo point before bulk operations"""
        try:
            undo_id = f"undo_{self.user.id}_{int(timezone.now().timestamp())}"
            
            undo_data = {
                'id': undo_id,
                'user_id': self.user.id,
                'operation_type': operation_data.get('type', 'bulk_delete'),
                'affected_emails': operation_data.get('message_ids', []),
                'search_query': operation_data.get('search_query'),
                'created_at': timezone.now().isoformat(),
                'expires_at': (timezone.now() + timedelta(hours=24)).strftime('%Y-%m-%dT%H:%M:%S.%fZ'),
                'can_undo': True
            }
            
            # Store undo point (in production, use database)
            cache_key = f"undo_points_{self.user.id}"
            undo_points = cache.get(cache_key, [])
            undo_points.append(undo_data)
            
            # Keep only last 10 undo points
            undo_points = undo_points[-10:]
            cache.set(cache_key, undo_points, 86400)
            
            return {'status': 'created', 'undo_id': undo_id}
            
        except Exception as e:
            logger.error(f"Undo point creation error: {e}")
            return {'error': str(e)}
        
    
    def execute_undo(self, undo_id):
        """Execute undo operation"""
        try:
            cache_key = f"undo_points_{self.user.id}"
            undo_points = cache.get(cache_key, [])
            
            undo_point = next((u for u in undo_points if u['id'] == undo_id), None)
            
            if not undo_point:
                return {'error': 'Undo point not found'}
            
            # Check if expired
            from django.utils.dateparse import parse_datetime
            expire_time = parse_datetime(undo_point['expires_at'])
            if expire_time.tzinfo is None:
                expire_time = timezone.make_aware(expire_time)    

            if timezone.now() > expire_time:
                return {'error': 'Undo point has expired (24 hour limit)'}
            
            if not undo_point['can_undo']:
                return {'error': 'This operation cannot be undone'}
            
            # Execute recovery based on operation type
            if undo_point['operation_type'] in ['bulk_delete', 'bulk_delete_query']:
                if undo_point.get('search_query'):
                    # For query-based deletions, recover from trash using the same query
                    trash_query = f"in:trash ({undo_point['search_query']})"
                    result = self.deletion_manager.recover_by_query(
                        search_query=undo_point['search_query'],  # Remove the query, just recover from trash
                        max_emails=5000
                    )
                else:
                    # Recover by message IDs
                    result = self.deletion_manager.fast_batch_recover_emails(
                        undo_point['affected_emails']
                    )
                
                # Mark as used
                undo_point['can_undo'] = False
                undo_point['executed_at'] = timezone.now().isoformat()
                updated_points = [u if u['id'] != undo_id else undo_point for u in undo_points]
                cache.set(cache_key, updated_points, 86400)
                
                return result
            
            return {'error': 'Unknown operation type'}
            
        except Exception as e:
            logger.error(f"Undo execution error: {e}")
            return {'error': str(e)}
        
    
    def get_undo_history(self):
        """Get available undo points for user"""
        try:
            cache_key = f"undo_points_{self.user.id}"
            undo_points = cache.get(cache_key, [])
            
            # Filter non-expired points
            current_time = timezone.now()
            active_points = []
            
            for point in undo_points:
                expire_time = datetime.fromisoformat(point['expires_at'].replace('Z', '+00:00'))
                if current_time <= expire_time:
                    active_points.append(point)
            
            return active_points
            
        except Exception as e:
            logger.error(f"Undo history error: {e}")
            return []
        

@shared_task
def execute_scheduled_rules():
    """Celery task to execute scheduled deletion rules"""
    try:
        # Get all users with deletion rules (implement based on your storage)
        # For now, this is a placeholder
        
        logger.info("Scheduled rules execution completed")
        return {'status': 'completed', 'rules_executed': 0}
        
    except Exception as e:
        logger.error(f"Scheduled rules execution error: {e}")
        return {'status': 'error', 'message': str(e)}