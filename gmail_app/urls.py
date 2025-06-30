from django.urls import path
from .views import ProfileView, UserRegistrationView, UserLoginView, UserLogoutView
from .views import GoogleAuthURLView, GoogleOAuthCallbackView, GoogleTokenStatusView, GoogleTokenRevokeView
from rest_framework_simplejwt.views import TokenRefreshView

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


]