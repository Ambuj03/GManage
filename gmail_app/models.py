from django.db import models
from django.contrib.auth.models import User
from django.utils import timezone

# Create your models here.

class GoogleOAuthToken(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='google_token')
    access_token = models.TextField()
    refresh_token = models.TextField()
    token_uri = models.URLField(default = 'https://oauth2.googleapis.com/token')
    client_id = models.CharField(max_length=255)
    client_secret = models.CharField(max_length=255)
    scopes = models.JSONField(default=list)
    expiry = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f'Google OAuth token for {self.user.username}'
    
    def is_expired(self):
        if not self.expiry:
            return False

        return timezone.now() >= self.expiry
    
    class Meta:
        verbose_name = 'Google OAuth Token'
        verbose_name_plural = 'Google OAuth Tokens'
