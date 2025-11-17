import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/contexts/AuthContext';

interface Profile {
  id: string;
  display_name: string | null;
  profile_photo_url: string | null;
  bio: string | null;
}

export default function ProfileScreen() {
  const { user } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);

  // Image editing state
  const [showImageEditor, setShowImageEditor] = useState(false);
  const [selectedImage, setSelectedImage] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [editedImage, setEditedImage] = useState<ImageManipulator.ImageResult | null>(null);
  const [imageRotation, setImageRotation] = useState(0);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        throw error;
      }

      if (data) {
        setProfile(data);
        setDisplayName(data.display_name || '');
        setBio(data.bio || '');
        setProfilePhotoUrl(data.profile_photo_url);
      } else {
        // Create default profile
        setProfile({
          id: user.id,
          display_name: null,
          profile_photo_url: null,
          bio: null,
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      Alert.alert('Error', 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async () => {
    try {
      // Request permissions
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant permission to access your photos');
        return;
      }

      // Launch image picker (without editing to allow full control)
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false, // We'll handle editing ourselves
        quality: 1.0, // High quality for editing
      });

      if (!result.canceled && result.assets[0]) {
        setSelectedImage(result.assets[0]);
        setEditedImage(null);
        setImageRotation(0);
        setShowImageEditor(true);
      }
    } catch (error) {
      console.error('Error picking image:', error);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const rotateImage = async () => {
    if (!selectedImage) return;

    setIsEditing(true);
    try {
      const newRotation = (imageRotation + 90) % 360;
      setImageRotation(newRotation);

      const manipResult = await ImageManipulator.manipulateAsync(
        selectedImage.uri,
        [{ rotate: newRotation }],
        { compress: 1, format: ImageManipulator.SaveFormat.JPEG }
      );

      setEditedImage(manipResult);
    } catch (error) {
      console.error('Error rotating image:', error);
      Alert.alert('Error', 'Failed to rotate image');
    } finally {
      setIsEditing(false);
    }
  };

  const cropAndUseImage = async () => {
    if (!selectedImage) return;

    setIsEditing(true);
    try {
      // Crop to square (1:1 aspect ratio) and apply current rotation
      const manipResult = await ImageManipulator.manipulateAsync(
        selectedImage.uri,
        [
          { rotate: imageRotation },
          {
            crop: {
              originX: 0,
              originY: 0,
              width: Math.min(selectedImage.width, selectedImage.height),
              height: Math.min(selectedImage.width, selectedImage.height),
            }
          }
        ],
        {
          compress: 0.8,
          format: ImageManipulator.SaveFormat.JPEG
        }
      );

      setEditedImage(manipResult);
      setShowImageEditor(false);

      // Upload the edited image
      await uploadImage({
        ...selectedImage,
        uri: manipResult.uri,
        width: manipResult.width,
        height: manipResult.height,
      });
    } catch (error) {
      console.error('Error cropping image:', error);
      Alert.alert('Error', 'Failed to crop image');
    } finally {
      setIsEditing(false);
    }
  };

  const cancelImageEdit = () => {
    setShowImageEditor(false);
    setSelectedImage(null);
    setEditedImage(null);
    setImageRotation(0);
  };

  const uploadImage = async (asset: ImagePicker.ImagePickerAsset | ImageManipulator.ImageResult) => {
    if (!user) return;

    setSaving(true);
    try {
      // Generate unique filename
      const fileName = `${user.id}/profile-${Date.now()}.jpg`;

      // Convert to blob - handle both asset types
      const response = await fetch(asset.uri);
      const blob = await response.blob();

      // Upload to Supabase Storage
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(fileName, blob, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('profile-photos')
        .getPublicUrl(fileName);

      // Update profile with new photo URL
      await updateProfile({ profile_photo_url: publicUrl });

      setProfilePhotoUrl(publicUrl);
      Alert.alert('Success', 'Profile photo updated!');
    } catch (error) {
      console.error('Error uploading image:', error);
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = async (updates: Partial<Profile>) => {
    if (!user) return;

    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          ...updates,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;
    } catch (error) {
      console.error('Error updating profile:', error);
      throw error;
    }
  };

  const saveProfile = async () => {
    if (!user) return;

    // Check if there are any changes to update
    const hasDisplayNameChanged = (displayName.trim() || null) !== (profile?.display_name || null);
    const hasBioChanged = (bio.trim() || null) !== (profile?.bio || null);
    const hasPhotoChanged = profilePhotoUrl !== (profile?.profile_photo_url || null);

    const hasChanges = hasDisplayNameChanged || hasBioChanged || hasPhotoChanged;

    if (!hasChanges) {
      Alert.alert('No Changes', 'No changes were made to your profile.');
      return;
    }

    setSaving(true);
    try {
      await updateProfile({
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        profile_photo_url: profilePhotoUrl,
      });

      // Update local profile state
      setProfile(prev => ({
        ...prev!,
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        profile_photo_url: profilePhotoUrl,
      }));

      // Navigate back to home screen
      router.replace('/(app)/(tabs)');
    } catch (error) {
      Alert.alert('Error', 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#0d9488" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-white">
      <View className="p-6">
        {/* Header */}
        <View className="mb-8">
          <TouchableOpacity
            onPress={() => router.back()}
            className="mb-4 w-10 h-10 items-center justify-center rounded-full bg-gray-100">
            <Text className="text-xl font-bold text-gray-600">←</Text>
          </TouchableOpacity>
          <Text className="text-2xl font-bold text-gray-800">Profile</Text>
        </View>

        {/* Profile Photo */}
        <View className="items-center mb-8">
          <TouchableOpacity onPress={pickImage} disabled={saving}>
            <View className="relative">
              {profilePhotoUrl ? (
                <Image
                  source={{ uri: profilePhotoUrl }}
                  className="w-24 h-24 rounded-full"
                />
              ) : (
                <View className="w-24 h-24 rounded-full bg-teal-100 items-center justify-center">
                  <Text className="text-3xl font-bold text-teal-600">
                    {user?.email?.[0]?.toUpperCase() || 'U'}
                  </Text>
                </View>
              )}
              {saving && (
                <View className="absolute inset-0 rounded-full bg-black/50 items-center justify-center">
                  <ActivityIndicator color="white" />
                </View>
              )}
            </View>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={pickImage}
            disabled={saving}
            className="mt-2 px-4 py-2 bg-teal-600 rounded-lg">
            <Text className="text-white font-semibold">
              {profilePhotoUrl ? 'Change Photo' : 'Add Photo'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Profile Form */}
        <View className="space-y-6">
          {/* Email (read-only) */}
          <View>
            <Text className="text-sm font-semibold text-gray-600 mb-1">Email</Text>
            <View className="px-4 py-3 bg-gray-100 rounded-lg">
              <Text className="text-gray-800">{user?.email}</Text>
            </View>
          </View>

          {/* Display Name */}
          <View>
            <Text className="text-sm font-semibold text-gray-600 mb-1">Display Name</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Enter your display name"
              className="px-4 py-3 border border-gray-300 rounded-lg"
              maxLength={50}
            />
          </View>

          {/* Bio */}
          <View>
            <Text className="text-sm font-semibold text-gray-600 mb-1">Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              multiline
              numberOfLines={3}
              className="px-4 py-3 border border-gray-300 rounded-lg h-24"
              maxLength={200}
            />
          </View>

          {/* Save Button */}
          <TouchableOpacity
            onPress={saveProfile}
            disabled={saving}
            className="mt-6 py-4 bg-teal-600 rounded-lg items-center">
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text className="text-white font-semibold text-lg">Save Profile</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Image Editor Modal */}
      <Modal
        visible={showImageEditor}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={cancelImageEdit}>
        <View className="flex-1 bg-black">
          {/* Header */}
          <View className="flex-row justify-between items-center p-4 bg-gray-900">
            <TouchableOpacity onPress={cancelImageEdit} className="p-2">
              <Text className="text-white text-lg font-semibold">Cancel</Text>
            </TouchableOpacity>
            <Text className="text-white text-lg font-semibold">Edit Photo</Text>
            <TouchableOpacity
              onPress={cropAndUseImage}
              disabled={isEditing}
              className="p-2">
              {isEditing ? (
                <ActivityIndicator color="white" size="small" />
              ) : (
                <Text className="text-teal-400 text-lg font-semibold">Done</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Image Display */}
          <View className="flex-1 items-center justify-center p-4">
            {selectedImage && (
              <View className="relative">
                <Image
                  source={{ uri: editedImage?.uri || selectedImage.uri }}
                  className="w-80 h-80 rounded-lg"
                  resizeMode="contain"
                />
                {isEditing && (
                  <View className="absolute inset-0 bg-black/50 rounded-lg items-center justify-center">
                    <ActivityIndicator color="white" size="large" />
                  </View>
                )}
              </View>
            )}
          </View>

          {/* Controls */}
          <View className="p-6 bg-gray-900">
            <View className="flex-row justify-center items-center space-x-8">
              <TouchableOpacity
                onPress={rotateImage}
                disabled={isEditing}
                className="items-center">
                <View className="w-12 h-12 rounded-full bg-gray-700 items-center justify-center mb-2">
                  <Text className="text-white text-xl">↻</Text>
                </View>
                <Text className="text-white text-sm">Rotate</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={cropAndUseImage}
                disabled={isEditing}
                className="items-center">
                <View className="w-12 h-12 rounded-full bg-teal-600 items-center justify-center mb-2">
                  <Text className="text-white text-xl">✂️</Text>
                </View>
                <Text className="text-white text-sm">Crop</Text>
              </TouchableOpacity>
            </View>

            <Text className="text-gray-400 text-center text-sm mt-4">
              Rotate and crop your profile photo
            </Text>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
