import { Stack, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
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
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

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
    const nextErrors: { email?: string; password?: string } = {};
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      nextErrors.email = 'Please enter your email address';
    } else if (!cleanEmail.includes('@')) {
      nextErrors.email = 'Please enter a valid email address';
    }
    if (!password.trim()) {
      nextErrors.password = 'Please enter your password';
    } else if (password.length < 6) {
      nextErrors.password = 'Password must be at least 6 characters';
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const onSignIn = async () => {
    if (!validateForm()) return;
    if (loading) return;

    setLoading(true);
    setErrors((e) => ({ ...e, form: undefined }));
    setSuccessMessage(null);
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
        const msg = (error.message || '').toLowerCase();
        if (error.status === 429 || msg.includes('429') || msg.includes('rate limit')) {
          setErrors({ form: 'Too many attempts. Please wait a moment and try again.' });
        } else if (msg.includes('email not confirmed') || msg.includes('not confirmed') || msg.includes('verify')) {
          setErrors({ form: 'Email not confirmed. Please check your inbox for a confirmation link.' });
        } else if (error.status === 400 || msg.includes('invalid')) {
          setErrors({ form: 'Invalid email or password.' });
        } else {
          setErrors({ form: 'Unable to sign in. Please try again.' });
        }
      } else if (data.user) {
        console.log('Sign in successful, user:', data.user.email);
        // Navigation will happen automatically via AuthContext
      }
    } catch (error: any) {
      console.error('Sign in exception:', error);
      setErrors({ form: error?.message || 'An unexpected error occurred' });
    } finally {
      setLoading(false);
    }
  };

  const onSignUp = async () => {
    if (!validateForm()) return;
    if (loading) return;

    setLoading(true);
    setErrors((e) => ({ ...e, form: undefined }));
    setSuccessMessage(null);
    try {
      console.log('Starting signup...');
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });

      console.log('Signup response:', { data, error });

      if (error) {
        console.error('Signup error:', error);
        const msg = (error.message || '').toLowerCase();
        if (error.status === 429 || msg.includes('429') || msg.includes('rate limit')) {
          setErrors({ form: 'Too many attempts. Please wait a moment and try again.' });
        } else if (msg.includes('user already registered') || msg.includes('already exists')) {
          setErrors({ form: 'An account with this email already exists. Try signing in instead.' });
        } else if (msg.includes('password')) {
          setErrors({ password: 'Password is too weak. Use at least 6 characters.' });
        } else {
          setErrors({ form: error.message || 'Unable to sign up. Please try again.' });
        }
        setLoading(false);
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
          setSuccessMessage('Account created! Redirecting...');
          // Small delay to ensure AuthContext has updated
          setTimeout(() => {
            console.log('Navigating to home page...');
            router.replace('/(app)/(tabs)');
          }, 500);
        } else {
          // No session means email confirmation is required
          console.log('Email confirmation required - no session returned');
          setLoading(false);
          setSuccessMessage('Check your email to confirm your account, then sign in.');
          setIsSignUp(false);
          setEmail('');
          setPassword('');
        }
      } else {
        console.warn('No user returned from signup');
        setLoading(false);
        setErrors({ form: 'Account creation failed. Please try again.' });
      }
    } catch (error: any) {
      console.error('Signup exception:', error);
      setLoading(false);
      setErrors({ form: error?.message || 'An unexpected error occurred' });
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
        <View className="mb-6">
          <Text className="mb-2 text-3xl font-bold text-gray-900">
            {isSignUp ? 'Create Account' : 'Welcome Back'}
          </Text>
          <Text className="text-base text-gray-600">
            {isSignUp
              ? 'Sign up to start tracking prices'
              : 'Sign in to your account to continue'}
          </Text>
        </View>

        {/* Sign In / Sign Up segmented control for mobile */}
        <View className="mb-6 flex-row rounded-lg border border-gray-200 bg-white p-1">
          <Pressable
            onPress={() => {
              if (isSignUp) {
                setIsSignUp(false);
                setErrors({});
                setSuccessMessage(null);
              }
            }}
            className={`flex-1 rounded-md py-2 ${!isSignUp ? 'bg-teal-600' : ''}`}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Switch to Sign In">
            <Text className={`text-center text-sm font-semibold ${!isSignUp ? 'text-white' : 'text-gray-700'}`}>Sign In</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              if (!isSignUp) {
                setIsSignUp(true);
                setErrors({});
                setSuccessMessage(null);
              }
            }}
            className={`flex-1 rounded-md py-2 ${isSignUp ? 'bg-teal-600' : ''}`}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Switch to Sign Up">
            <Text className={`text-center text-sm font-semibold ${isSignUp ? 'text-white' : 'text-gray-700'}`}>Sign Up</Text>
          </Pressable>
        </View>

        {errors.form && (
          <View className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3">
            <Text className="text-sm font-semibold text-red-700">{errors.form}</Text>
          </View>
        )}
        {successMessage && (
          <View className="mb-4 rounded-lg border border-green-200 bg-green-50 p-3">
            <Text className="text-sm font-semibold text-green-700">{successMessage}</Text>
          </View>
        )}

        <View className="mb-6 gap-4">
          <View>
            <Text className="mb-2 text-sm font-semibold text-gray-700">Email</Text>
            <TextInput
              value={email}
              onChangeText={(t) => {
                setEmail(t);
                if (errors.email) setErrors((e) => ({ ...e, email: undefined }));
              }}
              placeholder="Enter your email"
              placeholderTextColor="#9CA3AF"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
            />
            {errors.email && (
              <Text className="mt-1 text-xs font-medium text-red-600">{errors.email}</Text>
            )}
          </View>

          <View>
            <Text className="mb-2 text-sm font-semibold text-gray-700">Password</Text>
            <TextInput
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                if (errors.password) setErrors((e) => ({ ...e, password: undefined }));
              }}
              placeholder="Enter your password"
              placeholderTextColor="#9CA3AF"
              secureTextEntry
              editable={!loading}
              className="rounded-lg border border-gray-300 bg-white px-4 py-3 text-base text-gray-900"
            />
            {errors.password && (
              <Text className="mt-1 text-xs font-medium text-red-600">{errors.password}</Text>
            )}
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
          <Pressable
            onPress={() => {
              setIsSignUp(!isSignUp);
              setErrors({});
              setSuccessMessage(null);
            }}
            hitSlop={10}
            disabled={loading}>
            <Text className="font-semibold text-teal-600 active:text-teal-700">
              {isSignUp ? 'Sign In' : 'Sign Up'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}