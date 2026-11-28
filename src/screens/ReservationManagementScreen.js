import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Chip, IconButton, Menu, SegmentedButtons, Text, TextInput } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { cancelManagedReservation, fetchManagedReservations } from '../services/api';

const PAGE_SIZE = 10;
const CANCELLATION_REASONS = ['Passenger request', 'Bus breakdown', 'Schedule change'];

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Unknown';
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatJourneyDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: 'Unknown', time: 'Unknown' };
  return {
    date: date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }),
    time: date.toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
    }),
  };
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

function csvCell(value) {
  const text = String(value ?? '');
  const safeText = /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function departureState(value, now) {
  const departure = new Date(value).getTime();
  if (!Number.isFinite(departure)) return null;
  if (departure <= now) return { label: 'Departed', style: styles.departed };
  if (departure - now <= 24 * 60 * 60 * 1000) {
    return { label: 'Departing within 24h', style: styles.departingSoon };
  }
  return null;
}

function TableCell({ children, width, header = false, style }) {
  return (
    <View style={[styles.tableCell, { width }, header && styles.tableHeaderCell, style]}>
      {header ? (
        <Text variant="labelMedium" style={styles.tableHeaderText}>{children}</Text>
      ) : children}
    </View>
  );
}

function ReservationTableRow({
  reservation,
  isSystemAdmin,
  now,
  onRowPress,
  onDetails,
  onSeatMap,
  onCancel,
  cancelling,
}) {
  const journey = formatJourneyDate(reservation.departureDate);
  const departure = departureState(reservation.departureDate, now);
  return (
    <View style={styles.tableRow}>
      <Pressable
        style={styles.tableDataCells}
        onPress={() => onRowPress(reservation)}
        onAccessibilityTap={() => onDetails(reservation)}
        accessibilityRole="button"
        accessibilityLabel={`Reservation ${reservation.pnr}, ${reservation.route}`}
        accessibilityHint="Double-click or double-tap to open reservation details."
      >
        <TableCell width={150}>
          <Text variant="labelLarge" style={styles.tablePrimary}>{reservation.pnr}</Text>
          <Text variant="bodySmall" style={styles.tableMuted}>Schedule {reservation.scheduleId}</Text>
        </TableCell>
        <TableCell width={150}>
          <Text
            variant="labelMedium"
            style={[
              styles.status,
              reservation.status === 'Confirmed' ? styles.confirmed : styles.cancelled,
            ]}
          >
            {reservation.status}
          </Text>
          {reservation.status === 'Cancelled' && reservation.cancellationReason ? (
            <Text variant="bodySmall" style={styles.tableMuted}>
              {reservation.cancellationReason}
              {reservation.cancelledBy ? ` · ${reservation.cancelledBy}` : ''}
              {reservation.cancelledAt ? ` · ${formatDate(reservation.cancelledAt)}` : ''}
            </Text>
          ) : null}
        </TableCell>
        <TableCell width={190}>
          <Text
            variant={isSystemAdmin ? 'titleSmall' : 'bodyMedium'}
            style={isSystemAdmin ? styles.ownerTag : styles.tablePrimary}
          >
            {reservation.operator}
          </Text>
          <Text variant="bodySmall" style={styles.tableMuted}>Bus {reservation.busNumber}</Text>
        </TableCell>
        <TableCell width={190}>
          <Text variant="bodyMedium" style={styles.tablePrimary}>{reservation.route}</Text>
        </TableCell>
        <TableCell width={175}>
          <Text variant="bodyMedium" style={styles.journeyLabel}>{journey.date}</Text>
          <Text variant="bodySmall" style={styles.tableMuted}>Departure {journey.time}</Text>
          {departure ? <Text variant="labelSmall" style={departure.style}>{departure.label}</Text> : null}
        </TableCell>
        <TableCell width={175}>
          <Text variant="bodyMedium" style={styles.tablePrimary}>{formatDate(reservation.createdAt)}</Text>
        </TableCell>
        <TableCell width={220}>
          {reservation.seats.length ? reservation.seats.map((seat) => (
            <View key={seat.seatNumber} style={styles.passengerRow}>
              <Text variant="bodySmall" style={styles.passenger}>
                {seat.seatNumber} · {seat.passengerName}
              </Text>
              {seat.passengerGender === 'Male' || seat.passengerGender === 'Female' ? (
                <Text
                  variant="labelSmall"
                  style={seat.passengerGender === 'Female' ? styles.femaleBadge : styles.maleBadge}
                >
                  {seat.passengerGender === 'Female' ? 'F' : 'M'}
                </Text>
              ) : null}
            </View>
          )) : <Text variant="bodySmall" style={styles.tableMuted}>No seats</Text>}
        </TableCell>
        <TableCell width={120}>
          <Text variant="titleSmall" style={styles.tablePrimary}>
            ₹{Number(reservation.amount || 0).toFixed(2)}
          </Text>
        </TableCell>
      </Pressable>
      <TableCell width={155} style={styles.tableActionsCell}>
        <Button
          mode="text"
          icon="information-outline"
          compact
          onPress={() => onDetails(reservation)}
        >
          Details
        </Button>
        <Button
          mode="text"
          icon="seat"
          compact
          onPress={() => onSeatMap(reservation)}
        >
          Seat map
        </Button>
        {reservation.status === 'Confirmed' ? (
          <Button
            mode="text"
            textColor="#B3261E"
            icon="close-circle-outline"
            compact
            onPress={() => onCancel(reservation)}
            loading={cancelling}
            disabled={Boolean(cancelling)}
          >
            Cancel
          </Button>
        ) : null}
      </TableCell>
    </View>
  );
}

export default function ReservationManagementScreen({ navigation }) {
  const { user } = useAuth();
  const scrollRef = useRef(null);
  const lastRowPressRef = useRef(null);
  const interactionRef = useRef(false);
  const filterFocusedRef = useRef(false);
  const filterTypingUntilRef = useRef(0);
  const scrollingUntilRef = useRef(0);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [cancellingId, setCancellingId] = useState(null);
  const [reservationToView, setReservationToView] = useState(null);
  const [reservationToCancel, setReservationToCancel] = useState(null);
  const [cancellationReason, setCancellationReason] = useState('');
  const [busFilter, setBusFilter] = useState('');
  const [searchFilter, setSearchFilter] = useState('');
  const [routeFilter, setRouteFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [journeyDateFilter, setJourneyDateFilter] = useState('');
  const [bookedDateFilter, setBookedDateFilter] = useState('');
  const [showJourneyDatePicker, setShowJourneyDatePicker] = useState(false);
  const [showBookedDatePicker, setShowBookedDatePicker] = useState(false);
  const [routeMenuVisible, setRouteMenuVisible] = useState(false);
  const [page, setPage] = useState(1);
  const [showScrollToTop, setShowScrollToTop] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [clockNow, setClockNow] = useState(Date.now());

  const loadReservations = useCallback(async (showLoader = false) => {
    if (showLoader) setLoading(true);
    setError('');
    try {
      const result = await fetchManagedReservations();
      setReservations(result);
      setLastUpdated(Date.now());
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
    const refreshTimer = setInterval(() => {
      if (interactionRef.current ||
        filterFocusedRef.current ||
        Date.now() < filterTypingUntilRef.current ||
        Date.now() < scrollingUntilRef.current) return;
      loadReservations();
    }, 10000);
    return () => clearInterval(refreshTimer);
  }, [loadReservations]));

  useEffect(() => {
    const clockTimer = setInterval(() => setClockNow(Date.now()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  const updateFilter = (setter) => (value) => {
    setter(value);
    filterTypingUntilRef.current = Date.now() + 1200;
  };

  const openCancellation = (reservation) => {
    interactionRef.current = true;
    setReservationToView(null);
    setCancellationReason('');
    setReservationToCancel(reservation);
  };

  const openReservationDetails = (reservation) => {
    interactionRef.current = true;
    setReservationToView(reservation);
  };

  const handleReservationRowPress = (reservation) => {
    const now = Date.now();
    const lastPress = lastRowPressRef.current;
    if (lastPress?.reservationId === reservation.id && now - lastPress.time <= 400) {
      lastRowPressRef.current = null;
      openReservationDetails(reservation);
      return;
    }
    lastRowPressRef.current = { reservationId: reservation.id, time: now };
  };

  const closeReservationDetails = () => {
    interactionRef.current = false;
    setReservationToView(null);
  };

  const closeCancellation = () => {
    interactionRef.current = false;
    setReservationToCancel(null);
    setCancellationReason('');
  };

  const confirmCancellation = async () => {
    if (!reservationToCancel) return;
    const reservation = reservationToCancel;
    setCancellingId(reservation.id);
    setError('');
    try {
      await cancelManagedReservation(reservation.id, cancellationReason.trim());
      closeCancellation();
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
  };

  const refresh = () => {
    setRefreshing(true);
    loadReservations();
  };

  const filteredReservations = useMemo(() => {
    const busQuery = busFilter.trim().toLowerCase();
    const searchQuery = searchFilter.trim().toLowerCase();
    const matches = reservations.filter((reservation) => {
      const matchesBus = !busQuery ||
        String(reservation.busNumber || '').toLowerCase().includes(busQuery) ||
        String(reservation.operator || '').toLowerCase().includes(busQuery);
      const matchesSearch = !searchQuery ||
        String(reservation.pnr || '').toLowerCase().includes(searchQuery) ||
        reservation.seats.some((seat) => [
          seat.passengerName,
          seat.seatNumber,
        ].some((value) => String(value || '').toLowerCase().includes(searchQuery))
        );
      const matchesRoute = !routeFilter || String(reservation.route || '') === routeFilter;
      const matchesStatus = statusFilter === 'All' || reservation.status === statusFilter;
      const matchesJourneyDate = !journeyDateFilter ||
        toDateKey(reservation.departureDate) === journeyDateFilter;
      const matchesBookedDate = !bookedDateFilter ||
        toDateKey(reservation.createdAt) === bookedDateFilter;
      return matchesBus && matchesSearch && matchesRoute && matchesStatus &&
        matchesJourneyDate && matchesBookedDate;
    });
    return matches.sort((first, second) => {
      const firstDeparture = new Date(first.departureDate).getTime();
      const secondDeparture = new Date(second.departureDate).getTime();
      if (Number.isFinite(firstDeparture) && Number.isFinite(secondDeparture) &&
        firstDeparture !== secondDeparture) {
        return firstDeparture - secondDeparture;
      }
      if (Number.isFinite(firstDeparture) !== Number.isFinite(secondDeparture)) {
        return Number.isFinite(firstDeparture) ? -1 : 1;
      }
      return String(first.pnr || '').localeCompare(
        String(second.pnr || ''),
        undefined,
        { numeric: true, sensitivity: 'base' }
      );
    });
  }, [bookedDateFilter, busFilter, journeyDateFilter, reservations, routeFilter, searchFilter, statusFilter]);

  const routeOptions = useMemo(() => [...new Set(
    reservations.map((reservation) => reservation.route).filter(Boolean)
  )].sort((first, second) => first.localeCompare(second)), [reservations]);

  const pageCount = Math.max(1, Math.ceil(filteredReservations.length / PAGE_SIZE));
  const pagedReservations = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredReservations.slice(start, start + PAGE_SIZE);
  }, [filteredReservations, page]);

  const summary = useMemo(() => ({
    confirmed: filteredReservations.filter((reservation) => reservation.status === 'Confirmed').length,
    cancelled: filteredReservations.filter((reservation) => reservation.status === 'Cancelled').length,
    seats: filteredReservations.reduce((count, reservation) => count + reservation.seats.length, 0),
    fare: filteredReservations.reduce((total, reservation) => total + Number(reservation.amount || 0), 0),
  }), [filteredReservations]);

  const activeFilters = [
    ...(busFilter ? [{ label: `Bus: ${busFilter}`, clear: () => setBusFilter('') }] : []),
    ...(searchFilter ? [{ label: `PNR / passenger: ${searchFilter}`, clear: () => setSearchFilter('') }] : []),
    ...(routeFilter ? [{ label: `Route: ${routeFilter}`, clear: () => setRouteFilter('') }] : []),
    ...(statusFilter !== 'All' ? [{ label: `Status: ${statusFilter}`, clear: () => setStatusFilter('All') }] : []),
    ...(journeyDateFilter ? [{ label: `Journey: ${journeyDateFilter}`, clear: () => setJourneyDateFilter('') }] : []),
    ...(bookedDateFilter ? [{ label: `Booked: ${bookedDateFilter}`, clear: () => setBookedDateFilter('') }] : []),
  ];

  useEffect(() => {
    setPage(1);
  }, [busFilter, routeFilter, statusFilter, journeyDateFilter, bookedDateFilter, searchFilter]);

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
    setSearchFilter('');
    setRouteFilter('');
    setStatusFilter('All');
    setJourneyDateFilter('');
    setBookedDateFilter('');
    setPage(1);
  };

  const toggleFilterPanel = () => {
    const collapsing = filtersExpanded;
    setFiltersExpanded(!filtersExpanded);
    if (collapsing) {
      setShowJourneyDatePicker(false);
      setShowBookedDatePicker(false);
      setRouteMenuVisible(false);
      filterFocusedRef.current = false;
      interactionRef.current = false;
    }
  };

  const handleJourneyDateChange = (event, date) => {
    setShowJourneyDatePicker(false);
    interactionRef.current = false;
    if (date) setJourneyDateFilter(toDateKey(date));
  };

  const handleBookedDateChange = (event, date) => {
    setShowBookedDatePicker(false);
    interactionRef.current = false;
    if (date) setBookedDateFilter(toDateKey(date));
  };

  const exportReservations = async () => {
    const columns = [
      'Status', 'PNR', 'Operator', 'Bus Number', 'Route', 'Journey Date',
      'Departure Time', 'Seat Count', 'Seats', 'Passengers', 'Amount',
      'Booking Created', 'Cancellation Reason', 'Cancelled By', 'Cancelled At',
    ];
    const rows = filteredReservations.map((reservation) => {
      const journey = formatJourneyDate(reservation.departureDate);
      return [
        reservation.status,
        reservation.pnr,
        reservation.operator,
        reservation.busNumber,
        reservation.route,
        journey.date,
        journey.time,
        reservation.seats.length,
        reservation.seats.map((seat) => seat.seatNumber).join(', '),
        reservation.seats.map((seat) =>
          `${seat.passengerName} (${seat.passengerGender || 'Unknown'})`
        ).join('; '),
        Number(reservation.amount || 0).toFixed(2),
        formatDate(reservation.createdAt),
        reservation.cancellationReason || '',
        reservation.cancelledBy || '',
        reservation.cancelledAt ? formatDate(reservation.cancelledAt) : '',
      ];
    });
    const csv = [columns, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
    const filename = `seat-reservations-${toDateKey(new Date())}.csv`;

    try {
      if (Platform.OS === 'web' && typeof document !== 'undefined') {
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
        return;
      }
      await Share.share({ title: filename, message: csv });
    } catch (exportError) {
      setError(exportError.message || 'Could not export the filtered reservations.');
    }
  };

  const openSeatMap = (reservation) => {
    setReservationToView(null);
    interactionRef.current = false;
    navigation.navigate('SeatSelection', {
      readOnly: true,
      selectedBus: {
        scheduleId: reservation.scheduleId,
        busId: reservation.busId,
        busNumber: reservation.busNumber,
        operator: reservation.operator,
        route: reservation.route,
        departureDateTime: reservation.departureDate,
        departure: formatJourneyDate(reservation.departureDate).time,
        type: reservation.busType || 'Bus',
      },
      travelDate: reservation.departureDate,
    });
  };

  const updatedSecondsAgo = lastUpdated === null
    ? null
    : Math.max(0, Math.floor((clockNow - lastUpdated) / 1000));
  const reservationDetailsJourney = reservationToView
    ? formatJourneyDate(reservationToView.departureDate)
    : null;
  const reservationDetailsDeparture = reservationToView
    ? departureState(reservationToView.departureDate, clockNow)
    : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        onScroll={(event) => {
          scrollingUntilRef.current = Date.now() + 900;
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

        <Text variant="bodySmall" style={styles.subtitle}>
          Auto-refresh every 10 seconds · {updatedSecondsAgo === null
            ? 'Waiting for first update'
            : `Last updated ${updatedSecondsAgo}s ago`}
        </Text>

        <View style={styles.kpiStrip}>
          <Card style={[styles.kpiCard, styles.kpiConfirmed]}>
            <Card.Content>
              <Text variant="labelMedium" style={styles.kpiLabel}>Confirmed</Text>
              <Text variant="titleLarge" style={styles.kpiValue}>{summary.confirmed}</Text>
            </Card.Content>
          </Card>
          <Card style={[styles.kpiCard, styles.kpiCancelled]}>
            <Card.Content>
              <Text variant="labelMedium" style={styles.kpiLabel}>Cancelled</Text>
              <Text variant="titleLarge" style={styles.kpiValue}>{summary.cancelled}</Text>
            </Card.Content>
          </Card>
          <Card style={styles.kpiCard}>
            <Card.Content>
              <Text variant="labelMedium" style={styles.kpiLabel}>Seats</Text>
              <Text variant="titleLarge" style={styles.kpiValue}>{summary.seats}</Text>
            </Card.Content>
          </Card>
          <Card style={styles.kpiCard}>
            <Card.Content>
              <Text variant="labelMedium" style={styles.kpiLabel}>Total fare</Text>
              <Text variant="titleLarge" style={styles.kpiValue}>₹{summary.fare.toFixed(2)}</Text>
            </Card.Content>
          </Card>
        </View>
        <Text variant="labelSmall" style={styles.kpiCaption}>
          Totals for all {filteredReservations.length} matching reservations
        </Text>

        <Card style={styles.filterCard}>
          <Card.Content>
            <View style={styles.filterHeader}>
              <Button
                icon={filtersExpanded ? 'chevron-up' : 'filter-variant'}
                mode="contained-tonal"
                compact
                onPress={toggleFilterPanel}
                accessibilityLabel={filtersExpanded ? 'Hide reservation filters' : 'Show reservation filters'}
                accessibilityState={{ expanded: filtersExpanded }}
                style={styles.filterToggle}
              >
                {filtersExpanded ? 'Hide' : 'Filters'}
              </Button>
              <View style={styles.filterHeading}>
                <Text variant="titleMedium" style={styles.filterTitle}>Find reservations</Text>
                <Text variant="bodySmall" style={styles.filterSummary}>
                  {filteredReservations.length} of {reservations.length} reservations
                  {activeFilters.length ? ` · ${activeFilters.length} filters active` : ''}
                </Text>
              </View>
              {activeFilters.length ? (
                <Button mode="text" compact onPress={clearFilters}>Reset</Button>
              ) : null}
            </View>

            {filtersExpanded ? (
              <>
            <View style={styles.filterGroup}>
              <Text variant="labelSmall" style={styles.filterGroupLabel}>SEARCH</Text>
              <View style={styles.filterRow}>
                <TextInput
                  label="Bus number or operator"
                  value={busFilter}
                  onChangeText={updateFilter(setBusFilter)}
                  onFocus={() => { filterFocusedRef.current = true; }}
                  onBlur={() => {
                    filterFocusedRef.current = false;
                    filterTypingUntilRef.current = Date.now() + 1200;
                  }}
                  left={<TextInput.Icon icon="bus" />}
                  mode="outlined"
                  style={styles.filterInput}
                  dense
                />
                <TextInput
                  label="PNR, passenger, or seat"
                  value={searchFilter}
                  onChangeText={updateFilter(setSearchFilter)}
                  onFocus={() => { filterFocusedRef.current = true; }}
                  onBlur={() => {
                    filterFocusedRef.current = false;
                    filterTypingUntilRef.current = Date.now() + 1200;
                  }}
                  left={<TextInput.Icon icon="ticket-outline" />}
                  mode="outlined"
                  style={styles.filterInput}
                  dense
                />
              </View>
            </View>

            <View style={styles.filterGroup}>
              <Text variant="labelSmall" style={styles.filterGroupLabel}>REFINE RESULTS</Text>
              <View style={styles.filterRow}>
                <View style={styles.routeFilterWrap}>
                  <Text variant="labelSmall" style={styles.filterControlLabel}>Route</Text>
                  <Menu
                    visible={routeMenuVisible}
                    onDismiss={() => {
                      setRouteMenuVisible(false);
                      interactionRef.current = false;
                    }}
                    anchor={
                      <Button
                        mode="outlined"
                        icon="map-marker-path"
                        onPress={() => {
                          setRouteMenuVisible(true);
                          interactionRef.current = true;
                        }}
                        style={styles.routeSelect}
                        contentStyle={styles.routeSelectContent}
                        disabled={!routeOptions.length}
                      >
                        {routeFilter || 'All routes'}
                      </Button>
                    }
                  >
                    <Menu.Item
                      title="All routes"
                      onPress={() => {
                        setRouteFilter('');
                        setRouteMenuVisible(false);
                        interactionRef.current = false;
                      }}
                    />
                    {routeOptions.map((route) => (
                      <Menu.Item
                        key={route}
                        title={route}
                        onPress={() => {
                          setRouteFilter(route);
                          setRouteMenuVisible(false);
                          interactionRef.current = false;
                        }}
                      />
                    ))}
                  </Menu>
                </View>
              </View>
            </View>

            <View style={styles.filterGroup}>
              <Text variant="labelSmall" style={styles.filterGroupLabel}>DATES & EXPORT</Text>
              <View style={styles.filterActions}>
                <Button
                  mode={journeyDateFilter ? 'contained-tonal' : 'outlined'}
                  icon="calendar-month-outline"
                  onPress={() => {
                    setShowJourneyDatePicker(true);
                    interactionRef.current = true;
                  }}
                >
                  {journeyDateFilter ? `Journey · ${journeyDateFilter}` : 'Journey date'}
                </Button>
                <Button
                  mode={bookedDateFilter ? 'contained-tonal' : 'outlined'}
                  icon="calendar-check-outline"
                  onPress={() => {
                    setShowBookedDatePicker(true);
                    interactionRef.current = true;
                  }}
                >
                  {bookedDateFilter ? `Booked · ${bookedDateFilter}` : 'Booking date'}
                </Button>
                <Button
                  mode="contained"
                  icon="file-export-outline"
                  onPress={exportReservations}
                  disabled={!filteredReservations.length}
                >
                  Export CSV
                </Button>
              </View>
            </View>

            <View style={styles.filterGroup}>
              <Text variant="labelSmall" style={styles.filterGroupLabel}>BOOKING STATUS</Text>
              <SegmentedButtons
                value={statusFilter}
                onValueChange={setStatusFilter}
                buttons={[
                  { value: 'All', label: 'All' },
                  { value: 'Confirmed', label: 'Confirmed' },
                  { value: 'Cancelled', label: 'Cancelled' },
                ]}
                style={styles.statusFilter}
              />
            </View>

            {activeFilters.length ? (
              <View style={styles.activeFilters}>
                <Text variant="labelSmall" style={styles.filterGroupLabel}>ACTIVE FILTERS</Text>
                <View style={styles.chipRow}>
                  {activeFilters.map((filter) => (
                    <Chip key={filter.label} compact onClose={filter.clear} style={styles.filterChip}>
                      {filter.label}
                    </Chip>
                  ))}
                </View>
              </View>
            ) : null}
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
              </>
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
                Change or clear the active bus, PNR, passenger, route, status, or date filters.
              </Text>
            </Card.Content>
          </Card>
        ) : (
          <>
            <Text variant="labelSmall" style={styles.tableHint}>
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredReservations.length)}
              {' '}of {filteredReservations.length} · Journey departure ascending · Search bus/operator, PNR, passenger, or seat · Double-click a row for details
            </Text>
            <ScrollView horizontal nestedScrollEnabled showsHorizontalScrollIndicator>
              <View style={styles.table}>
                <View style={styles.tableRow}>
                  <TableCell width={150} header>PNR / Schedule</TableCell>
                  <TableCell width={150} header>Status</TableCell>
                  <TableCell width={190} header>Operator / Bus</TableCell>
                  <TableCell width={190} header>Route</TableCell>
                  <TableCell width={175} header>Journey / Departure</TableCell>
                  <TableCell width={175} header>Booking created</TableCell>
                  <TableCell width={220} header>Seats / Passengers</TableCell>
                  <TableCell width={120} header>Fare</TableCell>
                  <TableCell width={155} header>Actions</TableCell>
                </View>
                {pagedReservations.map((reservation) => (
                  <ReservationTableRow
                    key={reservation.id}
                    reservation={reservation}
                    isSystemAdmin={user?.role === 'SystemAdmin'}
                    now={clockNow}
                    onRowPress={handleReservationRowPress}
                    onDetails={openReservationDetails}
                    onSeatMap={openSeatMap}
                    onCancel={openCancellation}
                    cancelling={cancellingId === reservation.id}
                  />
                ))}
              </View>
            </ScrollView>
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

      <Modal
        visible={Boolean(reservationToView)}
        transparent
        animationType="fade"
        onRequestClose={closeReservationDetails}
      >
        <View style={styles.modalBackdrop}>
          <Card style={styles.detailModal}>
            <ScrollView style={styles.detailModalScroll}>
              <Card.Content>
                {reservationToView ? (
                  <>
                    <View style={styles.detailsHeader}>
                      <View style={styles.detailsTitleWrap}>
                        <Text variant="labelSmall" style={styles.eyebrow}>RESERVATION DETAILS</Text>
                        <Text variant="titleLarge" style={styles.cardTitle}>{reservationToView.pnr}</Text>
                      </View>
                      <Text
                        variant="labelMedium"
                        style={[
                          styles.status,
                          reservationToView.status === 'Confirmed' ? styles.confirmed : styles.cancelled,
                        ]}
                      >
                        {reservationToView.status}
                      </Text>
                    </View>

                    <View style={styles.detailsGroup}>
                      <Text variant="labelSmall" style={styles.detailsLabel}>ROUTE</Text>
                      <Text variant="bodyLarge" style={styles.detailsValue}>{reservationToView.route}</Text>
                    </View>
                    <View style={styles.detailsPair}>
                      <View style={[styles.detailsGroup, styles.detailsPairItem]}>
                        <Text variant="labelSmall" style={styles.detailsLabel}>OPERATOR</Text>
                        <Text variant="bodyMedium" style={styles.detailsValue}>{reservationToView.operator}</Text>
                      </View>
                      <View style={[styles.detailsGroup, styles.detailsPairItem]}>
                        <Text variant="labelSmall" style={styles.detailsLabel}>BUS</Text>
                        <Text variant="bodyMedium" style={styles.detailsValue}>{reservationToView.busNumber}</Text>
                      </View>
                    </View>
                    <View style={styles.detailsPair}>
                      <View style={[styles.detailsGroup, styles.detailsPairItem]}>
                        <Text variant="labelSmall" style={styles.detailsLabel}>JOURNEY / DEPARTURE</Text>
                        <Text variant="bodyMedium" style={styles.detailsValue}>
                          {reservationDetailsJourney?.date} · {reservationDetailsJourney?.time}
                        </Text>
                        {reservationDetailsDeparture ? (
                          <Text variant="labelSmall" style={reservationDetailsDeparture.style}>
                            {reservationDetailsDeparture.label}
                          </Text>
                        ) : null}
                      </View>
                      <View style={[styles.detailsGroup, styles.detailsPairItem]}>
                        <Text variant="labelSmall" style={styles.detailsLabel}>BOOKING CREATED</Text>
                        <Text variant="bodyMedium" style={styles.detailsValue}>
                          {formatDate(reservationToView.createdAt)}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.detailsPair}>
                      <View style={[styles.detailsGroup, styles.detailsPairItem]}>
                        <Text variant="labelSmall" style={styles.detailsLabel}>SCHEDULE</Text>
                        <Text variant="bodyMedium" style={styles.detailsValue}>{reservationToView.scheduleId}</Text>
                      </View>
                      <View style={[styles.detailsGroup, styles.detailsPairItem]}>
                        <Text variant="labelSmall" style={styles.detailsLabel}>TOTAL FARE</Text>
                        <Text variant="titleMedium" style={styles.detailsValue}>
                          ₹{Number(reservationToView.amount || 0).toFixed(2)}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.detailsGroup}>
                      <Text variant="labelSmall" style={styles.detailsLabel}>SEATS & PASSENGERS</Text>
                      {reservationToView.seats.length ? reservationToView.seats.map((seat) => (
                        <View key={seat.seatNumber} style={styles.detailsPassenger}>
                          <Text variant="bodyMedium" style={styles.detailsValue}>
                            Seat {seat.seatNumber} · {seat.passengerName}
                          </Text>
                          {seat.passengerGender === 'Male' || seat.passengerGender === 'Female' ? (
                            <Text
                              variant="labelSmall"
                              style={seat.passengerGender === 'Female' ? styles.femaleBadge : styles.maleBadge}
                            >
                              {seat.passengerGender === 'Female' ? 'F' : 'M'}
                            </Text>
                          ) : (
                            <Text variant="labelSmall" style={styles.tableMuted}>
                              {seat.passengerGender || 'Gender not provided'}
                            </Text>
                          )}
                        </View>
                      )) : (
                        <Text variant="bodySmall" style={styles.tableMuted}>No seat details available.</Text>
                      )}
                    </View>

                    {reservationToView.status === 'Cancelled' ? (
                      <View style={styles.detailsGroup}>
                        <Text variant="labelSmall" style={styles.detailsLabel}>CANCELLATION AUDIT</Text>
                        <Text variant="bodyMedium" style={styles.detailsValue}>
                          Reason: {reservationToView.cancellationReason || 'Not provided'}
                        </Text>
                        <Text variant="bodySmall" style={styles.tableMuted}>
                          Cancelled by {reservationToView.cancelledBy || 'Unknown'}
                          {reservationToView.cancelledAt ? ` · ${formatDate(reservationToView.cancelledAt)}` : ''}
                        </Text>
                      </View>
                    ) : null}
                  </>
                ) : null}
              </Card.Content>
            </ScrollView>
            <Card.Actions>
              <Button onPress={closeReservationDetails}>Close</Button>
              {reservationToView ? (
                <Button
                  mode="contained-tonal"
                  icon="seat"
                  onPress={() => openSeatMap(reservationToView)}
                >
                  Seat map
                </Button>
              ) : null}
            </Card.Actions>
          </Card>
        </View>
      </Modal>

      <Modal
        visible={Boolean(reservationToCancel)}
        transparent
        animationType="fade"
        onRequestClose={closeCancellation}
      >
        <View style={styles.modalBackdrop}>
          <Card style={styles.cancelModal}>
            <Card.Content>
              <Text variant="titleLarge" style={styles.cardTitle}>Cancel reservation?</Text>
              {reservationToCancel ? (
                <>
                  <Text variant="bodyMedium" style={styles.detail}>
                    PNR {reservationToCancel.pnr} · {reservationToCancel.seats.length} passenger
                    {reservationToCancel.seats.length === 1 ? '' : 's'} / seat
                    {reservationToCancel.seats.length === 1 ? '' : 's'}
                  </Text>
                  <Text variant="bodyMedium" style={styles.detail}>{reservationToCancel.route}</Text>
                  <Text variant="bodyMedium" style={styles.detail}>
                    {formatJourneyDate(reservationToCancel.departureDate).date} · Departure{' '}
                    {formatJourneyDate(reservationToCancel.departureDate).time}
                  </Text>
                  <Text variant="bodyMedium" style={styles.detail}>
                    Amount · ₹{Number(reservationToCancel.amount || 0).toFixed(2)}
                  </Text>
                </>
              ) : null}
              <Text variant="labelMedium" style={styles.reasonLabel}>Cancellation reason (optional)</Text>
              <View style={styles.reasonOptions}>
                {CANCELLATION_REASONS.map((reason) => (
                  <Chip
                    key={reason}
                    selected={cancellationReason === reason}
                    onPress={() => setCancellationReason(reason)}
                  >
                    {reason}
                  </Chip>
                ))}
              </View>
              <TextInput
                label="Other reason"
                value={cancellationReason}
                onChangeText={setCancellationReason}
                mode="outlined"
                maxLength={250}
                style={styles.reasonInput}
              />
            </Card.Content>
            <Card.Actions>
              <Button onPress={closeCancellation} disabled={Boolean(cancellingId)}>Keep booking</Button>
              <Button
                textColor="#B3261E"
                icon="close-circle-outline"
                onPress={confirmCancellation}
                loading={Boolean(cancellingId)}
                disabled={Boolean(cancellingId)}
              >
                Confirm cancellation
              </Button>
            </Card.Actions>
          </Card>
        </View>
      </Modal>
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
  kpiStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  kpiCard: { flexGrow: 1, flexBasis: '45%', backgroundColor: '#FFFBFE', borderRadius: 14 },
  kpiConfirmed: { backgroundColor: '#E8F5EC' },
  kpiCancelled: { backgroundColor: '#FCE8E6' },
  kpiLabel: { color: '#625B71' },
  kpiValue: { color: '#1D1B20', fontWeight: '700' },
  kpiCaption: { color: '#625B71', marginTop: 5, marginLeft: 4 },
  filterCard: { backgroundColor: '#FFFBFE', borderRadius: 18, marginTop: 14, borderWidth: 1, borderColor: '#E7E0EC', elevation: 2 },
  filterHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 4 },
  filterToggle: { borderRadius: 10, marginLeft: -6, marginVertical: 0 },
  filterHeading: { flex: 1 },
  filterTitle: { color: '#1D1B20', fontWeight: '700' },
  filterSummary: { color: '#625B71', marginTop: 2 },
  filterGroup: { marginTop: 14 },
  filterGroupLabel: { color: '#6750A4', fontWeight: '700', letterSpacing: 0.8, marginBottom: 7 },
  filterControlLabel: { color: '#625B71', marginBottom: 5 },
  filterRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  filterInput: { flex: 1, backgroundColor: '#FFFBFE' },
  routeFilterWrap: { flex: 1 },
  routeSelect: { borderRadius: 10, justifyContent: 'center', margin: 0 },
  routeSelectContent: { height: 48, flexDirection: 'row-reverse' },
  statusFilter: { width: '100%' },
  filterActions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  activeFilters: { marginTop: 15, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#E7E0EC', paddingTop: 12 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: { maxWidth: '100%', backgroundColor: '#F3F0FA' },
  tableHint: { color: '#625B71', marginTop: 16, marginBottom: 6 },
  table: { backgroundColor: '#FFFBFE', borderWidth: 1, borderColor: '#E7E0EC', borderRadius: 12, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#D9D3E0' },
  tableDataCells: { flexDirection: 'row' },
  tableCell: { justifyContent: 'center', gap: 3, paddingHorizontal: 10, paddingVertical: 9, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: '#E7E0EC' },
  tableHeaderCell: { backgroundColor: '#EDE7F6', minHeight: 46 },
  tableHeaderText: { color: '#3F2B70', fontWeight: '700' },
  tablePrimary: { color: '#1D1B20' },
  tableMuted: { color: '#625B71' },
  tableActionsCell: { alignItems: 'flex-start', gap: 0 },
  paginationRow: { position: 'relative', alignItems: 'center', justifyContent: 'center', minHeight: 48, marginTop: 12, marginBottom: 4 },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  scrollToTopButton: { position: 'absolute', right: 0 },
  pageLabel: { color: '#49454F', marginHorizontal: 8 },
  loading: { alignItems: 'center', gap: 12, paddingVertical: 40 },
  errorCard: { backgroundColor: '#FCE8E6', marginTop: 16 },
  errorText: { color: '#B3261E' },
  emptyCard: { backgroundColor: '#FFFBFE', marginTop: 18 },
  cardTitle: { color: '#1D1B20', fontWeight: '700' },
  ownerTag: { color: '#3F2B70', fontWeight: '700', marginTop: 4 },
  status: { borderRadius: 12, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 6, fontWeight: '700' },
  confirmed: { backgroundColor: '#166534', color: '#FFFFFF' },
  cancelled: { backgroundColor: '#6B7280', color: '#FFFFFF' },
  journeyLabel: { color: '#3F2B70' },
  departingSoon: { color: '#B45309', marginTop: 4, fontWeight: '700' },
  departed: { color: '#6B7280', marginTop: 4, fontWeight: '700' },
  passengerRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 5, marginLeft: 8 },
  passenger: { color: '#625B71' },
  femaleBadge: { color: '#9D174D', backgroundColor: '#FCE7F3', overflow: 'hidden', paddingHorizontal: 5, borderRadius: 8 },
  maleBadge: { color: '#1E40AF', backgroundColor: '#DBEAFE', overflow: 'hidden', paddingHorizontal: 5, borderRadius: 8 },
  modalBackdrop: { flex: 1, justifyContent: 'center', padding: 18, backgroundColor: 'rgba(0, 0, 0, 0.45)' },
  detailModal: { width: '100%', maxHeight: '90%', backgroundColor: '#FFFBFE', borderRadius: 18 },
  detailModalScroll: { flexShrink: 1 },
  detailsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  detailsTitleWrap: { flex: 1 },
  detailsGroup: { marginTop: 14 },
  detailsPair: { flexDirection: 'row', gap: 14 },
  detailsPairItem: { flex: 1 },
  detailsLabel: { color: '#6750A4', fontWeight: '700', letterSpacing: 0.6, marginBottom: 3 },
  detailsValue: { color: '#1D1B20' },
  detailsPassenger: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 7 },
  cancelModal: { backgroundColor: '#FFFBFE', borderRadius: 18 },
  detail: { color: '#49454F', marginTop: 8 },
  reasonLabel: { color: '#49454F', marginTop: 18, marginBottom: 8 },
  reasonOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  reasonInput: { marginTop: 10, backgroundColor: '#FFFBFE' },
});
