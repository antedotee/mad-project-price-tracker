// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Note: AsyncStorage is handled at runtime in utils/supabase.ts
// The storage adapter checks for web environment and uses localStorage instead
// Runtime checks prevent AsyncStorage from being used in web/SSR environments

module.exports = withNativeWind(config, { input: './global.css' });
