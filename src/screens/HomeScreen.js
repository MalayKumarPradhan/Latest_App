import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  Avatar,
  Button,
  Card,
  Divider,
  IconButton,
  List,
  Searchbar,
  Surface,
  Text,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '../context/AuthContext';
import { API_BASE_URL } from '../config';
import { fetchBusLocations, searchLocationsApi } from '../services/api';

const formatTravelDate = (date) =>
  date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

export default function HomeScreen({ navigation }) {
  const { user, signOut } = useAuth();
  const [locations, setLocations] = useState([]);
  const [source, setSource] = useState(null);
  const [destination, setDestination] = useState(null);
  const [locationsLoading, setLocationsLoading] = useState(true);
  const [locationsError, setLocationsError] = useState('');
  const [locationNotice, setLocationNotice] = useState('');
  const [picker, setPicker] = useState(null);
  const [locationSearch, setLocationSearch] = useState('');
  const [searchResults, setSearchResults] = useState(null);
  const [travelDate, setTravelDate] = useState(() => new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const loadLocations = useCallback(async () => {
    setLocationsLoading(true);
    setLocationsError('');
    try {
      const availableLocations = await fetchBusLocations();
      setLocationNotice('');
      setLocations(availableLocations);
      setSource((current) => current || availableLocations[0] || null);
      setDestination((current) => current || availableLocations.find(
        (location) => location.cityName !== availableLocations[0]?.cityName
      ) || null);
    } catch (error) {
      setLocationsError(
        error.response?.data?.error ||
        (error.request
          ? `Could not reach ${API_BASE_URL}/locations. Check that the API is running and set EXPO_PUBLIC_API_URL to a host reachable from this device.`
          : error.message || 'Could not load locations.')
      );
    } finally {
      setLocationsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLocations();
  }, [loadLocations]);

  useEffect(() => {
    const query = locationSearch.trim();
    if (!picker || !query) {
      setSearchResults(null);
      return undefined;
    }

    let active = true;
    const searchTimer = setTimeout(async () => {
      try {
        const results = await searchLocationsApi({ q: query, limit: 100 });
        if (active) setSearchResults(results);
      } catch (lookupError) {
        if (active) {
          setSearchResults([]);
          setLocationNotice(
            lookupError.response?.data?.error ||
            'Could not search locations on active routes.'
          );
        }
      }
    }, 250);

    return () => {
      active = false;
      clearTimeout(searchTimer);
    };
  }, [locationSearch, picker]);

  const pickerTitle = picker === 'source' ? 'Choose starting location' : 'Choose destination';
  const searchableLocations = searchResults || locations;
  const pickerOptions = searchableLocations.filter((location) =>
    location.cityName !== (picker === 'source' ? destination?.cityName : source?.cityName) &&
    [
      location.locationName,
      location.cityName,
      location.district,
      location.state,
      location.pincode,
      location.shortCode,
    ].some((value) => value?.toLocaleLowerCase().includes(locationSearch.trim().toLocaleLowerCase()))
  );

  const openLocationPicker = (type) => {
    setLocationSearch('');
    setSearchResults(null);
    setPicker(type);
  };

  const selectLocation = (location) => {
    if (picker === 'source') {
      setSource(location);
    } else {
      setDestination(location);
    }
    setPicker(null);
  };

  const handleDateChange = (event, date) => {
    setShowDatePicker(false);
    if (!date) return;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const selected = new Date(date);
    selected.setHours(0, 0, 0, 0);
    if (selected < today) {
      setLocationNotice('Past dates cannot be selected for bus booking.');
      return;
    }
    setLocationNotice('');
    setTravelDate(selected);
  };

  const locationLabel = (location) => {
    if (!location) return '';
    const districtAndState = [location.district, location.state].filter(Boolean).join(', ');
    const detail = [districtAndState, location.pincode].filter(Boolean).join(' - ');
    return detail ? `${location.locationName} (${detail})` : location.locationName;
  };
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const travelDay = new Date(travelDate);
  travelDay.setHours(0, 0, 0, 0);
  const canSearch = Boolean(
    source &&
    destination &&
    source.cityName !== destination.cityName &&
    !Number.isNaN(travelDay.getTime()) &&
    travelDay >= today
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <View style={styles.welcome}>
            <Avatar.Icon size={46} icon="bus" style={styles.avatar} />
            <View style={styles.welcomeText}>
              <Text variant="bodyMedium" style={styles.greeting}>Welcome back</Text>
              <Text variant="titleLarge" style={styles.userName} numberOfLines={1}>
                {user?.name || 'Passenger'}
              </Text>
            </View>
          </View>
          <IconButton
            icon="logout"
            mode="contained-tonal"
            onPress={signOut}
            accessibilityLabel="Log out"
          />
        </View>

        <Surface style={styles.hero} elevation={1}>
          <Text variant="labelLarge" style={styles.heroEyebrow}>YOUR NEXT JOURNEY</Text>
          <Text variant="headlineMedium" style={styles.heroTitle}>Where to today?</Text>
          <Text variant="bodyMedium" style={styles.heroSubtitle}>
            Find a bus and make your next trip easy.
          </Text>
        </Surface>

        <Card style={styles.searchCard} mode="elevated">
          <Card.Content style={styles.searchContent}>
            <View style={styles.sectionHeading}>
              <Avatar.Icon size={38} icon="map-marker-path" style={styles.sectionIcon} />
              <View>
                <Text variant="titleMedium" style={styles.sectionTitle}>Plan your trip</Text>
                <Text variant="bodySmall" style={styles.sectionSubtitle}>Choose your route and travel date</Text>
              </View>
            </View>

            {locationsLoading ? (
              <View style={styles.loadingLocations}>
                <ActivityIndicator size="small" color="#6750A4" />
                <Text variant="bodyMedium" style={styles.mutedText}>Loading available locations…</Text>
              </View>
            ) : locationsError ? (
              <View style={styles.locationError}>
                <Text variant="bodyMedium" style={styles.errorText}>{locationsError}</Text>
                <Button mode="text" onPress={loadLocations}>Try again</Button>
              </View>
            ) : locations.length === 0 ? (
              <Text variant="bodyMedium" style={styles.mutedText}>
                No locations are assigned to active routes yet.
              </Text>
            ) : (
              <>
                <View style={styles.routeFields}>
                  <Button
                    mode="outlined"
                    icon="map-marker"
                    onPress={() => openLocationPicker('source')}
                    style={styles.locationButton}
                    contentStyle={styles.locationButtonContent}
                    labelStyle={styles.locationButtonLabel}
                  >
                    {locationLabel(source) || 'Choose starting location'}
                  </Button>
                  <IconButton
                    icon="swap-vertical"
                    mode="contained-tonal"
                    onPress={() => {
                      setSource(destination);
                      setDestination(source);
                    }}
                    disabled={!source || !destination}
                    accessibilityLabel="Swap starting city and destination"
                    style={styles.swapButton}
                  />
                  <Button
                    mode="outlined"
                    icon="map-marker-check"
                    onPress={() => openLocationPicker('destination')}
                    style={styles.locationButton}
                    contentStyle={styles.locationButtonContent}
                    labelStyle={styles.locationButtonLabel}
                  >
                    {locationLabel(destination) || 'Choose destination'}
                  </Button>
                </View>
                {locationNotice ? (
                  <Text variant="bodySmall" style={styles.locationNotice}>{locationNotice}</Text>
                ) : null}
                {source && destination && source.cityName === destination.cityName && (
                  <Text variant="bodySmall" style={styles.errorText}>
                    Choose two different cities for your trip.
                  </Text>
                )}

                <Divider style={styles.divider} />

                <Button
                  mode="outlined"
                  icon="calendar-month-outline"
                  onPress={() => setShowDatePicker(true)}
                  style={styles.dateButton}
                  contentStyle={styles.dateButtonContent}
                  labelStyle={styles.dateButtonLabel}
                >
                  Travel date · {formatTravelDate(travelDate)}
                </Button>

                {showDatePicker && (
                  <DateTimePicker
                    value={travelDate}
                    mode="date"
                    minimumDate={new Date()}
                    onChange={handleDateChange}
                  />
                )}

                <Button
                  mode="contained"
                  icon="magnify"
                  onPress={() => navigation.navigate('BusList', {
                    source: source.cityName,
                    destination: destination.cityName,
                    travelDate: travelDate.toISOString(),
                  })}
                  disabled={!canSearch}
                  contentStyle={styles.searchButtonContent}
                  style={styles.searchButton}
                >
                  Search buses
                </Button>
              </>
            )}
          </Card.Content>
        </Card>
      </ScrollView>

      <Modal
        visible={Boolean(picker)}
        transparent
        animationType="slide"
        onRequestClose={() => setPicker(null)}
      >
        <View style={styles.modalBackdrop}>
          <Surface style={styles.locationModal} elevation={5}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeading}>
                <Text variant="titleLarge" style={styles.modalTitle}>{pickerTitle}</Text>
                <Text variant="bodySmall" style={styles.sectionSubtitle}>
                  Search by terminal, city, district, or PIN code
                </Text>
              </View>
              <IconButton icon="close" onPress={() => setPicker(null)} />
            </View>
            <Searchbar
              placeholder="Search location, district, or PIN code"
              value={locationSearch}
              onChangeText={setLocationSearch}
              style={styles.locationSearch}
            />
            <ScrollView keyboardShouldPersistTaps="handled">
              {pickerOptions.length ? pickerOptions.map((location) => (
                <List.Item
                  key={location.locationId || location.cityName}
                  title={locationLabel(location)}
                  description={location.locationName !== location.cityName ? location.cityName : location.state}
                  titleStyle={styles.locationOption}
                  left={(props) => <List.Icon {...props} icon="map-marker-outline" />}
                  right={(props) => <List.Icon {...props} icon="chevron-right" />}
                  onPress={() => selectLocation(location)}
                />
              )) : (
                <Text variant="bodyMedium" style={styles.noLocations}>
                  No matching locations found.
                </Text>
              )}
            </ScrollView>
          </Surface>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3F4F8',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 22,
  },
  welcome: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    backgroundColor: '#6750A4',
  },
  welcomeText: {
    flex: 1,
    marginLeft: 12,
  },
  greeting: {
    color: '#625B71',
  },
  userName: {
    color: '#1D1B20',
    fontWeight: '700',
  },
  hero: {
    backgroundColor: '#6750A4',
    borderRadius: 24,
    marginBottom: 20,
    padding: 22,
  },
  heroEyebrow: {
    color: '#E9DFFF',
    letterSpacing: 1,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    marginTop: 8,
  },
  heroSubtitle: {
    color: '#F1ECFA',
    marginTop: 6,
  },
  searchCard: {
    borderRadius: 24,
    backgroundColor: '#FFFBFE',
  },
  searchContent: {
    padding: 20,
  },
  sectionHeading: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionIcon: {
    backgroundColor: '#EADDFF',
    marginRight: 12,
  },
  sectionTitle: {
    color: '#1D1B20',
    fontWeight: '700',
  },
  sectionSubtitle: {
    color: '#625B71',
    marginTop: 2,
  },
  routeFields: {
    gap: 10,
  },
  locationButton: {
    alignSelf: 'stretch',
    borderRadius: 14,
  },
  locationButtonContent: {
    minHeight: 54,
    justifyContent: 'flex-start',
  },
  locationButtonLabel: {
    flex: 1,
    textAlign: 'left',
  },
  swapButton: {
    alignSelf: 'center',
    marginVertical: -10,
    zIndex: 1,
  },
  divider: {
    marginVertical: 18,
  },
  dateButton: {
    alignSelf: 'stretch',
    borderRadius: 14,
  },
  dateButtonContent: {
    minHeight: 52,
  },
  dateButtonLabel: {
    flex: 1,
    textAlign: 'left',
  },
  searchButton: {
    alignSelf: 'stretch',
    borderRadius: 14,
    marginTop: 18,
  },
  searchButtonContent: {
    minHeight: 52,
  },
  loadingLocations: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 18,
  },
  mutedText: {
    color: '#625B71',
    paddingVertical: 8,
  },
  locationNotice: {
    color: '#8A5A00',
    marginTop: 8,
  },
  locationError: {
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  errorText: {
    color: '#B3261E',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(29, 27, 32, 0.42)',
  },
  locationModal: {
    maxHeight: '82%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: '#FFFBFE',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalHeading: {
    flex: 1,
  },
  modalTitle: {
    color: '#1D1B20',
    fontWeight: '700',
  },
  locationSearch: {
    marginBottom: 8,
    backgroundColor: '#F3F4F8',
  },
  locationOption: {
    color: '#1D1B20',
  },
  noLocations: {
    color: '#625B71',
    paddingVertical: 24,
    textAlign: 'center',
  },
});
