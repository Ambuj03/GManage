from django.urls import path
from .views import ProfileView, UserRegistrationView, UserLoginView, UserLogoutView
from .views import GoogleAuthURLView, GoogleOAuthCallbackView, GoogleTokenStatusView, GoogleTokenRevokeView, GmailConnectivityTestView
from rest_framework_simplejwt.views import TokenRefreshView
from .views import GmailEmailListView, GmailEmailMetadataView, GmailSearchView, GmailLabelsView

urlpatterns = [
    # JWT realted URLs
    path("auth/register/",  UserRegistrationView.as_view(), name="user_register"),
    path('auth/login/', UserLoginView.as_view(), name = 'user_login'),
    path('auth/logout/', UserLogoutView.as_view(), name = 'user_logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name = 'token_refresh'),
    # URL to view profile of the user
    path('profile/', ProfileView.as_view(), name='user_profile'),   
    #OAuth related apis
    path('auth/google/url/', GoogleAuthURLView.as_view(), name='google_auth_url'),
    path('auth/google/callback/', GoogleOAuthCallbackView.as_view(), name='google_callback'),
    path('auth/google/status/', GoogleTokenStatusView.as_view(), name='google_token_status'),
    path('auth/google/revoke/', GoogleTokenRevokeView.as_view(), name='google_token_revoke'),

    #Gmail connectivity test views
    path('gmail/connectivity/', GmailConnectivityTestView.as_view(), name='gmail_connectivity'),

    #Gmail operations related views
    path('gmail/emails/', GmailEmailListView.as_view(), name='gmail_emails'),
    path('gmail/emails/metadata/', GmailEmailMetadataView.as_view(), name='gmail_email_metadata'),
    path('gmail/search/', GmailSearchView.as_view(), name='gmail_search'),
    path('gmail/labels/', GmailLabelsView.as_view(), name='gmail_labels'),

]