import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import {
  Badge,
  Button,
  Card,
  Chip,
  Divider,
  FAB,
  HelperText,
  IconButton,
  SegmentedButtons,
  Text,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { fetchBusOptions, fetchScheduleDetails } from '../services/api';

const SEATING_FILTERS = ['AC', 'Non-AC', 'Sleeper', 'Seater', 'Semi-Sleeper'];
const DEPARTURE_SLOTS = [
  { id: 'morning', label: '6 AM - 12 PM' },
  { id: 'afternoon', label: '12 PM - 6 PM' },
  { id: 'evening', label: '6 PM - 12 AM' },
  { id: 'night', label: '12 AM - 6 AM' },
];
const BOARDING_POINTS = ['Main Station', 'Airport Bypass', 'City Center', 'Highway Plaza'];
const DROPPING_POINTS = ['Central Terminal', 'South Hub', 'Expressway Exit'];
const INITIAL_FILTERS = {
  type: '',
  minPrice: '',
  maxPrice: '',
  departureTimes: [],
  boardingPoints: [],
  droppingPoints: [],
  minRating: 0,
  sortBy: 'departure',
};

const formatTravelDate = (value) => {
  if (!value) return 'Date not selected';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date not selected';
  return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
};

const hasSeatAvailability = (bus) =>
  bus.seatsLeft !== null && bus.seatsLeft !== undefined &&
  Number.isFinite(Number(bus.seatsLeft));

const isFullyBooked = (bus) => hasSeatAvailability(bus) && Number(bus.seatsLeft) <= 0;

function FilterSection({ title, children }) {
  return (
    <View style={styles.filterSection}>
      <Text variant="titleSmall" style={styles.sectionTitle}>{title}</Text>
      <View style={styles.chipRow}>{children}</View>
    </View>
  );
}

export default function BusListScreen({ navigation, route }) {
  const { source, destination, travelDate } = route.params || {};
  const [buses, setBuses] = useState([]);
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [draftFilters, setDraftFilters] = useState(INITIAL_FILTERS);
  const [filterVisible, setFilterVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [priceError, setPriceError] = useState('');
  const [showScrollTop, setShowScrollTop] = useState(false);
  const listScrollRef = useRef(null);
  const [routeModalVisible, setRouteModalVisible] = useState(false);
  const [routeBus, setRouteBus] = useState(null);
  const [routeDetails, setRouteDetails] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState('');

  const loadBuses = useCallback(async (nextFilters) => {
    setLoading(true);
    setError('');
    try {
      const date = travelDate ? new Date(travelDate) : null;
      if (!date || Number.isNaN(date.getTime())) {
        setError('A valid travel date is required.');
        setBuses([]);
        return;
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      date.setHours(0, 0, 0, 0);
      if (date < today) {
        setError('Past dates cannot be used to search or book buses.');
        setBuses([]);
        return;
      }
      const data = await fetchBusOptions({
        source,
        destination,
        ...(date && !Number.isNaN(date.getTime()) ? { date: date.toISOString().slice(0, 10) } : {}),
        ...(nextFilters.type ? { type: nextFilters.type } : {}),
        ...(nextFilters.minPrice !== '' ? { minPrice: nextFilters.minPrice } : {}),
        ...(nextFilters.maxPrice !== '' ? { maxPrice: nextFilters.maxPrice } : {}),
        ...(nextFilters.departureTimes.length
          ? { departureTimes: nextFilters.departureTimes.join(',') }
          : {}),
        ...(nextFilters.boardingPoints.length
          ? { boardingPoints: nextFilters.boardingPoints.join(',') }
          : {}),
        ...(nextFilters.droppingPoints.length
          ? { droppingPoints: nextFilters.droppingPoints.join(',') }
          : {}),
        ...(nextFilters.minRating ? { minRating: nextFilters.minRating } : {}),
        sortBy: nextFilters.sortBy,
      });
      setBuses(data);
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message || 'Could not load buses. Please try again.');
      setBuses([]);
    } finally {
      setLoading(false);
    }
  }, [destination, source, travelDate]);

  useEffect(() => {
    loadBuses(INITIAL_FILTERS);
  }, [loadBuses]);

  const toggleDepartureTime = (value) => {
    setDraftFilters((current) => ({
      ...current,
      departureTimes: current.departureTimes.includes(value)
        ? current.departureTimes.filter((item) => item !== value)
        : [...current.departureTimes, value],
    }));
  };

  const toggleLocationFilter = (category, value) => {
    setDraftFilters((current) => ({
      ...current,
      [category]: current[category].includes(value)
        ? current[category].filter((item) => item !== value)
        : [...current[category], value],
    }));
  };

  const applyFilters = async () => {
    const min = draftFilters.minPrice.trim() === '' ? null : Number(draftFilters.minPrice);
    const max = draftFilters.maxPrice.trim() === '' ? null : Number(draftFilters.maxPrice);
    if ((min !== null && (!Number.isFinite(min) || min < 0)) ||
      (max !== null && (!Number.isFinite(max) || max < 0))) {
      setPriceError('Enter valid non-negative prices.');
      return;
    }
    if (min !== null && max !== null && min > max) {
      setPriceError('Minimum price cannot exceed maximum price.');
      return;
    }

    setPriceError('');
    const appliedFilters = {
      ...draftFilters,
      minPrice: min === null ? '' : String(min),
      maxPrice: max === null ? '' : String(max),
    };
    setFilters(appliedFilters);
    setFilterVisible(false);
    await loadBuses(appliedFilters);
  };

  const resetFilters = () => {
    setDraftFilters(INITIAL_FILTERS);
    setPriceError('');
  };

  const activeFilterCount = Number(Boolean(filters.type)) +
    Number(filters.minPrice !== '' || filters.maxPrice !== '') +
    filters.departureTimes.length +
    filters.boardingPoints.length +
    filters.droppingPoints.length +
    Number(Boolean(filters.minRating)) +
    Number(filters.sortBy !== 'departure');

  const selectBus = (selectedBus) => navigation.navigate('SeatSelection', {
    selectedBus,
    travelDate,
  });

  const loadFullRoute = async (bus) => {
    setRouteBus(bus);
    setRouteDetails(null);
    setRouteError('');
    setRouteModalVisible(true);
    setRouteLoading(true);
    try {
      setRouteDetails(await fetchScheduleDetails(bus.scheduleId));
    } catch (requestError) {
      setRouteError(
        requestError.response?.data?.error ||
        requestError.message ||
        'Could not load the full route.'
      );
    } finally {
      setRouteLoading(false);
    }
  };

  const formatStopTime = (value) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? '—'
      : date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        ref={listScrollRef}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        onScroll={(event) => setShowScrollTop(event.nativeEvent.contentOffset.y > 320)}
        scrollEventThrottle={16}
      >
        <Card style={styles.heroCard} mode="contained">
          <Card.Content>
            <View style={styles.headerTop}>
              <IconButton
                icon="arrow-left"
                mode="contained-tonal"
                iconColor="#FFFFFF"
                onPress={() => navigation.goBack()}
                accessibilityLabel="Back to search"
              />
              <View style={styles.headerText}>
                <Text variant="labelLarge" style={styles.headerEyebrow}>YOUR JOURNEY</Text>
                <Text variant="headlineSmall" style={styles.title}>Available buses</Text>
              </View>
            </View>
            <View style={styles.tripSummary}>
              <View style={styles.cityColumn}>
                <Text variant="labelSmall" style={styles.cityLabel}>FROM</Text>
                <Text variant="titleMedium" style={styles.cityName} numberOfLines={1}>
                  {source || 'Any origin'}
                </Text>
              </View>
              <IconButton icon="arrow-right" iconColor="#FFFFFF" />
              <View style={[styles.cityColumn, styles.destinationColumn]}>
                <Text variant="labelSmall" style={styles.cityLabel}>TO</Text>
                <Text variant="titleMedium" style={styles.cityName} numberOfLines={1}>
                  {destination || 'Any destination'}
                </Text>
              </View>
            </View>
            <Text variant="bodyMedium" style={styles.subtitle}>
              {formatTravelDate(travelDate)}
            </Text>
          </Card.Content>
        </Card>

        <View style={styles.filterToolbar}>
          <View style={styles.filterIconWrap}>
            <IconButton
              icon="tune-variant"
              size={20}
              mode="contained-tonal"
              onPress={() => {
                setDraftFilters(filters);
                setPriceError('');
                setFilterVisible(true);
              }}
              style={styles.filterIconButton}
              accessibilityLabel={`Filter and sort${activeFilterCount ? `, ${activeFilterCount} active` : ''}`}
            />
            {activeFilterCount > 0 && (
              <Badge size={16} style={styles.filterBadge}>{activeFilterCount}</Badge>
            )}
          </View>
        </View>

        <Modal
          visible={filterVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setFilterVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <Card style={styles.filterModal} mode="elevated">
              <View style={styles.modalHeader}>
                <Text variant="titleLarge" style={styles.modalTitle}>Filter buses</Text>
                <Button mode="text" onPress={resetFilters}>Reset</Button>
                <IconButton icon="close" onPress={() => setFilterVisible(false)} />
              </View>
              <Divider />
              <ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">
                <FilterSection title="Bus type">
                  {SEATING_FILTERS.map((type) => (
                    <Chip
                      key={type}
                      selected={draftFilters.type === type}
                      onPress={() => setDraftFilters((current) => ({
                        ...current,
                        type: current.type === type ? '' : type,
                      }))}
                      showSelectedCheck
                    >
                      {type}
                    </Chip>
                  ))}
                </FilterSection>

                <FilterSection title="Departure time">
                  {DEPARTURE_SLOTS.map((slot) => (
                    <Chip
                      key={slot.id}
                      selected={draftFilters.departureTimes.includes(slot.id)}
                      onPress={() => toggleDepartureTime(slot.id)}
                      showSelectedCheck
                    >
                      {slot.label}
                    </Chip>
                  ))}
                </FilterSection>

                <FilterSection title="Minimum rating">
                  {[0, 3, 4].map((rating) => (
                    <Chip
                      key={rating}
                      selected={draftFilters.minRating === rating}
                      onPress={() => setDraftFilters((current) => ({ ...current, minRating: rating }))}
                      showSelectedCheck
                    >
                      {rating ? `${rating}+ stars` : 'Any'}
                    </Chip>
                  ))}
                </FilterSection>

                <FilterSection title="Boarding point">
                  {BOARDING_POINTS.map((point) => (
                    <Chip
                      key={point}
                      selected={draftFilters.boardingPoints.includes(point)}
                      onPress={() => toggleLocationFilter('boardingPoints', point)}
                      showSelectedCheck
                    >
                      {point}
                    </Chip>
                  ))}
                </FilterSection>

                <FilterSection title="Dropping point">
                  {DROPPING_POINTS.map((point) => (
                    <Chip
                      key={point}
                      selected={draftFilters.droppingPoints.includes(point)}
                      onPress={() => toggleLocationFilter('droppingPoints', point)}
                      showSelectedCheck
                    >
                      {point}
                    </Chip>
                  ))}
                </FilterSection>

                <FilterSection title="Price range">
                  <View style={styles.priceFields}>
                    <TextInput
                      label="Minimum"
                      value={draftFilters.minPrice}
                      onChangeText={(value) => setDraftFilters((current) => ({ ...current, minPrice: value }))}
                      keyboardType="decimal-pad"
                      mode="outlined"
                      left={<TextInput.Affix text="₹" />}
                      style={styles.priceInput}
                    />
                    <TextInput
                      label="Maximum"
                      value={draftFilters.maxPrice}
                      onChangeText={(value) => setDraftFilters((current) => ({ ...current, maxPrice: value }))}
                      keyboardType="decimal-pad"
                      mode="outlined"
                      left={<TextInput.Affix text="₹" />}
                      style={styles.priceInput}
                    />
                  </View>
                  <HelperText type="error" visible={Boolean(priceError)}>{priceError}</HelperText>
                </FilterSection>

                <FilterSection title="Sort by">
                  <SegmentedButtons
                    value={draftFilters.sortBy}
                    onValueChange={(sortBy) => setDraftFilters((current) => ({ ...current, sortBy }))}
                    buttons={[
                      { value: 'departure', label: 'Departure' },
                      { value: 'price_low', label: 'Price ↑' },
                      { value: 'price_high', label: 'Price ↓' },
                    ]}
                  />
                </FilterSection>
              </ScrollView>
              <Card.Actions style={styles.modalActions}>
                <Button mode="contained" onPress={applyFilters} loading={loading} disabled={loading}>
                  Show buses
                </Button>
              </Card.Actions>
            </Card>
          </View>
        </Modal>

        <Modal
          visible={routeModalVisible}
          animationType="slide"
          transparent
          onRequestClose={() => setRouteModalVisible(false)}
        >
          <View style={styles.modalBackdrop}>
            <Card style={styles.routeModal} mode="elevated">
              <View style={styles.modalHeader}>
                <View style={styles.routeModalHeading}>
                  <Text variant="titleLarge" style={styles.routeModalTitle}>Full bus route</Text>
                  <Text variant="bodySmall" style={styles.routeModalSubtitle}>
                    {routeBus?.operator} · {routeBus?.id}
                  </Text>
                </View>
                <IconButton
                  icon="close"
                  onPress={() => setRouteModalVisible(false)}
                  accessibilityLabel="Close full route"
                />
              </View>
              <Divider />
              {routeLoading ? (
                <View style={styles.routeLoading}>
                  <ActivityIndicator size="large" color="#6750A4" />
                  <Text variant="bodyMedium" style={styles.statusText}>Loading route stops…</Text>
                </View>
              ) : routeError ? (
                <View style={styles.routeMessage}>
                  <Text accessibilityRole="alert" variant="bodyMedium" style={styles.routeError}>
                    {routeError}
                  </Text>
                  <Button
                    mode="outlined"
                    icon="refresh"
                    onPress={() => routeBus && loadFullRoute(routeBus)}
                    style={styles.routeRetry}
                  >
                    Try again
                  </Button>
                </View>
              ) : (
                <>
                  {routeDetails && (
                    <View style={styles.routeSummary}>
                      <Text variant="titleMedium" style={styles.routeSummaryTitle}>
                        {routeDetails.route.origin} → {routeDetails.route.destination}
                      </Text>
                      <Text variant="bodySmall" style={styles.routeModalSubtitle}>
                        {routeDetails.route.distanceKm} km · {routeDetails.route.durationMinutes} min
                      </Text>
                    </View>
                  )}
                  <ScrollView contentContainerStyle={styles.routeStopList}>
                    {routeDetails?.route?.stops?.length ? routeDetails.route.stops.map((stop, index) => (
                      <View key={stop.stopId} style={styles.routeStopRow}>
                        <View style={styles.routeStopTrack}>
                          <View style={[
                            styles.routeStopDot,
                            index === 0 && styles.routeStartDot,
                            index === routeDetails.route.stops.length - 1 && styles.routeEndDot,
                          ]} />
                          {index < routeDetails.route.stops.length - 1 && (
                            <View style={styles.routeStopLine} />
                          )}
                        </View>
                        <View style={styles.routeStopCopy}>
                          <Text variant="titleSmall" style={styles.routeStopName}>{stop.name}</Text>
                          {stop.landmark ? (
                            <Text variant="bodySmall" style={styles.routeStopLandmark}>
                              {stop.landmark}
                            </Text>
                          ) : null}
                        </View>
                        <View style={styles.routeStopTimes}>
                          {stop.arrivalTime ? (
                            <Text variant="labelSmall" style={styles.routeStopTime}>
                              Arr {formatStopTime(stop.arrivalTime)}
                            </Text>
                          ) : null}
                          {stop.departureTime ? (
                            <Text variant="labelSmall" style={styles.routeStopTime}>
                              Dep {formatStopTime(stop.departureTime)}
                            </Text>
                          ) : null}
                        </View>
                      </View>
                    )) : (
                      <Text variant="bodyMedium" style={styles.routeEmpty}>
                        No intermediate route stops are available for this schedule.
                      </Text>
                    )}
                  </ScrollView>
                </>
              )}
            </Card>
          </View>
        </Modal>

        {loading ? (
          <View style={styles.status}>
            <ActivityIndicator animating size="large" />
            <Text variant="bodyMedium" style={styles.statusText}>Searching scheduled buses…</Text>
          </View>
        ) : error ? (
          <Card style={styles.messageCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.messageTitle}>Could not load buses</Text>
              <Text variant="bodyMedium">{error}</Text>
            </Card.Content>
            <Card.Actions>
              <Button mode="contained" onPress={() => loadBuses(filters)}>Try again</Button>
            </Card.Actions>
          </Card>
        ) : buses.length === 0 ? (
          <Card style={styles.messageCard}>
            <Card.Content>
              <Text variant="titleMedium" style={styles.messageTitle}>No buses found</Text>
              <Text variant="bodyMedium">Try changing your route, travel date, or filters.</Text>
            </Card.Content>
          </Card>
        ) : (
          <>
            <Text variant="titleMedium" style={styles.resultCount}>
              {buses.length} {buses.length === 1 ? 'bus' : 'buses'} available
            </Text>
            {buses.map((bus) => (
              <Card key={bus.scheduleId || bus.id} style={styles.busCard} mode="elevated">
                <Card.Content>
                  <View style={styles.busHeader}>
                    <View style={styles.busName}>
                      <Text variant="titleMedium" style={styles.operator}>{bus.operator}</Text>
                      <Text variant="bodySmall" style={styles.busNumber}>
                        {bus.id} · {bus.type}
                      </Text>
                    </View>
                    <IconButton
                      icon="map-marker-path"
                      size={20}
                      mode="contained-tonal"
                      onPress={() => loadFullRoute(bus)}
                      style={styles.routeQuickButton}
                      accessibilityLabel={`View full route for ${bus.operator}`}
                    />
                    <View style={styles.fareBlock}>
                      <Text variant="titleLarge" style={styles.price}>
                        ₹{Number(bus.price).toLocaleString('en-IN')}
                      </Text>
                      <Text variant="labelSmall" style={styles.fareCaption}>base fare / seat</Text>
                    </View>
                  </View>
                  <View style={styles.timeRow}>
                    <View style={styles.journeyPoint}>
                      <Text variant="titleLarge" style={styles.time}>{bus.departure || '--:--'}</Text>
                      <Text variant="bodySmall" style={styles.journeyCity} numberOfLines={1}>
                        {bus.source || source || 'Origin'}
                      </Text>
                    </View>
                    <View style={styles.durationTrack}>
                      <Text variant="labelSmall" style={styles.duration}>
                        {bus.duration || 'Duration unavailable'}
                      </Text>
                      <View style={styles.routeLine}>
                        <View style={styles.routeDot} />
                        <View style={styles.routeDash} />
                        <MaterialCommunityIcons name="bus" size={17} color="#6750A4" />
                        <View style={styles.routeDash} />
                        <View style={[styles.routeDot, styles.destinationDot]} />
                      </View>
                    </View>
                    <View style={[styles.journeyPoint, styles.journeyEnd]}>
                      <Text variant="titleLarge" style={styles.time}>{bus.arrival || '--:--'}</Text>
                      <Text variant="bodySmall" style={styles.journeyCity} numberOfLines={1}>
                        {bus.destination || destination || 'Destination'}
                      </Text>
                    </View>
                  </View>
                  <Divider style={styles.cardDivider} />
                  <View style={styles.chipRow}>
                    <Chip compact icon={Number(bus.rating) > 0 ? 'star' : 'star-outline'}>
                      {Number(bus.rating) > 0 ? `${Number(bus.rating).toFixed(1)} rating` : 'No ratings'}
                    </Chip>
                    <Chip compact icon="seat-passenger">
                      {hasSeatAvailability(bus)
                        ? (isFullyBooked(bus) ? 'Fully booked' : `${bus.seatsLeft} seats left`)
                        : 'Availability on request'}
                    </Chip>
                  </View>
                  <View style={styles.stopDetails}>
                    <View style={styles.stopDetail}>
                      <MaterialCommunityIcons name="map-marker-up-outline" size={17} color="#6750A4" />
                      <Text variant="bodySmall" style={styles.stopDetailText} numberOfLines={1}>
                        <Text style={styles.stopDetailLabel}>Pickup · </Text>
                        {bus.boardingPoint || 'Point shown before booking'}
                      </Text>
                    </View>
                    <View style={styles.stopDetail}>
                      <MaterialCommunityIcons name="map-marker-down-outline" size={17} color="#6750A4" />
                      <Text variant="bodySmall" style={styles.stopDetailText} numberOfLines={1}>
                        <Text style={styles.stopDetailLabel}>Drop-off · </Text>
                        {bus.droppingPoint || 'Point shown before booking'}
                      </Text>
                    </View>
                  </View>
                </Card.Content>
                <Card.Actions>
                  <Button
                    mode="contained"
                    icon={isFullyBooked(bus) ? 'close-circle-outline' : 'seat-passenger'}
                    onPress={() => selectBus(bus)}
                    style={styles.chooseSeatsButton}
                    disabled={isFullyBooked(bus)}
                  >
                    {isFullyBooked(bus) ? 'Fully booked' : 'Choose seats'}
                  </Button>
                </Card.Actions>
              </Card>
            ))}
          </>
        )}
      </ScrollView>
      <FAB
        icon="arrow-up"
        size="small"
        visible={showScrollTop}
        onPress={() => listScrollRef.current?.scrollTo({ y: 0, animated: true })}
        style={styles.scrollTopButton}
        accessibilityLabel="Scroll to top"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F8',
  },
  content: {
    padding: 18,
    paddingBottom: 36,
  },
  heroCard: {
    borderRadius: 24,
    backgroundColor: '#6750A4',
    marginBottom: 18,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerEyebrow: {
    color: '#E9DFFF',
    letterSpacing: 0.8,
  },
  headerText: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  subtitle: {
    color: '#F1ECFA',
    marginTop: 10,
  },
  tripSummary: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  cityColumn: {
    flex: 1,
  },
  destinationColumn: {
    alignItems: 'flex-end',
  },
  cityLabel: {
    color: '#E9DFFF',
    letterSpacing: 0.8,
  },
  cityName: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  filterToolbar: {
    alignItems: 'flex-end',
    marginBottom: 8,
  },
  filterIconWrap: {
    position: 'relative',
  },
  filterIconButton: {
    margin: 0,
    width: 42,
    height: 42,
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#B3261E',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(29, 27, 32, 0.42)',
  },
  filterModal: {
    maxHeight: '92%',
    paddingTop: 8,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#FFFBFE',
  },
  routeModal: {
    maxHeight: '82%',
    paddingTop: 8,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: '#FFFBFE',
  },
  routeModalTitle: {
    color: '#1D1B20',
    fontWeight: '700',
  },
  routeModalHeading: {
    flex: 1,
  },
  routeModalSubtitle: {
    color: '#625B71',
    marginTop: 3,
  },
  routeQuickButton: {
    margin: 0,
    marginRight: 8,
  },
  routeSummary: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
  },
  routeSummaryTitle: {
    color: '#1D1B20',
    fontWeight: '700',
  },
  routeLoading: {
    alignItems: 'center',
    paddingVertical: 36,
    gap: 12,
  },
  routeMessage: {
    padding: 20,
  },
  routeError: {
    color: '#B3261E',
  },
  routeRetry: {
    alignSelf: 'flex-start',
    marginTop: 12,
  },
  routeStopList: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
  },
  routeStopRow: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  routeStopTrack: {
    width: 20,
    alignItems: 'center',
  },
  routeStopDot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#6750A4',
    backgroundColor: '#FFFBFE',
    zIndex: 1,
  },
  routeStartDot: {
    backgroundColor: '#6750A4',
  },
  routeEndDot: {
    borderColor: '#047857',
    backgroundColor: '#D1FAE5',
  },
  routeStopLine: {
    position: 'absolute',
    top: 10,
    bottom: -1,
    width: 2,
    backgroundColor: '#D8D2E3',
  },
  routeStopCopy: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: 14,
  },
  routeStopName: {
    color: '#1D1B20',
    fontWeight: '700',
  },
  routeStopLandmark: {
    color: '#625B71',
    marginTop: 3,
  },
  routeStopTimes: {
    alignItems: 'flex-end',
    gap: 3,
    paddingLeft: 8,
  },
  routeStopTime: {
    color: '#6750A4',
  },
  routeEmpty: {
    color: '#625B71',
    paddingVertical: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 20,
  },
  modalTitle: {
    flex: 1,
    fontWeight: '700',
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  filterSection: {
    paddingVertical: 16,
    gap: 12,
  },
  sectionTitle: {
    color: '#49454F',
    fontWeight: '700',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  priceFields: {
    flexDirection: 'row',
    gap: 12,
  },
  priceInput: {
    flex: 1,
    backgroundColor: '#FFFBFE',
  },
  modalActions: {
    justifyContent: 'flex-end',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  status: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 14,
  },
  statusText: {
    color: '#625B71',
  },
  messageCard: {
    borderRadius: 20,
    backgroundColor: '#FFFBFE',
  },
  messageTitle: {
    fontWeight: '700',
    marginBottom: 6,
  },
  resultCount: {
    color: '#49454F',
    fontWeight: '700',
    marginBottom: 12,
  },
  busCard: {
    borderRadius: 22,
    backgroundColor: '#FFFBFE',
    marginBottom: 14,
  },
  busHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  busName: {
    flex: 1,
    paddingRight: 12,
  },
  operator: {
    color: '#1D1B20',
    fontWeight: '700',
  },
  busNumber: {
    color: '#79747E',
    marginTop: 2,
  },
  price: {
    color: '#6750A4',
    fontWeight: '700',
  },
  fareBlock: {
    alignItems: 'flex-end',
  },
  fareCaption: {
    color: '#79747E',
    marginTop: 1,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  journeyPoint: {
    flex: 1,
  },
  journeyEnd: {
    alignItems: 'flex-end',
  },
  journeyCity: {
    color: '#625B71',
    marginTop: 3,
  },
  durationTrack: {
    flex: 1.25,
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  time: {
    color: '#1D1B20',
    fontWeight: '700',
  },
  duration: {
    color: '#79747E',
  },
  routeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
  },
  routeDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#6750A4',
  },
  destinationDot: {
    backgroundColor: '#047857',
  },
  routeDash: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#B9B2C7',
  },
  stopDetails: {
    gap: 8,
    marginTop: 14,
  },
  stopDetail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  stopDetailText: {
    flex: 1,
    color: '#49454F',
  },
  stopDetailLabel: {
    color: '#79747E',
    fontWeight: '600',
  },
  cardDivider: {
    marginVertical: 14,
  },
  chooseSeatsButton: {
    borderRadius: 14,
  },
  scrollTopButton: {
    position: 'absolute',
    right: 18,
    bottom: 24,
    backgroundColor: '#6750A4',
  },
});
