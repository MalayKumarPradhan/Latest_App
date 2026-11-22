import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  Button,
  Card,
  HelperText,
  IconButton,
  Menu,
  SegmentedButtons,
  Switch,
  Text,
  TextInput,
} from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  createManagedLocation,
  deactivateManagedLocation,
  fetchManagedLocationCities,
  fetchManagedLocations,
  fetchLocationDistricts,
  geocodeLocationApi,
  updateManagedLocation,
  fetchManagedRoutes,
  createManagedRoute,
  fetchManagedRouteWaypoints,
  addManagedRouteWaypoint,
  updateManagedRouteWaypoint,
  deleteManagedRouteWaypoint,
  reorderManagedRouteWaypoints,
  submitManagedRouteChanges,
} from '../services/api';

const emptyForm = {
  cityId: null,
  locationName: '',
  shortCode: '',
  latitude: '',
  longitude: '',
  district: '',
  state: '',
  pincode: '',
  status: 'ACTIVE',
};

const emptyRouteForm = {
  routeCode: '',
  routeName: '',
  routeCategory: 'Local',
  originCityId: null,
  destinationCityId: null,
};

function getRequestError(error, fallback) {
  return error.response?.data?.error || error.message || fallback;
}

export default function LocationManagementScreen({ navigation, route }) {
  const [locations, setLocations] = useState([]);
  const [total, setTotal] = useState(0);
  const [cities, setCities] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [routeForm, setRouteForm] = useState(emptyRouteForm);
  const [routes, setRoutes] = useState([]);
  const [routeFormVisible, setRouteFormVisible] = useState(false);
  const [routeSearchQuery, setRouteSearchQuery] = useState('');
  const [routeStatusFilter, setRouteStatusFilter] = useState('ALL');
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [waypoints, setWaypoints] = useState([]);
  const [routeLocations, setRouteLocations] = useState([]);
  const [searchingRouteLocations, setSearchingRouteLocations] = useState(false);
  const [routeLocationId, setRouteLocationId] = useState(null);
  const [routeStopType, setRouteStopType] = useState('STOP');
  const [routeHaltMinutes, setRouteHaltMinutes] = useState('5');
  const [editingStopId, setEditingStopId] = useState(null);
  const [routeLocationSearch, setRouteLocationSearch] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [cityMenuVisible, setCityMenuVisible] = useState(false);
  const [routeCityMenuTarget, setRouteCityMenuTarget] = useState(null);
  const [districtMenuVisible, setDistrictMenuVisible] = useState(false);
  const [locationMenuVisible, setLocationMenuVisible] = useState(false);
  const [activePanel, setActivePanel] = useState(
    route?.params?.panel === 'routes' ? 'routes' : 'locations'
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  const loadData = useCallback(async (
    requestedPage = page,
    query = appliedSearch,
    status = statusFilter
  ) => {
    setError('');
    try {
      const [locationPage, cityOptions] = await Promise.all([
        fetchManagedLocations({
          page: requestedPage,
          pageSize: 50,
          ...(query ? { q: query } : {}),
          ...(status ? { status } : {}),
        }),
        fetchManagedLocationCities(),
      ]);
      const routeOptions = await fetchManagedRoutes();
      setLocations(locationPage.items);
      setTotal(locationPage.total);
      setCities(cityOptions);
      setRoutes(routeOptions);
    } catch (requestError) {
      setError(getRequestError(requestError, 'Could not load locations.'));
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, page, statusFilter]);

  useEffect(() => {
    let active = true;
    if (!form.state) {
      setDistricts([]);
      return undefined;
    }
    fetchLocationDistricts(form.state)
      .then((values) => {
        if (active) setDistricts(values);
      })
      .catch((requestError) => {
        if (active) setError(getRequestError(requestError, 'Could not load districts.'));
      });
    return () => {
      active = false;
    };
  }, [form.state]);

  useEffect(() => {
    let active = true;
    if (!selectedRoute?.routeId) {
      setRouteLocations([]);
      setSearchingRouteLocations(false);
      return undefined;
    }
    const timeout = setTimeout(() => {
      setSearchingRouteLocations(true);
      fetchManagedLocations({
        page: 1,
        pageSize: 100,
        q: routeLocationSearch.trim(),
        status: 'ACTIVE',
      })
        .then(({ items }) => {
          if (active) setRouteLocations(items);
        })
        .catch((requestError) => {
          if (active) setError(getRequestError(requestError, 'Could not search available locations.'));
        })
        .finally(() => {
          if (active) setSearchingRouteLocations(false);
        });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timeout);
    };
  }, [routeLocationSearch, selectedRoute?.routeId]);

  useEffect(() => {
    setActivePanel(route?.params?.panel === 'routes' ? 'routes' : 'locations');
  }, [route?.params?.panel]);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    loadData();
  }, [loadData]));

  const updateField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setMessage('');
  };

  const editLocation = (location) => {
    setEditingId(location.locationId);
    setForm({
      cityId: location.cityId,
      locationName: location.locationName,
      shortCode: location.shortCode || '',
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      district: location.district,
      state: location.state,
      pincode: location.pincode,
      status: location.status,
    });
    setMessage('');
  };

  const saveLocation = async () => {
    setError('');
    setMessage('');
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!form.cityId || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      setError('Choose a route city and enter valid latitude and longitude coordinates.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        latitude,
        longitude,
        shortCode: form.shortCode.trim() || null,
      };
      if (editingId) {
        await updateManagedLocation(editingId, payload);
      } else {
        await createManagedLocation(payload);
      }
      resetForm();
      setMessage(editingId ? 'Location updated.' : 'Location added.');
      setPage(1);
      await loadData(1);
    } catch (requestError) {
      setError(getRequestError(requestError, 'Could not save this location.'));
    } finally {
      setSaving(false);
    }
  };

  const deactivateLocation = (location) => {
    Alert.alert(
      'Deactivate location?',
      `${location.locationName} will no longer appear in active location searches.`,
      [
        { text: 'Keep active', style: 'cancel' },
        {
          text: 'Deactivate',
          style: 'destructive',
          onPress: async () => {
            setError('');
            setMessage('');
            try {
              await deactivateManagedLocation(location.locationId);
              setMessage('Location deactivated.');
              await loadData(1);
            } catch (requestError) {
              setError(getRequestError(requestError, 'Could not deactivate this location.'));
            }
          },
        },
      ]
    );
  };

  const lookupLocation = async () => {
    const address = [form.locationName, form.district, form.state, 'India']
      .filter(Boolean)
      .join(', ');
    if (!form.locationName.trim() || !form.state) {
      setError('Choose a route city and enter a location name before geocoding.');
      return;
    }
    setError('');
    setGeocoding(true);
    try {
      const result = await geocodeLocationApi(address);
      if (result.state && result.state.trim().toLocaleLowerCase() !== form.state.trim().toLocaleLowerCase()) {
        setError(`The geocoded address is in ${result.state}, but the selected city is in ${form.state}.`);
        return;
      }
      setForm((current) => ({
        ...current,
        latitude: String(result.latitude),
        longitude: String(result.longitude),
        pincode: result.pincode || current.pincode,
        district: result.district || current.district,
      }));
      setMessage('Location details loaded from OpenStreetMap. Review the pin and correct any fields before saving.');
    } catch (requestError) {
      setError(getRequestError(requestError, 'Could not look up this location.'));
    } finally {
      setGeocoding(false);
    }
  };

  const selectManagedRoute = async (route) => {
    setSelectedRoute(route);
    setEditingStopId(null);
    setRouteLocationId(null);
    setRouteLocationSearch('');
    setRouteLocations([]);
    setRouteStopType('STOP');
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const details = await fetchManagedRouteWaypoints(route.routeId);
      setSelectedRoute(details);
      setWaypoints(details.waypoints);
    } catch (requestError) {
      setError(getRequestError(requestError, 'Could not load route stops.'));
      setWaypoints([]);
    } finally {
      setLoading(false);
    }
  };

  const saveRoute = async () => {
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const response = await createManagedRoute(routeForm);
      const newRoute = response.data;
      setRouteForm(emptyRouteForm);
      setRouteFormVisible(false);
      setRouteSearchQuery('');
      setRouteStatusFilter('ALL');
      setPage(1);
      await loadData(1);
      await selectManagedRoute(newRoute);
      setActivePanel('routes');
      setMessage('Route added successfully.');
    } catch (requestError) {
      setError(getRequestError(requestError, 'Could not create this route.'));
    } finally {
      setSaving(false);
    }
  };

  const saveRouteWaypoint = async () => {
    if (!selectedRoute || !routeLocationId) {
      setError('Select a location to add to the route.');
      return;
    }
    setError('');
    setMessage('');
    setSaving(true);
    try {
      const payload = {
        locationId: routeLocationId,
        stopType: routeStopType,
        expectedHaltMinutes: Number(routeHaltMinutes || 0),
      };
      if (editingStopId) {
        await updateManagedRouteWaypoint(selectedRoute.routeId, editingStopId, payload);
      } else {
        await addManagedRouteWaypoint(selectedRoute.routeId, payload);
      }
      const details = await fetchManagedRouteWaypoints(selectedRoute.routeId);
      setSelectedRoute(details);
      setWaypoints(details.waypoints);
      setRouteLocationId(null);
      setEditingStopId(null);
      setRouteStopType('STOP');
      setMessage(editingStopId
        ? 'Route stop updated.'
        : selectedRoute.hasSchedules
          ? 'Stop staged. Review the route order and submit to update the existing route and its scheduled services.'
          : 'Location assigned to the route.');
    } catch (requestError) {
      setError(getRequestError(requestError, 'Could not save this route stop.'));
    } finally {
      setSaving(false);
    }
  };

  const editRouteWaypoint = (waypoint) => {
    setEditingStopId(waypoint.stopId);
    setRouteLocationId(waypoint.locationId);
    setRouteStopType(waypoint.stopType);
    setRouteHaltMinutes(String(waypoint.expectedHaltMinutes || 0));
  };

  const removeRouteWaypoint = (waypoint) => {
    Alert.alert('Remove route stop?', `Remove ${waypoint.locationName} from this route?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: async () => {
          setError('');
          try {
            await deleteManagedRouteWaypoint(selectedRoute.routeId, waypoint.stopId);
            const details = await fetchManagedRouteWaypoints(selectedRoute.routeId);
            setSelectedRoute(details);
            setWaypoints(details.waypoints);
            setMessage(selectedRoute.hasSchedules
              ? 'Draft stop removed. Submit the route changes to publish the updated path.'
              : 'Route stop removed and sequence updated.');
          } catch (requestError) {
            setError(getRequestError(requestError, 'Could not remove this route stop.'));
          }
        },
      },
    ]);
  };

  const moveWaypoint = async (index, offset) => {
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= waypoints.length) return;
    const reordered = [...waypoints];
    [reordered[index], reordered[nextIndex]] = [reordered[nextIndex], reordered[index]];
    try {
      await reorderManagedRouteWaypoints(selectedRoute.routeId, reordered.map((stop) => stop.stopId));
      const details = await fetchManagedRouteWaypoints(selectedRoute.routeId);
      setSelectedRoute(details);
      setWaypoints(details.waypoints);
      if (selectedRoute.hasSchedules) {
        setMessage('Stop order staged. Submit the route changes to update scheduled services.');
      }
      setError('');
    } catch (requestError) {
      setError(getRequestError(requestError, 'Could not reorder route stops.'));
    }
  };

  const submitRouteChanges = () => {
    Alert.alert(
      'Submit route changes?',
      'This will update the existing route and refresh stop timings for its scheduled services.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Submit',
          onPress: async () => {
            setError('');
            setMessage('');
            setSaving(true);
            try {
              await submitManagedRouteChanges(selectedRoute.routeId);
              const details = await fetchManagedRouteWaypoints(selectedRoute.routeId);
              setSelectedRoute(details);
              setWaypoints(details.waypoints);
              await loadData();
              setMessage('Route changes submitted. The existing route and scheduled services are updated.');
            } catch (requestError) {
              setError(getRequestError(requestError, 'Could not submit route changes.'));
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const selectedCity = cities.find((city) => city.cityId === form.cityId);
  const normalizedRouteSearch = routeSearchQuery.trim().toLowerCase();
  const filteredRoutes = routes.filter((route) => {
    const matchesStatus = routeStatusFilter === 'ALL' ||
      (route.isActive ? 'ACTIVE' : 'INACTIVE') === routeStatusFilter;
    const searchableText = [
      route.routeCode,
      route.routeName,
      route.routeCategory,
      route.origin,
      route.destination,
    ].filter(Boolean).join(' ').toLowerCase();
    return matchesStatus && (!normalizedRouteSearch || searchableText.includes(normalizedRouteSearch));
  });
  const selectedRouteLocation = routeLocations.find((location) => location.locationId === routeLocationId);
  const availableRouteLocations = routeLocations.filter((location) => {
    if (waypoints.some((waypoint) =>
      waypoint.locationId === location.locationId && waypoint.stopId !== editingStopId
    )) return false;
    const query = routeLocationSearch.trim().toLowerCase();
    return !query || `${location.locationName} ${location.cityName} ${location.district}`
      .toLowerCase().includes(query);
  });
  const hasScheduledRouteEndpoints = waypoints[0]?.stopType === 'SOURCE' &&
    waypoints[waypoints.length - 1]?.stopType === 'DESTINATION';
  const pageCount = Math.max(1, Math.ceil(total / 50));

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <IconButton
            icon="arrow-left"
            mode="contained-tonal"
            onPress={() => navigation.goBack()}
            accessibilityLabel="Back"
          />
          <View style={styles.heading}>
            <Text variant="labelLarge" style={styles.eyebrow}>SYSTEM ADMIN</Text>
            <Text variant="headlineSmall" style={styles.title}>
              {activePanel === 'routes' ? 'Manage route stops' : 'Manage locations'}
            </Text>
          </View>
          <IconButton
            icon="refresh"
            onPress={loadData}
            disabled={loading || saving}
            accessibilityLabel={activePanel === 'routes' ? 'Refresh route stops' : 'Refresh locations'}
          />
        </View>

        <Text variant="bodyMedium" style={styles.subtitle}>
          {activePanel === 'routes'
            ? 'Configure and reorder stops for bus routes.'
            : 'Manage the location directory used by bus routes.'}
        </Text>

        {error ? (
          <Card style={styles.errorCard}>
            <Card.Content><Text style={styles.errorText}>{error}</Text></Card.Content>
          </Card>
        ) : null}
        {message ? (
          <Card style={styles.messageCard}>
            <Card.Content><Text style={styles.messageText}>{message}</Text></Card.Content>
          </Card>
        ) : null}

        {activePanel === 'locations' ? (
        <>
        <Card style={styles.formCard}>
          <Card.Content>
            <Text variant="titleMedium" style={styles.formTitle}>
              {editingId ? 'Edit location' : 'Add location'}
            </Text>
            <Menu
              visible={cityMenuVisible}
              onDismiss={() => setCityMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  icon="chevron-down"
                  onPress={() => setCityMenuVisible(true)}
                  style={styles.cityButton}
                  contentStyle={styles.inputContent}
                >
                  {selectedCity
                    ? `${selectedCity.cityName}, ${selectedCity.state}`
                    : 'Select route city'}
                </Button>
              }
            >
              {cities.map((city) => (
                <Menu.Item
                  key={city.cityId}
                  title={`${city.cityName}, ${city.state}`}
                  onPress={() => {
                    setForm((current) => ({
                      ...current,
                      cityId: city.cityId,
                      state: city.state,
                      district: '',
                    }));
                    setCityMenuVisible(false);
                  }}
                />
              ))}
            </Menu>
            {!cities.length ? (
              <HelperText type="info">There are no active route cities to assign.</HelperText>
            ) : null}
            <TextInput
              label="Location / terminal name"
              value={form.locationName}
              onChangeText={(value) => updateField('locationName', value)}
              mode="outlined"
              style={styles.input}
            />
            <TextInput
              label="Short code (optional)"
              value={form.shortCode}
              onChangeText={(value) => updateField('shortCode', value)}
              mode="outlined"
              style={styles.input}
            />
            <View style={styles.coordinateRow}>
              <TextInput
                label="Latitude"
                value={form.latitude}
                onChangeText={(value) => updateField('latitude', value)}
                keyboardType="decimal-pad"
                mode="outlined"
                style={[styles.input, styles.coordinateInput]}
              />
              <TextInput
                label="Longitude"
                value={form.longitude}
                onChangeText={(value) => updateField('longitude', value)}
                keyboardType="decimal-pad"
                mode="outlined"
                style={[styles.input, styles.coordinateInput]}
              />
            </View>
            <Menu
              visible={districtMenuVisible}
              onDismiss={() => setDistrictMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  icon="chevron-down"
                  onPress={() => setDistrictMenuVisible(true)}
                  style={styles.cityButton}
                  contentStyle={styles.inputContent}
                  disabled={!form.state}
                >
                  {form.district || 'Select district'}
                </Button>
              }
            >
              {districts.map((district) => (
                <Menu.Item
                  key={district}
                  title={district}
                  onPress={() => {
                    updateField('district', district);
                    setDistrictMenuVisible(false);
                  }}
                />
              ))}
            </Menu>
            <TextInput
              label="District (or enter a new district)"
              value={form.district}
              onChangeText={(value) => updateField('district', value)}
              mode="outlined"
              style={styles.input}
            />
            <View style={styles.coordinateRow}>
              <TextInput
                label="State (from route city)"
                value={selectedCity?.state || form.state}
                editable={false}
                mode="outlined"
                style={[styles.input, styles.coordinateInput]}
              />
              <TextInput
                label="PIN code"
                value={form.pincode}
                onChangeText={(value) => updateField('pincode', value)}
                keyboardType="number-pad"
                mode="outlined"
                style={[styles.input, styles.coordinateInput]}
              />
            </View>
            <View style={styles.formActions}>
              <Button
                mode="outlined"
                icon="map-search-outline"
                onPress={lookupLocation}
                loading={geocoding}
                disabled={geocoding || !form.state || !form.locationName.trim()}
              >
                Look up with OpenStreetMap
              </Button>
              {form.latitude.trim() && form.longitude.trim() &&
                Number.isFinite(Number(form.latitude)) && Number.isFinite(Number(form.longitude)) ? (
                <Button
                  mode="text"
                  icon="map-marker-outline"
                  onPress={() => {
                    const url = `https://www.openstreetmap.org/?mlat=${form.latitude}&mlon=${form.longitude}#map=16/${form.latitude}/${form.longitude}`;
                    Linking.openURL(url).catch((requestError) => {
                      setError(getRequestError(requestError, 'Could not open the map.'));
                    });
                  }}
                >
                  Preview map
                </Button>
              ) : null}
            </View>
            <HelperText type="info">
              Coordinates, district, and PIN code remain editable after lookup. Review the external map preview before saving.
            </HelperText>
            <View style={styles.statusRow}>
              <Text variant="bodyMedium">Active in location search</Text>
              <Switch
                value={form.status === 'ACTIVE'}
                onValueChange={(active) => updateField('status', active ? 'ACTIVE' : 'INACTIVE')}
              />
            </View>
            <View style={styles.formActions}>
              {editingId ? (
                <Button mode="outlined" onPress={resetForm} disabled={saving}>Cancel</Button>
              ) : null}
              <Button
                mode="contained"
                onPress={saveLocation}
                loading={saving}
                disabled={saving || loading || cities.length === 0}
              >
                {editingId ? 'Save changes' : 'Add location'}
              </Button>
            </View>
          </Card.Content>
        </Card>

        <Text variant="titleLarge" style={styles.listTitle}>Location directory</Text>
        <View style={styles.searchRow}>
          <TextInput
            label="Search name, district, or PIN code"
            value={searchQuery}
            onChangeText={setSearchQuery}
            mode="outlined"
            style={styles.searchInput}
            onSubmitEditing={() => {
              const query = searchQuery.trim();
              setAppliedSearch(query);
              setPage(1);
              loadData(1, query, statusFilter);
            }}
          />
          <Button
            mode="contained"
            onPress={() => {
              const query = searchQuery.trim();
              setAppliedSearch(query);
              setPage(1);
              loadData(1, query, statusFilter);
            }}
          >
            Search
          </Button>
        </View>
        <SegmentedButtons
          value={statusFilter}
          onValueChange={(value) => {
            setStatusFilter(value);
            setPage(1);
            loadData(1, appliedSearch, value);
          }}
          buttons={[
            { value: '', label: 'All' },
            { value: 'ACTIVE', label: 'Active' },
            { value: 'INACTIVE', label: 'Inactive' },
          ]}
          style={styles.statusFilter}
        />
        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color="#6750A4" />
            <Text variant="bodyMedium" style={styles.subtitle}>Loading locations…</Text>
          </View>
        ) : locations.length ? locations.map((location) => (
          <Card key={location.locationId} style={styles.locationCard}>
            <Card.Content>
              <View style={styles.locationHeader}>
                <View style={styles.locationCopy}>
                  <Text variant="titleMedium" style={styles.locationName}>{location.locationName}</Text>
                  <Text variant="bodySmall" style={styles.locationDetail}>
                    {location.cityName} · {location.district}, {location.state} · {location.pincode}
                  </Text>
                  <Text variant="bodySmall" style={styles.locationDetail}>
                    {Number(location.latitude).toFixed(6)}, {Number(location.longitude).toFixed(6)}
                    {location.shortCode ? ` · ${location.shortCode}` : ''}
                  </Text>
                  <Text variant="labelSmall" style={location.status === 'ACTIVE' ? styles.active : styles.inactive}>
                    {location.status}
                  </Text>
                </View>
                <View>
                  <IconButton
                    icon="pencil-outline"
                    onPress={() => editLocation(location)}
                    accessibilityLabel={`Edit ${location.locationName}`}
                  />
                  {location.status === 'ACTIVE' ? (
                    <IconButton
                      icon="delete-outline"
                      onPress={() => deactivateLocation(location)}
                      accessibilityLabel={`Deactivate ${location.locationName}`}
                    />
                  ) : null}
                </View>
              </View>
            </Card.Content>
          </Card>
        )) : (
          <Card style={styles.locationCard}>
            <Card.Content><Text style={styles.subtitle}>No location records yet. Add the first one above.</Text></Card.Content>
          </Card>
        )}
        {!loading && total > 0 ? (
          <View style={styles.pagination}>
            <Button
              mode="outlined"
              disabled={page <= 1}
              onPress={() => {
                const nextPage = page - 1;
                setPage(nextPage);
                loadData(nextPage);
              }}
            >
              Previous
            </Button>
            <Text variant="bodySmall" style={styles.pageLabel}>
              Page {page} of {pageCount} · {total} location{total === 1 ? '' : 's'}
            </Text>
            <Button
              mode="outlined"
              disabled={page >= pageCount}
              onPress={() => {
                const nextPage = page + 1;
                setPage(nextPage);
                loadData(nextPage);
              }}
            >
              Next
            </Button>
          </View>
        ) : null}
        </>
        ) : (
        <>
          <View style={styles.routeToolbar}>
            <Text variant="titleLarge" style={styles.listTitle}>Route directory</Text>
            <Button
              mode="contained"
              icon="plus"
              onPress={() => {
                setError('');
                setMessage('');
                setRouteForm(emptyRouteForm);
                setRouteFormVisible(true);
              }}
              disabled={loading || saving}
            >
              Add new route
            </Button>
          </View>

          {routeFormVisible ? (
            <Card style={styles.formCard}>
              <Card.Content>
                <Text variant="titleMedium" style={styles.formTitle}>Create a bus route</Text>
                <TextInput
                  label="Route code"
                  value={routeForm.routeCode}
                  onChangeText={(routeCode) => setRouteForm((current) => ({ ...current, routeCode }))}
                  mode="outlined"
                  style={styles.input}
                  autoCapitalize="characters"
                />
                <TextInput
                  label="Route name"
                  value={routeForm.routeName}
                  onChangeText={(routeName) => setRouteForm((current) => ({ ...current, routeName }))}
                  mode="outlined"
                  style={styles.input}
                />
                <TextInput
                  label="Category"
                  value={routeForm.routeCategory}
                  onChangeText={(routeCategory) => setRouteForm((current) => ({ ...current, routeCategory }))}
                  mode="outlined"
                  style={styles.input}
                />
                {['originCityId', 'destinationCityId'].map((field) => {
                  const selected = cities.find((city) => city.cityId === routeForm[field]);
                  const label = field === 'originCityId' ? 'Origin city' : 'Destination city';
                  return (
                    <Menu
                      key={field}
                      visible={routeCityMenuTarget === field}
                      onDismiss={() => setRouteCityMenuTarget(null)}
                      anchor={
                        <Button
                          mode="outlined"
                          icon="chevron-down"
                          onPress={() => setRouteCityMenuTarget(field)}
                          style={styles.cityButton}
                          contentStyle={styles.inputContent}
                        >
                          {selected?.cityName || `Select ${label.toLowerCase()}`}
                        </Button>
                      }
                    >
                      {cities.map((city) => (
                        <Menu.Item
                          key={city.cityId}
                          title={city.cityName}
                          onPress={() => {
                            setRouteForm((current) => ({ ...current, [field]: city.cityId }));
                            setRouteCityMenuTarget(null);
                          }}
                        />
                      ))}
                    </Menu>
                  );
                })}
                <View style={styles.formActions}>
                  <Button
                    mode="outlined"
                    onPress={() => {
                      setRouteForm(emptyRouteForm);
                      setRouteFormVisible(false);
                    }}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                  <Button
                    mode="contained"
                    onPress={saveRoute}
                    loading={saving}
                    disabled={saving || loading || !routeForm.routeCode.trim() || !routeForm.routeName.trim() ||
                      !routeForm.originCityId || !routeForm.destinationCityId ||
                      routeForm.originCityId === routeForm.destinationCityId}
                  >
                    Create route
                  </Button>
                </View>
              </Card.Content>
            </Card>
          ) : null}

          <Card style={styles.filterCard}>
            <Card.Content>
              <TextInput
                label="Filter routes"
                value={routeSearchQuery}
                onChangeText={setRouteSearchQuery}
                mode="outlined"
                style={styles.input}
              />
              <SegmentedButtons
                value={routeStatusFilter}
                onValueChange={setRouteStatusFilter}
                buttons={[
                  { value: 'ALL', label: 'All' },
                  { value: 'ACTIVE', label: 'Active' },
                  { value: 'INACTIVE', label: 'Inactive' },
                ]}
                style={styles.statusFilter}
              />
            </Card.Content>
          </Card>

          {loading ? (
            <ActivityIndicator size="large" color="#6750A4" style={styles.loader} />
          ) : filteredRoutes.length === 0 ? (
            <Card style={styles.locationCard}>
              <Card.Content>
                <Text style={styles.subtitle}>
                  {routes.length ? 'No routes match the current filters.' : 'No routes have been created yet.'}
                </Text>
              </Card.Content>
            </Card>
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator>
              <View style={styles.routeTable}>
                <View style={[styles.routeTableRow, styles.routeTableHeader]}>
                  <Text variant="labelMedium" style={[styles.routeTableCell, styles.routeCodeColumn]}>Code</Text>
                  <Text variant="labelMedium" style={[styles.routeTableCell, styles.routeNameColumn]}>Route name</Text>
                  <Text variant="labelMedium" style={[styles.routeTableCell, styles.routeCategoryColumn]}>Category</Text>
                  <Text variant="labelMedium" style={[styles.routeTableCell, styles.routeCityColumn]}>Origin</Text>
                  <Text variant="labelMedium" style={[styles.routeTableCell, styles.routeCityColumn]}>Destination</Text>
                  <Text variant="labelMedium" style={[styles.routeTableCell, styles.routeStatusColumn]}>Status</Text>
                  <Text variant="labelMedium" style={[styles.routeTableCell, styles.routeActionColumn]}>Actions</Text>
                </View>
                {filteredRoutes.map((route) => (
                  <View key={route.routeId} style={styles.routeTableRow}>
                    <Text variant="bodySmall" style={[styles.routeTableCell, styles.routeCodeColumn, styles.routeTableText]}>
                      {route.routeCode}
                    </Text>
                    <Text variant="bodySmall" style={[styles.routeTableCell, styles.routeNameColumn, styles.routeTableText]}>
                      {route.routeName}
                    </Text>
                    <Text variant="bodySmall" style={[styles.routeTableCell, styles.routeCategoryColumn, styles.routeTableText]}>
                      {route.routeCategory}
                    </Text>
                    <Text variant="bodySmall" style={[styles.routeTableCell, styles.routeCityColumn, styles.routeTableText]}>
                      {route.origin}
                    </Text>
                    <Text variant="bodySmall" style={[styles.routeTableCell, styles.routeCityColumn, styles.routeTableText]}>
                      {route.destination}
                    </Text>
                    <View style={[styles.routeTableCell, styles.routeStatusColumn]}>
                      <Text variant="labelSmall" style={route.isActive ? styles.active : styles.inactive}>
                        {route.isActive ? 'Active' : 'Inactive'}
                      </Text>
                    </View>
                    <View style={[styles.routeTableCell, styles.routeActionColumn]}>
                      <Button
                        mode="outlined"
                        compact
                        onPress={() => selectManagedRoute(route)}
                        disabled={loading || saving}
                      >
                        Manage stops
                      </Button>
                    </View>
                  </View>
                ))}
              </View>
            </ScrollView>
          )}

          {selectedRoute ? (
            <>
              <Card style={styles.formCard}>
                <Card.Content>
                  <Text variant="titleMedium" style={styles.formTitle}>
                    {selectedRoute.routeCode} · {selectedRoute.origin} to {selectedRoute.destination}
                  </Text>
                  <Text variant="bodySmall" style={styles.locationDetail}>
                    {selectedRoute.routeCategory} · {Number(selectedRoute.distanceKm || 0).toFixed(2)} km ·
                    {' '}{selectedRoute.durationMinutes || 0} min
                  </Text>
                  <Text variant="labelSmall" style={selectedRoute.isActive ? styles.active : styles.inactive}>
                    {selectedRoute.hasDraft
                      ? 'PENDING REVIEW · NOT LIVE'
                      : selectedRoute.isActive ? 'ACTIVE PATH' : 'DRAFT · ADD ONE SOURCE AND ONE DESTINATION'}
                  </Text>
                  {selectedRoute.hasSchedules ? (
                    <HelperText type="info">
                      {selectedRoute.hasDraft
                        ? 'These changes are staged and are not visible to passengers until submitted. Review the stop order below before submitting.'
                        : hasScheduledRouteEndpoints
                          ? 'Add or reorder stops in the pending review path. The current route and its services remain unchanged until you submit.'
                          : 'This scheduled route is a draft. Add its missing source, intermediate stops, and destination, then submit the reviewed path.'}
                    </HelperText>
                  ) : null}
                  <TextInput
                    label="Filter available locations"
                    value={routeLocationSearch}
                    onChangeText={(query) => {
                      setRouteLocationSearch(query);
                      setRouteLocationId(null);
                      setRouteLocations([]);
                      setSearchingRouteLocations(true);
                    }}
                    mode="outlined"
                    style={styles.input}
                  />
                  <Menu
                    visible={locationMenuVisible}
                    onDismiss={() => setLocationMenuVisible(false)}
                    anchor={
                      <Button
                        mode="outlined"
                        icon="chevron-down"
                        onPress={() => setLocationMenuVisible(true)}
                        style={styles.cityButton}
                        contentStyle={styles.inputContent}
                      >
                        {selectedRouteLocation?.locationName || 'Select a location'}
                      </Button>
                    }
                  >
                    {availableRouteLocations.map((location) => (
                        <Menu.Item
                          key={location.locationId}
                          title={`${location.locationName} · ${location.cityName}`}
                          onPress={() => {
                            setRouteLocationId(location.locationId);
                            setLocationMenuVisible(false);
                          }}
                        />
                    ))}
                  </Menu>
                  {searchingRouteLocations ? (
                    <HelperText type="info">Searching active locations…</HelperText>
                  ) : routeLocationSearch.trim() && !availableRouteLocations.length ? (
                    <HelperText type="info">No available active locations match this search.</HelperText>
                  ) : null}
                  <SegmentedButtons
                    value={routeStopType}
                    onValueChange={setRouteStopType}
                    buttons={selectedRoute.hasSchedules
                      ? [
                        ...(!waypoints.some((waypoint) => waypoint.stopType === 'SOURCE')
                          ? [{ value: 'SOURCE', label: 'Source' }]
                          : []),
                        { value: 'STOP', label: 'Stop' },
                        ...(!waypoints.some((waypoint) => waypoint.stopType === 'DESTINATION')
                          ? [{ value: 'DESTINATION', label: 'Destination' }]
                          : []),
                      ]
                      : [
                        { value: 'SOURCE', label: 'Source' },
                        { value: 'STOP', label: 'Stop' },
                        { value: 'DESTINATION', label: 'Destination' },
                      ]}
                    style={styles.statusFilter}
                  />
                  <TextInput
                    label="Expected halt (minutes)"
                    value={routeHaltMinutes}
                    onChangeText={setRouteHaltMinutes}
                    keyboardType="number-pad"
                    mode="outlined"
                    style={styles.input}
                  />
                  <View style={styles.formActions}>
                    {editingStopId ? (
                      <Button
                        mode="outlined"
                        onPress={() => {
                          setEditingStopId(null);
                          setRouteLocationId(null);
                        }}
                      >
                        Cancel edit
                      </Button>
                    ) : null}
                    <Button
                      mode="contained"
                      icon={editingStopId ? 'content-save-outline' : 'plus'}
                      onPress={saveRouteWaypoint}
                      loading={saving}
                      disabled={saving || !routeLocationId ||
                        !/^\d+$/.test(routeHaltMinutes)}
                    >
                      {editingStopId ? 'Save stop' : 'Assign location'}
                    </Button>
                  </View>
                  <HelperText type="info">
                    A complete path needs one source first and one destination last. Use the arrows below to change stop order.
                  </HelperText>
                </Card.Content>
              </Card>

              <Text variant="titleLarge" style={styles.listTitle}>Current route path</Text>
              {!waypoints.length ? (
                <Card style={styles.locationCard}>
                  <Card.Content><Text style={styles.subtitle}>This route has no stops yet.</Text></Card.Content>
                </Card>
              ) : waypoints.map((waypoint, index) => (
                <Card key={waypoint.stopId} style={styles.locationCard}>
                  <Card.Content>
                    <View style={styles.locationHeader}>
                      <View style={styles.locationCopy}>
                        <Text variant="labelLarge" style={styles.eyebrow}>
                          {waypoint.sequence}. {waypoint.stopType}
                        </Text>
                        <Text variant="titleMedium" style={styles.locationName}>{waypoint.locationName}</Text>
                        <Text variant="bodySmall" style={styles.locationDetail}>
                          {waypoint.cityName} · {waypoint.district || 'District not set'} ·
                          {' '}{Number(waypoint.distanceFromSourceKm || 0).toFixed(2)} km
                        </Text>
                        <Text variant="bodySmall" style={styles.locationDetail}>
                          Expected halt: {waypoint.expectedHaltMinutes || 0} min
                        </Text>
                      </View>
                      <View style={styles.waypointActions}>
                        <IconButton
                          icon="arrow-up"
                          onPress={() => moveWaypoint(index, -1)}
                          disabled={index === 0 ||
                            waypoint.stopType === 'SOURCE' || waypoints[index - 1]?.stopType === 'DESTINATION'}
                          accessibilityLabel={`Move ${waypoint.locationName} up`}
                        />
                        <IconButton
                          icon="arrow-down"
                          onPress={() => moveWaypoint(index, 1)}
                          disabled={index === waypoints.length - 1 ||
                            waypoint.stopType === 'DESTINATION' || waypoints[index + 1]?.stopType === 'SOURCE'}
                          accessibilityLabel={`Move ${waypoint.locationName} down`}
                        />
                        <IconButton
                          icon="pencil-outline"
                          onPress={() => editRouteWaypoint(waypoint)}
                          disabled={selectedRoute.hasSchedules}
                          accessibilityLabel={`Edit ${waypoint.locationName}`}
                        />
                        <IconButton
                          icon="delete-outline"
                          onPress={() => removeRouteWaypoint(waypoint)}
                          disabled={selectedRoute.hasSchedules && !waypoint.isDraftNew}
                          accessibilityLabel={`Remove ${waypoint.locationName}`}
                        />
                      </View>
                    </View>
                  </Card.Content>
                </Card>
              ))}
              {selectedRoute.hasSchedules && selectedRoute.hasDraft ? (
                <Button
                  mode="contained"
                  icon="check-circle-outline"
                  onPress={submitRouteChanges}
                  loading={saving}
                  disabled={saving}
                  style={styles.submitRouteButton}
                >
                  Submit reviewed route changes
                </Button>
              ) : null}
            </>
          ) : null}
        </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F3F4F8' },
  content: { padding: 18, paddingBottom: 36 },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  heading: { flex: 1 },
  eyebrow: { color: '#6750A4', letterSpacing: 1 },
  title: { color: '#1D1B20', fontWeight: '700' },
  subtitle: { color: '#625B71', marginBottom: 16 },
  panelSelector: { marginBottom: 16 },
  formCard: { borderRadius: 18, backgroundColor: '#FFFBFE', marginBottom: 24 },
  filterCard: { borderRadius: 18, backgroundColor: '#FFFBFE', marginBottom: 12 },
  routeToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 10,
  },
  submitRouteButton: { marginBottom: 16 },
  formTitle: { fontWeight: '700', marginBottom: 12 },
  cityButton: { marginBottom: 10, borderRadius: 12 },
  input: { marginBottom: 10, backgroundColor: '#FFFBFE' },
  inputContent: { minHeight: 48 },
  coordinateRow: { flexDirection: 'row', gap: 10 },
  coordinateInput: { flex: 1 },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 4 },
  formActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  listTitle: { color: '#1D1B20', fontWeight: '700', marginBottom: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  searchInput: { flex: 1, backgroundColor: '#FFFBFE' },
  statusFilter: { marginBottom: 12 },
  loader: { marginVertical: 24 },
  routeTable: {
    backgroundColor: '#FFFBFE',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E7E0EC',
  },
  routeTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#E7E0EC',
  },
  routeTableHeader: { backgroundColor: '#F3F4F8', borderBottomWidth: 2 },
  routeTableCell: { paddingHorizontal: 10, paddingVertical: 10, justifyContent: 'center' },
  routeTableText: { color: '#49454F' },
  routeCodeColumn: { width: 110 },
  routeNameColumn: { width: 170 },
  routeCategoryColumn: { width: 125 },
  routeCityColumn: { width: 150 },
  routeStatusColumn: { width: 100, alignItems: 'center' },
  routeActionColumn: { width: 150, alignItems: 'center' },
  pagination: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  pageLabel: { color: '#625B71', textAlign: 'center' },
  locationCard: { borderRadius: 16, backgroundColor: '#FFFBFE', marginBottom: 12 },
  locationHeader: { flexDirection: 'row', alignItems: 'center' },
  waypointActions: { alignItems: 'center' },
  locationCopy: { flex: 1 },
  locationName: { color: '#1D1B20', fontWeight: '700' },
  locationDetail: { color: '#625B71', marginTop: 3 },
  active: { color: '#2E7D32', marginTop: 6 },
  inactive: { color: '#B3261E', marginTop: 6 },
  errorCard: { backgroundColor: '#FCE8E6', marginBottom: 12 },
  errorText: { color: '#B3261E' },
  messageCard: { backgroundColor: '#E8F5E9', marginBottom: 12 },
  messageText: { color: '#2E7D32' },
  loading: { alignItems: 'center', paddingVertical: 28 },
});
