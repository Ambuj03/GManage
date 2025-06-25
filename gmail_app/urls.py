from django.urls import path
from .views import ProfileView, UserRegistrationView, UserLoginView, UserLogoutView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path("auth/register/",  UserRegistrationView.as_view(), name="user_register"),
    path('auth/login/', UserLoginView.as_view(), name = 'user_login'),
    path('auth/logout/', UserLogoutView.as_view(), name = 'user_logout'),
    path('auth/refresh/', TokenRefreshView.as_view(), name = 'token_refresh'),
    path('profile/', ProfileView.as_view(), name='user_profile'),   

]