import logging
from typing import List
from googleapiclient.errors import HttpError
from .gmail_utils import GmailServiceManager, handle_gmail_api_error, retry_gmail_operation

logger = logging.getLogger(__name__)

class GmailOperations:
    """Class for Gmail email operations"""
    
    def __init__(self, user):
        self.user = user
        self.service_manager = GmailServiceManager(user)
    
    def list_emails(self, query='', max_results=50, page_token=None, label_ids=None):
        """List emails with optional query and pagination"""
        try:
            service = self.service_manager.get_service()
            if not service:
                return {'error': 'Gmail service not available'}
            
            # Build request parameters
            params = {
                'userId': 'me',
                'maxResults': min(max_results, 500),  # Gmail API limit
                'q': query if query else ''
            }
            
            if page_token:
                params['pageToken'] = page_token
            
            if label_ids:
                params['labelIds'] = label_ids
            
            def fetch_messages():
                return service.users().messages().list(**params).execute()
            
            result = retry_gmail_operation(fetch_messages)
            
            messages = result.get('messages', [])
            next_page_token = result.get('nextPageToken')
            result_size_estimate = result.get('resultSizeEstimate', 0)
            
            logger.info(f"Listed {len(messages)} emails for user {self.user.username}")
            
            return {
                'messages': messages,
                'nextPageToken': next_page_token,
                'resultSizeEstimate': result_size_estimate,
                'query': query
            }
            
        except HttpError as e:
            error_info = handle_gmail_api_error(e, "list emails")
            logger.error(f"Gmail list error for user {self.user.username}: {error_info}")
            return {'error': error_info}
        except Exception as e:
            logger.error(f"Unexpected error listing emails for user {self.user.username}: {e}")
            return {'error': {'message': str(e), 'type': 'unknown'}}
    
    def get_email_metadata(self, message_ids: List[str]):
        """Get metadata for multiple emails efficiently"""
        try:
            service = self.service_manager.get_service()
            if not service:
                return {'error': 'Gmail service not available'}
            
            if not message_ids:
                return {'emails': []}
            
            # Limit batch size to avoid API limits
            batch_size = 100
            all_emails = []
            
            for i in range(0, len(message_ids), batch_size):
                batch_ids = message_ids[i:i + batch_size]
                
                def fetch_batch():
                    batch_emails = []
                    for msg_id in batch_ids:
                        try:
                            message = service.users().messages().get(
                                userId='me', 
                                id=msg_id,
                                format='metadata',
                                metadataHeaders=['From', 'To', 'Subject', 'Date']
                            ).execute()
                            
                            # Extract metadata
                            headers = {h['name']: h['value'] for h in message.get('payload', {}).get('headers', [])}
                            
                            email_data = {
                                'id': message['id'],
                                'thread_id': message.get('threadId'),
                                'label_ids': message.get('labelIds', []),
                                'snippet': message.get('snippet', ''),
                                'from': headers.get('From', 'Unknown'),
                                'to': headers.get('To', 'Unknown'), 
                                'subject': headers.get('Subject', 'No Subject'),
                                'date': headers.get('Date', 'Unknown'),
                                'size_estimate': message.get('sizeEstimate', 0),
                                'internal_date': message.get('internalDate')
                            }
                            
                            batch_emails.append(email_data)
                            
                        except HttpError as e:
                            if e.resp.status == 404:
                                logger.warning(f"Message {msg_id} not found, skipping")
                                continue
                            raise
                    
                    return batch_emails
                
                batch_result = retry_gmail_operation(fetch_batch)
                all_emails.extend(batch_result)
            
            logger.info(f"Retrieved metadata for {len(all_emails)} emails for user {self.user.username}")
            
            return {'emails': all_emails}
            
        except HttpError as e:
            error_info = handle_gmail_api_error(e, "get email metadata")
            logger.error(f"Gmail metadata error for user {self.user.username}: {error_info}")
            return {'error': error_info}
        except Exception as e:
            logger.error(f"Unexpected error getting email metadata for user {self.user.username}: {e}")
            return {'error': {'message': str(e), 'type': 'unknown'}}
    
    def search_emails(self, query, max_results=20, page_token=None):
        """Search emails using Gmail query syntax"""
        try:
            service = self.service_manager.get_service()
            if not service:
                return {'error': 'Gmail service not available'}
            
            # Get message list
            request_params = {
                'userId': 'me',
                'q': query,
                'maxResults': max_results
            }
            
            if page_token:
                request_params['pageToken'] = page_token
            
            result = service.users().messages().list(**request_params).execute()
            
            messages = result.get('messages', [])
            next_page_token = result.get('nextPageToken')
            result_size_estimate = result.get('resultSizeEstimate', 0)
            
            # Get detailed message information
            detailed_messages = []
            for msg in messages:
                try:
                    message = service.users().messages().get(
                        userId='me', 
                        id=msg['id'],
                        format='metadata',
                        metadataHeaders=['From', 'To', 'Subject', 'Date']
                    ).execute()
                    
                    # Extract headers
                    headers = {}
                    for header in message.get('payload', {}).get('headers', []):
                        headers[header['name']] = header['value']
                    
                    detailed_messages.append({
                        'id': message['id'],
                        'threadId': message['threadId'],
                        'labelIds': message.get('labelIds', []),
                        'snippet': message.get('snippet', ''),
                        'from': headers.get('From', 'Unknown'),
                        'to': headers.get('To', 'Unknown'),
                        'subject': headers.get('Subject', 'No Subject'),
                        'date': headers.get('Date', 'Unknown'),
                        'sizeEstimate': message.get('sizeEstimate', 0)
                    })
                except Exception as e:
                    logger.warning(f"Failed to get message details for {msg['id']}: {e}")
                    continue
            
            return {
                'messages': detailed_messages,
                'nextPageToken': next_page_token,
                'resultSizeEstimate': result_size_estimate,
                'query': query
            }
            
        except Exception as e:
            logger.error(f"Search emails error: {e}")
            return {'error': str(e)}
    
    def get_labels(self):
        """Get all Gmail labels"""
        try:
            service = self.service_manager.get_service()
            if not service:
                return {'error': 'Gmail service not available'}
            
            def fetch_labels():
                return service.users().labels().list(userId='me').execute()
            
            result = retry_gmail_operation(fetch_labels)
            labels = result.get('labels', [])
            
            # Organize labels by type
            system_labels = [l for l in labels if l['type'] == 'system']
            user_labels = [l for l in labels if l['type'] == 'user']
            
            logger.info(f"Retrieved {len(labels)} labels for user {self.user.username}")
            
            return {
                'all_labels': labels,
                'system_labels': system_labels,
                'user_labels': user_labels
            }
            
        except HttpError as e:
            error_info = handle_gmail_api_error(e, "get labels")
            logger.error(f"Gmail labels error for user {self.user.username}: {error_info}")
            return {'error': error_info}
        except Exception as e:
            logger.error(f"Unexpected error getting labels for user {self.user.username}: {e}")
            return {'error': {'message': str(e), 'type': 'unknown'}}
    
    def get_accurate_email_count(self, query, max_count=10000):
        """Get accurate email count by actually fetching pages"""
        try:
            service = self.service_manager.get_service()
            if not service:
                return {'error': 'Gmail service not available'}
            
            total_count = 0
            page_token = None
            pages_checked = 0
            max_pages = 50  # Increased from 20 to 50 pages
            
            while pages_checked < max_pages:
                try:
                    result = service.users().messages().list(
                        userId='me',
                        q=query,
                        maxResults=500,  # Max per page
                        pageToken=page_token
                    ).execute()
                    
                    messages = result.get('messages', [])
                    if not messages:
                        break
                    
                    total_count += len(messages)
                    pages_checked += 1
                    
                    # FIXED: Don't stop at max_count, continue until we hit pages limit
                    # This way we get more accurate counts
                    
                    page_token = result.get('nextPageToken')
                    if not page_token:
                        # No more pages - we have the exact count
                        return {'count': total_count, 'is_estimate': False}
                        
                except Exception as e:
                    logger.error(f"Error getting email count: {e}")
                    break
            
            # If we hit the page limit, it's an estimate
            is_estimate = pages_checked >= max_pages
            return {'count': total_count, 'is_estimate': is_estimate}
            
        except Exception as e:
            logger.error(f"Count emails error: {e}")
            return {'error': str(e)}
    
    def get_quick_email_estimate(self, query):
        """Get quick estimate using Gmail's built-in resultSizeEstimate with sampling"""
        try:
            service = self.service_manager.get_service()
            if not service:
                return {'error': 'Gmail service not available'}
            
            # Get Gmail's estimate
            result = service.users().messages().list(
                userId='me',
                q=query,
                maxResults=1
            ).execute()
            
            estimate = result.get('resultSizeEstimate', 0)
            
            # For small numbers, get exact count
            if estimate <= 100:
                # Get a few pages to verify
                exact_result = service.users().messages().list(
                    userId='me',
                    q=query,
                    maxResults=100
                ).execute()
                
                messages = exact_result.get('messages', [])
                if len(messages) < 100:
                    return {'count': len(messages), 'is_estimate': False}
                else:
                    return {'count': estimate, 'is_estimate': True}
            
            return {'count': estimate, 'is_estimate': True}
            
        except Exception as e:
            logger.error(f"Quick estimate error: {e}")
            return {'error': str(e)}

