import React from 'react';
import { View, Text, TextInput, TextInputProps } from 'react-native';
import { colors, radius } from '@/theme/tokens';

interface Props extends TextInputProps {
  label: string;
  hint?: string;
}

export const TextField: React.FC<Props> = ({ label, hint, style, ...rest }) => (
  <View style={{ gap: 4 }}>
    <Text style={{ fontSize: 13, fontWeight: '500', color: colors.gray700 }}>{label}</Text>
    <TextInput
      placeholderTextColor={colors.gray400}
      style={[
        {
          borderWidth: 1,
          borderColor: colors.gray300,
          borderRadius: radius.xl,
          paddingHorizontal: 16,
          paddingVertical: 12,
          fontSize: 15,
          color: colors.gray900,
        },
        style,
      ]}
      {...rest}
    />
    {hint ? <Text style={{ fontSize: 12, color: colors.gray500 }}>{hint}</Text> : null}
  </View>
);
