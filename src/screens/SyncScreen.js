import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { syncPendingBookings, getPendingBookings } from '../services/offlineStorage';

export default function SyncScreen() {
  const [pendingCount, setPendingCount] = useState(0);
  const [status, setStatus] = useState('Ready to sync');

  useEffect(() => {
    async function load() {
      const records = await getPendingBookings();
      setPendingCount(records.length);
    }

    load();
  }, []);

  async function runSync() {
    setStatus('Syncing queued bookings...');
    try {
      const response = await syncPendingBookings();
      const records = await getPendingBookings();
      setPendingCount(records.length);
      setStatus(response.message || 'Sync complete');
    } catch (error) {
      setStatus(error.response?.data?.error || error.message || 'Could not synchronize queued bookings.');
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Offline sync</Text>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Queue status</Text>
          <Text style={styles.metric}>{pendingCount} pending records</Text>
          <Text style={styles.status}>{status}</Text>
          <Pressable style={styles.primaryButton} onPress={runSync}>
            <Text style={styles.primaryButtonText}>Sync now</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Sync rules</Text>
          <Text style={styles.rule}>• Server-wins conflict resolution</Text>
          <Text style={styles.rule}>• Queue bookings while offline</Text>
          <Text style={styles.rule}>• Pull remote changes when connectivity restores</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0B1220',
  },
  content: {
    padding: 18,
    paddingBottom: 40,
  },
  title: {
    color: '#F9FAFB',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 14,
  },
  card: {
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    color: '#F9FAFB',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  metric: {
    color: '#93C5FD',
    fontSize: 18,
    fontWeight: '700',
  },
  status: {
    color: '#CBD5E1',
    marginTop: 10,
  },
  rule: {
    color: '#D1D5DB',
    marginTop: 8,
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 18,
  },
  primaryButtonText: {
    color: '#F9FAFB',
    fontWeight: '700',
  },
});
