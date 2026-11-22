import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import {
  Button,
  Card,
  IconButton,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { createBookingApi, fetchScheduleSeats } from '../services/api';

const GENDERS = [
  { value: 'Female', label: 'Female' },
  { value: 'Male', label: 'Male' },
  { value: 'Other', label: 'Other' },
];

export default function BookingSummaryScreen({ navigation, route }) {
  const { user } = useAuth();
  const {
    selectedBus,
    passengers: selectedSeats = [],
    boardingPoint,
    droppingPoint,
    tripDetails,
    price = selectedBus?.price || 0,
    taxRate = 0,
  } = route.params || {};
  const [passengers, setPassengers] = useState(() => selectedSeats.map((seat) => ({
    ...seat,
    passengerName: user?.name || '',
    passengerAge: '',
    passengerGender: seat.passengerGender || 'Other',
  })));
  const [submitting, setSubmitting] = useState(false);
  const [confirmation, setConfirmation] = useState(null);
  const [error, setError] = useState('');
  const [liveSeatError, setLiveSeatError] = useState('');
  const [liveSeatLoading, setLiveSeatLoading] = useState(true);
  const [passengerErrors, setPassengerErrors] = useState({});

  useEffect(() => {
    let active = true;
    let requestInFlight = false;

    const checkSeatAvailability = async () => {
      if (requestInFlight) return;
      requestInFlight = true;
      try {
        const liveSeatMap = await fetchScheduleSeats(selectedBus?.scheduleId);
        const liveSeats = new Map(
          liveSeatMap.rows.flatMap((row) => [...row.leftSeats, ...row.rightSeats])
            .map((seat) => [seat.seatId, seat])
        );
        const unavailableSeat = selectedSeats.find((passenger) => {
          const seat = liveSeats.get(passenger.seatId);
          return !seat || !['AVAIL', 'F_AVAIL', 'M_AVAIL'].includes(seat.status);
        });
        if (active) {
          setLiveSeatError(unavailableSeat
            ? `Seat ${unavailableSeat.seatNumber} is no longer available. Return to seat selection.`
            : '');
        }
      } catch (requestError) {
        if (active) {
          setLiveSeatError(
            requestError.response?.data?.error ||
            requestError.message ||
            'Could not verify live seat availability.'
          );
        }
      } finally {
        if (active) setLiveSeatLoading(false);
        requestInFlight = false;
      }
    };

    setLiveSeatLoading(true);
    checkSeatAvailability();
    const refreshTimer = setInterval(checkSeatAvailability, 5000);
    return () => {
      active = false;
      clearInterval(refreshTimer);
    };
  }, [selectedBus?.scheduleId, selectedSeats]);

  const farePerSeat = Number(price);
  const subtotal = farePerSeat * passengers.length;
  const taxes = Math.round(subtotal * Number(taxRate)) / 100;
  const amount = Math.round((subtotal + taxes) * 100) / 100;

  const updatePassenger = (seatId, changes) => {
    setPassengers((current) => current.map((passenger) =>
      passenger.seatId === seatId ? { ...passenger, ...changes } : passenger
    ));
    setPassengerErrors((current) => {
      const next = { ...current };
      delete next[seatId];
      return next;
    });
    setError('');
  };

  const validatePassengers = () => {
    const errorsBySeat = {};
    const errors = [];
    if (!Number.isSafeInteger(Number(selectedBus?.scheduleId)) || Number(selectedBus?.scheduleId) <= 0) {
      errors.push('The selected bus schedule is invalid. Return to bus selection.');
    }
    if (!passengers.length) errors.push('Select at least one seat before continuing.');
    if (!Number.isFinite(farePerSeat) || farePerSeat < 0) errors.push('The seat fare is invalid. Return to seat selection.');
    if (!Number.isFinite(Number(taxRate)) || Number(taxRate) < 0 || Number(taxRate) > 100) {
      errors.push('The tax rate is invalid. Please reload the trip details.');
    }
    if (!Number.isSafeInteger(Number(boardingPoint?.stopId)) || Number(boardingPoint?.stopId) <= 0) {
      errors.push('Choose a boarding stop from the route details.');
    }
    if (!Number.isSafeInteger(Number(droppingPoint?.stopId)) || Number(droppingPoint?.stopId) <= 0) {
      errors.push('Choose a dropping stop from the route details.');
    }
    const stopOrder = tripDetails?.route?.stops || [];
    const boardingIndex = stopOrder.findIndex((stop) => stop.stopId === boardingPoint?.stopId);
    const droppingIndex = stopOrder.findIndex((stop) => stop.stopId === droppingPoint?.stopId);
    if (boardingIndex < 0 || droppingIndex <= boardingIndex) {
      errors.push('The dropping stop must be after the selected boarding stop.');
    }

    const seatIds = passengers.map((passenger) => passenger.seatId);
    if (seatIds.some((seatId) => !Number.isSafeInteger(Number(seatId)) || Number(seatId) <= 0)) {
      errors.push('One or more selected seats are invalid. Return to seat selection.');
    } else if (new Set(seatIds.map(Number)).size !== seatIds.length) {
      errors.push('A seat cannot be assigned to more than one passenger.');
    }

    for (const passenger of passengers) {
      const fieldErrors = {};
      const name = typeof passenger.passengerName === 'string' ? passenger.passengerName.trim() : '';
      if (name.length < 2 || name.length > 100) {
        fieldErrors.passengerName = 'Enter a name between 2 and 100 characters.';
      }
      const ageText = String(passenger.passengerAge ?? '').trim();
      const age = /^\d{1,3}$/.test(ageText) ? Number(ageText) : NaN;
      if (!Number.isInteger(age) || age < 1 || age > 120) {
        fieldErrors.passengerAge = 'Enter a whole-number age from 1 to 120.';
      }
      if (!GENDERS.some((gender) => gender.value === passenger.passengerGender)) {
        fieldErrors.passengerGender = 'Choose a valid passenger gender.';
      } else if (passenger.status === 'F_AVAIL' && passenger.passengerGender !== 'Female') {
        fieldErrors.passengerGender = 'This seat is reserved for a female passenger.';
      } else if (passenger.status === 'M_AVAIL' && passenger.passengerGender !== 'Male') {
        fieldErrors.passengerGender = 'This seat is reserved for a male passenger.';
      }
      if (Object.keys(fieldErrors).length) errorsBySeat[passenger.seatId] = fieldErrors;
    }
    return { errors, errorsBySeat };
  };

  const submitBooking = async () => {
    const departureDateTime = selectedBus?.departureDateTime;
    if (departureDateTime && new Date(departureDateTime).getTime() <= Date.now()) {
      setError('Booking is closed because this bus has already departed.');
      return;
    }
    const validation = validatePassengers();
    setPassengerErrors(validation.errorsBySeat);
    if (validation.errors.length) {
      setError(validation.errors[0]);
      return;
    }

    setSubmitting(true);
    setError('');
    const payload = {
      scheduleId: selectedBus.scheduleId,
      busId: selectedBus.busId,
      boardingStopId: boardingPoint.stopId,
      droppingStopId: droppingPoint.stopId,
      route: selectedBus.route,
      seats: passengers.map((passenger) => ({
        seatId: passenger.seatId,
        seatNumber: passenger.seatNumber,
        passengerName: passenger.passengerName.trim(),
        passengerAge: Number(passenger.passengerAge),
        passengerGender: passenger.passengerGender,
      })),
      amount,
      taxRate: Number(taxRate),
    };

    try {
      const liveSeatMap = await fetchScheduleSeats(selectedBus.scheduleId);
      const currentSeats = new Map(
        liveSeatMap.rows.flatMap((row) => [...row.leftSeats, ...row.rightSeats])
          .map((seat) => [seat.seatId, seat])
      );
      const unavailablePassenger = passengers.find((passenger) => {
        const seat = currentSeats.get(passenger.seatId);
        if (!seat || !['AVAIL', 'F_AVAIL', 'M_AVAIL'].includes(seat.status)) return true;
        if (seat.status === 'F_AVAIL' && passenger.passengerGender !== 'Female') return true;
        return seat.status === 'M_AVAIL' && passenger.passengerGender !== 'Male';
      });
      if (unavailablePassenger) {
        const message = `Seat ${unavailablePassenger.seatNumber} is no longer available. Return to seat selection and choose another seat.`;
        setLiveSeatError(message);
        setError(message);
        return;
      }

      const response = await createBookingApi(payload);
      setConfirmation({
        id: response.data.pnr,
        status: response.data.status,
      });
    } catch (requestError) {
      setError(
        requestError.response?.data?.error ||
        requestError.message ||
        'Could not submit the booking. Please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            mode="contained-tonal"
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back to seat selection"
          />
          <View style={styles.headerText}>
            <Text variant="labelLarge" style={styles.eyebrow}>STEP 2 OF 2</Text>
            <Text variant="headlineSmall" style={styles.title}>Booking summary</Text>
          </View>
        </View>

        {confirmation ? (
          <Card style={styles.confirmationCard}>
            <Card.Content>
              <Text variant="headlineSmall" style={styles.confirmationTitle}>
                {confirmation.status === 'pending_sync' ? 'Booking saved offline' : 'Booking confirmed'}
              </Text>
              <Text variant="bodyMedium" style={styles.confirmationText}>
                {confirmation.status === 'pending_sync'
                  ? 'Your booking is in the offline queue and will synchronize when the API is reachable.'
                  : 'Your seats have been reserved.'}
              </Text>
              <Text variant="titleMedium" style={styles.pnr}>Reference: {confirmation.id}</Text>
              <Button
                mode="contained"
                onPress={() => navigation.navigate('MainDrawer', {
                  screen: 'MainFlow',
                  params: {
                    screen: 'MainTabs',
                    params: { screen: confirmation.status === 'pending_sync' ? 'Sync' : 'Bookings' },
                  },
                })}
                style={styles.doneButton}
              >
                {confirmation.status === 'pending_sync' ? 'View sync queue' : 'Done'}
              </Button>
            </Card.Content>
          </Card>
        ) : (
          <>
            <Card style={styles.tripCard}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.operator}>{selectedBus?.operator || 'Scheduled bus'}</Text>
                <Text variant="bodyMedium" style={styles.tripText}>{selectedBus?.route || 'Your journey'}</Text>
                <Text variant="bodySmall" style={styles.tripText}>
                  {selectedBus?.departure || '--:--'} · {selectedBus?.type || 'Bus'}
                </Text>
                {boardingPoint ? (
                  <Text variant="bodySmall" style={styles.tripText}>
                    Pickup · {boardingPoint.name}
                  </Text>
                ) : null}
                {droppingPoint ? (
                  <Text variant="bodySmall" style={styles.tripText}>
                    Drop-off · {droppingPoint.name}
                  </Text>
                ) : null}
              </Card.Content>
            </Card>

            <Text variant="titleMedium" style={styles.sectionTitle}>Passenger details</Text>
            {passengers.map((passenger, index) => (
              <Card key={passenger.seatId} style={styles.passengerCard}>
                <Card.Content>
                  <Text variant="titleSmall" style={styles.passengerTitle}>
                    Passenger {index + 1} · Seat {passenger.seatNumber}
                  </Text>
                  <TextInput
                    label="Full name"
                    value={passenger.passengerName}
                    onChangeText={(passengerName) => updatePassenger(passenger.seatId, { passengerName })}
                    mode="outlined"
                    autoCapitalize="words"
                    style={styles.input}
                    error={Boolean(passengerErrors[passenger.seatId]?.passengerName)}
                  />
                  <Text
                    accessibilityRole="alert"
                    style={styles.fieldError}
                  >
                    {passengerErrors[passenger.seatId]?.passengerName || ''}
                  </Text>
                  <TextInput
                    label="Age"
                    value={String(passenger.passengerAge)}
                    onChangeText={(passengerAge) => updatePassenger(passenger.seatId, { passengerAge })}
                    mode="outlined"
                    keyboardType="number-pad"
                    style={styles.input}
                    error={Boolean(passengerErrors[passenger.seatId]?.passengerAge)}
                  />
                  <Text
                    accessibilityRole="alert"
                    style={styles.fieldError}
                  >
                    {passengerErrors[passenger.seatId]?.passengerAge || ''}
                  </Text>
                  <Text variant="labelMedium" style={styles.genderLabel}>Gender</Text>
                  <SegmentedButtons
                    value={passenger.passengerGender}
                    onValueChange={(passengerGender) => updatePassenger(passenger.seatId, { passengerGender })}
                    buttons={GENDERS}
                    density="small"
                  />
                  {passengerErrors[passenger.seatId]?.passengerGender ? (
                    <Text accessibilityRole="alert" style={styles.fieldError}>
                      {passengerErrors[passenger.seatId].passengerGender}
                    </Text>
                  ) : null}
                </Card.Content>
              </Card>
            ))}

            <Card style={styles.fareCard}>
              <Card.Content>
                <View style={styles.fareLine}>
                  <Text style={styles.fareLabel}>Seats · {passengers.map((passenger) => passenger.seatNumber).join(', ')}</Text>
                  <Text style={styles.fareValue}>₹{subtotal.toFixed(2)}</Text>
                </View>
                <View style={styles.fareLine}>
                  <Text style={styles.fareLabel}>Tax ({taxRate}%)</Text>
                  <Text style={styles.fareValue}>₹{taxes.toFixed(2)}</Text>
                </View>
                <View style={[styles.fareLine, styles.totalLine]}>
                  <Text style={styles.totalLabel}>Total payable</Text>
                  <Text style={styles.totalValue}>₹{amount.toFixed(2)}</Text>
                </View>
              </Card.Content>
            </Card>

            {liveSeatError ? (
              <Text accessibilityRole="alert" style={styles.errorText}>{liveSeatError}</Text>
            ) : null}
            {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}
            <Button
              mode="contained"
              onPress={submitBooking}
              disabled={submitting || passengers.length === 0 || liveSeatLoading || Boolean(liveSeatError)}
              contentStyle={styles.submitContent}
            >
              {submitting ? <ActivityIndicator color="#FFFFFF" /> : 'Confirm booking'}
            </Button>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F8' },
  content: { padding: 18, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  headerText: { flex: 1 },
  eyebrow: { color: '#6750A4', letterSpacing: 1 },
  title: { color: '#1D1B20', fontWeight: '700' },
  tripCard: { backgroundColor: '#6750A4', borderRadius: 20, marginBottom: 18 },
  operator: { color: '#FFFFFF', fontWeight: '700' },
  tripText: { color: '#F1ECFA', marginTop: 4 },
  sectionTitle: { color: '#1D1B20', fontWeight: '700', marginBottom: 10 },
  passengerCard: { backgroundColor: '#FFFBFE', borderRadius: 18, marginBottom: 12 },
  passengerTitle: { color: '#1D1B20', fontWeight: '700', marginBottom: 10 },
  input: { marginBottom: 10, backgroundColor: '#FFFBFE' },
  genderLabel: { color: '#49454F', marginBottom: 6 },
  fareCard: { backgroundColor: '#FFFBFE', borderRadius: 18, marginBottom: 14 },
  fareLine: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 5 },
  fareLabel: { flex: 1, color: '#49454F', paddingRight: 10 },
  fareValue: { color: '#1D1B20', fontWeight: '600' },
  totalLine: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#D8D2E3', marginTop: 8, paddingTop: 12 },
  totalLabel: { color: '#1D1B20', fontSize: 17, fontWeight: '700' },
  totalValue: { color: '#6750A4', fontSize: 18, fontWeight: '700' },
  errorText: { color: '#B3261E', marginBottom: 12 },
  fieldError: { color: '#B3261E', fontSize: 12, minHeight: 4, marginTop: -7, marginBottom: 7 },
  submitContent: { minHeight: 50 },
  confirmationCard: { backgroundColor: '#FFFBFE', borderRadius: 20, paddingVertical: 12 },
  confirmationTitle: { color: '#1D1B20', fontWeight: '700' },
  confirmationText: { color: '#49454F', marginTop: 10 },
  pnr: { color: '#6750A4', marginTop: 16, fontWeight: '700' },
  doneButton: { marginTop: 22 },
});
