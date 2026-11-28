import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Button, Card, IconButton, SegmentedButtons, Text } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import BusTripDetailsView from './BusTripDetailsView';
import { fetchScheduleDetails, fetchScheduleSeats } from '../services/api';

const PASSENGER_GENDERS = [
  { value: 'Female', label: 'Female' },
  { value: 'Male', label: 'Male' },
  { value: 'Other', label: 'Other' },
];

const STATUS_STYLES = {
  AVAIL: { backgroundColor: '#ECFDF5', borderColor: '#10B981', color: '#047857', label: 'Available' },
  BOOKED: { backgroundColor: '#E5E7EB', borderColor: '#9CA3AF', color: '#6B7280', label: 'Booked' },
  F_AVAIL: { backgroundColor: '#FCE7F3', borderColor: '#EC4899', color: '#BE185D', label: 'Female only' },
  F_BOOKED: { backgroundColor: '#BE185D', borderColor: '#9D174D', color: '#FFFFFF', label: 'Female passenger' },
  M_AVAIL: { backgroundColor: '#DBEAFE', borderColor: '#3B82F6', color: '#1D4ED8', label: 'Male only' },
  M_BOOKED: { backgroundColor: '#1D4ED8', borderColor: '#1E40AF', color: '#FFFFFF', label: 'Male passenger' },
};

function Seat({ seat, selected, passengerGender, onPress, readOnly }) {
  const style = STATUS_STYLES[seat.status] || STATUS_STYLES.BOOKED;
  const isReservedForOtherGender =
    (seat.status === 'F_AVAIL' && passengerGender !== 'Female') ||
    (seat.status === 'M_AVAIL' && passengerGender !== 'Male');
  const disabled = (seat.status !== 'AVAIL' && seat.status !== 'F_AVAIL' && seat.status !== 'M_AVAIL') ||
    isReservedForOtherGender;
  const selectedStyle = selected
    ? { backgroundColor: '#F59E0B', borderColor: '#D97706', color: '#FFFFFF' }
    : style;

  return (
    <Pressable
      accessibilityRole={readOnly ? 'text' : 'button'}
      accessibilityLabel={`Seat ${seat.seatNumber}, ${selected ? 'selected' : style.label}`}
      accessibilityState={{ selected, disabled }}
      disabled={readOnly || (disabled && !selected)}
      onPress={onPress}
      style={[
        styles.seat,
        {
          backgroundColor: selectedStyle.backgroundColor,
          borderColor: selectedStyle.borderColor,
          opacity: disabled && !selected ? 0.72 : 1,
        },
      ]}
    >
      <MaterialCommunityIcons
        name={selected ? 'check' : 'seat-recline-extra'}
        size={15}
        color={selectedStyle.color}
      />
      <Text style={[styles.seatNumber, { color: selectedStyle.color }]}>{seat.seatNumber}</Text>
    </Pressable>
  );
}

