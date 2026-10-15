import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';

export function nativePushSupported() {
  return (Platform.OS === 'android' || Platform.OS === 'ios') && Device.isDevice && Constants.executionEnvironment !== 'storeClient';
}
