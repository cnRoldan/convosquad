import { Platform } from 'react-native';
import { IconButton } from '@/components/icon-button';

export function headerBackOptions(onPress: () => void, label: string) {
  const renderButton = () => <IconButton icon="back" label={label} onPress={onPress} variant="plain" />;

  return {
    headerBackVisible: false,
    headerLeft: renderButton,
    // iOS 26 wraps custom header items in Liquid Glass unless explicitly disabled.
    ...(Platform.OS === 'ios' ? {
      unstable_headerLeftItems: () => [{
        type: 'custom' as const,
        element: renderButton(),
        hidesSharedBackground: true,
      }],
    } : {}),
  };
}