export default function SeatSelectionScreen({ navigation, route }) {
  const { selectedBus, travelDate, readOnly = false } = route.params || {};
  const [seatMap, setSeatMap] = useState(null);
  const [selectedSeatIds, setSelectedSeatIds] = useState(() => new Set());
  const [passengerGender, setPassengerGender] = useState('Female');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [availabilityNotice, setAvailabilityNotice] = useState('');
  const requestInFlight = useRef(false);
  const [tripDetails, setTripDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(true);
  const [detailsError, setDetailsError] = useState('');
  const [activeView, setActiveView] = useState('seats');
  const [selectedBoardingPoint, setSelectedBoardingPoint] = useState(null);
  const [selectedDroppingPoint, setSelectedDroppingPoint] = useState(null);

  const loadTripDetails = useCallback(async () => {
    setDetailsLoading(true);
    setDetailsError('');
    try {
      const details = await fetchScheduleDetails(selectedBus?.scheduleId);
      setTripDetails(details);
      setSelectedBoardingPoint((current) => current || details.route.stops[0] || null);
      setSelectedDroppingPoint((current) =>
        current || details.route.stops[details.route.stops.length - 1] || null
      );
    } catch (requestError) {
      setDetailsError(
        requestError.response?.data?.error ||
        requestError.message ||
        'Could not load bus and route details.'
      );
    } finally {
      setDetailsLoading(false);
    }
  }, [selectedBus?.scheduleId]);

  const loadSeatMap = useCallback(async (initialLoad = false) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    if (initialLoad) setLoading(true);
    try {
      const result = await fetchScheduleSeats(selectedBus?.scheduleId);
      setSeatMap(result);
      setError('');
      setAvailabilityNotice('');
    } catch (requestError) {
      const message =
        requestError.response?.data?.error ||
        requestError.message ||
        'Could not load live seat availability. Please try again.';
      if (initialLoad) setError(message);
      else setAvailabilityNotice(`Live seat availability could not be refreshed: ${message}`);
    } finally {
      if (initialLoad) setLoading(false);
      requestInFlight.current = false;
    }
  }, [selectedBus?.scheduleId]);

  useEffect(() => {
    setSelectedSeatIds(new Set());
    setAvailabilityNotice('');
    setError('');
    setTripDetails(null);
    setSelectedBoardingPoint(null);
    setSelectedDroppingPoint(null);
    loadTripDetails();
    loadSeatMap(true);
    const refreshTimer = setInterval(() => loadSeatMap(), 5000);
    return () => clearInterval(refreshTimer);
  }, [loadSeatMap, loadTripDetails]);

  useEffect(() => {
    if (!seatMap) return;
    const availableSeatIds = new Set(
      seatMap.rows
        .flatMap((row) => [...row.leftSeats, ...row.rightSeats])
        .filter((seat) => ['AVAIL', 'F_AVAIL', 'M_AVAIL'].includes(seat.status))
        .map((seat) => seat.seatId)
    );
    const unavailableSelection = [...selectedSeatIds].some((seatId) => !availableSeatIds.has(seatId));
    if (unavailableSelection) {
      setAvailabilityNotice('A selected seat was reserved by another passenger and has been removed.');
      setSelectedSeatIds((current) => new Set([...current].filter((seatId) => availableSeatIds.has(seatId))));
    }
  }, [seatMap, selectedSeatIds]);

  const selectedSeats = seatMap?.rows
    ?.flatMap((row) => [...row.leftSeats, ...row.rightSeats])
    .filter((seat) => selectedSeatIds.has(seat.seatId)) || [];
  const baseFare = Number(seatMap?.price ?? selectedBus?.price ?? 0);
  const taxRate = Number(seatMap?.taxRate ?? 0);
  const subtotal = baseFare * selectedSeats.length;
  const taxAmount = Math.round(subtotal * taxRate) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;

  const toggleSeat = (seat) => {
    setSelectedSeatIds((current) => {
      const next = new Set(current);
      if (next.has(seat.seatId)) {
        next.delete(seat.seatId);
      } else {
        next.add(seat.seatId);
      }
      return next;
    });
  };

  const proceedToSummary = () => {
    if (selectedSeats.length === 0) return;
    const departureDateTime = selectedBus?.departureDateTime;
    if (departureDateTime && new Date(departureDateTime).getTime() <= Date.now()) {
      setError('Booking is closed because this bus has already departed.');
      return;
    }
    navigation.navigate('BookingSummary', {
      selectedBus,
      travelDate,
      passengers: selectedSeats.map((seat) => ({
        seatId: seat.seatId,
        seatNumber: seat.seatNumber,
        passengerGender,
        status: seat.status,
      })),
      boardingPoint: selectedBoardingPoint,
      droppingPoint: selectedDroppingPoint,
      tripDetails,
      price: baseFare,
      taxRate,
    });
  };

  const handleContinue = () => {
    if (selectedSeats.length === 0) {
      setActiveView('seats');
      return;
    }
    proceedToSummary();
  };

  const renderSeat = (seat) => (
    <Seat
      key={seat.seatId}
      seat={seat}
      selected={selectedSeatIds.has(seat.seatId)}
      passengerGender={passengerGender}
      readOnly={readOnly}
      onPress={() => toggleSeat(seat)}
    />
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            mode="contained-tonal"
            onPress={() => navigation.goBack()}
            accessibilityLabel={readOnly ? 'Back to reservations' : 'Back to buses'}
          />
          <View style={styles.headerText}>
            <Text variant="labelLarge" style={styles.eyebrow}>
              {readOnly ? 'MANAGEMENT VIEW' : 'STEP 1 OF 2'}
            </Text>
            <Text variant="headlineSmall" style={styles.title}>
              {readOnly
                ? (activeView === 'seats' ? 'Seat occupancy' : 'Bus & trip details')
                : (activeView === 'seats' ? 'Choose your seats' : 'Bus & trip details')}
            </Text>
          </View>
        </View>

        <Card style={styles.tripCard} mode="contained">
          <Card.Content>
            <Text variant="titleMedium" style={styles.operator}>{selectedBus?.operator || 'Scheduled bus'}</Text>
            <Text variant="bodyMedium" style={styles.tripText}>
              {selectedBus?.route || 'Your selected journey'}
            </Text>
            <Text variant="bodySmall" style={styles.tripText}>
              {selectedBus?.departure || '--:--'} · {selectedBus?.type || 'Bus'}
            </Text>
          </Card.Content>
        </Card>

        {activeView === 'details' ? (
          <BusTripDetailsView
            details={tripDetails}
            loading={detailsLoading}
            error={detailsError}
            onRetry={loadTripDetails}
            selectedBoardingPoint={selectedBoardingPoint}
            selectedDroppingPoint={selectedDroppingPoint}
            onSelectBoardingPoint={(stop) => {
              setSelectedBoardingPoint(stop);
              const boardingIndex = tripDetails.route.stops.findIndex((item) => item.stopId === stop.stopId);
              const droppingIndex = tripDetails.route.stops.findIndex((item) => item.stopId === selectedDroppingPoint?.stopId);
              if (droppingIndex <= boardingIndex) {
                setSelectedDroppingPoint(tripDetails.route.stops[boardingIndex + 1] || null);
              }
            }}
            onSelectDroppingPoint={setSelectedDroppingPoint}
          />
        ) : (
          <>
        {!readOnly ? <Card style={styles.selectionCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.sectionTitle}>Passenger eligibility</Text>
            <Text variant="bodySmall" style={styles.muted}>
              Reserved seats are selectable only for passengers matching their gender.
            </Text>
            <SegmentedButtons
              value={passengerGender}
              onValueChange={setPassengerGender}
              buttons={PASSENGER_GENDERS}
              style={styles.genderButtons}
            />
          </Card.Content>
        </Card> : (
          <Text variant="bodySmall" style={styles.muted}>
            Read-only occupancy · Live availability refreshes every 5 seconds.
          </Text>
        )}

        {loading ? (
          <View style={styles.status}>
            <ActivityIndicator size="large" color="#6750A4" />
            <Text variant="bodyMedium" style={styles.muted}>Loading live seat availability…</Text>
          </View>
        ) : error ? (
          <Card style={styles.messageCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.sectionTitle}>Seat map unavailable</Text>
              <Text variant="bodyMedium" style={styles.errorText}>{error}</Text>
            </Card.Content>
            <Card.Actions>
              <Button
                mode="contained"
                onPress={() => navigation.replace('SeatSelection', { selectedBus, travelDate, readOnly })}
              >
                Try again
              </Button>
            </Card.Actions>
          </Card>
        ) : (
          <>
            {availabilityNotice ? (
              <Text accessibilityRole="alert" style={styles.errorText}>{availabilityNotice}</Text>
            ) : null}
            <Card style={styles.mapCard}>
              <Card.Content>
                <View style={[
                  styles.driverRow,
                  seatMap.driverSide === 'left' ? styles.driverLeft : styles.driverRight,
                ]}>
                  <View style={styles.driverBadge}>
                    <MaterialCommunityIcons name="steering" size={18} color="#6750A4" />
                    <Text variant="labelSmall" style={styles.driverText}>Driver</Text>
                  </View>
                </View>
                <View style={styles.frontPartition} />
                <View style={styles.frontLabel}>
                  <Text variant="labelSmall" style={styles.muted}>FRONT OF BUS</Text>
                </View>
                {seatMap.rows.map((row) => (
                  <View key={row.rowNumber} style={styles.seatRow}>
                    <Text style={styles.rowNumber}>{row.rowNumber}</Text>
                    <View style={styles.seatGroup}>{row.leftSeats.map(renderSeat)}</View>
                    <View style={styles.aisle} />
                    <View style={styles.seatGroup}>{row.rightSeats.map(renderSeat)}</View>
                  </View>
                ))}
              </Card.Content>
            </Card>

            <View style={styles.legend}>
              {['AVAIL', 'BOOKED', 'F_AVAIL', 'F_BOOKED', 'M_AVAIL', 'M_BOOKED', ...(readOnly ? [] : ['SELECTED'])].map((status) => {
                const style = status === 'SELECTED'
                  ? { backgroundColor: '#F59E0B', borderColor: '#D97706', color: '#FFFFFF' }
                  : STATUS_STYLES[status];
                const label = status === 'SELECTED' ? 'Selected' : STATUS_STYLES[status].label;
                return (
                  <View key={status} style={styles.legendItem}>
                    <View style={[styles.legendSwatch, { backgroundColor: style.backgroundColor, borderColor: style.borderColor }]} />
                    <Text variant="labelSmall" style={styles.muted}>{label}</Text>
                  </View>
                );
              })}
            </View>

            {!readOnly ? <Card style={styles.fareCard}>
              <Card.Content>
                <View style={styles.fareLine}>
                  <Text style={styles.fareLabel}>Seats · {selectedSeats.map((seat) => seat.seatNumber).join(', ') || 'None selected'}</Text>
                  <Text style={styles.fareValue}>₹{subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.fareLine}>
                  <Text style={styles.fareLabel}>Tax ({taxRate}%)</Text>
                  <Text style={styles.fareValue}>₹{taxAmount.toFixed(2)}</Text>
                </View>
                <View style={[styles.fareLine, styles.totalLine]}>
                  <Text style={styles.totalLabel}>Total</Text>
                  <Text style={styles.totalValue}>₹{total.toFixed(2)}</Text>
                </View>
              </Card.Content>
            </Card> : null}
          </>
        )}

          </>
        )}
      </ScrollView>
      <View style={styles.bottomNavigation}>
        <View style={styles.tabBar}>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeView === 'seats' }}
            onPress={() => setActiveView('seats')}
            style={[styles.tab, activeView === 'seats' && styles.activeTab]}
          >
            <MaterialCommunityIcons
              name="seat-recline-extra"
              size={20}
              color={activeView === 'seats' ? '#6750A4' : '#79747E'}
            />
            <Text style={[styles.tabLabel, activeView === 'seats' && styles.activeTabLabel]}>
              {readOnly
                ? 'Seat occupancy'
                : `Seat selection${selectedSeats.length ? ` · ${selectedSeats.length}` : ''}`}
            </Text>
          </Pressable>
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected: activeView === 'details' }}
            onPress={() => setActiveView('details')}
            style={[styles.tab, activeView === 'details' && styles.activeTab]}
          >
            <MaterialCommunityIcons
              name="bus-info"
              size={20}
              color={activeView === 'details' ? '#6750A4' : '#79747E'}
            />
            <Text style={[styles.tabLabel, activeView === 'details' && styles.activeTabLabel]}>
              Bus details
            </Text>
          </Pressable>
        </View>
        {readOnly ? (
          <Button
            mode="outlined"
            icon="arrow-left"
            contentStyle={styles.continueContent}
            onPress={() => navigation.goBack()}
            style={styles.continueButton}
          >
            Back to reservations
          </Button>
        ) : (
          <Button
            mode="contained"
            icon={selectedSeats.length ? 'arrow-right' : 'seat'}
            contentStyle={styles.continueContent}
            onPress={handleContinue}
            disabled={activeView === 'seats' && (loading || Boolean(error))}
            style={styles.continueButton}
          >
            {selectedSeats.length ? 'Proceed to booking summary' : 'Choose seats to continue'}
          </Button>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F8' },
  scroll: { flex: 1 },
  content: { padding: 18, paddingBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerText: { flex: 1 },
  eyebrow: { color: '#6750A4', letterSpacing: 1 },
  title: { color: '#1D1B20', fontWeight: '700' },
  tripCard: { backgroundColor: '#6750A4', borderRadius: 20, marginBottom: 14 },
  operator: { color: '#FFFFFF', fontWeight: '700' },
  tripText: { color: '#F1ECFA', marginTop: 4 },
  selectionCard: { backgroundColor: '#FFFBFE', borderRadius: 18, marginBottom: 14 },
  sectionTitle: { color: '#1D1B20', fontWeight: '700' },
  muted: { color: '#625B71', marginTop: 4 },
  genderButtons: { marginTop: 14 },
  status: { alignItems: 'center', gap: 12, paddingVertical: 36 },
  messageCard: { backgroundColor: '#FFFBFE', borderRadius: 18, marginBottom: 14 },
  errorText: { color: '#B3261E', marginTop: 8 },
  mapCard: { backgroundColor: '#FFFBFE', borderRadius: 20, marginBottom: 12 },
  driverRow: { flexDirection: 'row', marginBottom: 10 },
  driverLeft: { justifyContent: 'flex-start' },
  driverRight: { justifyContent: 'flex-end' },
  driverBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, padding: 7, borderRadius: 12, backgroundColor: '#EADDFF' },
  driverText: { color: '#4F378B', fontWeight: '700' },
  frontPartition: { height: 4, borderRadius: 3, backgroundColor: '#D8D2E3' },
  frontLabel: { alignItems: 'center', marginVertical: 8 },
  seatRow: { flexDirection: 'row', alignItems: 'center', minHeight: 56, paddingVertical: 4 },
  rowNumber: { width: 20, color: '#79747E', fontSize: 11, textAlign: 'center' },
  seatGroup: { flex: 1, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  aisle: { width: 18 },
  seat: { flex: 1, minWidth: 34, maxWidth: 52, height: 46, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderRadius: 10 },
  seatNumber: { fontSize: 9, fontWeight: '700', marginTop: 1 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendSwatch: { width: 14, height: 14, borderWidth: 1, borderRadius: 4 },
  fareCard: { backgroundColor: '#FFFBFE', borderRadius: 18, marginBottom: 16 },
  fareLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  fareLabel: { flex: 1, color: '#49454F', paddingRight: 10 },
  fareValue: { color: '#1D1B20', fontWeight: '600' },
  totalLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D8D2E3', marginTop: 8, paddingTop: 12 },
  totalLabel: { color: '#1D1B20', fontSize: 17, fontWeight: '700' },
  totalValue: { color: '#6750A4', fontSize: 18, fontWeight: '700' },
  continueContent: { minHeight: 50 },
  bottomNavigation: { backgroundColor: '#FFFBFE', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D8D2E3', paddingHorizontal: 14, paddingTop: 8, paddingBottom: 8 },
  tabBar: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  tab: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, borderRadius: 14, backgroundColor: '#F3F0F8' },
  activeTab: { backgroundColor: '#EADDFF' },
  tabLabel: { color: '#625B71', fontSize: 12, fontWeight: '600' },
  activeTabLabel: { color: '#4F378B' },
  continueButton: { borderRadius: 14 },
});
