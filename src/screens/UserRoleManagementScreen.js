import React, { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, IconButton, Menu, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { fetchManagedUsers, updateManagedUserRole } from '../services/api';

const USER_ROLES = ['Passenger', 'Conductor', 'OperatorAdmin', 'SystemAdmin'];

function UserRoleCard({ account, currentUserId, disabled, onChange }) {
  const [menuVisible, setMenuVisible] = useState(false);
  const isCurrentUser = Number(account.id) === Number(currentUserId);

  return (
    <Card style={styles.userCard}>
      <Card.Content>
        <View style={styles.userHeader}>
          <View style={styles.userInfo}>
            <Text variant="titleMedium" style={styles.userName}>{account.name}</Text>
            <Text variant="bodySmall" style={styles.contact}>
              {account.email || account.phone || 'No contact information'}
            </Text>
            {account.email && account.phone ? (
              <Text variant="bodySmall" style={styles.contact}>{account.phone}</Text>
            ) : null}
          </View>
          <Text variant="labelSmall" style={styles.userId}>ID {account.id}</Text>
        </View>

        <View style={styles.roleRow}>
          <Text variant="bodyMedium" style={styles.roleLabel}>Role</Text>
          <Menu
            visible={menuVisible}
            onDismiss={() => setMenuVisible(false)}
            anchor={
              <Button
                mode="outlined"
                icon="chevron-down"
                onPress={() => setMenuVisible(true)}
                disabled={disabled || isCurrentUser}
                accessibilityLabel={`Change role for ${account.name}`}
                compact
              >
                {account.role}
              </Button>
            }
          >
            {USER_ROLES.map((role) => (
              <Menu.Item
                key={role}
                title={role}
                disabled={role === account.role}
                onPress={() => {
                  setMenuVisible(false);
                  onChange(account, role);
                }}
              />
            ))}
          </Menu>
        </View>
        {isCurrentUser ? (
          <Text variant="bodySmall" style={styles.hint}>You cannot change your own role.</Text>
        ) : null}
      </Card.Content>
    </Card>
  );
}

export default function UserRoleManagementScreen({ navigation }) {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadUsers = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    setError('');
    try {
      setUsers(await fetchManagedUsers());
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
        requestError.message ||
        'Could not load users. Please try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadUsers(true);
  }, [loadUsers]));

  const refresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  const changeRole = async (account, role) => {
    setUpdatingUserId(account.id);
    setError('');
    setMessage('');
    try {
      await updateManagedUserRole(account.id, role);
      setUsers((currentUsers) => currentUsers.map((currentUser) =>
        currentUser.id === account.id ? { ...currentUser, role } : currentUser
      ));
      setMessage('Role updated. Existing access tokens may remain active for up to 15 minutes.');
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
        requestError.message ||
        'Could not update this user role.'
      );
    } finally {
      setUpdatingUserId(null);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            mode="contained-tonal"
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back"
          />
          <View style={styles.heading}>
            <Text variant="labelLarge" style={styles.eyebrow}>SYSTEM ADMIN</Text>
            <Text variant="headlineSmall" style={styles.title}>Manage user roles</Text>
          </View>
          <IconButton
            icon="refresh"
            onPress={refresh}
            disabled={refreshing || loading}
            accessibilityLabel="Refresh users"
          />
        </View>

        <Text variant="bodyMedium" style={styles.subtitle}>
          Assign Passenger, Conductor, OperatorAdmin, or SystemAdmin access.
          You cannot change your own role or demote the last active system administrator.
        </Text>

        {message ? (
          <Card style={styles.messageCard}>
            <Card.Content>
              <Text variant="bodySmall" style={styles.messageText}>{message}</Text>
            </Card.Content>
          </Card>
        ) : null}

        {error ? (
          <Card style={styles.errorCard}>
            <Card.Content>
              <Text variant="bodyMedium" style={styles.errorText}>{error}</Text>
              <Button mode="text" onPress={refresh}>Try again</Button>
            </Card.Content>
          </Card>
        ) : null}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#6750A4" />
            <Text variant="bodyMedium" style={styles.subtitle}>Loading users…</Text>
          </View>
        ) : users.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.userName}>No users found</Text>
            </Card.Content>
          </Card>
        ) : (
          users.map((account) => (
            <UserRoleCard
              key={account.id}
              account={account}
              currentUserId={user?.id}
              disabled={Boolean(updatingUserId)}
              onChange={changeRole}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F8' },
  content: { padding: 18, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  heading: { flex: 1 },
  eyebrow: { color: '#6750A4', letterSpacing: 1 },
  title: { color: '#1D1B20', fontWeight: '700' },
  subtitle: { color: '#625B71', marginTop: 4 },
  loading: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  messageCard: { backgroundColor: '#E8F5E9', marginTop: 16 },
  messageText: { color: '#1B5E20' },
  errorCard: { backgroundColor: '#FCE8E6', marginTop: 16 },
  errorText: { color: '#B3261E' },
  emptyCard: { backgroundColor: '#FFFBFE', marginTop: 18 },
  userCard: { backgroundColor: '#FFFBFE', borderRadius: 18, marginTop: 14 },
  userHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  userInfo: { flex: 1 },
  userName: { color: '#1D1B20', fontWeight: '700' },
  contact: { color: '#625B71', marginTop: 4 },
  userId: { color: '#79747E', marginTop: 4 },
  roleRow: {
    alignItems: 'center',
    borderTopColor: '#E7E0EC',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 14,
    paddingTop: 12,
  },
  roleLabel: { color: '#49454F' },
  hint: { color: '#79747E', marginTop: 8 },
});
