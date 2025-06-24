from django.http import JsonResponse

def health_check(request):
    """Simple health check endpoint to verify setup"""
    return JsonResponse({
        'status': 'success',
        'message': 'Gmail Purge API is running!',
        'version': '1.0.0'
    })