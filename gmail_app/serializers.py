from rest_framework import serializers
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.contrib.auth.hashers import make_password
from django.contrib.auth.password_validation import validate_password

from .models import GoogleOAuthToken


class UserLoginSerializer(serializers.Serializer):
    username = serializers.CharField()
    password = serializers.CharField(write_only = True)
    
    def validate(self, attrs):
        username = attrs.get('username')
        password = attrs.get('password')

        if username and password:
            user = authenticate(username = username, password = password)
            if not user:
                raise serializers.ValidationError('Invalid Credentials')
            if not user.is_active:
                raise serializers.ValidationError('User account is disabled')
            attrs['user'] = user
        else:
            raise serializers.ValidationError('Username and password not included!')
        
        return attrs


class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only = True, validators = [validate_password])
    password_confirm = serializers.CharField(write_only = True)

    class Meta:
        model = User
        fields = ('username', 'email', 'password', 'password_confirm')

    def validate_email(self, value):
        if User.objects.filter(email = value).exists():
            raise serializers.ValidationError("Email already exists")
        return value

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match")   
        return attrs
    
    def create(self, validated_data):
        validated_data.pop('password_confirm')
        validated_data['password'] = make_password(validated_data['password'])
        user = User.objects.create(**validated_data)
        return user
    
    
class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'date_joined')
        read_only_fields = ('id', 'date_joined')


'''GoogleOAuthSerializer - OAuth Token Display
This serializer handles displaying Google OAuth token information to users.'''
class GoogleOAuthSerializer(serializers.ModelSerializer):
    class Meta:
        model = GoogleOAuthToken
        fields = ('created_at', 'updated_at', 'scopes')
        read_only_fields = ('created_at', 'updated_at', 'scopes')


'''GoogleAuthURLSerializer - OAuth Initiation
This serializer handles starting the Google OAuth flow.'''

class GoogleAuthURLSerializer(serializers.Serializer):
    auth_url = serializers.URLField()
    state = serializers.CharField()