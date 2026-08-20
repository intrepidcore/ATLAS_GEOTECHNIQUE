import React from 'react';
import { Pressable, Text, ActivityIndicator, StyleProp, ViewStyle } from 'react-native';
import { colors, radius } from '@/theme/tokens';

interface Props {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline';
  style?: StyleProp<ViewStyle>;
}

export const PrimaryButton: React.FC<Props> = ({ label, onPress, loading, disabled, variant = 'primary', style }) => {
  const isOutline = variant === 'outline';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        {
          backgroundColor: isOutline ? colors.white : colors.blue600,
          borderWidth: isOutline ? 1 : 0,
          borderColor: colors.gray300,
          borderRadius: radius.xl,
          paddingVertical: 14,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isOutline ? colors.blue600 : colors.white} />
      ) : (
        <Text style={{ color: isOutline ? colors.gray700 : colors.white, fontWeight: '600', fontSize: 15 }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
};
