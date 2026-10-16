import { Text, View } from 'react-native';
import type { TextInputProps } from 'react-native';
import { Field } from '@/components/ui';
import { colors } from '@/theme';

export function PrivatePhoneField(props: TextInputProps & { label: string }) {
  return <View style={{ gap: 8 }}>
    <Field keyboardType="phone-pad" maxLength={30} {...props} />
    <Text style={{ color: colors.muted, fontSize: 12, lineHeight: 18 }}>Solo los capitanes pueden ver este número.</Text>
  </View>;
}
