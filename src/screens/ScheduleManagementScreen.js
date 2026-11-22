import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, IconButton, Menu, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import {
  cancelManagedSchedule,
  createManagedSchedule,
  fetchManagedSchedules,
  updateManagedSchedule,
} from '../services/api';

function toLocalInput(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return '';
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function dateFromLocalInput(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTime(value) {
  const date = dateFromLocalInput(value);
  if (!date) return 'Select date and time';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function replaceDateKeepingTime(value, pickedDate) {
  const current = dateFromLocalInput(value);
  if (!current) return toLocalInput(pickedDate);
  const combined = new Date(pickedDate);
  combined.setHours(current.getHours(), current.getMinutes(), 0, 0);
  return toLocalInput(combined);
}

function replaceTimeKeepingDate(value, pickedTime) {
  const current = dateFromLocalInput(value);
  if (!current) return toLocalInput(pickedTime);
  const combined = new Date(current);
  combined.setHours(pickedTime.getHours(), pickedTime.getMinutes(), 0, 0);
  return toLocalInput(combined);
}

function getError(error, fallback) {
  return error.response?.data?.error || error.message || fallback;
}

export default function ScheduleManagementScreen({ navigation }) {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [buses, setBuses] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [routeId, setRouteId] = useState(null);
  const [busId, setBusId] = useState(null);
  const [departure, setDeparture] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
  const [arrival, setArrival] = useState(() => toLocalInput(new Date(Date.now() + 5 * 60 * 60 * 1000)));
  const [baseFare, setBaseFare] = useState('750');
  const [statusFilter, setStatusFilter] = useState('');
  const [routeMenuVisible, setRouteMenuVisible] = useState(false);
  const [busMenuVisible, setBusMenuVisible] = useState(false);
  const [departurePickerMode, setDeparturePickerMode] = useState(null);
  const [arrivalPickerMode, setArrivalPickerMode] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const loadSchedules = useCallback(async (showLoader = true) => {
    if (showLoader) setLoading(true);
    setError('');
    try {
      const data = await fetchManagedSchedules();
      setSchedules(data.schedules);
      setRoutes(data.routes);
      setBuses(data.buses);
    } catch (requestError) {
      setError(getError(requestError, 'Could not load journeys.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadSchedules();
  }, [loadSchedules]));

  const resetForm = () => {
    setEditingId(null);
    setRouteId(null);
    setBusId(null);
    setDeparture(toLocalInput(new Date(Date.now() + 60 * 60 * 1000)));
    setArrival(toLocalInput(new Date(Date.now() + 5 * 60 * 60 * 1000)));
    setBaseFare('750');
  };

  const editSchedule = (schedule) => {
    setEditingId(schedule.scheduleId);
    setRouteId(schedule.routeId);
    setBusId(schedule.busId);
    setDeparture(toLocalInput(schedule.departureDateTime));
    setArrival(toLocalInput(schedule.arrivalDateTime));
    setBaseFare(String(Number(schedule.baseFare)));
    setMessage('');
  };

  const handleDepartureChange = (event, date) => {
    if (!date) {
      setDeparturePickerMode(null);
      return;
    }
    if (departurePickerMode === 'date') {
      setDeparture((current) => replaceDateKeepingTime(current, date));
      setDeparturePickerMode('time');
    } else {
      setDeparture((current) => replaceTimeKeepingDate(current, date));
      setDeparturePickerMode(null);
    }
  };

  const handleArrivalChange = (event, date) => {
    if (!date) {
      setArrivalPickerMode(null);
      return;
    }
    if (arrivalPickerMode === 'date') {
      setArrival((current) => replaceDateKeepingTime(current, date));
      setArrivalPickerMode('time');
    } else {
      setArrival((current) => replaceTimeKeepingDate(current, date));
      setArrivalPickerMode(null);
    }
  };

  const handleBaseFareChange = (value) => {
    if (/^\d*$/.test(value)) setBaseFare(value);
  };

  const submitSchedule = async (payload) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      if (editingId) await updateManagedSchedule(editingId, payload);
      else await createManagedSchedule(payload);
      setMessage(editingId ? 'Journey updated.' : 'Journey scheduled.');
      resetForm();
      await loadSchedules(false);
    } catch (requestError) {
      setError(getError(requestError, 'Could not save the journey.'));
    } finally {
      setSaving(false);
    }
  };

  const reviewAndSaveSchedule = () => {
    setError('');
    setMessage('');
    const fare = Number(baseFare);
    if (!routeId || !busId || !departure || !arrival) {
      setError('Select a route and bus, then enter departure and arrival times.');
      return;
    }
    if (!baseFare.trim() || !Number.isSafeInteger(fare) || fare < 0) {
      setError('Enter a non-negative whole-number base fare.');
      return;
    }
    const departureDate = new Date(departure);
    const arrivalDate = new Date(arrival);
    if (Number.isNaN(departureDate.getTime()) || Number.isNaN(arrivalDate.getTime())) {
      setError('Enter valid departure and arrival date/time values.');
      return;
    }
    if (departureDate <= new Date()) {
      setError('Journey departure must be in the future.');
      return;
    }
    if (arrivalDate <= departureDate) {
      setError('Arrival time must be after departure time.');
      return;
    }

    const payload = {
      routeId,
      busId,
      departureDateTime: departureDate.toISOString(),
      arrivalDateTime: arrivalDate.toISOString(),
      baseFare: fare,
    };
    const summary = [
      `Route: ${selectedRoute?.routeCode || routeId} · ${selectedRoute?.origin || ''} → ${selectedRoute?.destination || ''}`,
      `Bus: ${selectedBus?.busNumber || busId}${selectedBus?.operatorName ? ` · ${selectedBus.operatorName}` : ''}`,
      `Departure: ${formatDateTime(departure)}`,
      `Arrival: ${formatDateTime(arrival)}`,
      `Base fare: ₹${fare}`,
    ].join('\n');
    Alert.alert(
      editingId ? 'Confirm journey update?' : 'Confirm journey schedule?',
      summary,
      [
        { text: 'Back', style: 'cancel' },
        { text: editingId ? 'Update journey' : 'Submit journey', onPress: () => submitSchedule(payload) },
      ]
    );
  };

  const cancelSchedule = (schedule) => {
    Alert.alert(
      'Cancel journey?',
      `${schedule.routeCode} on bus ${schedule.busNumber} will no longer be bookable.`,
      [
        { text: 'Keep', style: 'cancel' },
        {
          text: 'Cancel journey',
          style: 'destructive',
          onPress: async () => {
            setSaving(true);
            try {
              await cancelManagedSchedule(schedule.scheduleId);
              setMessage('Journey cancelled.');
              await loadSchedules(false);
            } catch (requestError) {
              setError(getError(requestError, 'Could not cancel the journey.'));
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const selectedRoute = routes.find((route) => route.routeId === routeId);
  const selectedBus = buses.find((bus) => bus.busId === busId);
  const filteredSchedules = useMemo(() => schedules.filter((schedule) =>
    !statusFilter || schedule.scheduleStatus === statusFilter
  ), [schedules, statusFilter]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <IconButton icon="arrow-left" mode="contained-tonal" onPress={() => navigation.goBack()} />
          <View style={styles.heading}>
            <Text variant="labelLarge" style={styles.eyebrow}>
              {user?.role === 'SystemAdmin' ? 'SYSTEM ADMIN' : 'BUS OPERATOR'}
            </Text>
            <Text variant="headlineSmall" style={styles.title}>Manage journeys</Text>
          </View>
          <IconButton icon="refresh" onPress={() => loadSchedules()} disabled={loading || saving} />
        </View>

        {error ? <Card style={styles.errorCard}><Card.Content><Text style={styles.errorText}>{error}</Text></Card.Content></Card> : null}
        {message ? <Card style={styles.messageCard}><Card.Content><Text style={styles.messageText}>{message}</Text></Card.Content></Card> : null}

        <Card style={styles.formCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>{editingId ? 'Edit journey' : 'Schedule journey'}</Text>
            <Menu visible={routeMenuVisible} onDismiss={() => setRouteMenuVisible(false)}
              anchor={<Button mode="outlined" icon="chevron-down" onPress={() => setRouteMenuVisible(true)}
                style={styles.fieldButton} disabled={!routes.length}>
                {selectedRoute ? `${selectedRoute.routeCode} · ${selectedRoute.origin} → ${selectedRoute.destination}` : 'Select route'}
              </Button>}>
              {routes.map((route) => (
                <Menu.Item key={route.routeId} title={`${route.routeCode} · ${route.origin} → ${route.destination}`}
                  onPress={() => { setRouteId(route.routeId); setRouteMenuVisible(false); }} />
              ))}
            </Menu>
            <Menu visible={busMenuVisible} onDismiss={() => setBusMenuVisible(false)}
              anchor={<Button mode="outlined" icon="chevron-down" onPress={() => setBusMenuVisible(true)}
                style={styles.fieldButton} disabled={!buses.length}>
                {selectedBus ? `${selectedBus.busNumber} · ${selectedBus.operatorName}` : 'Select Bus Operator'}
              </Button>}>
              {buses.map((bus) => (
                <Menu.Item key={bus.busId} title={`${bus.busNumber} · ${bus.operatorName} · ${bus.busType}`}
                  onPress={() => { setBusId(bus.busId); setBusMenuVisible(false); }} />
              ))}
            </Menu>
            <Button
              mode="outlined"
              icon="calendar-clock"
              onPress={() => setDeparturePickerMode('date')}
              style={styles.fieldButton}
              contentStyle={styles.dateButtonContent}
            >
              Departure: {formatDateTime(departure)}
            </Button>
            {departurePickerMode ? (
              <DateTimePicker
                value={dateFromLocalInput(departure) || new Date()}
                mode={departurePickerMode}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={new Date()}
                onChange={handleDepartureChange}
              />
            ) : null}
            <Button
              mode="outlined"
              icon="calendar-clock"
              onPress={() => setArrivalPickerMode('date')}
              style={styles.fieldButton}
              contentStyle={styles.dateButtonContent}
            >
              Arrival: {formatDateTime(arrival)}
            </Button>
            {arrivalPickerMode ? (
              <DateTimePicker
                value={dateFromLocalInput(arrival) || dateFromLocalInput(departure) || new Date()}
                mode={arrivalPickerMode}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                minimumDate={dateFromLocalInput(departure) || new Date()}
                onChange={handleArrivalChange}
              />
            ) : null}
            <TextInput label="Base fare (whole number)" value={baseFare} onChangeText={handleBaseFareChange}
              keyboardType="number-pad" mode="outlined" style={styles.input} />
            <View style={styles.formActions}>
              {editingId ? <Button mode="outlined" onPress={resetForm} disabled={saving}>Cancel</Button> : null}
              <Button mode="contained" onPress={reviewAndSaveSchedule} loading={saving} disabled={saving || loading}>
                {editingId ? 'Save journey' : 'Schedule journey'}
              </Button>
            </View>
          </Card.Content>
        </Card>

        <View style={styles.statusFilters}>
          {['', 'Scheduled', 'InTransit', 'Completed', 'Cancelled'].map((status) => (
            <Button key={status || 'ALL'} mode={statusFilter === status ? 'contained' : 'outlined'}
              onPress={() => setStatusFilter(status)} compact>
              {status || 'All'}
            </Button>
          ))}
        </View>

        <Text variant="titleLarge" style={styles.listTitle}>Journey records</Text>
        {loading ? <ActivityIndicator size="large" color="#6750A4" style={styles.loader} /> :
          filteredSchedules.length === 0 ? (
            <Card style={styles.emptyCard}><Card.Content><Text>No journeys match this status.</Text></Card.Content></Card>
          ) : filteredSchedules.map((schedule) => (
            <Card key={schedule.scheduleId} style={styles.scheduleCard}>
              <Card.Content>
                <View style={styles.scheduleHeader}>
                  <View style={styles.scheduleCopy}>
                    <Text variant="titleMedium" style={styles.routeName}>{schedule.origin} → {schedule.destination}</Text>
                    <Text variant="bodySmall" style={styles.detail}>{schedule.routeCode} · {schedule.routeName}</Text>
                  </View>
                  <Text variant="labelMedium" style={[styles.status, schedule.scheduleStatus === 'Cancelled' ? styles.cancelled : styles.active]}>
                    {schedule.scheduleStatus}
                  </Text>
                </View>
                <Text variant="bodyMedium" style={styles.detail}>
                  Bus {schedule.busNumber} · {schedule.operatorName}
                </Text>
                <Text variant="bodySmall" style={styles.detail}>
                  Departure: {new Date(schedule.departureDateTime).toLocaleString('en-IN')}
                </Text>
                <Text variant="bodySmall" style={styles.detail}>
                  Arrival: {new Date(schedule.arrivalDateTime).toLocaleString('en-IN')} · Fare ₹{Number(schedule.baseFare)}
                </Text>
                {schedule.scheduleStatus === 'Scheduled' ? (
                  <View style={styles.scheduleActions}>
                    <Button mode="outlined" icon="pencil-outline" onPress={() => editSchedule(schedule)}>Edit</Button>
                    <Button mode="text" textColor="#B3261E" onPress={() => cancelSchedule(schedule)}>Cancel</Button>
                  </View>
                ) : null}
              </Card.Content>
            </Card>
          ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F8' },
  content: { padding: 18, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  heading: { flex: 1 },
  eyebrow: { color: '#6750A4', letterSpacing: 1 },
  title: { color: '#1D1B20', fontWeight: '700' },
  formCard: { backgroundColor: '#FFFBFE', borderRadius: 18, marginBottom: 12 },
  sectionTitle: { color: '#1D1B20', fontWeight: '700', marginBottom: 10 },
  fieldButton: { marginBottom: 10 },
  dateButtonContent: { minHeight: 44, justifyContent: 'flex-start' },
  input: { backgroundColor: '#FFFBFE', marginBottom: 10 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  statusFilters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  listTitle: { color: '#1D1B20', fontWeight: '700', marginVertical: 12 },
  loader: { marginVertical: 30 },
  emptyCard: { backgroundColor: '#FFFBFE', borderRadius: 16 },
  scheduleCard: { backgroundColor: '#FFFBFE', borderRadius: 18, marginBottom: 12 },
  scheduleHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  scheduleCopy: { flex: 1 },
  routeName: { color: '#1D1B20', fontWeight: '700' },
  detail: { color: '#625B71', marginTop: 5 },
  status: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, overflow: 'hidden' },
  active: { backgroundColor: '#DCFCE7', color: '#166534' },
  cancelled: { backgroundColor: '#F3F4F6', color: '#6B7280' },
  scheduleActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  errorCard: { backgroundColor: '#FCE8E6', marginBottom: 12 },
  errorText: { color: '#B3261E' },
  messageCard: { backgroundColor: '#DDF7E3', marginBottom: 12 },
  messageText: { color: '#166534' },
});
