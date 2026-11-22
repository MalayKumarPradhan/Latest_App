import React, { useEffect, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { createBookingApi } from '../services/api';
import { getPendingBookings, queueOfflineBooking } from '../services/offlineStorage';

export default function BookingScreen({ route, navigation }) {
  const selectedBus = route?.params?.selectedBus;
  const selectedSeats = route?.params?.selectedSeats || [];
  const [pending, setPending] = useState([]);

  useEffect(() => {
    async function loadPending() {
      const data = await getPendingBookings();
      setPending(data);
    }

    loadPending();
  }, []);

  async function submitBooking() {
    if (!selectedBus) {
      return;
    }

    const payload = {
      id: `BK-${Date.now()}`,
      busId: selectedBus.id,
      route: selectedBus.route,
      seats: selectedSeats,
      amount: selectedBus.price * selectedSeats.length,
      status: 'pending_sync',
    };

    try {
      await createBookingApi(payload);
      await queueOfflineBooking(payload);
      const refreshedPending = await getPendingBookings();
      setPending(refreshedPending);
      navigation.navigate('Sync');
    } catch (error) {
      console.warn('Booking error:', error);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>My bookings</Text>

        {selectedBus ? (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{selectedBus.operator}</Text>
            <Text style={styles.route}>{selectedBus.route}</Text>
            <Text style={styles.meta}>Seats: {selectedSeats.join(', ') || 'Not selected'}</Text>
            <Text style={styles.meta}>Total: ₹{selectedBus.price * selectedSeats.length}</Text>
            <Pressable style={styles.primaryButton} onPress={submitBooking}>
              <Text style={styles.primaryButtonText}>Submit booking</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.emptyText}>No booking in progress.</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Offline queue</Text>
          {pending.length === 0 ? (
            <Text style={styles.emptyText}>No pending offline bookings.</Text>
          ) : (
            pending.map((item) => (
              <View key={item.id} style={styles.queueItem}>
                <Text style={styles.queueText}>{item.route}</Text>
                <Text style={styles.queueMeta}>{item.status}</Text>
              </View>
            ))
          )}
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
  },
  route: {
    color: '#D1D5DB',
    marginTop: 6,
  },
  meta: {
    color: '#CBD5E1',
    marginTop: 10,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#F9FAFB',
    fontWeight: '700',
  },
  emptyText: {
    color: '#9CA3AF',
  },
  queueItem: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#1F2937',
    paddingTop: 10,
  },
  queueText: {
    color: '#F9FAFB',
    fontWeight: '600',
  },
  queueMeta: {
    color: '#93C5FD',
    marginTop: 4,
  },
});
