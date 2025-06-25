from django.urls import path
from . views import ProfileView, UserRegistrationView

urlpatterns = [
    path("auth/register/",  UserRegistrationView.as_view(), name="user_register"),
    path('profile/', ProfileView.as_view(), name='user_profile'),   
]