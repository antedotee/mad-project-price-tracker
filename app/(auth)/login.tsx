import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';

import { supabase } from '../../utils/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);

  // Clear any stale session on mount (helpful after auth config changes)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        console.log('Found existing session on login screen, clearing it...');
        supabase.auth.signOut();
      }
    });
  }, []);

  const validateForm = () => {
    if (!email.trim()) {
      Alert.alert('Validation Error', 'Please enter your email address');
      return false;
    }
    if (!email.includes('@')) {
      Alert.alert('Validation Error', 'Please enter a valid email address');
      return false;
    }
    if (!password.trim()) {
      Alert.alert('Validation Error', 'Please enter your password');
      return false;
    }
    if (password.length < 6) {
      Alert.alert('Validation Error', 'Password must be at least 6 characters');
      return false;
    }
    return true;
  };

  const onSignIn = async () => {
    if (!validateForm()) return;
    if (loading) return;

    setLoading(true);
    try {
      console.log('Attempting sign in with email:', email.trim());
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      console.log('Sign in response:', { 
        hasUser: !!data?.user, 
        hasSession: !!data?.session,
        errorStatus: error?.status,
        errorMessage: error?.message,
        errorName: error?.name 
      });

      if (error) {
        console.error('Sign in error details:', error);
        
        // Handle rate limiting gracefully
        if (error.status === 429 || error.message?.includes('429') || error.message?.includes('rate limit')) {
          Alert.alert(
            'Too Many Requests',
            'Please wait a moment before trying again. Too many sign-in attempts have been made.',
          );
        } 
        // Handle unconfirmed email
        else if (
          error.message?.toLowerCase().includes('email not confirmed') ||
          error.message?.toLowerCase().includes('not confirmed') ||
          error.message?.toLowerCase().includes('verify') ||
          (error.status === 400 && error.message?.toLowerCase().includes('invalid'))
        ) {
          Alert.alert(
            'Email Not Confirmed',
            'Your email address has not been confirmed yet. Please check your email for a confirmation link, or delete this account from your Supabase dashboard and sign up again.\n\nError: ' + error.message,
            [
              { text: 'Switch to Sign Up', onPress: () => setIsSignUp(true) },
              { text: 'OK' }
            ]
          );
        }
        // Handle invalid credentials
        else if (error.status === 400) {
          Alert.alert(
            'Sign In Error',
            'Invalid email or password. If you just signed up with email confirmation enabled, please check your email to confirm your account first.\n\nError: ' + error.message,
            [
              { text: 'Try Sign Up', onPress: () => setIsSignUp(true) },
              { text: 'OK' }
            ]
          );
        }
        // Generic error
        else {
          Alert.alert('Sign In Error', error.message || 'Unable to sign in. Please try again.');
        }
      } else if (data.user) {
        console.log('Sign in successful, user:', data.user.email);
        // Navigation will happen automatically via AuthContext
      }
    } catch (error: any) {
      console.error('Sign in exception:', error);
      Alert.alert('Sign In Error', error?.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const onSignUp = async () => {
    if (!validateForm()) return;
    if (loading) return;

    setLoading(true);
    try {
      console.log('Starting signup...');
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      console.log('Signup response:', { data, error });

      if (error) {
        console.error('Signup error:', error);
        setLoading(false);
        // Handle rate limiting gracefully
        if (error.status === 429 || error.message?.includes('429') || error.message?.includes('rate limit')) {
          Alert.alert(
            'Too Many Requests',
            'Please wait a moment before trying again. If this persists, you may have reached the signup limit.',
          );
        } else {
          Alert.alert('Sign Up Error', error.message);
        }
        return;
      }

      if (data.user) {
        console.log('User created:', data.user.id);
        console.log('Session exists:', !!data.session);
        console.log('User confirmation status:', data.user.confirmed_at);

        // Check if email confirmation is required
        if (data.session) {
          // User is automatically signed in (email confirmation disabled)
          console.log('Session available, user is signed in. Navigating to home...');
          setLoading(false);
          // Small delay to ensure AuthContext has updated
          setTimeout(() => {
            console.log('Navigating to home page...');
            router.replace('/(app)/(tabs)');
          }, 500);
        } else {
          // No session means email confirmation is required
          console.log('Email confirmation required - no session returned');
          setLoading(false);
          Alert.alert(
            'Check Your Email',
            'Please check your email and click the confirmation link to activate your account. After confirming, you can sign in.',
            [
              {
                text: 'OK',
                onPress: () => {
                  setIsSignUp(false);
                  setEmail('');
                  setPassword('');
                },
              },
            ],
          );
        }
      } else {
        console.warn('No user returned from signup');
        setLoading(false);
        Alert.alert('Sign Up Error', 'Account creation failed. Please try again.');
      }
    } catch (error: any) {
      console.error('Signup exception:', error);
      setLoading(false);
      Alert.alert('Sign Up Error', error?.message || 'An unexpected error occurred');
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1 bg-gray-50">
      <Stack.Screen options={{ title: isSignUp ? 'Create Account' : 'Sign In' }} />
      <ScrollView
        contentContainerClassName="flex-grow justify-center px-6 py-8"
        keyboardShouldPersistTaps="handled">
        <View className="mb-8">
          <Text className="mb-2 text-3xl font-bold text-gray-900">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </Text>
          <Text className="text-base text-gray-600">
            {isSignUp
              ? 'Sign up to start tracking prices'
              : 'Sign in to your account to continue'}
          </Text>
        </View>

        <View className="mb-6 gap-4">
          <View>
            <Text className="mb-2 text-sm font-semibold text-gray-700">Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
            />
          </View>

          <View>
            <Text className="mb-2 text-sm font-semibold text-gray-700">Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              editable={!loading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
            />
          </View>
        </View>

        {isSignUp ? (
          <Pressable
            onPress={onSignUp}
            disabled={loading}
            className="mb-4 rounded-lg bg-teal-600 py-4 shadow-sm active:bg-teal-700 disabled:opacity-50">
            {loading ? (
              <View className="flex-row items-center justify-center gap-2">
                <ActivityIndicator size="small" color="white" />
                <Text className="text-base font-semibold text-white">Creating Account...</Text>
              </View>
            ) : (
              <Text className="text-center text-base font-semibold text-white">Sign Up</Text>
            )}
          </Pressable>
        ) : (
          <Pressable
            onPress={onSignIn}
            disabled={loading}
            className="mb-4 rounded-lg bg-teal-600 py-4 shadow-sm active:bg-teal-700 disabled:opacity-50">
            {loading ? (
              <View className="flex-row items-center justify-center gap-2">
                <ActivityIndicator size="small" color="white" />
                <Text className="text-base font-semibold text-white">Signing In...</Text>
              </View>
            ) : (
              <Text className="text-center text-base font-semibold text-white">Sign In</Text>
            )}
          </Pressable>
        )}

        <View className="mt-4 flex-row items-center justify-center gap-2">
          <Text className="text-gray-600">
            {isSignUp ? 'Already have an account?' : "Don't have an account?"}
          </Text>
          <Pressable onPress={() => setIsSignUp(!isSignUp)} disabled={loading}>
            <Text className="font-semibold text-teal-600 active:text-teal-700">
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}