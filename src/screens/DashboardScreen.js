import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Menu, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import {
  fetchBusOptions,
  fetchManagedReservations,
  fetchManagedUsers,
} from '../services/api';

const CHART_COLORS = ['#6750A4', '#2E7D32', '#EF6C00', '#1565C0', '#AD1457'];

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function dateKeyFromValue(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : toDateKey(date);
}

function dateFromKey(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return toDateKey(date) === value ? date : null;
}

function formatDate(value) {
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function serviceKey(item) {
  return `${item.operator || ''}::${item.route || ''}`;
}

function formatService(item) {
  return [item.operator, item.route].filter(Boolean).join(' · ') || 'Unknown service';
}

function FilterMenu({ label, value, options, onSelect, disabled }) {
  const [visible, setVisible] = useState(false);
  return (
    <Menu
      visible={visible}
      onDismiss={() => setVisible(false)}
      anchor={
        <Button
          mode="outlined"
          icon="chevron-down"
          onPress={() => setVisible(true)}
          disabled={disabled}
          style={styles.filterButton}
          contentStyle={styles.filterButtonContent}
        >
          {label}: {value}
        </Button>
      }
    >
      <Menu.Item
        title={`All ${label.toLowerCase()}s`}
        onPress={() => {
          setVisible(false);
          onSelect('');
        }}
      />
      {options.map((option) => (
        <Menu.Item
          key={option.value}
          title={option.label}
          onPress={() => {
            setVisible(false);
            onSelect(option.value);
          }}
        />
      ))}
    </Menu>
  );
}

function MetricCard({ label, value, detail, icon }) {
  return (
    <Card style={styles.metricCard}>
      <Card.Content>
        <View style={styles.metricHeader}>
          <Text variant="labelLarge" style={styles.metricLabel}>{label}</Text>
          <Text style={styles.metricIcon}>{icon}</Text>
        </View>
        <Text variant="headlineSmall" style={styles.metricValue}>{value}</Text>
        {detail ? <Text variant="bodySmall" style={styles.metricDetail}>{detail}</Text> : null}
      </Card.Content>
    </Card>
  );
}

function BarChart({ title, subtitle, items, formatValue = (value) => String(value) }) {
  const maxValue = Math.max(...items.map((item) => item.value), 0);
  return (
    <Card style={styles.panel}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.panelTitle}>{title}</Text>
        <Text variant="bodySmall" style={styles.panelSubtitle}>{subtitle}</Text>
        {items.length ? items.map((item, index) => (
          <View key={item.label} style={styles.barItem}>
            <View style={styles.barLabelRow}>
              <Text variant="bodySmall" style={styles.barLabel} numberOfLines={1}>{item.label}</Text>
              <Text variant="labelMedium" style={styles.barValue}>{formatValue(item.value)}</Text>
            </View>
            <View style={styles.barTrack}>
              <View
                style={[
                  styles.barFill,
                  {
                    width: `${maxValue > 0 ? Math.max((item.value / maxValue) * 100, 2) : 0}%`,
                    backgroundColor: CHART_COLORS[index % CHART_COLORS.length],
                  },
                ]}
              />
            </View>
          </View>
        )) : (
          <Text variant="bodyMedium" style={styles.emptyText}>No data for these filters.</Text>
        )}
      </Card.Content>
    </Card>
  );
}

