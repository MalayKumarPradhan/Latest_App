import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, IconButton, Menu, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { cancelManagedReservation, fetchManagedReservations } from '../services/api';

function formatDate(value) {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function toDateKey(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateFromKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return toDateKey(date) === value ? date : null;
}

export default function ReservationManagementScreen({ navigation }) {
  const { user } = useAuth();
  const scrollRef = useRef(null);
  const PAGE_SIZE = 10;
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [busFilter, setBusFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [journeyDateFilter, setJourneyDateFilter] = useState('');
  const [bookedDateFilter, setBookedDateFilter] = useState('');
  const [showJourneyDatePicker, setShowJourneyDatePicker] = useState(false);
  const [showBookedDatePicker, setShowBookedDatePicker] = useState(false);
  const [routeMenuVisible, setRouteMenuVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [showScrollToTop, setShowScrollToTop] = useState(false);

  const loadReservations = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    setError('');
    try {
      const result = await fetchManagedReservations();
      setReservations(result);
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
        requestError.message ||
        'Could not load reservations. Please try again.'
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadReservations(true);
    const refreshTimer = setInterval(() => loadReservations(), 10000);
    return () => clearInterval(refreshTimer);
  }, [loadReservations]));

  const cancelReservation = (reservation) => {
    Alert.alert(
      'Cancel reservation?',
      `Cancel booking ${reservation.pnr} for ${reservation.route}?`,
      [
        { text: 'Keep reservation', style: 'cancel' },
        {
          text: 'Cancel booking',
          style: 'destructive',
          onPress: async () => {
            setCancellingId(reservation.id);
            setError('');
            try {
              await cancelManagedReservation(reservation.id);
              await loadReservations();
            } catch (requestError) {
              setError(
                requestError.response?.data?.error ||
                requestError.message ||
                'Could not cancel this reservation.'
              );
            } finally {
              setCancellingId(null);
            }
          },
        },
      ]
    );
  };

  const refresh = () => {
    setRefreshing(true);
    loadReservations();
  };

  const filteredReservations = useMemo(() => {
    const busQuery = busFilter.trim().toLowerCase();
    return reservations.filter((reservation) => {
      const matchesBus = !busQuery ||
        String(reservation.busNumber || '').toLowerCase().includes(busQuery);
      const matchesRoute = !routeFilter ||
        String(reservation.route || '') === routeFilter;
      const matchesJourneyDate = !journeyDateFilter ||
        toDateKey(reservation.departureDate) === journeyDateFilter;
      const matchesBookedDate = !bookedDateFilter ||
        toDateKey(reservation.createdAt) === bookedDateFilter;
      return matchesBus && matchesRoute && matchesJourneyDate && matchesBookedDate;
    });
  }, [busFilter, bookedDateFilter, journeyDateFilter, reservations, routeFilter]);

  const routeOptions = useMemo(() => [...new Set(
    reservations.map((reservation) => reservation.route).filter(Boolean)
  )].sort((first, second) => first.localeCompare(second)), [reservations]);

  const pageCount = Math.max(1, Math.ceil(filteredReservations.length / PAGE_SIZE));
  const pagedReservations = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredReservations.slice(start, start + PAGE_SIZE);
  }, [filteredReservations, page]);

  useEffect(() => {
    setPage(1);
  }, [busFilter, routeFilter, journeyDateFilter, bookedDateFilter]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
    setShowScrollToTop(false);
  };

  const changePage = (nextPage) => {
    setPage(nextPage);
    scrollToTop();
  };

  const clearFilters = () => {
    setBusFilter('');
    setRouteFilter('');
    setJourneyDateFilter('');
    setBookedDateFilter('');
    setPage(1);
  };

  const handleJourneyDateChange = (event, date) => {
    setShowJourneyDatePicker(false);
    if (date) setJourneyDateFilter(toDateKey(date));
  };

  const handleBookedDateChange = (event, date) => {
    setShowBookedDatePicker(false);
    if (date) setBookedDateFilter(toDateKey(date));
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        onScroll={(event) => {
          setShowScrollToTop(event.nativeEvent.contentOffset.y >= 280);
        }}
        scrollEventThrottle={16}
      >
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            mode="contained-tonal"
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back"
          />
          <View style={styles.heading}>
            <Text variant="labelLarge" style={styles.eyebrow}>
              {user?.role === 'SystemAdmin' ? 'SYSTEM ADMIN' : 'BUS OPERATOR'}
            </Text>
            <Text variant="headlineSmall" style={styles.title}>Seat reservations</Text>
          </View>
          <IconButton
            icon="refresh"
            onPress={refresh}
            disabled={refreshing || loading}
            accessibilityLabel="Refresh reservations"
          />
        </View>

        <Text variant="bodyMedium" style={styles.subtitle}>
          Live reservation updates refresh every 10 seconds. Booking and cancellation changes are committed by the API.
        </Text>

        <Card style={styles.filterCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.filterTitle}>Filter reservations</Text>
            <View style={styles.filterRow}>
              <TextInput
                label="Bus name"
                value={busFilter}
                onChangeText={setBusFilter}
                mode="outlined"
                style={styles.filterInput}
                dense
              />
              <Menu
                visible={routeMenuVisible}
                onDismiss={() => setRouteMenuVisible(false)}
                anchor={
                  <Button
                    mode="outlined"
                    icon="chevron-down"
                    onPress={() => setRouteMenuVisible(true)}
                    style={styles.routeSelect}
                    contentStyle={styles.routeSelectContent}
                    disabled={!routeOptions.length}
                  >
                    {routeFilter || 'Select route'}
                  </Button>
                }
              >
                <Menu.Item
                  title="All routes"
                  onPress={() => {
                    setRouteFilter('');
                    setRouteMenuVisible(false);
                  }}
                />
                {routeOptions.map((route) => (
                  <Menu.Item
                    key={route}
                    title={route}
                    onPress={() => {
                      setRouteFilter(route);
                      setRouteMenuVisible(false);
                    }}
                  />
                ))}
              </Menu>
            </View>
            <View style={styles.filterActions}>
              <Button
                mode="outlined"
                icon="calendar-month-outline"
                onPress={() => setShowJourneyDatePicker(true)}
              >
                {journeyDateFilter ? `Journey date: ${journeyDateFilter}` : 'Journey date'}
              </Button>
              <Button
                mode="outlined"
                icon="calendar-check-outline"
                onPress={() => setShowBookedDatePicker(true)}
              >
                {bookedDateFilter ? `Booked date: ${bookedDateFilter}` : 'Booked date'}
              </Button>
              {(busFilter || routeFilter || journeyDateFilter || bookedDateFilter) ? (
                <Button mode="text" icon="close-circle-outline" onPress={clearFilters}>
                  Clear
                </Button>
              ) : null}
            </View>
            {showJourneyDatePicker ? (
              <DateTimePicker
                value={dateFromKey(journeyDateFilter) || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleJourneyDateChange}
              />
            ) : null}
            {showBookedDatePicker ? (
              <DateTimePicker
                value={dateFromKey(bookedDateFilter) || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={handleBookedDateChange}
              />
            ) : null}
          </Card.Content>
        </Card>

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
            <Text variant="bodyMedium" style={styles.subtitle}>Loading live reservations…</Text>
          </View>
        ) : reservations.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.cardTitle}>No reservations yet</Text>
              <Text variant="bodyMedium" style={styles.subtitle}>
                Confirmed reservations for the operators you manage will appear here.
              </Text>
            </Card.Content>
          </Card>
        ) : filteredReservations.length === 0 ? (
          <Card style={styles.emptyCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.cardTitle}>No matching reservations</Text>
              <Text variant="bodyMedium" style={styles.subtitle}>
                Change or clear the bus name, route, or date filter.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          <>
          {pagedReservations.map((reservation) => (
            <Card key={reservation.id} style={styles.reservationCard}>
              <Card.Content>
                <View style={styles.reservationHeading}>
                  <View style={styles.reservationInfo}>
                    <Text variant="titleMedium" style={styles.cardTitle}>{reservation.route}</Text>
                    <Text variant="bodySmall" style={styles.subtitle}>
                      {reservation.operator} · {reservation.busNumber}
                    </Text>
                  </View>
                  <Text
                    variant="labelMedium"
                    style={[
                      styles.status,
                      reservation.status === 'Confirmed' ? styles.confirmed : styles.cancelled,
                    ]}
                  >
                    {reservation.status}
                  </Text>
                </View>
                <Text variant="bodyMedium" style={styles.detail}>
                  PNR {reservation.pnr} · Schedule {reservation.scheduleId}
                </Text>
                <Text variant="bodySmall" style={styles.detail}>
                  Journey date: {formatDate(reservation.departureDate)}
                </Text>
                <Text variant="bodySmall" style={styles.detail}>
                  Seat booked on: {formatDate(reservation.createdAt)}
                </Text>
                <Text variant="bodySmall" style={styles.detail}>
                  Seats {reservation.seats.map((seat) => seat.seatNumber).join(', ') || '—'}
                  {' · '}₹{reservation.amount.toFixed(2)}
                </Text>
                {reservation.seats.map((seat) => (
                  <Text key={seat.seatNumber} variant="bodySmall" style={styles.passenger}>
                    {seat.seatNumber} · {seat.passengerName} · {seat.passengerGender}
                  </Text>
                ))}
                {reservation.status === 'Confirmed' ? (
                  <Button
                    mode="outlined"
                    textColor="#B3261E"
                    onPress={() => cancelReservation(reservation)}
                    loading={cancellingId === reservation.id}
                    disabled={Boolean(cancellingId)}
                    style={styles.cancelButton}
                  >
                    Cancel reservation
                  </Button>
                ) : null}
              </Card.Content>
            </Card>
          ))}
          <View style={styles.paginationRow}>
            <View style={styles.pagination}>
              <IconButton
                icon="chevron-left"
                mode="outlined"
                onPress={() => changePage(Math.max(1, page - 1))}
                disabled={page === 1}
                accessibilityLabel="Previous reservation page"
              />
              <Text variant="labelLarge" style={styles.pageLabel}>
                Page {page} of {pageCount}
              </Text>
              <IconButton
                icon="chevron-right"
                mode="outlined"
                onPress={() => changePage(Math.min(pageCount, page + 1))}
                disabled={page === pageCount}
                accessibilityLabel="Next reservation page"
              />
            </View>
            {showScrollToTop ? (
              <IconButton
                icon="arrow-collapse-up"
                mode="outlined"
                onPress={scrollToTop}
                accessibilityLabel="Scroll to beginning"
                style={styles.scrollToTopButton}
              />
            ) : null}
          </View>
          </>
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
  filterCard: { backgroundColor: '#FFFBFE', borderRadius: 18, marginTop: 14 },
  filterTitle: { color: '#1D1B20', fontWeight: '700', marginBottom: 10 },
  filterRow: { flexDirection: 'row', gap: 10 },
  filterInput: { flex: 1, backgroundColor: '#FFFBFE' },
  routeSelect: { flex: 1, borderRadius: 4, justifyContent: 'center' },
  routeSelectContent: { height: 54, flexDirection: 'row-reverse' },
  filterActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  paginationRow: { position: 'relative', alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: 12, marginBottom: 4 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  scrollToTopButton: { position: 'absolute', right: 0 },
  pageLabel: { color: '#49454F', marginHorizontal: 8 },
  loading: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  errorCard: { backgroundColor: '#FCE8E6', marginTop: 16 },
  errorText: { color: '#B3261E' },
  emptyCard: { backgroundColor: '#FFFBFE', marginTop: 18 },
  reservationCard: { backgroundColor: '#FFFBFE', borderRadius: 18, marginTop: 14 },
  reservationHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  reservationInfo: { flex: 1 },
  cardTitle: { color: '#1D1B20', fontWeight: '700' },
  status: { borderRadius: 12, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 5 },
  confirmed: { backgroundColor: '#DCFCE7', color: '#166534' },
  cancelled: { backgroundColor: '#F3F4F6', color: '#6B7280' },
  detail: { color: '#49454F', marginTop: 8 },
  passenger: { color: '#625B71', marginTop: 5, marginLeft: 8 },
  cancelButton: { alignSelf: 'flex-start', marginTop: 14 },
});