def build_search_query(filters):
    """Build Gmail search query from filter parameters"""
    query_parts = []
    
    # Date filters
    if filters.get('older_than_days'):
        query_parts.append(f"older_than:{filters['older_than_days']}d")
    
    if filters.get('newer_than_days'):
        query_parts.append(f"newer_than:{filters['newer_than_days']}d")
    
    # Size filters
    if filters.get('larger_than_mb'):
        query_parts.append(f"larger:{filters['larger_than_mb']}M")
    
    if filters.get('smaller_than_mb'):
        query_parts.append(f"smaller:{filters['smaller_than_mb']}M")
    
    # Sender filters
    if filters.get('from_email'):
        query_parts.append(f"from:{filters['from_email']}")
    
    # Label filters
    if filters.get('labels'):
        for label in filters['labels']:
            query_parts.append(f"label:{label}")
    
    # Read status
    if filters.get('is_read') == True:
        query_parts.append("-is:unread")
    elif filters.get('is_read') == False:
        query_parts.append("is:unread")
    
    # Attachment filter
    if filters.get('has_attachment') == True:
        query_parts.append("has:attachment")
    elif filters.get('has_attachment') == False:
        query_parts.append("-has:attachment")
    
    # Subject filter
    if filters.get('subject_contains'):
        query_parts.append(f"subject:{filters['subject_contains']}")
    
    return ' '.join(query_parts)