export default function DashboardScreen({ navigation }) {
  const { user } = useAuth();
  const isConductor = user?.role === 'Conductor';
  const isSystemAdmin = user?.role === 'SystemAdmin';
  const [draftDate, setDraftDate] = useState(() => toDateKey(new Date()));
  const [appliedDate, setAppliedDate] = useState(() => toDateKey(new Date()));
  const [serviceFilter, setServiceFilter] = useState('');
  const [busFilter, setBusFilter] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [userCount, setUserCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async () => {
    setError('');
    try {
      let scheduleRequest = Promise.resolve([]);
      if (isConductor || isSystemAdmin) {
        scheduleRequest = fetchBusOptions({ date: appliedDate }).catch((requestError) => {
          if (requestError.response?.status === 404) return [];
          throw requestError;
        });
      }

      const reservationsRequest = isConductor
        ? Promise.resolve([])
        : fetchManagedReservations();
      const usersRequest = isSystemAdmin
        ? fetchManagedUsers()
        : Promise.resolve(null);

      const [scheduleData, reservationData, userData] = await Promise.all([
        scheduleRequest,
        reservationsRequest,
        usersRequest,
      ]);
      setSchedules(scheduleData);
      setReservations(reservationData);
      setUserCount(userData ? userData.length : null);
    } catch (requestError) {
      setSchedules([]);
      setReservations([]);
      setUserCount(null);
      setError(
        requestError.response?.data?.error ||
        (requestError.request
          ? 'Could not reach the server. Check your connection and try again.'
          : requestError.message || 'Could not load dashboard data.')
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [appliedDate, isConductor, isSystemAdmin]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadDashboard();
    const refreshTimer = setInterval(loadDashboard, 30000);
    return () => clearInterval(refreshTimer);
  }, [loadDashboard]));

  const scopedSchedules = useMemo(
    () => schedules.filter((schedule) =>
      (!serviceFilter || serviceKey(schedule) === serviceFilter) &&
      (!busFilter || schedule.busNumber === busFilter)
    ),
    [busFilter, schedules, serviceFilter]
  );
  const scopedReservations = useMemo(
    () => reservations.filter((reservation) =>
      dateKeyFromValue(reservation.departureDate) === appliedDate &&
      (!serviceFilter || serviceKey(reservation) === serviceFilter) &&
      (!busFilter || reservation.busNumber === busFilter)
    ),
    [appliedDate, busFilter, reservations, serviceFilter]
  );

  const serviceOptions = useMemo(() => {
    const options = new Map();
    [...schedules, ...reservations].forEach((item) => {
      const value = serviceKey(item);
      if (value !== '::') options.set(value, formatService(item));
    });
    return [...options].map(([value, label]) => ({ value, label }));
  }, [reservations, schedules]);
  const busOptions = useMemo(() => [...new Set(
    [...schedules, ...reservations].map((item) => item.busNumber).filter(Boolean)
  )].map((number) => ({ value: number, label: number })), [reservations, schedules]);

  const confirmedReservations = scopedReservations.filter(
    (reservation) => reservation.status === 'Confirmed'
  );
  const cancelledCount = scopedReservations.filter(
    (reservation) => reservation.status === 'Cancelled'
  ).length;
  const confirmedValue = confirmedReservations.reduce(
    (total, reservation) => total + Number(reservation.amount || 0),
    0
  );
  const statusChart = [
    { label: 'Confirmed', value: confirmedReservations.length },
    { label: 'Cancelled', value: cancelledCount },
    {
      label: 'Other',
      value: scopedReservations.length - confirmedReservations.length - cancelledCount,
    },
  ].filter((item) => item.value > 0);
  const revenueByService = Object.values(scopedReservations.reduce((groups, reservation) => {
    const label = reservation.operator || reservation.route || 'Other';
    if (!groups[label]) groups[label] = { label, value: 0 };
    if (reservation.status === 'Confirmed') {
      groups[label].value += Number(reservation.amount || 0);
    }
    return groups;
  }, {})).filter((item) => item.value > 0).sort((first, second) => second.value - first.value).slice(0, 5);

  const serviceTripData = isConductor
    ? scopedSchedules
    : scopedSchedules.length
      ? scopedSchedules
      : scopedReservations.map((reservation) => ({
        ...reservation,
        departureDateTime: reservation.departureDate,
        route: reservation.route,
      }));
  const uniqueBuses = new Set(serviceTripData.map((item) => item.busNumber).filter(Boolean)).size;
  const visibleTripCount = isConductor || (isSystemAdmin && scopedSchedules.length)
    ? scopedSchedules.length
    : new Set(scopedReservations.map((reservation) => reservation.scheduleId)).size;

  const refresh = () => {
    setRefreshing(true);
    loadDashboard();
  };

  const applyFilters = () => {
    if (!dateFromKey(draftDate)) {
      setError('Enter a valid date in YYYY-MM-DD format.');
      return;
    }
    if (draftDate < toDateKey(new Date())) {
      setError('Past dates cannot be used for bus service and booking reports.');
      return;
    }
    setError('');
    setAppliedDate(draftDate);
    setLoading(true);
  };

  const resetFilters = () => {
    const today = toDateKey(new Date());
    setDraftDate(today);
    setAppliedDate(today);
    setServiceFilter('');
    setBusFilter('');
    setLoading(true);
  };

  const handleDateChange = (event, date) => {
    setShowDatePicker(false);
    if (!date) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(date);
    selected.setHours(0, 0, 0, 0);
    if (selected < today) {
      setError('Past dates cannot be used for bus service and booking reports.');
      return;
    }
    setError('');
    setDraftDate(toDateKey(selected));
  };

  const bookingRows = [...scopedReservations]
    .sort((first, second) => new Date(second.createdAt) - new Date(first.createdAt))
    .slice(0, 20);
  const scheduleRows = [...scopedSchedules]
    .sort((first, second) => new Date(first.departureDateTime) - new Date(second.departureDateTime))
    .slice(0, 20);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text variant="labelLarge" style={styles.eyebrow}>
              {isSystemAdmin ? 'SYSTEM ADMIN' : isConductor ? 'CONDUCTOR' : 'OPERATOR ADMIN'}
            </Text>
            <Text variant="headlineSmall" style={styles.title}>Operations dashboard</Text>
            <Text variant="bodySmall" style={styles.subtitle}>
              Welcome, {user?.name || 'team member'}
            </Text>
          </View>
          <Button
            mode="outlined"
            icon="refresh"
            onPress={refresh}
            loading={refreshing}
            disabled={loading}
            compact
          >
            Refresh
          </Button>
        </View>

        <Card style={styles.hero}>
          <Card.Content>
            <Text variant="labelLarge" style={styles.heroBadge}>
              {isSystemAdmin ? 'PLATFORM OVERVIEW' : isConductor ? 'SERVICE OVERVIEW' : 'OPERATOR OVERVIEW'}
            </Text>
            <Text variant="titleLarge" style={styles.heroTitle}>
              {isSystemAdmin
                ? 'System operations'
                : isConductor
                  ? 'Scheduled bus services'
                  : 'Your reservation activity'}
            </Text>
            <Text variant="bodyMedium" style={styles.heroDescription}>
              {isConductor
                ? 'This view shows publicly available scheduled services. Conductor-specific assignments, ticket sales, and collections are not currently provided by the API.'
                : 'Dashboard figures are calculated from live schedules and reservation records returned by the API.'}
            </Text>
          </Card.Content>
        </Card>

        <Card style={styles.filterPanel}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.panelTitle}>Operation filters</Text>
            <View style={styles.filterRow}>
              {Platform.OS === 'web' ? (
                <TextInput
                  label="Operation date (YYYY-MM-DD)"
                  mode="outlined"
                  value={draftDate}
                  onChangeText={setDraftDate}
                  autoCapitalize="none"
                  style={styles.dateInput}
                />
              ) : (
                <Button
                  mode="outlined"
                  icon="calendar"
                  onPress={() => setShowDatePicker(true)}
                  style={styles.filterButton}
                >
                  Date: {draftDate}
                </Button>
              )}
              <FilterMenu
                label="Service"
                value={serviceOptions.find((option) => option.value === serviceFilter)?.label || 'All'}
                options={serviceOptions}
                onSelect={setServiceFilter}
                disabled={loading}
              />
              <FilterMenu
                label="Bus"
                value={busFilter || 'All'}
                options={busOptions}
                onSelect={setBusFilter}
                disabled={loading}
              />
            </View>
            <View style={styles.filterActions}>
              <Button mode="contained" onPress={applyFilters} disabled={loading}>Apply filters</Button>
              <Button mode="text" onPress={resetFilters}>Reset</Button>
            </View>
            {showDatePicker && Platform.OS !== 'web' ? (
              <DateTimePicker
                value={dateFromKey(draftDate) || new Date()}
                mode="date"
                display="default"
                minimumDate={new Date()}
                onChange={handleDateChange}
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
            <Text variant="bodyMedium" style={styles.subtitle}>Loading dashboard data…</Text>
          </View>
        ) : (
          <>
            <View style={styles.metrics}>
              <MetricCard
                label={isConductor ? 'Scheduled services' : isSystemAdmin ? 'Scheduled trips' : 'Trips with bookings'}
                value={String(visibleTripCount)}
                detail={`For ${appliedDate}`}
                icon="▤"
              />
              <MetricCard
                label={isConductor ? 'Buses listed' : 'Buses in view'}
                value={String(uniqueBuses)}
                detail="Distinct buses in current data"
                icon="▰"
              />
              {isConductor ? (
                <MetricCard
                  label="Seats available"
                  value={String(scopedSchedules.reduce((total, item) => total + Number(item.seatsLeft || 0), 0))}
                  detail="Across listed services"
                  icon="◉"
                />
              ) : (
                <>
                  <MetricCard
                    label="Confirmed bookings"
                    value={String(confirmedReservations.length)}
                    detail={`${cancelledCount} cancelled`}
                    icon="✓"
                  />
                  <MetricCard
                    label="Confirmed booking value"
                    value={`₹${confirmedValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`}
                    detail="Not a payment-settlement total"
                    icon="₹"
                  />
                </>
              )}
              {isSystemAdmin ? (
                <MetricCard
                  label="Registered users"
                  value={userCount === null ? '—' : String(userCount)}
                  detail="All roles"
                  icon="◎"
                />
              ) : null}
            </View>

            {isConductor ? (
              <Card style={styles.noticeCard}>
                <Card.Content>
                  <Text variant="titleSmall" style={styles.noticeTitle}>Conductor data scope</Text>
                  <Text variant="bodySmall" style={styles.noticeText}>
                    The current system has no conductor-to-trip assignments or ticket-payment records.
                    These service listings are not a personal shift or sales report.
                  </Text>
                </Card.Content>
              </Card>
            ) : (
              <View style={styles.charts}>
                <BarChart
                  title="Bookings by status"
                  subtitle={`Reservations departing ${appliedDate}`}
                  items={statusChart}
                />
                <BarChart
                  title="Confirmed booking value"
                  subtitle="By operator · confirmed reservations only"
                  items={revenueByService}
                  formatValue={(value) => `₹${value.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                />
              </View>
            )}

            <Card style={styles.panel}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.panelTitle}>
                  {isConductor ? 'Scheduled services' : 'Recent reservations'}
                </Text>
                <Text variant="bodySmall" style={styles.panelSubtitle}>
                  {isConductor
                    ? `${scheduleRows.length} service${scheduleRows.length === 1 ? '' : 's'} for ${appliedDate}`
                    : `Up to ${bookingRows.length} reservation${bookingRows.length === 1 ? '' : 's'} for ${appliedDate}`}
                </Text>
                {isConductor ? (
                  scheduleRows.length ? scheduleRows.map((schedule) => (
                    <View key={schedule.scheduleId} style={styles.record}>
                      <View style={styles.recordMain}>
                        <Text variant="titleSmall" style={styles.recordTitle}>{schedule.route}</Text>
                        <Text variant="bodySmall" style={styles.recordSubtitle}>
                          {schedule.operator} · {schedule.busNumber} · {formatDate(schedule.departureDateTime)}
                        </Text>
                      </View>
                      <Text variant="labelMedium" style={styles.recordAmount}>
                        {Number(schedule.seatsLeft || 0)} seats · ₹{Number(schedule.price || 0).toLocaleString('en-IN')}
                      </Text>
                    </View>
                  )) : <Text variant="bodyMedium" style={styles.emptyText}>No scheduled services match these filters.</Text>
                ) : (
                  bookingRows.length ? bookingRows.map((reservation) => (
                    <View key={reservation.id} style={styles.record}>
                      <View style={styles.recordMain}>
                        <Text variant="titleSmall" style={styles.recordTitle}>{reservation.route}</Text>
                        <Text variant="bodySmall" style={styles.recordSubtitle}>
                          {reservation.operator} · {reservation.busNumber} · {formatDate(reservation.departureDate)}
                        </Text>
                        <Text variant="bodySmall" style={styles.recordSubtitle}>
                          PNR {reservation.pnr} · {reservation.seats.length} seat(s)
                        </Text>
                      </View>
                      <View style={styles.recordStatus}>
                        <Text
                          variant="labelSmall"
                          style={reservation.status === 'Confirmed' ? styles.confirmed : styles.cancelled}
                        >
                          {reservation.status}
                        </Text>
                        <Text variant="labelMedium" style={styles.recordAmount}>
                          ₹{Number(reservation.amount || 0).toLocaleString('en-IN')}
                        </Text>
                      </View>
                    </View>
                  )) : <Text variant="bodyMedium" style={styles.emptyText}>No reservations match these filters.</Text>
                )}
              </Card.Content>
            </Card>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F8' },
  content: { padding: 18, paddingBottom: 36, gap: 14 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 10, justifyContent: 'space-between' },
  heading: { flex: 1 },
  eyebrow: { color: '#6750A4', letterSpacing: 1 },
  title: { color: '#1D1B20', fontWeight: '700' },
  subtitle: { color: '#625B71', marginTop: 4 },
  hero: { backgroundColor: '#33235F', borderRadius: 20 },
  heroBadge: { color: '#D9C9FF', letterSpacing: 1 },
  heroTitle: { color: '#FFFFFF', fontWeight: '700', marginTop: 8 },
  heroDescription: { color: '#EEE8FF', marginTop: 6 },
  filterPanel: { backgroundColor: '#FFFBFE', borderRadius: 18 },
  panel: { backgroundColor: '#FFFBFE', borderRadius: 18 },
  panelTitle: { color: '#1D1B20', fontWeight: '700' },
  panelSubtitle: { color: '#625B71', marginTop: 3, marginBottom: 12 },
  filterRow: { gap: 8, marginTop: 10 },
  filterButton: { alignSelf: 'stretch' },
  filterButtonContent: { justifyContent: 'space-between' },
  dateInput: { marginBottom: 4 },
  filterActions: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 8 },
  errorCard: { backgroundColor: '#FCE8E6' },
  errorText: { color: '#B3261E' },
  loading: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  metrics: { gap: 10 },
  metricCard: { backgroundColor: '#FFFBFE', borderRadius: 16 },
  metricHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  metricLabel: { color: '#625B71', flex: 1 },
  metricIcon: { color: '#6750A4', fontSize: 19, fontWeight: '700' },
  metricValue: { color: '#1D1B20', fontWeight: '700', marginTop: 4 },
  metricDetail: { color: '#79747E', marginTop: 2 },
  charts: { gap: 12 },
  barItem: { marginTop: 12 },
  barLabelRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  barLabel: { color: '#49454F', flex: 1 },
  barValue: { color: '#1D1B20' },
  barTrack: { backgroundColor: '#EEEAF4', borderRadius: 5, height: 8, marginTop: 5, overflow: 'hidden' },
  barFill: { borderRadius: 5, height: '100%' },
  emptyText: { color: '#79747E', marginTop: 10 },
  noticeCard: { backgroundColor: '#FFF4D6', borderRadius: 16 },
  noticeTitle: { color: '#704D00', fontWeight: '700' },
  noticeText: { color: '#604E23', marginTop: 4 },
  record: {
    alignItems: 'flex-start',
    borderTopColor: '#E7E0EC',
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
  },
  recordMain: { flex: 1 },
  recordTitle: { color: '#1D1B20', fontWeight: '700' },
  recordSubtitle: { color: '#625B71', marginTop: 4 },
  recordStatus: { alignItems: 'flex-end' },
  recordAmount: { color: '#1D1B20', marginTop: 5 },
  confirmed: { backgroundColor: '#DCFCE7', borderRadius: 10, color: '#166534', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
  cancelled: { backgroundColor: '#F3F4F6', borderRadius: 10, color: '#6B7280', overflow: 'hidden', paddingHorizontal: 8, paddingVertical: 4 },
});
