import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Button,
  Checkbox,
  HelperText,
  ProgressBar,
  SegmentedButtons,
  Snackbar,
  Surface,
  Text,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  requestPasswordResetApi,
  resetPasswordApi,
  verifyRecoveryCodeApi,
} from '../services/api';
import { useAuth } from '../context/AuthContext';

const isValidIdentifier = (value) => {
  const trimmed = value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) return true;
  if (!/^\+?[\d\s()-]+$/.test(trimmed)) return false;
  const digits = trimmed.replace(/\D/g, '');
  return digits.length === 10 || (digits.length === 12 && digits.startsWith('91'));
};
const isValidPassword = (value) =>
  value.length >= 8 && /[a-z]/.test(value) && /[A-Z]/.test(value) &&
  /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
const getRequestError = (error) => {
  if (error.response?.data?.error) return error.response.data.error;
  if (error.request && !error.response) {
    return 'Unable to reach the server. Check that the API is running and its URL is reachable from this device.';
  }
  return error.message || 'Something went wrong. Please try again.';
};

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login');
  const [identifier, setIdentifier] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [step, setStep] = useState('request');
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (countdown < 1) return undefined;
    const timer = setTimeout(() => setCountdown((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const setError = (field, message) => {
    setFieldErrors((current) => ({ ...current, [field]: message }));
  };
  const validateIdentifier = () => {
    const valid = isValidIdentifier(identifier);
    setError('identifier', valid ? '' : 'Enter a valid email address or 10-digit mobile number.');
    return valid;
  };
  const validatePassword = () => {
    const valid = isValidPassword(password);
    setError('password', valid ? '' : 'Use 8+ characters with uppercase, lowercase, a number, and a special character.');
    return valid;
  };
  const updateIdentifier = (value) => {
    setIdentifier(value);
    if (fieldErrors.identifier) setError('identifier', '');
  };

  async function handleSubmit() {
    setFieldErrors({});
    setNotice('');

    if (mode === 'login') {
      if (!validateIdentifier() || !password) {
        if (!password) setError('password', 'Enter your password.');
        return;
      }
    } else if (mode === 'signup') {
      const nextErrors = {};
      if (!/^[A-Za-z0-9 ]{2,100}$/.test(name.trim())) nextErrors.name = 'Enter a name with at least 2 characters.';
      if (!isValidIdentifier(identifier)) nextErrors.identifier = 'Enter a valid email address or 10-digit mobile number.';
      if (!isValidPassword(password)) nextErrors.password = 'Use 8+ characters with uppercase, lowercase, a number, and a special character.';
      if (confirmPassword !== password) nextErrors.confirmPassword = 'Passwords do not match.';
      if (!acceptedTerms) nextErrors.terms = 'Accept the terms and conditions to continue.';
      setFieldErrors(nextErrors);
      if (Object.keys(nextErrors).length) return;
    } else if (step === 'request') {
      if (!validateIdentifier()) return;
    } else if (step === 'verify') {
      if (!/^\d{6}$/.test(code)) {
        setError('code', 'Enter the 6-digit code sent to your registered contact.');
        return;
      }
    } else {
      const nextErrors = {};
      if (!isValidPassword(password)) nextErrors.password = 'Use 8+ characters with uppercase, lowercase, a number, and a special character.';
      if (confirmPassword !== password) nextErrors.confirmPassword = 'Passwords do not match.';
      setFieldErrors(nextErrors);
      if (Object.keys(nextErrors).length) return;
    }

    try {
      setLoading(true);
      if (mode === 'login') {
        await signIn({ identifier: identifier.trim(), password, rememberMe });
      } else if (mode === 'signup') {
        await signUp({
          name: name.trim(),
          identifier: identifier.trim(),
          password,
          termsAccepted: acceptedTerms,
        });
      } else if (step === 'request') {
        await requestPasswordResetApi(identifier.trim());
        setStep('verify');
        setCountdown(60);
        setNotice('If this account exists, instructions have been sent.');
      } else if (step === 'verify') {
        await verifyRecoveryCodeApi(identifier.trim(), code);
        setStep('reset');
        setNotice('Code verified. Choose a new password.');
      } else {
        await resetPasswordApi(identifier.trim(), code, password);
        setMode('login');
        setStep('request');
        setPassword('');
        setConfirmPassword('');
        setCode('');
        setNotice('Password updated. You can now log in.');
      }
    } catch (error) {
      setNotice(getRequestError(error));
    } finally {
      setLoading(false);
    }
  }

  async function resendCode() {
    if (countdown > 0 || loading) return;
    try {
      setLoading(true);
      await requestPasswordResetApi(identifier.trim());
      setCountdown(60);
      setNotice('If this account exists, instructions have been sent.');
    } catch (error) {
      setNotice(getRequestError(error));
    } finally {
      setLoading(false);
    }
  }

  const title = mode === 'forgot'
    ? 'Reset your password'
    : mode === 'signup' ? 'Create account' : 'Welcome aboard';
  const subtitle = mode === 'forgot'
    ? 'We’ll help you get back to your account.'
    : mode === 'signup' ? 'Book your next journey in a few steps.' : 'Sign in to find and book your next ride.';
  const buttonLabel = mode === 'login' ? 'Log in'
    : mode === 'signup' ? 'Create account'
      : step === 'request' ? 'Send verification code'
        : step === 'verify' ? 'Verify code' : 'Update password';

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.brand}>
            <Surface style={styles.brandIcon} elevation={1}>
              <Text variant="headlineSmall" style={styles.brandGlyph}>B</Text>
            </Surface>
            <Text variant="titleMedium" style={styles.brandName}>BUS BOOKING</Text>
          </View>

          <Surface style={styles.card} elevation={2}>
            <Text variant="headlineSmall" style={styles.title}>{title}</Text>
            <Text variant="bodyMedium" style={styles.subtitle}>{subtitle}</Text>

            {mode !== 'forgot' && (
              <SegmentedButtons
                value={mode}
                onValueChange={(value) => {
                  setMode(value);
                  setFieldErrors({});
                  setNotice('');
                }}
                buttons={[
                  { value: 'login', label: 'Log in' },
                  { value: 'signup', label: 'Sign up' },
                ]}
                style={styles.modeSelector}
              />
            )}

            {mode === 'signup' && (
              <View style={styles.field}>
                <TextInput
                  label="Full name"
                  value={name}
                  onChangeText={setName}
                  onBlur={() => setError('name', /^[A-Za-z0-9 ]{2,100}$/.test(name.trim()) ? '' : 'Enter a name with at least 2 characters.')}
                  autoCapitalize="words"
                  mode="outlined"
                  left={<TextInput.Icon icon="account-outline" />}
                  error={Boolean(fieldErrors.name)}
                />
                <HelperText type="error" visible={Boolean(fieldErrors.name)}>{fieldErrors.name}</HelperText>
              </View>
            )}

            {!(mode === 'forgot' && step !== 'request') && (
              <View style={styles.field}>
                <TextInput
                  label="Email or mobile number"
                  value={identifier}
                  onChangeText={updateIdentifier}
                  onBlur={validateIdentifier}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  mode="outlined"
                  left={<TextInput.Icon icon="account-circle-outline" />}
                  error={Boolean(fieldErrors.identifier)}
                />
                <HelperText type="error" visible={Boolean(fieldErrors.identifier)}>{fieldErrors.identifier}</HelperText>
              </View>
            )}

            {mode === 'forgot' && step === 'verify' && (
              <View style={styles.field}>
                <TextInput
                  label="6-digit verification code"
                  value={code}
                  onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                  keyboardType="number-pad"
                  mode="outlined"
                  left={<TextInput.Icon icon="shield-key-outline" />}
                  error={Boolean(fieldErrors.code)}
                />
                <HelperText type="error" visible={Boolean(fieldErrors.code)}>{fieldErrors.code}</HelperText>
                <Button
                  mode="text"
                  onPress={resendCode}
                  disabled={countdown > 0 || loading}
                  compact
                  style={styles.resendButton}
                >
                  {countdown > 0 ? `Resend code in ${countdown}s` : 'Resend code'}
                </Button>
              </View>
            )}

            {(mode !== 'forgot' || step === 'reset') && (
              <>
                <View style={styles.field}>
                  <TextInput
                    label={mode === 'forgot' ? 'New password' : 'Password'}
                    value={password}
                    onChangeText={setPassword}
                    onBlur={() => {
                      if (mode !== 'login') validatePassword();
                    }}
                    secureTextEntry={!passwordVisible}
                    autoCapitalize="none"
                    mode="outlined"
                    left={<TextInput.Icon icon="lock-outline" />}
                    right={<TextInput.Icon icon={passwordVisible ? 'eye-off-outline' : 'eye-outline'} onPress={() => setPasswordVisible((visible) => !visible)} />}
                    error={Boolean(fieldErrors.password)}
                  />
                  <HelperText type="error" visible={Boolean(fieldErrors.password)}>{fieldErrors.password}</HelperText>
                </View>

                {(mode === 'signup' || (mode === 'forgot' && step === 'reset')) && (
                  <View style={styles.field}>
                    <TextInput
                      label="Confirm password"
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                      secureTextEntry={!confirmVisible}
                      autoCapitalize="none"
                      mode="outlined"
                      left={<TextInput.Icon icon="lock-check-outline" />}
                      right={<TextInput.Icon icon={confirmVisible ? 'eye-off-outline' : 'eye-outline'} onPress={() => setConfirmVisible((visible) => !visible)} />}
                      error={Boolean(fieldErrors.confirmPassword)}
                    />
                    <HelperText type="error" visible={Boolean(fieldErrors.confirmPassword)}>{fieldErrors.confirmPassword}</HelperText>
                  </View>
                )}
              </>
            )}

            {mode === 'login' && (
              <View style={styles.loginOptions}>
                <Checkbox.Item
                  label="Remember me"
                  status={rememberMe ? 'checked' : 'unchecked'}
                  onPress={() => setRememberMe((value) => !value)}
                  position="leading"
                  labelStyle={styles.checkboxLabel}
                  style={styles.checkbox}
                />
                <Button mode="text" compact onPress={() => {
                  setMode('forgot');
                  setStep('request');
                  setPassword('');
                  setConfirmPassword('');
                  setCode('');
                  setFieldErrors({});
                  setNotice('');
                }}>
                  Forgot password?
                </Button>
              </View>
            )}

            {mode === 'signup' && (
              <View style={styles.termsBlock}>
                <Checkbox.Item
                  label="I agree to the Terms & Conditions"
                  status={acceptedTerms ? 'checked' : 'unchecked'}
                  onPress={() => setAcceptedTerms((value) => !value)}
                  position="leading"
                  labelStyle={styles.checkboxLabel}
                  style={styles.checkbox}
                />
                <HelperText type="error" visible={Boolean(fieldErrors.terms)}>{fieldErrors.terms}</HelperText>
              </View>
            )}

            {mode === 'forgot' && (
              <ProgressBar progress={step === 'request' ? 1 / 3 : step === 'verify' ? 2 / 3 : 1} style={styles.progress} />
            )}

            <Button
              mode="contained"
              onPress={handleSubmit}
              loading={loading}
              disabled={loading}
              contentStyle={styles.submitContent}
              style={styles.submitButton}
            >
              {buttonLabel}
            </Button>

            {mode === 'forgot' && step === 'request' && (
              <Text variant="bodySmall" style={styles.privacyNote}>
                For your privacy, we’ll show the same confirmation whether or not the account exists.
              </Text>
            )}
            {mode === 'forgot' && (
              <Button mode="text" onPress={() => {
                setMode('login');
                setFieldErrors({});
                setNotice('');
              }} style={styles.backButton}>
                Back to log in
              </Button>
            )}
          </Surface>
          <Text variant="bodySmall" style={styles.footer}>Secure access for every journey</Text>
        </ScrollView>
      </KeyboardAvoidingView>
      <Snackbar visible={Boolean(notice)} onDismiss={() => setNotice('')} duration={5000}>
        {notice}
      </Snackbar>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F8',
  },
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
    paddingVertical: 32,
  },
  brand: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#6750A4',
    marginBottom: 10,
  },
  brandGlyph: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  brandName: {
    color: '#49454F',
    letterSpacing: 1.4,
    fontWeight: '700',
  },
  card: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    backgroundColor: '#FFFBFE',
    borderRadius: 28,
    padding: 24,
  },
  title: {
    color: '#1D1B20',
    fontWeight: '700',
  },
  subtitle: {
    color: '#625B71',
    marginTop: 6,
    marginBottom: 22,
  },
  modeSelector: {
    marginBottom: 20,
  },
  field: {
    marginBottom: 2,
  },
  loginOptions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
    marginBottom: 8,
  },
  checkbox: {
    paddingHorizontal: 0,
    flex: 1,
  },
  checkboxLabel: {
    fontSize: 13,
    textAlign: 'left',
  },
  termsBlock: {
    marginBottom: 8,
  },
  submitButton: {
    borderRadius: 100,
    marginTop: 12,
  },
  submitContent: {
    minHeight: 50,
  },
  progress: {
    marginTop: 8,
    borderRadius: 10,
  },
  privacyNote: {
    color: '#625B71',
    marginTop: 14,
    textAlign: 'center',
  },
  resendButton: {
    alignSelf: 'flex-end',
  },
  backButton: {
    marginTop: 4,
  },
  footer: {
    color: '#625B71',
    textAlign: 'center',
    marginTop: 20,
  },
});
