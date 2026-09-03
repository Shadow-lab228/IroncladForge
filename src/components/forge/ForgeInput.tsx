
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import { colors, radii, spacing, type } from '../../theme/tokens';
import { typography } from '../../theme';

interface ForgeInputProps extends TextInputProps {
  label?: string;
  hint?: string;
  error?: string;
}

/** A labelled forge input (parchment-on-iron). */
export function ForgeInput({ label, hint, error, style, ...rest }: ForgeInputProps) {
  return (
    <View style={styles.wrapper}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.textDim}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    ...typography.label,
  },
  input: {
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.rivet,
    borderRadius: radii.md,
    color: colors.text,
    fontSize: type.scale.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 44,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: colors.danger,
  },
  hint: {
    ...typography.caption,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
});
